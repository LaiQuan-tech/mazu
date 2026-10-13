-- 會員可以讀自己的法會報名
--
-- ── 為什麼需要 ──
-- 普渡那四十幾位信眾填完整張法會表、填了牌位、匯了款，但在網站上等於不存在：
-- 法會報名是 2026-08 為了普渡獨立做的一套流程，`fahui_registrations` 的 SELECT
-- 政策只開給管理員（auth_select_fahui），會員連自己那一筆都讀不到。
-- 於是「報名紀錄」那一頁看不到法會，下次辦法會還是得從頭填一次。
--
-- ── 規則與其他三張表一致，不是新發明的 ──
-- bookings／lamp_registrations／blessing_registrations 現在都是
-- `is_admin() OR phone = my_phone()`，這裡照抄。my_phone() 讀的是登入者自己在
-- member_profiles 填的電話（SECURITY DEFINER），所以會員只看得到自己那支電話的紀錄。
--
-- ── 這件事順便救回舊資料 ──
-- 紀錄是以電話為鍵，所以已經報過名的人不必重填：哪天他用同一支電話註冊會員、
-- 在會員中心填上電話，過去的法會紀錄就會自己出現。
--
-- ── 已知的既有弱點（這次沒有擴大它）──
-- my_phone() 讀的電話是會員自己打的、沒有驗證，所以「知道別人電話的人可以看到
-- 那個人的報名紀錄」這件事本來就成立（四張表皆然）。這次只是讓法會與其他三張
-- 表一致，沒有新增曝險面；要真正關掉得先做手機驗證（簡訊 OTP），那是另一件事。

DROP POLICY IF EXISTS "member_read_own_fahui" ON public.fahui_registrations;
CREATE POLICY "member_read_own_fahui" ON public.fahui_registrations
  FOR SELECT TO authenticated
  USING (public.is_admin() OR (phone IS NOT NULL AND phone = public.my_phone()));
