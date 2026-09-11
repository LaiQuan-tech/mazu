-- 揪團：主揪可以主動刪除自己的共享報名表（廟方 2026-09-12 要求）
-- 請在 Supabase Dashboard > SQL Editor 執行此檔案（可重複執行）
--
-- 原本只能等 7 天到期。開錯服務、親友都不填了、或想重開一張，都只能放著。
--
-- ── 只有主揪本人能刪 ──
-- RLS 的 USING 綁 created_by = auth.uid()，被揪的人拿著連結也刪不掉。
-- 名單（shared_session_entries）靠既有的 ON DELETE CASCADE 一起清掉，不必另外處理。
--
-- ── 舊場次刪不掉，這是刻意的 ──
-- 2026-09-10 之前建的場次 created_by 是 NULL，沒有人能通過這條政策。
-- 若放寬成「NULL 也可刪」，任何拿到連結的人都能把別人開的表刪掉。
-- 這種場次最多再活 7 天就過期，不值得為它開一個洞。
DROP POLICY IF EXISTS "owner_delete_shared_sessions" ON public.shared_sessions;
CREATE POLICY "owner_delete_shared_sessions" ON public.shared_sessions
  FOR DELETE TO authenticated USING (created_by = auth.uid());

-- 確認：shared_sessions 現在應有四條政策
--   admin_all / member_insert / owner_select / owner_delete
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'shared_sessions'
ORDER BY policyname;
