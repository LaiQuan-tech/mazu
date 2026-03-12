-- Migration: 共享報名表（揪團功能）
-- 請在 Supabase Dashboard > SQL Editor 執行此檔案

CREATE TABLE IF NOT EXISTS public.shared_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL,   -- 'lamp' | 'blessing' | 'booking'
  config       jsonb NOT NULL DEFAULT '{}',
  notes        text,
  status       text NOT NULL DEFAULT 'open',   -- 'open' | 'submitted'
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE TABLE IF NOT EXISTS public.shared_session_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES public.shared_sessions(id) ON DELETE CASCADE,
  name          text NOT NULL,
  phone         text,
  birth_date    text,
  zodiac        text,
  gender        text,
  address       text,
  contact_label text,
  service_id    text,        -- lamp only：燈種 ID
  package_id    text,        -- blessing only：方案 ID
  booking_type  text,        -- booking only：ConsultationType value
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
