-- 會員最後一次回到官網的時間（2026-11-27 廟方：「最後登入時間也還好，這其實是要知道信眾多久沒有
-- 回到官網，做成一個月沒有到官網有提示即可」）。
--
-- **為什麼不能用最後登入**：Supabase 的 last_sign_in_at 只在「按登入」時更新。會員登入一次之後
-- 一直保持登入，天天來官網，last_sign_in_at 還是幾個月前——會被誤判成「好久沒來」。
-- 所以另記一欄：會員打開官網時（每天最多一次）由前台寫入自己這一列。
--
-- 寫入權限沿用既有的 own_all_member_profiles（user_id = auth.uid() 本人），不新增任何政策。
-- 本人可以把這欄改成任意值，但它只影響後台對他自己的一個提示，沒有安全意義。
-- 只新增欄位，可重複執行。還原：ALTER TABLE public.member_profiles DROP COLUMN IF EXISTS last_seen_at;
ALTER TABLE public.member_profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- 驗證：應回一列 last_seen_at
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'member_profiles' AND column_name = 'last_seen_at';
