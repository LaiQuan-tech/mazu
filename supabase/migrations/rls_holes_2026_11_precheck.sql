-- rls_holes_2026_11.sql 執行前檢查（唯讀，不含個資）；結果同時當作現有規則的備份
SELECT jsonb_pretty(jsonb_build_object(
  '全部規則', (SELECT jsonb_agg(concat_ws(' | ', schemaname || '.' || tablename, policyname, permissive, cmd, roles::text, qual, with_check) ORDER BY schemaname, tablename, policyname)
     FROM pg_policies WHERE schemaname IN ('public', 'storage')),
  'RLS沒開的表', (SELECT jsonb_agg(relname) FROM pg_class
     WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND NOT relrowsecurity),
  '觸發器', (SELECT jsonb_agg(t.tgrelid::regclass::text || ' ' || t.tgname || ' ' || p.proname || CASE WHEN p.prosecdef THEN ' definer' ELSE ' invoker' END)
     FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid JOIN pg_class c ON c.oid = t.tgrelid
    WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace),
  '編號欄位', (SELECT jsonb_agg(concat_ws(' ', table_name, column_name, column_default, 'identity=' || is_identity))
     FROM information_schema.columns WHERE table_schema = 'public' AND column_name IN ('member_number', 'contact_number')),
  '登入時間函式', (SELECT jsonb_agg(pg_get_functiondef(oid)) FROM pg_proc WHERE proname = 'get_users_last_login' AND pronamespace = 'public'::regnamespace),
  '訪客可執行的definer函式', (SELECT jsonb_agg(oid::regprocedure::text) FROM pg_proc
     WHERE pronamespace = 'public'::regnamespace AND prosecdef AND has_function_privilege('anon', oid, 'EXECUTE')),
  '視圖', (SELECT jsonb_agg(relname || ' ' || coalesce(reloptions::text, '')) FROM pg_class
     WHERE relnamespace = 'public'::regnamespace AND relkind IN ('v', 'm')),
  '儲存桶', (SELECT jsonb_agg(id || ' public=' || public) FROM storage.buckets)
)) AS 檢查結果;
