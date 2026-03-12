-- Migration: 關閉 lamp 兩張表的 RLS
-- 問題：lamp_service_configs / lamp_registrations 有 RLS，導致後台無法更新/刪除
-- 解決：與本專案其他表格一致，關閉 Row Level Security

ALTER TABLE public.lamp_service_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lamp_registrations   DISABLE ROW LEVEL SECURITY;
