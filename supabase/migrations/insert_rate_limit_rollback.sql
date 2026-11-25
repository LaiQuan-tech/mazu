-- 還原限流（會失去防灌報名的保護，報名資料不受影響）
DO $$ DECLARE t text; BEGIN
  SET LOCAL lock_timeout = '5s';
  FOREACH t IN ARRAY ARRAY['bookings','lamp_registrations','blessing_registrations','donations','urgent_prayers',
      'volunteer_registrations','shared_session_entries','bulletin_registrations'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS guard_insert_rate ON public.%I', t);
  END LOOP;
  DROP FUNCTION IF EXISTS public.guard_insert_rate();
  DROP FUNCTION IF EXISTS public.tmp_ip_probe();
  DROP TABLE IF EXISTS public.insert_rate;
END $$;
SELECT count(*) AS 應為0 FROM pg_trigger WHERE tgname = 'guard_insert_rate';
