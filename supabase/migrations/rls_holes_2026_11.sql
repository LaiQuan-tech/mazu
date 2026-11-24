-- 收緊「無條件放行」的 RLS（2026-11-24 盤點發現）
-- RLS 是「任一條通過就放行」：mainsite_rls.sql 建了嚴格的規則，但早期在 Dashboard 手動建的
-- 寬鬆規則沒刪，把嚴格的全部蓋過。這支只刪寬鬆的，不動訪客 INSERT 與公開內容的 SELECT。
-- 先確認每張表的替代規則都在，缺一條就整批不動（避免把後台鎖在外面）。
DO $$
DECLARE r record;
BEGIN
  -- 還沒有管理員就不要動
  IF NOT EXISTS (SELECT 1 FROM public.admin_profiles) THEN RAISE EXCEPTION '沒有管理員資料，不執行'; END IF;

  FOR r IN SELECT * FROM (VALUES
    ('bookings','member_read_own_bookings'),('bookings','admin_write_bookings'),('bookings','admin_delete_bookings'),('bookings','anyone_insert_bookings'),
    ('donations','member_read_own_donations'),('donations','admin_write_donations'),('donations','admin_delete_donations'),('donations','anyone_insert_donations'),
    ('lamp_registrations','member_read_own_lamp_registrations'),('lamp_registrations','admin_write_lamp_registrations'),('lamp_registrations','admin_delete_lamp_registrations'),('lamp_registrations','anyone_insert_lamp_registrations'),
    ('blessing_registrations','member_read_own_blessing_registrations'),('blessing_registrations','admin_write_blessing_registrations'),('blessing_registrations','admin_delete_blessing_registrations'),('blessing_registrations','anyone_insert_blessing_registrations'),
    ('member_profiles','own_all_member_profiles'),('member_profiles','admin_all_member_profiles'),
    ('member_contacts','own_all_member_contacts'),('member_contacts','admin_all_member_contacts'),
    ('bulletin_registrations','admin_all_bulletin_registrations'),('bulletin_registrations','anyone_insert_bulletin_registrations'),
    ('bulletins','admin_all_bulletins'),('bulletins','public_read_bulletins'),
    ('blessing_events','admin_all_blessing_events'),('blessing_events','public_read_blessing_events'),
    ('booking_sessions','admin_all_booking_sessions'),('booking_sessions','public_read_booking_sessions'),
    ('deities','admin_all_deities'),('deities','public_read_deities'),
    ('deity_halls','admin_all_deity_halls'),('deity_halls','public_read_deity_halls'),
    ('hero_slides','admin_all_hero_slides'),('hero_slides','public_read_hero_slides'),
    ('repair_projects','admin_all_repair_projects'),('repair_projects','public_read_repair_projects'),
    ('scripture_verses','admin_all_scripture_verses'),('scripture_verses','public_read_scripture_verses'),
    ('site_images','admin_all_site_images'),('site_images','public_read_site_images')
  ) v(t, p) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=r.t AND policyname=r.p) THEN
      RAISE EXCEPTION '缺少替代規則 %.%，全部不改', r.t, r.p;
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = format('public.%I', r.t)::regclass) THEN
      RAISE EXCEPTION '% 沒有啟用 RLS，全部不改', r.t;
    END IF;
  END LOOP;

  FOR r IN SELECT * FROM (VALUES
    ('bookings','auth_select_bookings'),('bookings','auth_update_bookings'),
    ('donations','auth_select_donations'),('donations','auth_update_donations'),('donations','auth_delete_donations'),
    ('lamp_registrations','auth_select_lamp_registrations'),('lamp_registrations','auth_update_lamp_registrations'),('lamp_registrations','auth_delete_lamp_registrations'),
    ('blessing_registrations','auth_all_blessing_registrations'),
    ('member_profiles','auth_admin_read_all_profiles'),
    ('member_contacts','auth_admin_read_all_contacts'),
    ('bulletin_registrations','Public read'),('bulletin_registrations','Auth manage'),
    ('bulletins','Authenticated users can manage bulletins'),
    ('blessing_events','auth_all_blessing_events'),
    ('booking_sessions','booking_sessions_admin_all'),
    ('deities','Auth write deities'),
    ('deity_halls','deity_halls_manage'),
    ('hero_slides','Auth write'),
    ('repair_projects','repair_projects_manage'),
    ('scripture_verses','Auth write scripture'),
    ('site_images','Auth write site_images')
  ) v(t, p) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.p, r.t);
  END LOOP;

  -- 會員最後登入時間：原本訪客也叫得到，改成只有後台人員有結果
  CREATE OR REPLACE FUNCTION public.get_users_last_login()
  RETURNS TABLE(user_id uuid, last_sign_in_at timestamptz)
  LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
  AS $f$ SELECT id AS user_id, last_sign_in_at FROM auth.users WHERE public.is_admin(); $f$;

  -- 事後斷言：不可以再有無條件的 ALL／UPDATE／DELETE，也不可以有無條件讀個資
  FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
     AND ((cmd IN ('ALL','UPDATE','DELETE') AND (qual = 'true' OR qual LIKE '%''authenticated''%'))
       OR (cmd = 'SELECT' AND qual = 'true' AND tablename IN ('bookings','donations','lamp_registrations',
           'blessing_registrations','fahui_registrations','member_profiles','member_contacts','bulletin_registrations')))
  LOOP
    RAISE EXCEPTION '還有寬鬆規則 %.%，全部不改', r.tablename, r.policyname;
  END LOOP;
END $$;

-- 確認：剩下「不是只靠 is_admin 或本人」的規則。public 的 SELECT true（公開內容）與 INSERT true（報名）是正常的
SELECT schemaname, tablename, policyname, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname IN ('public', 'storage')
   AND coalesce(qual, '') || coalesce(with_check, '') NOT LIKE '%is_admin()%'
 ORDER BY 1, 2, 4;
