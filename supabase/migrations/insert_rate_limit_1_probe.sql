-- 防灌假報名 第 1 步：盤點＋暫時的探測函式（不改任何報名表）。2026-11-26 已執行
-- 探測函式只回「有沒有這個標頭、是不是同一個位址」，不回位址本身；第 2 步會刪掉它。
CREATE OR REPLACE FUNCTION public.tmp_ip_probe() RETURNS jsonb
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'has_cf', h ? 'cf-connecting-ip',
    'has_xff', h ? 'x-forwarded-for',
    'xff_count', coalesce(array_length(string_to_array(h->>'x-forwarded-for', ','), 1), 0),
    'cf_is_first', trim(split_part(h->>'x-forwarded-for', ',', 1)) = h->>'cf-connecting-ip',
    'cf_is_test', h->>'cf-connecting-ip' = '203.0.113.7',
    'xff_first_is_test', trim(split_part(h->>'x-forwarded-for', ',', 1)) = '203.0.113.7',
    'role', current_setting('role', true))
  FROM (SELECT coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb AS h) x
$$;
REVOKE EXECUTE ON FUNCTION public.tmp_ip_probe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tmp_ip_probe() TO anon;
NOTIFY pgrst, 'reload schema';

-- 盤點：現有觸發器，以及過去 90 天單一電話／單一小時最多幾筆（只有數字，沒有個資）
WITH a AS (
  SELECT 'bookings' t, phone, created_at FROM public.bookings UNION ALL
  SELECT 'lamp_registrations', phone, created_at FROM public.lamp_registrations UNION ALL
  SELECT 'blessing_registrations', phone, created_at FROM public.blessing_registrations UNION ALL
  SELECT 'donations', phone, created_at FROM public.donations UNION ALL
  SELECT 'urgent_prayers', phone, created_at FROM public.urgent_prayers UNION ALL
  SELECT 'volunteer_registrations', phone, created_at FROM public.volunteer_registrations)
SELECT '觸發器' AS 項目, string_agg(tgrelid::regclass || ':' || tgname, '、' ORDER BY 1) AS 值 FROM pg_trigger
 WHERE NOT tgisinternal AND tgrelid::regclass::text IN ('bookings','lamp_registrations','blessing_registrations','donations',
   'urgent_prayers','volunteer_registrations','shared_session_entries','bulletin_registrations')
UNION ALL SELECT '全部表存在', (SELECT count(*)::text FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname IN
  ('bookings','lamp_registrations','blessing_registrations','donations','urgent_prayers','volunteer_registrations','shared_session_entries','bulletin_registrations'))
UNION ALL SELECT '單一小時全站最多', (SELECT max(n)::text FROM (SELECT count(*) n FROM a GROUP BY date_trunc('hour', created_at)) x)
UNION ALL SELECT '單一電話10分鐘最多', (SELECT max(n)::text FROM (SELECT count(*) n FROM a WHERE phone <> '' GROUP BY phone, floor(extract(epoch FROM created_at) / 600)) x)
UNION ALL SELECT '單一電話一天最多', (SELECT max(n)::text FROM (SELECT count(*) n FROM a WHERE phone <> '' GROUP BY phone, created_at::date) x);
