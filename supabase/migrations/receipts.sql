-- 三聯式收據（可補印、可重印、可作廢）
-- 2026-10-30。請在 Supabase Dashboard > SQL Editor 執行（可重複執行）
--
-- ── 為什麼收據要存成資料 ──
-- 廟方 2026-10-30：「可以事後補印／重印。」**能重印就代表收據必須是一筆資料，
-- 不能只是一個列印動作**——否則查不到誰領過第幾號，也補不了印。
--
-- ── 單頭＋明細（廟方 2026-10-30 決定）──
-- 「一張收據指向多筆報名，金額由明細加總。」同一個人同一天點了燈又捐了款，
-- 開一張收據、列兩個項目。
--
-- ── 貫穿這份 schema 的四個決定 ──
--
-- 1. **合計不存，一律由 receipt_items 加總。** 存下來之後一旦與明細對不起來，
--    沒有任何方法知道該信哪個。同 finance_vouchers.sql 的 voucherTotal()。
--
-- 2. **金額與項目名稱是「快照」，不是即時引用。** 這一條與憑證刻意不同，理由要講清楚：
--    憑證是廟方內部的帳，報名金額改了就該跟著改；**收據是已經印出來交到信眾手上的紙**，
--    它是不可變的。日後點燈漲價、活動改名，那張紙上印的仍然是當時的金額與名稱。
--    所以 `amount` 與 `label` 在開立當下寫死。
--    **但金額的來源仍然是報名紀錄（經 serviceAmount.ts 算出），不是財務自己打的**
--    ——同一筆錢只有一個金額來源，這一點與憑證一致。
--    `source_table` + `source_id` 留著，是為了查得到「這筆報名開過收據沒」。
--
-- 3. **作廢不刪除，而且這比憑證更重要。** 連號收據一旦出現缺號，外觀上與
--    「有人抽走一張」無法分辨——那是財務稽核最敏感的事。作廢的收據要留在列表裡、
--    標明已作廢，號碼才看得出是「作廢」而不是「不見了」。
--
-- 4. **配號與寫入必須在同一個交易裡。** 先配號、再寫收據的話，寫入失敗就燒掉一個號碼，
--    留下一個永遠補不回來的缺口。所以開立走 `create_receipt()` 這支 RPC，
--    它在一個交易內配號並寫入單頭與明細，任何一步失敗就整個回滾、號碼也退回。

-- ── 權限 ────────────────────────────────────────────────────────────────
-- 沿用 finance_vouchers.sql 建的 has_finance_access()（admin ＋ finance）。
-- 那支若還沒建（finance_vouchers.sql 沒跑過），這裡先補一份，定義完全相同。
CREATE OR REPLACE FUNCTION public.has_finance_access() RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.admin_profiles
  WHERE user_id = auth.uid() AND role IN ('admin', 'finance')
); $$;

REVOKE EXECUTE ON FUNCTION public.has_finance_access() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_finance_access() TO authenticated;

-- ── 流水號計數器 ────────────────────────────────────────────────────────
-- 一年一列，跨年自動從 1 開始。**年份用民國年並明寫 Asia/Taipei**：
-- 伺服器時區是 UTC，台灣時間凌晨開的收據會被算成前一年。
CREATE TABLE IF NOT EXISTS public.receipt_counters (
  roc_year int PRIMARY KEY,
  last_no  int NOT NULL DEFAULT 0
);

