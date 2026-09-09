-- 揪團：主揪改為必須登入會員（廟方 2026-09-10 決定）
-- 請在 Supabase Dashboard > SQL Editor 執行此檔案（可重複執行）
--
-- ── 設計 ──
-- 概念與 Uber Eats 揪團一樣：**只有主揪要有帳號**，被揪的人不必登入，
-- 點連結進來選方案、填自己的資料、加入即可。
--   主揪（authenticated）  建立場次、看到全部名單、按下送出
--   被揪的人（anon）        知道 UUID 就能讀這一張、加自己這一筆，如此而已
--
-- ── 為什麼要有 created_by ──
-- 原本場次沒有擁有者欄位，「誰開的」只記在主揪自己瀏覽器的 localStorage。
-- 換一台裝置就找不回未送出的表（廟方回報「整張訂單都不見」）。有了帳號就能
-- 從資料庫查回來，不再依賴瀏覽器。
--
-- ── 順帶修掉一個安全問題 ──
-- mark_shared_session_submitted 原本 anon 也能呼叫：**任何拿到分享連結的人
-- 都可以把整團送出**，主揪還沒收齊就被結單。改成只有主揪本人能送。
-- 舊場次（created_by IS NULL）維持原行為，否則這次改動之前開的表會卡住送不出去。

-- ── 1. 擁有者欄位 ──
ALTER TABLE public.shared_sessions
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 主揪查自己的場次會用到
CREATE INDEX IF NOT EXISTS shared_sessions_created_by_idx
  ON public.shared_sessions (created_by, status);

-- ── 2. 建立場次改為必須登入，且只能掛在自己名下 ──
-- WITH CHECK 而不是只靠前端擋：前端可以繞過，RLS 不行。
DROP POLICY IF EXISTS "anyone_insert_shared_sessions" ON public.shared_sessions;
DROP POLICY IF EXISTS "member_insert_shared_sessions" ON public.shared_sessions;
CREATE POLICY "member_insert_shared_sessions" ON public.shared_sessions
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

-- ── 3. 主揪讀得到自己的場次（列出未送出的用）──
-- 被揪的人仍然只能透過 get_shared_session(uuid) 讀單一張，不能查整表。
DROP POLICY IF EXISTS "owner_select_shared_sessions" ON public.shared_sessions;
CREATE POLICY "owner_select_shared_sessions" ON public.shared_sessions
  FOR SELECT TO authenticated USING (created_by = auth.uid());

-- 加名單維持開放給所有人（被揪的人不登入）——這是揪團的重點，不要動。
--   anyone_insert_shared_session_entries 保持原樣

-- ── 4. 送出改為只有主揪本人 ──
CREATE OR REPLACE FUNCTION public.mark_shared_session_submitted(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE owner_id uuid;
BEGIN
  SELECT created_by INTO owner_id FROM public.shared_sessions WHERE id = p_id;
  -- 舊場次沒有擁有者，維持原本「知道 UUID 即可送出」的行為，否則會卡死送不出去
  IF owner_id IS NOT NULL AND owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION '只有建立這張報名表的人可以送出';
  END IF;
  UPDATE public.shared_sessions SET status = 'submitted' WHERE id = p_id;
END;
$$;

-- ── 5. 主揪的未送出清單（含名單，一次問完）──
-- 用 RPC 而不是讓前端自己 join：前端要的是「每張表有幾個人」，
-- 分兩次查會出現「場次讀到了、名單還沒回來」的中間狀態，卡片上的人數會跳動。
CREATE OR REPLACE FUNCTION public.get_my_shared_sessions()
RETURNS json
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT coalesce(json_agg(x ORDER BY x.created_at DESC), '[]'::json)
  FROM (
    SELECT
      s.*,
      coalesce((
        SELECT json_agg(row_to_json(e) ORDER BY e.created_at)
        FROM public.shared_session_entries e WHERE e.session_id = s.id
      ), '[]'::json) AS entries
    FROM public.shared_sessions s
    WHERE s.created_by = auth.uid()
      AND s.status = 'open'
      AND s.expires_at > now()
  ) x;
$$;

-- 先從 PUBLIC 收回再指定授權。**只寫 REVOKE ... FROM anon 是沒有用的**：
-- Postgres 建立函式時預設就 GRANT EXECUTE TO PUBLIC，anon 是靠 PUBLIC 拿到權限的，
-- 從 anon 收回等於收一個它本來就沒有的直接授權（實測：改前訪客仍叫得動，只是
-- auth.uid() 為 null 所以回空陣列——沒外洩，但與註解不符）。
REVOKE EXECUTE ON FUNCTION public.get_my_shared_sessions() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_shared_sessions() TO authenticated;

-- 確認
SELECT
  (SELECT count(*) FROM public.shared_sessions)                          AS 場次總數,
  (SELECT count(*) FROM public.shared_sessions WHERE created_by IS NULL) AS 無擁有者的舊場次,
  (SELECT count(*) FROM public.shared_sessions WHERE status = 'open')    AS 未送出;
