-- 訪客與一般會員送出報名時，後台才該填的欄位一律由資料庫決定（2026-11-24）
-- 前台報名不需登入、INSERT 是開放的，懂技術的人可以直接送「已收款」、自填神明的話或建立時間。
-- 做法是「改成正確的值」而不是「擋下來」：正常送出本來就是這些值，不會有人因此報不了名。
-- 後台人員（is_admin）與伺服器（service role）不受影響，代為報名照常。
CREATE OR REPLACE FUNCTION public.guard_public_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE patch jsonb; ev record; fee int; pk jsonb;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_admin() THEN RETURN NEW; END IF;

  -- jsonb_populate_record 只換 patch 裡有、而且這張表真的有的欄位
  patch := jsonb_build_object(
    'status', TG_ARGV[0], 'created_at', now(),
    'confirm_sent_at', NULL, 'payinfo_sent_at', NULL, 'reminder_sent_at', NULL,
    'payment_reminded_at', NULL, 'renew_notified_at', NULL, 'statement_sent_at', NULL, 'expires_at', NULL,
    'divine_message', NULL, 'payment_method', NULL, 'payment_date', NULL, 'thanks_letter', NULL, 'admin_note', NULL,
    'finance_check', false, 'accounting_check', false);
  NEW := jsonb_populate_record(NEW, patch);
  -- 「admin/…」是後台代為報名專用的來源
  IF NEW.source LIKE 'admin/%' THEN NEW.source := 'direct'; END IF;
  IF octet_length(to_jsonb(NEW)::text) > 200000 THEN RAISE EXCEPTION '內容太長'; END IF;

  IF TG_TABLE_NAME = 'donations' THEN
    IF NEW.amount IS NULL OR NEW.amount <= 0 OR NEW.amount > 2000000000 THEN RAISE EXCEPTION '捐款金額不正確'; END IF;
  ELSIF TG_TABLE_NAME = 'blessing_registrations' THEN
    SELECT external_form, packages INTO ev FROM public.blessing_events WHERE id = NEW.event_id;
    -- 法會報名單（entries）只能掛在法會活動，一般報名不能掛進法會活動：否則後台哪一份名單都看不到
    IF (NEW.entries IS NOT NULL) <> (coalesce(ev.external_form, '') = 'fahui') THEN RAISE EXCEPTION '報名方式不正確'; END IF;
    -- 這兩欄要是清單，不是就當沒填（壞的形狀會讓名額統計整支報錯）
    IF jsonb_typeof(NEW.selected_addons) IS DISTINCT FROM 'array' THEN NEW.selected_addons := '[]'::jsonb; END IF;
    IF jsonb_typeof(NEW.claimed_offerings) IS DISTINCT FROM 'array' THEN NEW.claimed_offerings := '[]'::jsonb; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.selected_addons || NEW.claimed_offerings) x
                WHERE jsonb_typeof(x) <> 'object' OR x->>'fee' LIKE '-%') THEN RAISE EXCEPTION '加購金額不正確'; END IF;
    IF NEW.entries IS NOT NULL AND (jsonb_typeof(NEW.entries) <> 'object' OR EXISTS (
         SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(NEW.entries) = 'object' THEN NEW.entries ELSE '{}'::jsonb END) e
          WHERE jsonb_typeof(e.value) <> 'array')) THEN RAISE EXCEPTION '報名內容格式不正確'; END IF;
    IF NEW.entries IS NULL THEN
      NEW.total_amount := NULL; NEW.meal_sponsor := NULL; NEW.zanpu_offering := NULL; NEW.account_last5 := NULL; NEW.line_id := NULL;
      -- 方案費以後台設定為準：先認「名稱與價錢都對」，再認名稱，再認價錢（方案剛改名、或名稱空白），
      -- 都對不到就取最高價——寧可多算讓廟方看到，不可以變成 0 元。沒有設方案的活動留空，用活動的統一費用
      pk := CASE WHEN jsonb_typeof(ev.packages) = 'array' THEN ev.packages ELSE '[]'::jsonb END;
      SELECT x.f INTO fee FROM (
        SELECT p->>'name' AS n, (p->>'fee')::int AS f FROM jsonb_array_elements(pk) p
         WHERE CASE WHEN p->>'fee' ~ '^[0-9]{1,8}$' THEN true ELSE false END) x
       ORDER BY (x.n IS NOT DISTINCT FROM NEW.package_name AND x.f IS NOT DISTINCT FROM NEW.package_fee) DESC,
                (x.n IS NOT DISTINCT FROM NEW.package_name) DESC,
                (x.f IS NOT DISTINCT FROM NEW.package_fee) DESC, x.f DESC LIMIT 1;
      NEW.package_fee := fee;
    ELSIF NEW.total_amount IS NULL OR NEW.total_amount < 0 OR NEW.total_amount > 2000000000 OR coalesce(NEW.meal_sponsor, 0) < 0 THEN
      RAISE EXCEPTION '金額不正確';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE r record; c text;
