-- 只讀查詢（不改任何資料）：找出「稱謂是本人，但姓名跟那支電話的會員姓名不同」的報名。
-- 背景：2026-11-27 會員鍾介凡幫鍾木森點燈，名單上寫「鍾木森 #本人」——第一張卡預設是本人，
-- 會員把姓名改成家人的、稱謂沒改。前台 2026-11-27 起送出前會提醒，這支是找舊資料用的。
-- 來源 admin/ 開頭＝後台「代為報名」。2026-11-28 前那個視窗固定存「本人」，幫家人代報的也一樣，
-- 所以 admin/ 開頭的更要逐筆確認（鍾家三筆就是這樣來的）。之後代為報名可以選稱謂。
SELECT '點燈' AS 類型, r.id, r.name AS 報名姓名, m.name AS 會員姓名, r.phone, r.source, r.created_at
  FROM public.lamp_registrations r JOIN public.member_profiles m ON m.phone = r.phone
 WHERE r.contact_label = '本人' AND replace(r.name, ' ', '') <> replace(m.name, ' ', '')
UNION ALL
SELECT '祈福／法會', r.id, r.name, m.name, r.phone, r.source, r.created_at
  FROM public.blessing_registrations r JOIN public.member_profiles m ON m.phone = r.phone
 WHERE r.contact_label = '本人' AND replace(r.name, ' ', '') <> replace(m.name, ' ', '')
UNION ALL
SELECT '問事', r.id, r.name, m.name, r.phone, r.source, r.created_at
  FROM public.bookings r JOIN public.member_profiles m ON m.phone = r.phone
 WHERE r.contact_label = '本人' AND replace(r.name, ' ', '') <> replace(m.name, ' ', '')
UNION ALL
SELECT '捐獻', r.id, r.name, m.name, r.phone, r.source, r.created_at
  FROM public.donations r JOIN public.member_profiles m ON m.phone = r.phone
 WHERE r.contact_label = '本人' AND replace(r.name, ' ', '') <> replace(m.name, ' ', '')
ORDER BY created_at DESC;
