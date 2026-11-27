-- 報名後加 LINE 好友、讓廟方知道他的 LINE（2026-11-27 廟方：「報名後常常沒辦法聯絡信眾，
-- 報名完就請他加和聖壇 LINE 好友，並讓我們知道他在 LINE 的名稱」）。
--
-- ── 怎麼對上是誰 ──
-- LINE 加好友本身不會告訴我們「這是哪一筆報名」。所以報名完成頁的按鈕會打開 LINE，
-- 對話框裡帶好「報名確認 K7Q2MX」；信眾按送出後，api/line.ts（LINE webhook）用確認碼
-- 對到這次送出的那幾筆，向 LINE 取他的顯示名稱，記在 line_links。
--
-- ── 兩張表都只有後台看得到 ──
-- line_link_codes：確認碼 → 這次送出的報名 id。只有伺服器（service role）用，零政策。
-- line_links：哪一筆報名綁了哪個 LINE。LINE userId 拿到就能推播，所以只給管理員讀；
--   寫入只有 webhook（service role）。
-- **綁的是「那幾筆報名」不是「電話」**：任何人都能拿別人的電話報名，若以電話綁，
-- 冒名報名一次就能把那支電話之後所有通知（姓名、金額、感謝狀）收走。
--
-- 只新增，不動既有資料表，可重複執行。還原見 line_links_rollback.sql。

CREATE TABLE IF NOT EXISTS public.line_link_codes (
  code         text PRIMARY KEY,
  source_table text NOT NULL CHECK (source_table IN
    ('bookings', 'lamp_registrations', 'blessing_registrations', 'donations', 'fahui_registrations')),
  source_ids   text[] NOT NULL CHECK (cardinality(source_ids) BETWEEN 1 AND 50),
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '30 days',
  used_at      timestamptz,
  -- 第一個用掉這組碼的 LINE。之後只有同一個人能再用（家人轉傳了也搶不走）
  used_by      text
);
ALTER TABLE public.line_link_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.line_link_codes FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.line_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_id    text NOT NULL,
  line_user_id text NOT NULL,
  line_name    text,
  linked_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_table, source_id)
);
ALTER TABLE public.line_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.line_links FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.line_links FROM authenticated;
GRANT SELECT ON public.line_links TO authenticated;
DROP POLICY IF EXISTS line_links_admin_read ON public.line_links;
CREATE POLICY line_links_admin_read ON public.line_links FOR SELECT TO authenticated USING (public.is_admin());

-- 會員管理、信眾名冊也要看得到 LINE 名稱（2026-11-27）：用 LINE 登入的會員，登入時 LINE 給的顯示名稱
-- 存在 auth.identities（provider = custom:line）的 identity_data。前端讀不到 auth，所以走這支，
-- **限 is_admin()**（同 get_member_emails 的作法；不碰既有的 get_users_last_login）。
CREATE OR REPLACE FUNCTION public.get_member_line_names()
RETURNS TABLE (user_id uuid, line_name text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT i.user_id, coalesce(nullif(i.identity_data->>'name', ''), nullif(i.identity_data->>'full_name', ''),
                             nullif(i.identity_data->>'nickname', ''))
    FROM auth.identities i
   WHERE public.is_admin()
     AND i.provider = 'custom:line'
     AND EXISTS (SELECT 1 FROM public.member_profiles mp WHERE mp.user_id = i.user_id);
$$;
REVOKE ALL ON FUNCTION public.get_member_line_names() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_line_names() TO authenticated;

-- 驗證：應看到兩張表、RLS 都是 true
SELECT relname AS 表, relrowsecurity AS 已啟用RLS FROM pg_class
 WHERE relname IN ('line_link_codes', 'line_links') AND relnamespace = 'public'::regnamespace;
-- 用 LINE 登入的會員有幾位拿得到名稱（SQL Editor 裡 is_admin() 是 false，所以直接算）：
SELECT count(*) AS LINE會員, count(coalesce(nullif(identity_data->>'name',''), nullif(identity_data->>'full_name',''))) AS 有名稱
  FROM auth.identities WHERE provider = 'custom:line';
