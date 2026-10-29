-- 祈福報名補 contact_label（稱謂／關係）
-- 請在 Supabase Dashboard > SQL Editor 執行（可重複執行）
--
-- ── 為什麼 ──
-- 祈福報名表單**一直有在收「稱謂／關係」**（App.tsx 的 `RELATION_OPTIONS`，
-- 與問事／點燈／捐款同一組），但那個值在送出的路上被丟掉了，**三層都缺**：
--   ① `BlessingRegistrationData` 沒有 `contactLabel` 這個欄位
--   ② App.tsx 呼叫 `createBlessingRegistration()` 時沒有帶
--   ③ insert 的 payload 裡沒有 `contact_label`
-- 所以信眾在祈福表單上選的關係，從上線到 2026-10-29 全部沒有存下來。
-- 不會報錯、不會噴型別——選單有正常運作，值就是消失了。這是本專案最常見的失敗形狀。
--
-- **過去的資料救不回來**：它從來沒有被寫進資料庫，沒有任何地方可以回填。
-- 這支只讓之後的報名存得進去。
--
-- ── 其他幾張表的現況（查過） ──
--   `bookings`        ← booking_fix_columns_rls.sql 建的
--   `shared_entries`  ← shared_sessions.sql 建的
--   `donations`／`lamp_registrations` ← 沒有 migration，是在 Supabase 後台手動加的
--     （程式無條件寫入這一欄且正式站正常，所以欄位確實存在）
--   `fahui_registrations` ← **刻意沒有**，見下。
--
-- ── 法會為什麼不在這一支裡 ──
-- 法會的結構是「一個聯絡人 ＋ 多個陽上牌位」，關係要掛在**每一個牌位**上才有意義
-- （一張報名單上同時有父母親與兒女），掛在報名層級只會是一個對不上任何人的值。
-- 那是 `entries` 這個 JSON 結構的改動，要廟方先決定牌位要不要收關係。
--
-- ── 跑之前 / 跑之後都不會壞 ──
-- 寫入端是 `insertOptional('blessing_registrations', …, ['email', 'contact_label'])`：
-- 欄位不存在時它會把這一欄退掉再送，所以**這支沒跑，祈福報名照樣送得出去**，
-- 只是關係存不下來。讀取端 `row.contact_label || undefined` 也容得下沒有這一欄。

ALTER TABLE public.blessing_registrations
  ADD COLUMN IF NOT EXISTS contact_label text;

-- 驗收：
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'blessing_registrations' AND column_name = 'contact_label';
-- 應該回一列。之後從前台送一筆祈福報名（姓名前面加「測試」），
-- 後台「信眾資訊」那一頁該筆的「關係」欄就會有值，驗完記得用 SQL 刪掉那筆測試資料。
