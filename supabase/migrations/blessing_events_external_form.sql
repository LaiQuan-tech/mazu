-- 祈福活動：標記「報名不走這一套」的活動（廟方 2026-10-01 回報後台顯示 0 人報名）
-- 請在 Supabase Dashboard > SQL Editor 執行此檔案（可重複執行）
--
-- ── 廟方遇到的事 ──
-- 普渡法會那一筆 blessing_events 是 2026-09-02 為了讓它出現在歲時節令上補建的
-- （見 blessing_event_pudu_2026.sql），它的報名其實走 fahui_registrations 那套
-- 獨立的七項目表單，blessing_registrations 裡一筆都沒有。
-- 後台「祈福活動」的列表是數 blessing_registrations，所以顯示「0 筆報名」——
-- 實際上有四十幾筆，只是在「法會報名」分頁。數字沒錯，但它在說謊。
--
-- **那一筆在 2026-10-01 已經被刪掉了**（查到時只剩天赦日一筆），所以下面的 UPDATE
-- 現在會是 0 rows，這是正常的。欄位仍然要加：以後的法會只要照廟方 2026-09-02
-- 定的作法「在祈福活動後台建一筆」，就會再撞到同一件事。
-- 刪掉的副作用是**歲時節令上 9/13 只剩姜子牙聖誕**，法會辦過的事實從行事曆上
-- 消失了；要補回來就重跑 blessing_event_pudu_2026.sql，再跑一次這一支。
--
-- ── 為什麼不是把兩張表加起來 ──
-- 兩套報名表的欄位與流程完全不同（法會那套有牌位、贊普、物資捐贈與供品處理方式），
-- 加總只會產生一個沒有地方可以點進去看的數字。要的是「告訴廟方去哪裡看」。
--
-- ── 這個欄位的意思 ──
-- external_form = 這個活動的報名走哪一套外部表單。目前只有 'fahui'（法會報名表）。
-- 有值時：後台列表改顯示「N 筆報名在『法會報名』分頁」並可直接點過去，不再顯示 0；
--        前台就算誤把 is_active 打開也不給「我要報名」——那顆會開一般祈福報名流程，
--        跟這個活動無關，信眾填了會變成一筆對不到場次的孤兒訂單
--        （blessing_event_pudu_2026.sql 檔頭已經警告過，現在用欄位擋住而不是只靠註解）。
ALTER TABLE public.blessing_events
  ADD COLUMN IF NOT EXISTS external_form TEXT;

COMMENT ON COLUMN public.blessing_events.external_form IS
  '報名走哪一套外部表單（目前只有 fahui＝法會報名表）。NULL＝走一般祈福報名 blessing_registrations';

-- 普渡那一筆若還在（或日後補回來）就標記起來。不在就是 0 rows，不是錯誤。
UPDATE public.blessing_events
SET external_form = 'fahui'
WHERE title = '太上慈悲普渡禮懺法會' AND external_form IS DISTINCT FROM 'fahui';

-- 確認：欄位存在；有普渡那一筆的話 external_form 應為 fahui，其餘為 NULL
SELECT title, start_date, is_active, external_form
FROM public.blessing_events ORDER BY start_date;
