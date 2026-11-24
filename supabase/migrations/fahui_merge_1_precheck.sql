-- 法會併入祈福：搬移前盤點（唯讀，不改任何東西、不輸出姓名電話等個資）
SELECT jsonb_pretty(jsonb_build_object(
  '法會_筆數與金額', (SELECT jsonb_agg(x) FROM (
     SELECT status, count(*) AS n, sum(total_amount) AS amount,
            min(created_at)::date AS first, max(created_at)::date AS last,
            count(*) FILTER (WHERE total_amount IS NULL) AS no_amount
       FROM public.fahui_registrations GROUP BY status) x),
  '法會_對帳欄位', (SELECT jsonb_agg(x) FROM (
     SELECT to_jsonb(f)->>'payment_method' AS method, count(*) AS n,
            count(to_jsonb(f)->>'account_last5') AS last5,
            count(to_jsonb(f)->>'confirm_sent_at') AS confirm_sent
       FROM public.fahui_registrations f GROUP BY 1) x),
  '祈福_各活動', (SELECT jsonb_agg(x) FROM (
     SELECT e.id, e.title, e.start_date, e.is_active, to_jsonb(e)->>'external_form' AS form,
            (SELECT count(*) FROM public.blessing_registrations r WHERE r.event_id = e.id) AS regs
       FROM public.blessing_events e ORDER BY e.start_date) x),
  '祈福_狀態', (SELECT jsonb_object_agg(coalesce(status, '(空)'), n) FROM (
     SELECT status, count(*) AS n FROM public.blessing_registrations GROUP BY status) x),
  'id_重複', (SELECT count(*) FROM public.fahui_registrations f
     JOIN public.blessing_registrations b ON b.id = f.id),
  '收據指向法會', CASE WHEN to_regclass('public.receipt_items') IS NULL THEN '無此表' ELSE
     (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.receipt_items where source_table = ''fahui_registrations''', false, true, '')))[1]::text END,
  '憑證指向法會', CASE WHEN to_regclass('public.voucher_items') IS NULL THEN '無此表' ELSE
     (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.voucher_items where source_table = ''fahui_registrations''', false, true, '')))[1]::text END,
  '欄位', (SELECT jsonb_object_agg(table_name, cols) FROM (
     SELECT table_name, jsonb_agg(column_name || ' ' || udt_name
              || CASE WHEN is_nullable = 'NO' THEN ' 必填' ELSE '' END
              || coalesce(' =' || column_default, '') ORDER BY ordinal_position) AS cols
       FROM information_schema.columns WHERE table_schema = 'public'
        AND table_name IN ('fahui_registrations', 'blessing_registrations', 'blessing_events')
      GROUP BY table_name) x),
  '限制', (SELECT jsonb_agg(conrelid::regclass::text || ': ' || conname || ' ' || pg_get_constraintdef(oid))
     FROM pg_constraint WHERE conrelid IN ('public.fahui_registrations'::regclass, 'public.blessing_registrations'::regclass)
        OR confrelid IN ('public.fahui_registrations'::regclass, 'public.blessing_registrations'::regclass)
        OR (conrelid IN (to_regclass('public.receipt_items'), to_regclass('public.voucher_items'))
            AND pg_get_constraintdef(oid) LIKE '%fahui%')),
  '權限', (SELECT jsonb_agg(tablename || ': ' || policyname || ' ' || cmd || ' ' || roles::text
              || coalesce(' USING ' || qual, '') || coalesce(' CHECK ' || with_check, ''))
     FROM pg_policies WHERE schemaname = 'public'
      AND tablename IN ('fahui_registrations', 'blessing_registrations')),
  '觸發器', (SELECT jsonb_agg(pg_get_triggerdef(oid)) FROM pg_trigger WHERE NOT tgisinternal
      AND tgrelid IN ('public.fahui_registrations'::regclass, 'public.blessing_registrations'::regclass)),
  '用到的函式', (SELECT jsonb_agg(p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prokind = 'f'
       AND (p.prosrc ILIKE '%fahui_registrations%' OR p.prosrc ILIKE '%blessing_registrations%'))
)) AS 盤點結果;