BEGIN
  SET LOCAL lock_timeout = '5s';
  -- 正式站的結構與預期不同就不裝：裝錯會讓訪客全部送不出報名
  IF NOT has_function_privilege('anon', 'public.is_admin()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') THEN RAISE EXCEPTION 'is_admin 沒有開放執行，不安裝'; END IF;
  FOREACH c IN ARRAY ARRAY['blessing_registrations.entries','blessing_registrations.total_amount','blessing_registrations.meal_sponsor',
      'blessing_registrations.zanpu_offering','blessing_registrations.account_last5','blessing_registrations.line_id',
      'blessing_registrations.package_name','blessing_registrations.package_fee','blessing_registrations.selected_addons',
      'blessing_registrations.claimed_offerings','blessing_registrations.event_id','blessing_events.external_form','blessing_events.packages',
      'donations.amount'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
        AND table_name = split_part(c, '.', 1) AND column_name = split_part(c, '.', 2)) THEN RAISE EXCEPTION '缺少欄位 %，不安裝', c; END IF;
  END LOOP;
  FOR r IN SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND is_nullable = 'NO'
      AND table_name IN ('bookings','lamp_registrations','blessing_registrations','donations','urgent_prayers','volunteer_registrations')
      AND column_name IN ('confirm_sent_at','payinfo_sent_at','reminder_sent_at','payment_reminded_at','renew_notified_at','statement_sent_at',
        'expires_at','divine_message','payment_method','payment_date','thanks_letter','admin_note','total_amount','meal_sponsor',
        'zanpu_offering','account_last5','line_id','package_fee') LOOP
    RAISE EXCEPTION '%.% 是必填，不安裝', r.table_name, r.column_name; END LOOP;
  FOR r IN SELECT conrelid::regclass::text AS t, pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE contype = 'c'
      AND conrelid::regclass::text IN ('bookings','lamp_registrations','blessing_registrations','donations','urgent_prayers','volunteer_registrations')
      AND pg_get_constraintdef(oid) ~ '\mstatus\M' LOOP
    IF strpos(r.d, CASE r.t WHEN 'bookings' THEN '待處理' WHEN 'urgent_prayers' THEN '待處理' WHEN 'volunteer_registrations' THEN 'pending' ELSE '待匯款' END) = 0 THEN
      RAISE EXCEPTION '% 的狀態限制不含初始狀態：%', r.t, r.d; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname <> 'guard_public_insert' AND tgrelid::regclass::text IN
      ('bookings','lamp_registrations','blessing_registrations','donations','urgent_prayers','volunteer_registrations')) THEN
    RAISE EXCEPTION '這幾張表已有其他觸發器，請先確認'; END IF;

  FOR r IN SELECT * FROM (VALUES
    ('bookings', '待處理'), ('lamp_registrations', '待匯款'), ('blessing_registrations', '待匯款'),
    ('donations', '待匯款'), ('urgent_prayers', '待處理'), ('volunteer_registrations', 'pending')) v(t, s)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS guard_public_insert ON public.%I', r.t);
    EXECUTE format('CREATE TRIGGER guard_public_insert BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_public_insert(%L)', r.t, r.s);
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = r.t AND column_name = 'source')
      OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = r.t AND column_name = 'status') THEN
      RAISE EXCEPTION '% 缺少 source 或 status 欄位，全部不改', r.t; END IF;
  END LOOP;
END $$;

SELECT tgrelid::regclass AS 表, pg_get_triggerdef(oid) AS 觸發器 FROM pg_trigger WHERE tgname = 'guard_public_insert' ORDER BY 1;

-- 還原：
-- DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['bookings','lamp_registrations','blessing_registrations','donations','urgent_prayers','volunteer_registrations']
--   LOOP EXECUTE format('DROP TRIGGER IF EXISTS guard_public_insert ON public.%I', t); END LOOP; END $$;
