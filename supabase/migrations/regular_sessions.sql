-- 定期共修場次（誦經祈福這類每月固定會辦、但日期不固定的活動）
-- 請在 Supabase Dashboard > SQL Editor 執行此檔案（可重複執行）
--
-- ── 為什麼要第三張表 ──
-- 歲時節令上現在有四種東西，來源刻意分開：
--   deity_feasts      每年重複、記農曆規則的日子（神明聖誕、節令）
--   blessing_events   單次的祈福活動，有報名方案與費用
--   booking_sessions  辦事日＝問事場次（既有表，後台「問事管理」在維護）
--   regular_sessions  ← 這張。誦經祈福這類每月都辦、但日期時間由廟方當月決定的
--
-- 為什麼不塞進既有的表（2026-10-01 廟方確認「每月日期不固定，逐場建立」）：
--   deity_feasts 存的是「每年都會到的規則」，算得出年年的日期；誦經祈福沒有規則，
--     硬塞就得每年手動補 12 筆，那正是那張表要避免的事。
--   blessing_events 帶報名方案、費用與截止日，而且每一筆都會上架到祈福活動頁——
--     誦經祈福不收報名，塞進去會讓那一頁多出十二筆沒有方案的活動。
--   booking_sessions 有名額與線上預約，誦經祈福不需要；共用會讓「問事管理」的
--     場次清單混進非問事的場次，廟方改到哪一筆都難講。
--
-- ── title 不寫死 ──
-- 預設「誦經祈福」，但留成可改的欄位：廟方若之後多了「月例共修」「朝山」
-- 這類同性質的活動，不必再開一張表或改程式。
CREATE TABLE IF NOT EXISTS public.regular_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL DEFAULT '誦經祈福',
  session_date DATE NOT NULL,
  -- 時段是自由文字，與 booking_sessions.session_time 同慣例（例：上午 09:00–11:00）。
  -- 不拆成起訖兩個 time 欄位：廟方寫的是「上午九點」這種給人看的字，
  -- 拆欄位反而要他把口語轉成兩個精確時間，填錯的機會更大。
  session_time TEXT,
  note         TEXT,
  is_visible   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 同一天可以有兩場（上午、下午），所以不是唯一鍵；查詢一律照日期排
CREATE INDEX IF NOT EXISTS regular_sessions_date_idx ON public.regular_sessions (session_date);

ALTER TABLE public.regular_sessions ENABLE ROW LEVEL SECURITY;

-- 訪客只讀得到「顯示中」的：還沒跟廟方確認的日期留在後台不會外流（同 deity_feasts）
DROP POLICY IF EXISTS "public_read_regular_sessions" ON public.regular_sessions;
CREATE POLICY "public_read_regular_sessions" ON public.regular_sessions
  FOR SELECT TO anon, authenticated USING (is_visible = TRUE);

DROP POLICY IF EXISTS "admin_all_regular_sessions" ON public.regular_sessions;
CREATE POLICY "admin_all_regular_sessions" ON public.regular_sessions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 確認（新建時 0 筆）
SELECT count(*) AS 定期共修場次 FROM public.regular_sessions;
