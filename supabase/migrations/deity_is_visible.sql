-- Migration: 神明管理新增隱藏功能
-- 請在 Supabase Dashboard > SQL Editor 執行此檔案

ALTER TABLE public.deities
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;
