-- 接在 rls_holes_2026_11.sql 之後執行（分開跑：storage 的權限若不足，不會連累主要的修補）
DO $$
BEGIN
  -- 網站圖片：原本任何登入會員都能上傳、覆蓋、刪除，收成只有後台人員。公開讀取不動
  DROP POLICY IF EXISTS "Auth upload site-images" ON storage.objects;
  DROP POLICY IF EXISTS "Auth update site-images" ON storage.objects;
  DROP POLICY IF EXISTS "Auth delete site-images" ON storage.objects;
  DROP POLICY IF EXISTS "admin_insert_site_images" ON storage.objects;
  DROP POLICY IF EXISTS "admin_update_site_images" ON storage.objects;
  DROP POLICY IF EXISTS "admin_delete_site_images" ON storage.objects;
  CREATE POLICY "admin_insert_site_images" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'site-images' AND public.is_admin());
  CREATE POLICY "admin_update_site_images" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'site-images' AND public.is_admin()) WITH CHECK (bucket_id = 'site-images' AND public.is_admin());
  CREATE POLICY "admin_delete_site_images" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'site-images' AND public.is_admin());
END $$;

SELECT policyname, cmd, roles::text, qual, with_check FROM pg_policies
 WHERE schemaname = 'storage' ORDER BY policyname;
