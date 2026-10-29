-- 後台「會員資訊」要能用信箱搜尋會員
-- 請在 Supabase Dashboard > SQL Editor 執行（可重複執行）
--
-- ── 為什麼需要這一支 ──
-- 廟方 2026-10-29：「我要能在會員清單搜尋姓名、電話、email 找到某個會員。」
-- 但**信箱不在 `member_profiles`**（那張表只有姓名／電話／生日／生肖／性別／地址），
-- 它在 `auth.users.email`。前端是 anon key，讀不到 auth schema，也**不應該**為了這件事
-- 把 service key 放進瀏覽器。既有的作法是走 SECURITY DEFINER 的 RPC
-- （`get_users_last_login` 就是這樣拿到最後登入時間的），這裡沿用同一套。
--
-- ── 為什麼不直接改 `get_users_last_login` ──
-- 那支函式**是在 Supabase 後台手動建的、repo 裡沒有定義**（同 lamp_registrations
-- 與 blessing_registrations 兩張表的情況）。`CREATE OR REPLACE` 等於用猜的內容覆蓋掉
-- 一支看不見的函式：猜錯權限判斷就會把全站會員的信箱放寬給任何登入者，而那不會報錯。
-- 所以這裡**新增一支**，原來那支完全不動。前端兩支併發呼叫，使用者無感。
--
-- ── 權限 ──
-- 一律 `public.is_admin()`（定義在 mainsite_rls.sql：admin_profiles 有沒有這個 user_id）。
-- 這與 `devotee_overrides`、`about_sections` 等後台資料用的是同一道門，**沒有擴大暴露面**：
-- 能進後台的人本來就看得到這些會員的姓名、電話與地址，信箱不比那些更敏感。
-- 不是管理員呼叫就回零列（不是報錯）——報錯會讓前端分不出「沒有權限」與「沒有資料」。
--
-- ── 跑之前 / 跑之後都不會壞 ──
-- 前端 `getUsersLastLogin()` 對這支的失敗是容錯的：抓不到就 `emails = {}`，
-- 會員搜尋少了信箱這一路、其餘照常。所以這支沒跑不會壞任何東西，只是搜不到信箱。

CREATE OR REPLACE FUNCTION public.get_member_emails()
RETURNS TABLE (user_id uuid, email text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT u.id, u.email::text
  FROM auth.users u
  WHERE public.is_admin()
    -- **LINE 登入的帳號沒有信箱**（LINE 不給），那種 row 的 email 是 NULL。
    -- 濾掉是刻意的：回一堆 NULL 只會讓前端那張 map 長出一堆空值。
    -- 代價是「用信箱搜尋」永遠找不到 LINE 會員——所以會員搜尋同時吃姓名與電話。
    AND u.email IS NOT NULL
    -- 只給真的有建立會員資料的帳號。後台管理員自己的帳號也在 auth.users 裡，
    -- 但他們不是會員，不該出現在會員清單的搜尋結果裡。
    AND EXISTS (SELECT 1 FROM public.member_profiles mp WHERE mp.user_id = u.id);
$$;

REVOKE ALL ON FUNCTION public.get_member_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_emails() TO authenticated;

-- ── 驗收（注意：不能在 SQL Editor 裡直接查這支函式） ──
-- **SQL Editor 跑的時候 `auth.uid()` 是 NULL**，所以 `public.is_admin()` 會是 false、
-- 這支函式回 0 列。那是權限閘正常運作，不是函式壞了——別被那個 0 誤導。
--
-- ① 在 SQL Editor 確認「函式建起來了」：
--      SELECT proname FROM pg_proc WHERE proname = 'get_member_emails';
--    回一列就對了。
--
-- ② 在 SQL Editor 確認「之後應該會有幾筆」（繞過 is_admin()，直接算同一組條件）：
--      SELECT count(*) FROM auth.users u
--      WHERE u.email IS NOT NULL
--        AND EXISTS (SELECT 1 FROM public.member_profiles mp WHERE mp.user_id = u.id);
--    這個數字就是「有信箱的會員數」。它比會員總數少是正常的——LINE 登入的沒有信箱。
--
-- ③ 真正的驗收在後台：用管理員帳號登入 → 會員資訊 → 搜尋框輸入某個會員信箱的一段，
--    搜得到就成功。瀏覽器 console 若出現「get_member_emails 取不到」就是這支沒跑成功。
--
-- ④ 權限有沒有關好，也在後台驗：用**一般會員帳號**登入會員中心，console 執行
--      await supabase.rpc('get_member_emails')
--    應該回空陣列（不是報錯、也不是別人的信箱）。
