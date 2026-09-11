-- 揪團紀錄：會員中心要看得到自己開過的每一張共享報名表（廟方 2026-09-12：「紀錄很重要」）
-- 請在 Supabase Dashboard > SQL Editor 執行此檔案（可重複執行）
--
-- ── 為什麼另開一支，不改 get_my_shared_sessions ──
-- 那支是給服務頁「您有 N 張還沒送出」的提示卡用的，刻意只回 open 且未過期的——
-- 提示卡要的是「現在還能動的」。紀錄要的是「全部」：已送出的要留著看名單，
-- 過期沒送的也要列出來讓主揪知道那團沒成。兩者語意不同，硬併成一支加參數會讓
-- 呼叫端各自傳旗標，反而容易傳錯。
--
-- ── 為什麼揪團的紀錄不能只靠報名紀錄 ──
-- 會員中心的報名紀錄是拿「電話相同」去撈 lamp_registrations 等表。揪團送出時，
-- 親友填了自己的電話，那筆就掛親友的電話，主揪的紀錄裡看不到；沒填才退回主揪的。
-- 同一團有的看得到、有的看不到。這支直接回場次＋名單（shared_session_entries 在
-- 送出後仍保留，只是場次 status 變 submitted），主揪看到的是完整的一團。
CREATE OR REPLACE FUNCTION public.get_my_shared_history()
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
  ) x;
$$;

-- 同 get_my_shared_sessions：先從 PUBLIC 收回再指定授權，只 REVOKE FROM anon 是沒用的
REVOKE EXECUTE ON FUNCTION public.get_my_shared_history() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_shared_history() TO authenticated;

-- 確認（登入狀態下執行才有東西；SQL Editor 是 postgres 角色，auth.uid() 為 null 會回 []）
SELECT public.get_my_shared_history();
