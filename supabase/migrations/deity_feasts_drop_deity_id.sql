-- 歲時節令與祀奉神尊解除綁定（廟方 2026-09-09）
-- 請在 Supabase Dashboard > SQL Editor 執行
--
-- ── 一、清掉列尊號的備註 ──
-- 合併的四筆原本在 note 裡列出本壇奉祀哪幾尊（「本壇奉祀濟公三師父、濟公五師父，
-- 同日祝壽。」）。標題已經寫明是哪一位神明，再列一次是同一件事講兩次，前台也顯得冗長。
-- 只清這種列尊號的，別名與規則說明要留著：
--   順天夫人「又稱順天聖母、臨水夫人、陳靖姑。」
--   火神「又稱火德星君。」
--   地藏王菩薩「農曆七月最後一天。大月為三十、小月為廿九，本表已為您換算。」
--
-- ── 二、廢除 deity_id ──
-- 當初想讓每筆聖誕關聯到 deities 的一尊，但：
--   1. 合併的筆數一對多，1:1 的外鍵接不住，只能填 NULL；
--   2. 前台唯一的用途是在日期後面再掛一次神尊名（「農曆五月十八　張天師」），
--      標題已經是「張天師聖誕」，純屬重複，已於 2026-09-09 移除；
--   3. 後台每建一筆就要多選一次神尊，設定變麻煩卻沒有任何回報。
-- 程式端已完全不再讀寫這個欄位（types.ts / supabase.ts / AdminFeastsTab 都清了），
-- 留著只是死欄位，所以一併刪除。

-- 一、清掉列尊號的備註
UPDATE public.deity_feasts
SET note = ''
WHERE note LIKE '本壇奉祀%同日祝壽。';

-- 二、廢除 deity_id（不可逆；若想先觀察一陣子，這一行可以之後再跑）
ALTER TABLE public.deity_feasts DROP COLUMN IF EXISTS deity_id;

-- 確認：應為 27 筆，只剩三筆有備註（順天夫人、火神、地藏王菩薩）
SELECT title, lunar_month || '月' || lunar_day AS 農曆, COALESCE(NULLIF(note,''),'—') AS 備註
FROM public.deity_feasts
ORDER BY lunar_month, lunar_day, title;
