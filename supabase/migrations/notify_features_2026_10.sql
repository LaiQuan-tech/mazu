-- 2026-10-16 一批通知功能要用的欄位與設定（廟方要求的六項）
-- 請在 Supabase Dashboard > SQL Editor 執行（可重複執行）
--
-- 這一支一次把六個功能的欄位都加好，不要分批跑——分批的話某個功能會處在
-- 「程式上線了但欄位還沒有」的中間狀態，而那種狀態的症狀都是「信沒來」，
-- 從外面看不出是哪一個。
--
-- ── 每一欄都是「寄過沒」的時間戳，不是旗標 ──
-- 用 timestamptz 而不是 boolean：除了「寄過沒」之外還要回答「什麼時候寄的」，
-- 而廟方查問題時問的永遠是後者。同 confirm_sent_at 的作法。
-- 一律可為 NULL，NULL ＝ 還沒寄過。

-- ① 問事：前一天提醒（減少放鳥；問事是現場收費又佔場次名額）
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- ② 點燈：到期續點提醒
--    `expires_at` 為 NULL 時，程式以「建立日 + 1 年」推算（點燈是一年一期）。
--    **刻意可以為 NULL 而不是用觸發器自動填**：多數人在農曆年前後點燈、點的是
--    「下一年」的燈，真正的期別只有廟方知道。先給一個看得見的推算值，
--    對不上時廟方在後台改那一筆就好，不要讓程式假裝自己知道。
ALTER TABLE public.lamp_registrations ADD COLUMN IF NOT EXISTS expires_at        timestamptz;
ALTER TABLE public.lamp_registrations ADD COLUMN IF NOT EXISTS renew_notified_at timestamptz;

-- ③ 未匯款提醒（點燈／祈福／法會三種要先匯款的）
ALTER TABLE public.lamp_registrations     ADD COLUMN IF NOT EXISTS payment_reminded_at timestamptz;
ALTER TABLE public.blessing_registrations ADD COLUMN IF NOT EXISTS payment_reminded_at timestamptz;
ALTER TABLE public.fahui_registrations    ADD COLUMN IF NOT EXISTS payment_reminded_at timestamptz;

-- ④ 送出當下就把匯款資訊推給信眾（免得他關掉分頁就找不到帳號）
ALTER TABLE public.lamp_registrations     ADD COLUMN IF NOT EXISTS payinfo_sent_at timestamptz;
ALTER TABLE public.blessing_registrations ADD COLUMN IF NOT EXISTS payinfo_sent_at timestamptz;

-- ⑤ 年度捐獻明細（寄過的那幾筆蓋章，隔年再寄不會重複）
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS statement_sent_at timestamptz;

-- ⑥ 公佈欄一鍵發到 LINE（蓋章避免重複群發——群發是要算訊息則數的）
ALTER TABLE public.bulletins ADD COLUMN IF NOT EXISTS broadcast_at timestamptz;

-- ── 匯款資訊搬進 site_settings ──
-- 原本寫死在 App.tsx 的 BankInfoBox 裡。現在伺服器端也要用（推給信眾的訊息要帶帳號），
-- 兩邊各寫一份遲早對不起來——而這一份對不起來的後果是信眾把錢匯到錯的帳戶。
-- 沿用既有的 site_settings（key/value），同 info_* 那一組的作法。
-- **這是一般捐獻與各項服務用的中國信託帳戶**；遷址募資的專款帳戶是另一個，
-- 2026-09-12 起已從 /relocation 撤下、等協會成立後再提供，不要混用（見 CLAUDE.md）。
INSERT INTO public.site_settings (key, value) VALUES
  ('bank_name',   '中國信託銀行'),
  ('bank_code',   '822'),
  ('bank_branch', '大安分行'),
  ('bank_account','6025-4035-6010'),
  ('bank_holder', '王順文')
ON CONFLICT (key) DO NOTHING;

-- 核對
SELECT key, value FROM public.site_settings WHERE key LIKE 'bank_%' ORDER BY key;
