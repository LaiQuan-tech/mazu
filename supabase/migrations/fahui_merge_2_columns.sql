-- 法會併入祈福 第 1 步：祈福報名表加法會專用欄位（只加不改，舊程式照常運作）
-- entries 有值＝這一筆是法會報名單（一位聯絡人＋多個牌位），NULL＝一般祈福
ALTER TABLE public.blessing_registrations
  ADD COLUMN IF NOT EXISTS entries          jsonb,
  ADD COLUMN IF NOT EXISTS line_id          text,
  ADD COLUMN IF NOT EXISTS zanpu_offering   text,
  ADD COLUMN IF NOT EXISTS meal_sponsor     int,
  ADD COLUMN IF NOT EXISTS total_amount     int,
  ADD COLUMN IF NOT EXISTS payment_method   text,
  ADD COLUMN IF NOT EXISTS payment_date     date,
  ADD COLUMN IF NOT EXISTS account_last5    text,
  ADD COLUMN IF NOT EXISTS finance_check    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS thanks_letter    text,
  ADD COLUMN IF NOT EXISTS accounting_check boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_note       text;

ALTER TABLE public.blessing_registrations DROP CONSTRAINT IF EXISTS blessing_payment_method_chk;
ALTER TABLE public.blessing_registrations ADD CONSTRAINT blessing_payment_method_chk
  CHECK (payment_method IS NULL OR payment_method IN ('現金', '轉帳', '功德主'));
-- 法會那種的金額一律用存的總額，不可以沒有
ALTER TABLE public.blessing_registrations DROP CONSTRAINT IF EXISTS blessing_fahui_total_chk;
ALTER TABLE public.blessing_registrations ADD CONSTRAINT blessing_fahui_total_chk
  CHECK (entries IS NULL OR total_amount IS NOT NULL);

-- 原本是 ON DELETE CASCADE：刪一場活動會把報名（含金額）一起刪掉。改成有報名就刪不掉
ALTER TABLE public.blessing_registrations DROP CONSTRAINT IF EXISTS blessing_registrations_event_id_fkey;
ALTER TABLE public.blessing_registrations ADD CONSTRAINT blessing_registrations_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.blessing_events(id) ON DELETE RESTRICT;

NOTIFY pgrst, 'reload schema';

SELECT count(*) AS 祈福筆數, count(*) FILTER (WHERE entries IS NOT NULL) AS 法會筆數
  FROM public.blessing_registrations;
