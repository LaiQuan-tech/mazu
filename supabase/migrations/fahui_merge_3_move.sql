-- 法會併入祈福 第 3 步：搬移（程式已部署之後才可以跑）。任何一項對不上就整批不動。
DO $$
DECLARE
  pol text; ev uuid; m0 bigint; am0 bigint; n0 bigint; a0 bigint; n1 bigint; a1 bigint; b0 bigint; bad bigint; rc bigint;
BEGIN
  IF to_regclass('public.fahui_registrations') IS NULL THEN RAISE EXCEPTION '找不到 fahui_registrations（已經搬過了？）'; END IF;
  LOCK TABLE public.fahui_registrations IN ACCESS EXCLUSIVE MODE;
  LOCK TABLE public.blessing_registrations IN SHARE ROW EXCLUSIVE MODE;

  SELECT id INTO STRICT ev FROM public.blessing_events
   WHERE title = '太上慈悲普渡禮懺法會' AND external_form = 'fahui';
  SELECT count(*), coalesce(sum(total_amount), 0) INTO n0, a0 FROM public.fahui_registrations;
  SELECT count(*) INTO b0 FROM public.blessing_registrations WHERE entries IS NULL;
  -- 部署後、搬移前可能已經有新的法會報名直接寫進祈福表：保留，搬完一起核對
  SELECT count(*), coalesce(sum(total_amount), 0) INTO m0, am0 FROM public.blessing_registrations WHERE entries IS NOT NULL;
  IF EXISTS (SELECT 1 FROM public.fahui_registrations f JOIN public.blessing_registrations b ON b.id = f.id) THEN
    RAISE EXCEPTION '有相同 id，請先確認'; END IF;
  -- 權限：個資要搬進來，這張表不可以有寬鬆規則（RLS 是任一條通過就放行）
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.blessing_registrations'::regclass) THEN
    RAISE EXCEPTION '祈福報名表沒有開 RLS'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blessing_registrations'
      AND cmd <> 'INSERT' AND coalesce(qual, 'true') NOT LIKE '%is_admin()%') THEN
    RAISE EXCEPTION '祈福報名表還有寬鬆的權限規則'; END IF;
  -- 刪活動不可以連帶刪報名
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE contype = 'f' AND conrelid = 'public.blessing_registrations'::regclass
      AND confrelid = 'public.blessing_events'::regclass AND confdeltype <> 'r') THEN
    RAISE EXCEPTION '外鍵還是連帶刪除，請先跑 fahui_merge_2_columns.sql'; END IF;
  SELECT count(*) INTO bad FROM public.fahui_registrations WHERE status NOT IN ('pending', 'paid');
  IF bad > 0 THEN RAISE EXCEPTION '有 % 筆狀態不是 pending／paid', bad; END IF;

  INSERT INTO public.blessing_registrations
    (id, event_id, created_at, name, phone, address, birth_date, zodiac, gender, notes, status,
     source, email, confirm_sent_at, payment_reminded_at,
     entries, line_id, zanpu_offering, meal_sponsor, total_amount, payment_method, payment_date,
     account_last5, finance_check, thanks_letter, accounting_check, admin_note, contact_label)
  SELECT id, ev, created_at, name, phone, address, contact_birth_date, contact_zodiac, contact_gender, notes,
     CASE status WHEN 'paid' THEN '已收款' ELSE '待匯款' END,
     source, email, confirm_sent_at, payment_reminded_at,
     entries, line_id, zanpu_offering, meal_sponsor, total_amount, payment_method, payment_date,
     account_last5, finance_check, thanks_letter, accounting_check, admin_note, '本人'
    FROM public.fahui_registrations;

  SELECT count(*), coalesce(sum(total_amount), 0) INTO n1, a1 FROM public.blessing_registrations WHERE entries IS NOT NULL;
  IF n0 + m0 <> n1 OR a0 + am0 <> a1 THEN RAISE EXCEPTION '筆數或金額不符：應為 % 筆 % 元，實際 % 筆 % 元', n0 + m0, a0 + am0, n1, a1; END IF;
  IF b0 <> (SELECT count(*) FROM public.blessing_registrations WHERE entries IS NULL) THEN
    RAISE EXCEPTION '原有祈福筆數變了'; END IF;

  -- 逐筆逐欄
  SELECT count(*) INTO bad FROM public.fahui_registrations f
    LEFT JOIN public.blessing_registrations b ON b.id = f.id
   WHERE (f.created_at, f.name, f.phone, f.address, f.contact_birth_date, f.contact_zodiac, f.contact_gender, f.notes,
          CASE f.status WHEN 'paid' THEN '已收款' ELSE '待匯款' END, f.source, f.email, f.confirm_sent_at, f.payment_reminded_at,
          f.entries, f.line_id, f.zanpu_offering, f.meal_sponsor, f.total_amount, f.payment_method, f.payment_date,
          f.account_last5, f.finance_check, f.thanks_letter, f.accounting_check, f.admin_note)
     IS DISTINCT FROM
         (b.created_at, b.name, b.phone, b.address, b.birth_date, b.zodiac, b.gender, b.notes,
          b.status, b.source, b.email, b.confirm_sent_at, b.payment_reminded_at,
          b.entries, b.line_id, b.zanpu_offering, b.meal_sponsor, b.total_amount, b.payment_method, b.payment_date,
          b.account_last5, b.finance_check, b.thanks_letter, b.accounting_check, b.admin_note);
  IF bad > 0 THEN RAISE EXCEPTION '有 % 筆內容不符', bad; END IF;

  -- 收據、憑證改指新表（id 不變）
  UPDATE public.receipt_items SET source_table = 'blessing_registrations' WHERE source_table = 'fahui_registrations';
  GET DIAGNOSTICS rc = ROW_COUNT;
  UPDATE public.voucher_items SET source_table = 'blessing_registrations' WHERE source_table = 'fahui_registrations';
  SELECT count(*) INTO bad FROM public.receipt_items i WHERE i.source_table = 'blessing_registrations'
     AND NOT EXISTS (SELECT 1 FROM public.blessing_registrations b WHERE b.id = i.source_id);
  RAISE NOTICE '收據改指 % 筆；指向不存在報名的收據明細 % 筆', rc, bad;

  -- 舊表改名保留、收掉前台與會員的權限：新程式讀不到它就不會重複，也不會有人寫進去
  ALTER TABLE public.fahui_registrations RENAME TO fahui_registrations_backup_20261124;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fahui_registrations_backup_20261124' LOOP
    EXECUTE format('DROP POLICY %I ON public.fahui_registrations_backup_20261124', pol);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT e.title, r.status, count(*) AS 筆數, sum(r.total_amount) AS 金額,
       (SELECT count(*) FROM public.fahui_registrations_backup_20261124) AS 備份筆數,
       (SELECT sum(total_amount) FROM public.fahui_registrations_backup_20261124) AS 備份金額,
       (SELECT count(*) FROM public.receipt_items WHERE source_table = 'fahui_registrations') AS 收據仍指舊表
  FROM public.blessing_registrations r JOIN public.blessing_events e ON e.id = r.event_id
 WHERE r.entries IS NOT NULL GROUP BY 1, 2;
