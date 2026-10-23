-- 遷址護持登記表（2026-10-23 廟方：「遷址捐款，最後面的捐款也要填寫姓名、性別、
-- 出生年月日、地址，還有要哪個捐款方案」）
--
-- /relocation 頁尾本來只有一組匯款帳號，信眾匯了款廟方不知道是誰、要哪個方案。
-- 現在那一頁有自己的登記表，寫進既有的 donations 表（type = '遷址護持'）。
--
-- 為什麼不另開一張表：這就是一筆捐獻，後台的捐獻管理、應收、流量來源、
-- 信眾名冊、感謝信全部已經讀 donations；另開一張等於那六個地方各漏一塊。
-- 作法與「神尊修復」同一套（repair_project_id／repair_project_name）。
--
-- ── 沒跑這一支會怎樣 ──
-- 表單**照樣送得出去**（services/supabase.ts 的 insertOptional 會把資料庫沒有的
-- 選填欄位捨棄再送），但生日與方案會**安靜地掉**——捐款本身收得到，
-- 廟方卻不知道那個人選的是月供養還是單次供養。所以這一支要盡快跑。
-- 送出時瀏覽器的 console 會印一行「資料庫還沒有 … 欄位」，可以用來確認。

alter table public.donations
  -- 全站唯一那一種合併格式：民國72年6月20日（農曆五月初十）
  -- 存文字不存 date：農曆那一段算不回來，而疏文與功德簿要的正是那一段
  add column if not exists birth_date      text,
  -- 方案名與級距存「文字」不存 relocation_plans 的 id：
  -- 方案表在後台改得動（改名、調金額），改了之後歷史紀錄要維持當初登記的樣子。
  -- 同 donations.type 存文字不存 donation_types.id 的理由。
  add column if not exists relocation_plan text,
  -- 級距單獨一欄，廟方才統計得出各級各幾人（例：'600 元'、'隨喜'、'100,000 元以上'）
  add column if not exists relocation_tier text;

comment on column public.donations.birth_date      is '出生年月日（合併格式字串）。遷址護持才收，一般捐獻為 NULL';
comment on column public.donations.relocation_plan is '遷址方案名稱（文字快照，例：每月同行｜月供養）';
comment on column public.donations.relocation_tier is '遷址方案級距（文字快照，例：600 元 / 隨喜）';

-- RLS 不必動：donations 的 INSERT 政策是整列放行給 anon 與 authenticated，
-- 不是逐欄授權，加欄位不會被擋。
