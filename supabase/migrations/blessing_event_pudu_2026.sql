-- 把 2026 普渡法會補建成一筆 blessing_events，讓它出現在歲時節令上
-- 請在 Supabase Dashboard > SQL Editor 執行（可重複執行）
--
-- ── 為什麼要補這一筆 ──
-- 行事曆不只是神明聖誕，壇務活動也該在上面。普渡法會（9/13）走的是
-- fahui_registrations 那套獨立流程，不在 blessing_events 裡，所以行事曆看不到它，
-- 9/13 那天只剩姜子牙聖誕。廟方 2026-09-02 已決定「以後的法會都在祈福活動後台
-- 建一筆 blessing_events」，這筆等於把普渡也補進同一套。
--
-- ── is_active 一定要是 false ──
-- 報名 9/06 已截止。is_active 管的是「在 /blessing 上架、還能報名」：
--   true  → /blessing 會多出一張卡，跟頁面上寫死的普渡橫幅重複，而且點進去
--           走的是一般祈福報名流程，不是法會那套，會把信眾帶錯地方。
--   false → /blessing 不顯示（該頁只取 is_active = true），行事曆照樣顯示
--           （CalendarPage 刻意不濾這個旗標，見該檔註解）。
-- 語意上也對：活動確實發生，只是不再收件。
--
-- registration_deadline 是 timestamptz，只寫日期會被當成當天凌晨零時（等於 9/05
-- 結束），所以寫足 '2026-09-06 23:59:59+08'。

INSERT INTO public.blessing_events
  (title, description, event_type, start_date, end_date, registration_deadline,
   fee, packages, addons, offerings, is_active, sort_order)
SELECT
  '太上慈悲普渡禮懺法會',
  '丙午年度・護國佑民。設超渡祖先、解冤親債、贊普、地基主等 7 種項目。報名已於 9/06 截止。',
  '法會',
  '2026-09-13', '2026-09-13', '2026-09-06 23:59:59+08',
  0, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  FALSE, 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.blessing_events WHERE title = '太上慈悲普渡禮懺法會'
);

-- 確認：應有一筆、is_active 為 false
SELECT title, start_date, registration_deadline, is_active
FROM public.blessing_events ORDER BY start_date;
