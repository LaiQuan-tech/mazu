-- Migration: 修復 bookings 表缺欄位 + 關閉 RLS
-- 問題：zodiac / address / contact_label 欄位缺失，且 RLS 封鎖匿名寫入

-- 1. 補缺失欄位
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS zodiac        text,
  ADD COLUMN IF NOT EXISTS address       text,
  ADD COLUMN IF NOT EXISTS contact_label text;

-- 2. 關閉 Row Level Security（與本專案其他表格一致）
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
