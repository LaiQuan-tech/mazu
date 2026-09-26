-- 財務憑證管理（支出／收入）
-- 2026-09-27。設計說明見 docs/finance-voucher-plan.md。
--
-- 三個貫穿整份 schema 的決定：
--
-- 1. **金額只存一個整數，不拆格子。** 廟方的紙本傳票把金額拆成「佰萬／拾萬／萬／
--    仟／佰／拾／元」，那是紙本防竄改的作法。存成七個欄位就是七個可以各自寫錯、
--    而且無法交叉驗證的地方。資料存 `amount integer`，要印成傳票時再由程式排進格子。
--
-- 2. **合計金額不存。** 紙本上的合計是人加的；存進資料庫之後一旦與明細加總不一致，
--    沒有任何方法知道該信哪個。一律由 voucher_items 即時加總。
--    （同一個原則已經用在：捐款類別存文字不存 id、生肖由生日推算不開放手選。）
--
-- 3. **收入憑證引用既有紀錄，不重新輸入金額。** 報名紀錄是「業務事實」（誰、報了
--    什麼、應付多少），憑證是「財務事實」（這筆錢何時、用什麼方式、由誰經手）。
--    同一筆錢只有一個金額來源，憑證靠 source_table + source_id 指過去。
--    本站的收入目前有三套不一致的作法（應收管理是唯讀報表、法會對帳欄位只綁法會、
--    捐獻連「收到了沒」都沒有），再做一套「自己輸入金額」的就是第四套也是最糟的一套。

-- ── 權限：財務組與管理組 ────────────────────────────────────────────────
-- 財務資料比全站任何一張表都敏感，**完全不開放 anon**。
-- 注意 REVOKE 要同時收 PUBLIC 與 anon：Postgres 預設 GRANT TO PUBLIC，
-- Supabase 的 default privileges 又另外 GRANT 給 anon，只收其中一個沒用
-- （2026-09-12 get_my_shared_history 踩過這個坑）。
CREATE OR REPLACE FUNCTION public.has_finance_access() RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.admin_profiles
  WHERE user_id = auth.uid() AND role IN ('admin', 'finance')
); $$;

REVOKE EXECUTE ON FUNCTION public.has_finance_access() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_finance_access() TO authenticated;

-- ── 會計科目 ────────────────────────────────────────────────────────────
-- 照 donation_types 的模式：後台可增刪改，不要讓憑證的科目是自由文字。
-- 自由文字的科目永遠對不齊（「水電」「水電費」「水電瓦斯」會變三個科目），報表就做不出來。
CREATE TABLE IF NOT EXISTS public.accounting_accounts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  direction  text NOT NULL CHECK (direction IN ('expense', 'income', 'both')) DEFAULT 'both',
  sort_order int  NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 憑證單頭 ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vouchers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction    text NOT NULL CHECK (direction IN ('expense', 'income')),
  -- 單號：系統會建議（如 E20260927-01）但可改。既有的「感謝狀編號」就是財務自己填的，
  -- 看得出廟方偏好自己掌握號碼；UNIQUE 是為了擋重號，不是為了強迫用系統的格式。
  voucher_no   text NOT NULL UNIQUE,
  voucher_date date NOT NULL,
  summary      text,
  -- 打到一半的單不該被當成正式單。作廢用 void 不要用刪除——財務資料不刪，
  -- 這與「有紀錄的捐款類別禁止刪除」是同一個原則。
  status       text NOT NULL CHECK (status IN ('draft', 'confirmed', 'void')) DEFAULT 'draft',
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── 憑證明細（一單多筆）────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.voucher_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  seq        int  NOT NULL DEFAULT 1,
  -- RESTRICT 不是 CASCADE：用過的科目不能刪，否則舊憑證會指向不存在的科目、報表出現空白分類。
  -- 要停用就把 accounting_accounts.is_active 設 false。
  account_id uuid REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  summary    text,
  amount     integer NOT NULL CHECK (amount >= 0),
  applicant  text,
  -- 收入憑證專用：指向產生這筆錢的業務紀錄。刻意不是外鍵——來源可能是五張不同的表。
  source_table text CHECK (source_table IS NULL OR source_table IN
    ('donations', 'lamp_registrations', 'blessing_registrations', 'bookings', 'fahui_registrations')),
  source_id    uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- 有來源就必須兩個欄位一起有，不能只填一半
  CONSTRAINT voucher_items_source_pair CHECK (
    (source_table IS NULL AND source_id IS NULL) OR
    (source_table IS NOT NULL AND source_id IS NOT NULL)
  )
);

-- ── 附件（發票、收據、傳票影本）────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.voucher_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id  uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  item_id     uuid REFERENCES public.voucher_items(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('支出傳票', '發票', '收據', '其他')) DEFAULT '其他',
  storage_path text NOT NULL,          -- 私有 bucket 內的路徑，不是公開網址
  file_name   text NOT NULL,
  mime        text,
  size_bytes  integer,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ── 索引 ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS vouchers_date_idx        ON public.vouchers (voucher_date DESC);
