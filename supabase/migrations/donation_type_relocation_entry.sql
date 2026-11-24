-- 隨喜捐獻的類別「廟宇維護/修繕」改名「護持遷址」（廟方 2026-11-24）。
-- **程式要先部署**（選了會導到遷址募款頁），否則信眾會照一般帳戶匯遷址的錢。
-- 只改類別名稱，過去的捐款紀錄（donations.type）不動。
UPDATE public.donation_types SET name = '護持遷址', updated_at = NOW()
 WHERE name = '廟宇維護/修繕';

SELECT sort_order, name, is_visible FROM public.donation_types ORDER BY sort_order;

-- 還原（程式退回 2026-11-24 之前的版本時一定要先跑，否則舊程式會用一般帳戶收遷址的錢）：
-- UPDATE public.donation_types SET name = '廟宇維護/修繕' WHERE name = '護持遷址';
