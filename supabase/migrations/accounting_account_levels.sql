-- 會計科目改成三層：項目 → 子目 → 明細
-- 2026-10-30。請在 Supabase Dashboard > SQL Editor 執行（可重複執行）
--
-- ── 為什麼 ──
-- 廟方 2026-10-30：「科目要有項目、子目、明細，且可以新增編輯。」
-- 原本是一層扁平的清單，做不出「收入 → 香油 → 油香／點燈」這種分類，
-- 報表也只能逐個科目列、沒辦法彙總。
--
-- ── 為什麼是自我參照而不是三張表 ──
-- 三張表的話，`voucher_items.account_id` 就得知道「指向哪一張表」，變成
-- 跟 `source_table` 一樣的多型外鍵——而那是在收入憑證上**不得已**才用的作法
-- （來源真的是五張不同的表）。科目三層其實是同一種東西的三個層級，
-- 一張表加 `parent_id` 就夠，而且 `voucher_items` 一個欄位都不用改。
--
-- ── `level` 存下來而不是每次往上數 ──
-- 深度是可以從 parent_id 一路數出來的，但那要遞迴查詢，而這張表每次開憑證
-- 都要讀。存一欄整數換掉每一次的遞迴，代價是要靠 CHECK 維持它與 parent_id
-- 一致——下面那條 CHECK 就是在做這件事，不是裝飾。
--
-- ── 刪除用 RESTRICT ──
-- 有子目的項目不能刪，與「被憑證用過的科目不能刪」同一個原則：
-- 父層一消失，子目就變成指向不存在的東西的孤兒。要收起來請用「停用」。

ALTER TABLE public.accounting_accounts
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS level     int NOT NULL DEFAULT 1;

-- 既有資料全部是第一層（項目），parent_id 留 NULL——下面的 CHECK 會通過。
-- **這一條不能省**：level 與 parent_id 是同一件事的兩種寫法，不綁在一起的話
-- 會出現「level=3 但沒有父層」這種對不起來的資料，而且不會有任何地方報錯。
ALTER TABLE public.accounting_accounts
  DROP CONSTRAINT IF EXISTS accounting_accounts_level_chk;
ALTER TABLE public.accounting_accounts
  ADD CONSTRAINT accounting_accounts_level_chk CHECK (
    (level = 1 AND parent_id IS NULL)
    OR (level IN (2, 3) AND parent_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS accounting_accounts_parent_idx
  ON public.accounting_accounts (parent_id);

COMMENT ON COLUMN public.accounting_accounts.level IS
  '1＝項目、2＝子目、3＝明細。與 parent_id 必須一致（見 accounting_accounts_level_chk）。';
COMMENT ON COLUMN public.accounting_accounts.parent_id IS
  '上一層的科目。第一層是 NULL。RESTRICT：有子目的科目不能刪，只能停用。';

-- 驗收：
--   SELECT level, count(*) FROM public.accounting_accounts GROUP BY level ORDER BY level;
-- 跑完當下應該只有 level=1 一列（既有科目全部變成「項目」）。
-- 之後在後台「財務憑證 → 會計科目」新增子目與明細，再查一次會看到 2 與 3。
