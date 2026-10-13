-- 報名表加選填的電子信箱，給「廟方確認後寄確認信」用
--
-- ── 為什麼需要 ──
-- 廟方 2026-10-13：「報名經後台管理人員確認後，應該要發一個報名完成的確認信。」
-- 但查下去發現**只有法會表收了 email**，問事／點燈／祈福／捐獻四種只收電話，
-- 所以根本沒有地址可寄。這幾欄就是補那件事。
--
-- **捐獻那一封不是確認信而是感謝信，而且不等廟方確認**（廟方 2026-10-13：
-- 「捐獻，直接寄感謝信」）。理由：捐獻沒有「已確認」這個狀態，後台那一頁
-- 只是一份紀錄清單，沒有任何動作可以觸發；而捐款人要的本來也不是「我們確認了」，
-- 是一句謝謝。所以它走送出當下那條路（見 api/notify-confirm.ts 的公開模式）。
--
-- ── 為什麼是選填 ──
-- 本站信眾以長者居多，表單每多一個必填欄位就多一個放棄的理由。
-- 沒填也沒關係：寄信時會拿電話回頭對 member_profiles，
-- 如果這個人是用信箱註冊的會員，就寄到那個帳號的信箱（見 api/notify-confirm.ts）。
--
-- ── 刻意不加 CHECK 或 NOT NULL ──
-- 這是報名的送出路徑。任何擋得下來的限制，擋到的那一刻就是一筆報名失敗，
-- 而一個打錯的信箱遠比掉一筆報名輕微。格式由前端的 type="email" 擋一層就好。
-- （同 utm_source_column.sql 裡 source 欄位的理由。）

ALTER TABLE public.bookings               ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.lamp_registrations     ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.blessing_registrations ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.donations              ADD COLUMN IF NOT EXISTS email text;

-- ── 寄給信眾的那封信寄出的時間戳：防止重複寄送 ──
-- 廟方在後台改狀態是一顆下拉選單，狀態會被改來改去（按錯、改回、再改過來），
-- 而「已確認」每出現一次就寄一封信的話，信眾會收到一疊一模一樣的信。
-- 捐獻的感謝信雖然是送出當下寄的，一樣要擋：重送同一批 id 不該再來一封。
-- 這一欄就是「這筆已經寄過了」，寄之前先看它、寄完就蓋章。
-- **不是另外開一張寄送紀錄表**：要回答的只有一個是非題，而且它與那筆報名
-- 同生共死（報名刪了紀錄也沒有意義），放在同一列最不會對不起來。
--
-- 法會也要：它的「標記已收款」就是廟方確認那筆報名完成的那一刻
-- （`fahui_registrations` 本來就有 email 欄位，是五種報名裡唯一有的）。
ALTER TABLE public.bookings               ADD COLUMN IF NOT EXISTS confirm_sent_at timestamptz;
ALTER TABLE public.lamp_registrations     ADD COLUMN IF NOT EXISTS confirm_sent_at timestamptz;
ALTER TABLE public.blessing_registrations ADD COLUMN IF NOT EXISTS confirm_sent_at timestamptz;
ALTER TABLE public.donations              ADD COLUMN IF NOT EXISTS confirm_sent_at timestamptz;
ALTER TABLE public.fahui_registrations    ADD COLUMN IF NOT EXISTS confirm_sent_at timestamptz;

SELECT 'registration_email.sql 已套用' AS ok;
