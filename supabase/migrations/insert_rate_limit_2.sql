-- 防灌假報名 第 2 步：同一網路來源限流。2026-11-26 已執行；實測 cf-connecting-ip 由外部偽造會被 Cloudflare 擋下（x-forwarded-for 可偽造，不可用）。
-- 每個來源 10 分鐘 120 筆、一天 200 筆（八張表合計）。揪團 50 人由同一人登記再送出共 100 筆，不會碰到。
-- 不存 IP 原文，只存每天換一次的雜湊，兩天後自動清掉。拿不到來源或計數出錯一律放行：寧可漏擋，不可擋掉真的信眾。
DO $$
DECLARE t text;
BEGIN
  SET LOCAL lock_timeout = '5s';
  FOREACH t IN ARRAY ARRAY['bookings','lamp_registrations','blessing_registrations','donations','urgent_prayers',
      'volunteer_registrations','shared_session_entries','bulletin_registrations'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN RAISE EXCEPTION '找不到 %，全部不改', t; END IF;
  END LOOP;

  CREATE TABLE IF NOT EXISTS public.insert_rate (key text NOT NULL, bucket timestamptz NOT NULL, n int NOT NULL DEFAULT 0, PRIMARY KEY (key, bucket));
  ALTER TABLE public.insert_rate ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.insert_rate FROM PUBLIC, anon, authenticated;
  CREATE INDEX IF NOT EXISTS insert_rate_bucket ON public.insert_rate (bucket);

  EXECUTE $f$
  CREATE OR REPLACE FUNCTION public.guard_insert_rate() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
  DECLARE ip inet; h text; n10 int := 0; nday int := 0; day0 timestamptz;
  BEGIN
    -- 後台人員、伺服器、SQL Editor 不限
    IF coalesce(current_setting('role', true), '') NOT IN ('anon', 'authenticated') THEN RETURN NEW; END IF;
    BEGIN
      IF public.is_admin() THEN RETURN NEW; END IF;
      ip := nullif(current_setting('request.headers', true)::json->>'cf-connecting-ip', '')::inet;
      IF ip IS NULL THEN RETURN NEW; END IF;
      IF family(ip) = 6 THEN ip := network(set_masklen(ip, 64)); END IF;
      day0 := date_trunc('day', now());
      h := encode(sha256(convert_to(ip::text || day0::text || 'insert_rate', 'UTF8')), 'hex');
      INSERT INTO public.insert_rate AS r (key, bucket, n)
        VALUES ('m' || h, to_timestamp(floor(extract(epoch FROM now()) / 600) * 600), 1)
        ON CONFLICT (key, bucket) DO UPDATE SET n = r.n + 1 RETURNING n INTO n10;
      INSERT INTO public.insert_rate AS r (key, bucket, n) VALUES ('d' || h, day0, 1)
        ON CONFLICT (key, bucket) DO UPDATE SET n = r.n + 1 RETURNING n INTO nday;
      IF nday = 1 THEN
        DELETE FROM public.insert_rate WHERE ctid IN (SELECT ctid FROM public.insert_rate
          WHERE bucket < now() - interval '2 days' LIMIT 200 FOR UPDATE SKIP LOCKED);
      END IF;
    EXCEPTION WHEN OTHERS THEN RETURN NEW;
    END;
    IF n10 > 120 OR nday > 200 THEN
      RAISE EXCEPTION '短時間內送出太多筆，請稍後再試或與本壇聯繫' USING ERRCODE = 'P0001', HINT = 'rate_limit';
    END IF;
    RETURN NEW;
  END $fn$ $f$;
  REVOKE EXECUTE ON FUNCTION public.guard_insert_rate() FROM PUBLIC, anon, authenticated;

  FOREACH t IN ARRAY ARRAY['bookings','lamp_registrations','blessing_registrations','donations','urgent_prayers',
      'volunteer_registrations','shared_session_entries','bulletin_registrations'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS guard_insert_rate ON public.%I', t);
    EXECUTE format('CREATE TRIGGER guard_insert_rate BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_insert_rate()', t);
  END LOOP;
  DROP FUNCTION IF EXISTS public.tmp_ip_probe();
END $$;
NOTIFY pgrst, 'reload schema';

SELECT count(*) AS 應為8, (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.insert_rate'::regclass) AS 應為true,
  has_table_privilege('anon', 'public.insert_rate', 'SELECT') AS 應為false FROM pg_trigger WHERE tgname = 'guard_insert_rate';
