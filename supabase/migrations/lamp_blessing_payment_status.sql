-- 點燈與祈福的狀態改成「收款」語彙：待匯款／已收款／已取消
-- 請在 Supabase Dashboard > SQL Editor 執行（可重複執行）
--
-- ── 為什麼 ──
-- 廟方 2026-10-13：「點燈／祈福跟法會一樣，要匯款，由後台按標記已收款，
-- 只有問事是現場收費。」
-- 原本這兩張表存的是「處理進度」（待處理／待確認／已確認／已完成），
-- 而廟方真正在做的只有一件事：確認錢收到了。後台那顆四選一的下拉因此換成
-- 跟法會一樣的「標記已收款」按鈕，狀態值也跟著改成它真正的意思。
--
-- **`bookings` 不在內**：問事是現場收費，沒有收款這個環節，它的
-- 待處理／已確認／已完成講的是預約的處理進度，是對的，不要為了統一而改。
--
-- ── `已完成` 折成 `已收款` ──
-- 廟方確認那個狀態從來沒在用（2026-10-13）。真的有這個值的紀錄必然是收過款
-- 才會被標的，折成「已收款」是這批資料唯一說得通的解釋。
--
-- ── 跑之前 / 跑之後都不會壞 ──
-- 程式兩端都不假設這支跑過：讀取端 `normalizeLampStatus()` 會把舊值折成新值，
-- 寫入端遇到 CHECK 擋下來（23514）會改用舊值送出。所以這支的作用是讓資料
-- **收斂**，而不是讓功能可用。跑完之後那兩段相容程式就再也不會走到。

-- ① 先拿掉卡住舊值的 CHECK（如果有）
--    這兩張表是在 Supabase 後台手動建的、repo 裡沒有 CREATE TABLE，
--    所以從程式看不出到底有沒有這個限制。有就拿掉，沒有就什麼都不做。
--    **刻意不再建一個新的 CHECK**：這是報名的送出路徑，CHECK 一旦擋下來
--    整筆報名就失敗，而追蹤欄位／狀態欄位絕對不可以把轉換擋掉
--    （同 utm_source_column.sql 裡 source 欄位的理由）。
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conrelid::regclass AS tbl, conname
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid IN ('public.lamp_registrations'::regclass,
                       'public.blessing_registrations'::regclass)
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
    RAISE NOTICE '已移除 % 的 CHECK %', c.tbl, c.conname;
  END LOOP;
END $$;

-- ② 舊值換成新值
UPDATE public.lamp_registrations SET status = '待匯款' WHERE status = '待處理';
UPDATE public.lamp_registrations SET status = '已收款' WHERE status IN ('已確認', '已完成');

UPDATE public.blessing_registrations SET status = '待匯款' WHERE status = '待確認';
UPDATE public.blessing_registrations SET status = '已收款' WHERE status = '已確認';

-- ③ 新紀錄的預設值。程式其實會明寫 status，這一行是保險
--    （有人直接在後台 SQL 插一筆時不會又生出舊值）
ALTER TABLE public.lamp_registrations     ALTER COLUMN status SET DEFAULT '待匯款';
ALTER TABLE public.blessing_registrations ALTER COLUMN status SET DEFAULT '待匯款';

-- ④ 核對：跑完應該只剩 待匯款／已收款／已取消 三種
SELECT '點燈' AS 表, status, count(*) FROM public.lamp_registrations     GROUP BY status
UNION ALL
SELECT '祈福' AS 表, status, count(*) FROM public.blessing_registrations GROUP BY status
ORDER BY 1, 2;
