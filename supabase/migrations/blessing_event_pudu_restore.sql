-- 把普渡法會補回歲時節令（廟方 2026-10-01 同意）
-- 請在 Supabase Dashboard > SQL Editor 執行此檔案（可重複執行）
--
-- ── 為什麼要補回來 ──
-- 2026-09-02 為了讓 9/13 的法會出現在歲時節令上，補建了一筆 blessing_events
-- （見 blessing_event_pudu_2026.sql）。2026-10-01 那一筆被刪掉了——大概是廟方
-- 要「把辦完的法會從祈福活動移除」時，在後台按了刪除。
--
-- **但它本來就不在祈福活動頁上**：is_active = false，/blessing 只取 is_active = true。
-- 它唯一的作用是當行事曆的紀錄，所以刪掉的結果是歲時節令 9/13 只剩姜子牙聖誕，
-- 法會辦過的事實消失了。報名資料完全不受影響（在 fahui_registrations，兩張表無關聯）。
--
-- ── 這次多了 external_form ──
-- 標成 'fahui' 之後：後台祈福活動列表不再顯示假的「0 筆報名」，改成
-- 「N 筆報名在『法會報名』分頁 →」；前台就算誤開上架也不給「我要報名」。
-- 欄位的說明見 blessing_events_external_form.sql；這裡一併 ALTER 讓本檔可以單獨跑。
ALTER TABLE public.blessing_events
  ADD COLUMN IF NOT EXISTS external_form TEXT;

INSERT INTO public.blessing_events
  (title, description, event_type, start_date, end_date, registration_deadline,
   fee, packages, addons, offerings, is_active, sort_order, external_form)
SELECT
  '太上慈悲普渡禮懺法會',
  '丙午年度・護國佑民。設超渡祖先、解冤親債、贊普、地基主等 7 種項目。報名已於 9/06 截止。',
  '法會',
  '2026-09-13', '2026-09-13', '2026-09-06 23:59:59+08',
  0, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  -- is_active 一定是 false：true 會讓它回到 /blessing 上，而那頁的報名走的是
  -- 一般祈福流程、不是法會那套。行事曆刻意不濾這個旗標，所以 false 照樣顯示。
  FALSE, 0, 'fahui'
WHERE NOT EXISTS (
  SELECT 1 FROM public.blessing_events WHERE title = '太上慈悲普渡禮懺法會'
);

-- 若那一筆已經在（例如重跑本檔），補上標記就好
UPDATE public.blessing_events
SET external_form = 'fahui'
WHERE title = '太上慈悲普渡禮懺法會' AND external_form IS DISTINCT FROM 'fahui';

-- 確認：普渡應為 is_active = false、external_form = fahui
SELECT title, start_date, is_active, external_form
FROM public.blessing_events ORDER BY start_date;
