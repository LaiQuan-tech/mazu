-- 法會供品名額：替 blessing_events 加 offerings 欄位
ALTER TABLE blessing_events
  ADD COLUMN IF NOT EXISTS offerings jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 報名者認領供品：替 blessing_registrations 加 claimed_offerings 欄位
ALTER TABLE blessing_registrations
  ADD COLUMN IF NOT EXISTS claimed_offerings jsonb NOT NULL DEFAULT '[]'::jsonb;