-- ── 收據單頭 ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.receipts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 格式 `115-00001`（民國年-五碼流水）。UNIQUE 是擋重號。
  -- **要改格式只改 create_receipt() 裡組字串那一行**，這一欄是純文字。
  receipt_no  text NOT NULL UNIQUE,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  -- 抬頭：通常是信眾姓名，但也可能是公司行號或「○○家族」，所以不綁報名人姓名
  title       text NOT NULL,
  phone       text,
  address     text,
  note        text,
  status      text NOT NULL CHECK (status IN ('issued', 'void')) DEFAULT 'issued',
  void_reason text,
  voided_at   timestamptz,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- **開立人姓名要快照**：帳號日後可能停用或刪除（created_by 會變 NULL），
  -- 而「這張收據是誰開的」是稽核時一定會問的問題。
  created_by_name text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 收據明細（一張多筆）────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.receipt_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  seq        int  NOT NULL DEFAULT 1,
  -- 指向產生這筆錢的業務紀錄。刻意不是外鍵——來源是四張不同的表。
  -- 問事不在內：現場收費，沒有收款這個環節（見 types.ts 的 BookingStatus）。
  source_table text CHECK (source_table IS NULL OR source_table IN
    ('donations', 'lamp_registrations', 'blessing_registrations', 'fahui_registrations')),
  source_id    uuid,
  -- 項目名稱與金額的快照，理由見檔頭第 2 條
  label      text    NOT NULL,
  amount     integer NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- 有來源就必須兩個欄位一起有，不能只填一半（同 voucher_items）
  CONSTRAINT receipt_items_source_pair CHECK (
    (source_table IS NULL AND source_id IS NULL) OR
    (source_table IS NOT NULL AND source_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS receipts_issued_idx      ON public.receipts (issued_at DESC);
CREATE INDEX IF NOT EXISTS receipts_title_idx       ON public.receipts (title);
CREATE INDEX IF NOT EXISTS receipt_items_receipt_idx ON public.receipt_items (receipt_id);
-- 用來查「這筆報名開過收據沒」。**刻意不做 UNIQUE**：收據作廢之後應該能重開，
-- 而 UNIQUE 索引看不到 receipts.status，重複由畫面提醒（同 voucher_items_source_idx）。
CREATE INDEX IF NOT EXISTS receipt_items_source_idx ON public.receipt_items (source_table, source_id);

-- touch_updated_at() 原本是 finance_vouchers.sql 建的。
-- **不要假設那支跑過**：這裡補一份完全相同的定義，CREATE OR REPLACE 重跑無害。
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS receipts_touch ON public.receipts;
CREATE TRIGGER receipts_touch BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS：只給財務組與管理組，anon 完全沒有路徑 ──────────────────────────
ALTER TABLE public.receipts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['receipts', 'receipt_items', 'receipt_counters']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "finance_all_%s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "finance_all_%s" ON public.%I FOR ALL TO authenticated '
      'USING (public.has_finance_access()) WITH CHECK (public.has_finance_access())', t, t);
  END LOOP;
END $$;

-- Postgres 預設 GRANT TO PUBLIC，Supabase 又另外 GRANT 給 anon，
-- 只收其中一個沒用（finance_vouchers.sql 的註解記著這個坑）。
REVOKE ALL ON public.receipts, public.receipt_items, public.receipt_counters FROM PUBLIC, anon;
GRANT  SELECT, INSERT, UPDATE ON public.receipts, public.receipt_items TO authenticated;

-- ── 開立：配號與寫入在同一個交易裡 ──────────────────────────────────────
-- 回傳整張收據（單頭＋明細）。
-- p_items 的格式：[{"source_table":"donations","source_id":"...","label":"隨喜捐獻","amount":1000}, ...]
CREATE OR REPLACE FUNCTION public.create_receipt(
  p_title   text,
  p_items   jsonb,
  p_phone   text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_note    text DEFAULT NULL,
  p_by_name text DEFAULT NULL
) RETURNS public.receipts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_year int;
  v_no   int;
  v_rec  public.receipts;
  v_cnt  int;
BEGIN
  IF NOT public.has_finance_access() THEN
    RAISE EXCEPTION '沒有財務權限';
  END IF;

  v_cnt := jsonb_array_length(COALESCE(p_items, '[]'::jsonb));
  IF v_cnt = 0 THEN
    -- 空收據沒有意義，而且會燒掉一個號碼
    RAISE EXCEPTION '收據至少要有一個項目';
  END IF;

  -- 民國年，明寫台灣時區（伺服器是 UTC，凌晨開的會被算成前一年）
  v_year := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Taipei'))::int - 1911;

  -- ON CONFLICT DO UPDATE 會鎖住那一列，兩個人同時開立不會拿到同一個號碼
  INSERT INTO public.receipt_counters (roc_year, last_no) VALUES (v_year, 1)
  ON CONFLICT (roc_year) DO UPDATE SET last_no = receipt_counters.last_no + 1
  RETURNING last_no INTO v_no;

  INSERT INTO public.receipts (receipt_no, title, phone, address, note, created_by, created_by_name)
  VALUES (v_year || '-' || lpad(v_no::text, 5, '0'),
          p_title, p_phone, p_address, p_note, auth.uid(), p_by_name)
  RETURNING * INTO v_rec;

  INSERT INTO public.receipt_items (receipt_id, seq, source_table, source_id, label, amount)
  SELECT v_rec.id,
         (ord)::int,
         NULLIF(it->>'source_table', ''),
         NULLIF(it->>'source_id', '')::uuid,
         it->>'label',
         (it->>'amount')::int
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS a(it, ord);

  RETURN v_rec;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_receipt(text, jsonb, text, text, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_receipt(text, jsonb, text, text, text, text) TO authenticated;

-- ── 作廢 ────────────────────────────────────────────────────────────────
-- 不刪除。號碼留著，列表上標示已作廢（理由見檔頭第 3 條）。
CREATE OR REPLACE FUNCTION public.void_receipt(p_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_finance_access() THEN
    RAISE EXCEPTION '沒有財務權限';
  END IF;
  UPDATE public.receipts
     SET status = 'void', void_reason = p_reason, voided_at = now()
   WHERE id = p_id AND status <> 'void';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.void_receipt(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.void_receipt(uuid, text) TO authenticated;

-- 驗收（以管理員或財務帳號在後台執行；SQL Editor 沒有登入身分，會被權限擋下來回錯）：
--   SELECT * FROM public.create_receipt('測試信眾',
--     '[{"label":"測試項目","amount":100}]'::jsonb);
--   SELECT receipt_no, title, status FROM public.receipts ORDER BY created_at DESC LIMIT 1;
-- 應該看到 115-00001。驗完記得把那張測試收據與計數器一起清掉：
--   DELETE FROM public.receipts WHERE title = '測試信眾';
--   UPDATE public.receipt_counters SET last_no = 0 WHERE roc_year = 115;