CREATE INDEX IF NOT EXISTS vouchers_direction_idx   ON public.vouchers (direction, voucher_date DESC);
CREATE INDEX IF NOT EXISTS voucher_items_voucher_idx ON public.voucher_items (voucher_id);
CREATE INDEX IF NOT EXISTS voucher_items_account_idx ON public.voucher_items (account_id);
-- 用來查「這筆報名是不是已經開過憑證」。刻意不做 UNIQUE：憑證作廢之後應該能重開，
-- 而 UNIQUE 索引無法跨表看 vouchers.status，重複由 UI 提醒。
CREATE INDEX IF NOT EXISTS voucher_items_source_idx  ON public.voucher_items (source_table, source_id);
CREATE INDEX IF NOT EXISTS voucher_attach_voucher_idx ON public.voucher_attachments (voucher_id);

-- ── updated_at 自動維護 ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS vouchers_touch ON public.vouchers;
CREATE TRIGGER vouchers_touch BEFORE UPDATE ON public.vouchers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS：四張表都只給財務組與管理組，anon 完全沒有路徑 ──────────────────
ALTER TABLE public.accounting_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_attachments  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounting_accounts', 'vouchers', 'voucher_items', 'voucher_attachments']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "finance_all_%s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "finance_all_%s" ON public.%I FOR ALL TO authenticated
         USING (public.has_finance_access()) WITH CHECK (public.has_finance_access())', t, t);
  END LOOP;
END $$;

-- ── 私有儲存空間：發票與收據 ────────────────────────────────────────────
-- **不可以用既有的 site-images**：那個 bucket 是公開的（全站都走 getPublicUrl），
-- 路徑又是 bulletins/<timestamp>.jpg 這種可猜的格式。發票收據上有金額、統一編號、
-- 可能有個資，任何人拿到網址就看得到。
-- 這裡建一個 public = false 的 bucket，前端一律用 createSignedUrl 取短效網址。
INSERT INTO storage.buckets (id, name, public)
VALUES ('finance-docs', 'finance-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "finance_docs_select" ON storage.objects;
CREATE POLICY "finance_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'finance-docs' AND public.has_finance_access());

DROP POLICY IF EXISTS "finance_docs_insert" ON storage.objects;
CREATE POLICY "finance_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'finance-docs' AND public.has_finance_access());

DROP POLICY IF EXISTS "finance_docs_update" ON storage.objects;
CREATE POLICY "finance_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'finance-docs' AND public.has_finance_access());

DROP POLICY IF EXISTS "finance_docs_delete" ON storage.objects;
CREATE POLICY "finance_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'finance-docs' AND public.has_finance_access());

-- ── 起始科目：**這是預設值，請廟方依實際帳務改掉** ──────────────────────
-- 刻意只放最通用的幾個，不替廟方發明科目表。留空的話第一次進來連一張憑證都開不了，
-- 所以先給一組可用的，但名稱與代號都應該由廟方確認。
INSERT INTO public.accounting_accounts (code, name, direction, sort_order, note) VALUES
  ('5101', '香品金紙',   'expense', 10, '預設科目，請廟方依實際帳務調整'),
  ('5102', '供品',       'expense', 20, '預設科目，請廟方依實際帳務調整'),
  ('5201', '水電費',     'expense', 30, '預設科目，請廟方依實際帳務調整'),
  ('5202', '房租',       'expense', 40, '預設科目，請廟方依實際帳務調整'),
  ('5203', '修繕維護',   'expense', 50, '預設科目，請廟方依實際帳務調整'),
  ('5301', '印刷文宣',   'expense', 60, '預設科目，請廟方依實際帳務調整'),
  ('5401', '交通費',     'expense', 70, '預設科目，請廟方依實際帳務調整'),
  ('5901', '雜支',       'expense', 90, '預設科目，請廟方依實際帳務調整'),
  ('4101', '香油錢',     'income',  10, '預設科目，請廟方依實際帳務調整'),
  ('4102', '點燈',       'income',  20, '預設科目，請廟方依實際帳務調整'),
  ('4103', '祈福法會',   'income',  30, '預設科目，請廟方依實際帳務調整'),
  ('4104', '問事',       'income',  40, '預設科目，請廟方依實際帳務調整'),
  ('4105', '捐獻',       'income',  50, '預設科目，請廟方依實際帳務調整'),
  ('4901', '其他收入',   'income',  90, '預設科目，請廟方依實際帳務調整')
ON CONFLICT (code) DO NOTHING;

-- ── 跑完確認（應該回 4 張表） ───────────────────────────────────────────
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public'
--     AND table_name IN ('accounting_accounts','vouchers','voucher_items','voucher_attachments')
--   ORDER BY table_name;
--
-- 確認 anon 真的被擋住（應該回 42501 權限錯誤，不是空陣列）：
--   curl -s "$URL/rest/v1/vouchers?select=id" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
