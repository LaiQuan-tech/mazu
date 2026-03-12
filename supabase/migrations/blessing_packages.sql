-- Migration: 祈福法會多方案功能
-- 請在 Supabase Dashboard > SQL Editor 執行此檔案

-- 1. 在 blessing_events 增加 packages JSONB 欄位
ALTER TABLE public.blessing_events
  ADD COLUMN IF NOT EXISTS packages jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. 在 blessing_registrations 增加方案欄位
ALTER TABLE public.blessing_registrations
  ADD COLUMN IF NOT EXISTS package_name text,
  ADD COLUMN IF NOT EXISTS package_fee  integer;
