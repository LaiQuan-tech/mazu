-- 緊急還原 rls_holes_2026_11.sql（會把漏洞開回來；只在後台真的不能用時，還原出問題的那幾條）
-- 逐條執行，不要整份跑。刻意不還原：祈福報名 auth_all、公佈欄報名 Public read、deity_halls_manage、
-- repair_projects_manage——那是訪客或所有會員可讀寫，後台都有 admin_all 替代。

CREATE POLICY "auth_select_bookings" ON public.bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update_bookings" ON public.bookings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_select_donations" ON public.donations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update_donations" ON public.donations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_donations" ON public.donations FOR DELETE TO authenticated USING (true);
CREATE POLICY "auth_select_lamp_registrations" ON public.lamp_registrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update_lamp_registrations" ON public.lamp_registrations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_lamp_registrations" ON public.lamp_registrations FOR DELETE TO authenticated USING (true);
CREATE POLICY "auth_admin_read_all_profiles" ON public.member_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_admin_read_all_contacts" ON public.member_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all_blessing_events" ON public.blessing_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "booking_sessions_admin_all" ON public.booking_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth write deities" ON public.deities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth write" ON public.hero_slides FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth write scripture" ON public.scripture_verses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth write site_images" ON public.site_images FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage bulletins" ON public.bulletins FOR ALL TO public USING (auth.role() = 'authenticated');
CREATE POLICY "Auth upload site-images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'site-images');
CREATE POLICY "Auth update site-images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'site-images');
CREATE POLICY "Auth delete site-images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'site-images');
