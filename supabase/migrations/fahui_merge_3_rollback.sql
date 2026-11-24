-- 還原 fahui_merge_3_move.sql。搬移後新增／修改的法會報名會一起寫回舊表，不會遺失（「已取消」會變回待繳）
-- 順序：請後台人員先停用 → 跑這支 → 立刻把程式退回搬移前的版本；中間不要操作後台、不要收新報名。
-- 只跑這支、不退程式也能用（新程式兩邊都讀）。
DO $$
DECLARE n bigint; a bigint; n2 bigint; a2 bigint;
BEGIN
  LOCK TABLE public.blessing_registrations IN SHARE ROW EXCLUSIVE MODE;
  ALTER TABLE public.fahui_registrations_backup_20261124 RENAME TO fahui_registrations;
  SELECT count(*), coalesce(sum(total_amount), 0) INTO n, a FROM public.blessing_registrations WHERE entries IS NOT NULL;
  DELETE FROM public.fahui_registrations;
  INSERT INTO public.fahui_registrations
    (id, created_at, name, phone, address, line_id, entries, zanpu_offering, meal_sponsor, notes, total_amount, status,
     contact_birth_date, contact_zodiac, contact_gender, payment_method, payment_date, account_last5, finance_check,
     thanks_letter, accounting_check, admin_note, email, source, confirm_sent_at, payment_reminded_at)
  SELECT id, created_at, name, phone, coalesce(address, ''), line_id, entries, zanpu_offering, coalesce(meal_sponsor, 0), notes, total_amount,
     CASE status WHEN '已收款' THEN 'paid' ELSE 'pending' END,
     birth_date, zodiac, gender, payment_method, payment_date, account_last5, finance_check,
     thanks_letter, accounting_check, admin_note, email, source, confirm_sent_at, payment_reminded_at
    FROM public.blessing_registrations WHERE entries IS NOT NULL;
  SELECT count(*), coalesce(sum(total_amount), 0) INTO n2, a2 FROM public.fahui_registrations;
  IF n <> n2 OR a <> a2 THEN RAISE EXCEPTION '還原筆數或金額不符'; END IF;
  UPDATE public.receipt_items i SET source_table = 'fahui_registrations' WHERE source_table = 'blessing_registrations'
     AND EXISTS (SELECT 1 FROM public.fahui_registrations f WHERE f.id = i.source_id);
  UPDATE public.voucher_items i SET source_table = 'fahui_registrations' WHERE source_table = 'blessing_registrations'
     AND EXISTS (SELECT 1 FROM public.fahui_registrations f WHERE f.id = i.source_id);
  DELETE FROM public.blessing_registrations WHERE entries IS NOT NULL;

  CREATE POLICY "anon_insert_fahui" ON public.fahui_registrations FOR INSERT TO anon, authenticated WITH CHECK (true);
  CREATE POLICY "auth_select_fahui" ON public.fahui_registrations FOR SELECT TO authenticated USING (public.is_admin());
  CREATE POLICY "auth_update_fahui" ON public.fahui_registrations FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  CREATE POLICY "auth_delete_fahui" ON public.fahui_registrations FOR DELETE TO authenticated USING (public.is_admin());
  CREATE POLICY "member_read_own_fahui" ON public.fahui_registrations FOR SELECT TO authenticated
    USING (public.is_admin() OR (phone IS NOT NULL AND phone = public.my_phone()));
END $$;
NOTIFY pgrst, 'reload schema';
