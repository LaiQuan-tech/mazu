-- 專屬神明燈「每尊神明各自有名額」要用的計數（2026-11-17 廟方：「專屬神明燈，除了需要有神明表單，還要有數量限制」）
--
-- 為什麼要一支函式：前台是 anon，lamp_registrations 的 RLS 不讓 anon 讀（裡面是姓名電話生日），
-- 而前台要知道「天上聖母還剩幾盞」。這支是 SECURITY DEFINER，**只回「選項 → 盞數」**，
-- 不回任何一筆報名的內容，所以開給 anon 不會漏個資。
--
-- 信眾選的神明存在 notes 開頭「【指定神明】天上聖母」（見 services/lampChoice.ts 為什麼不加欄位），
-- 這裡用同一個格式拆出來數。已取消的不算；p_since 由前端傳「這一季從哪天算起」（九月一日，台北時間）。
--
-- 沒跑這支的症狀：前台照樣可以選神明、送得出去，只是不顯示剩幾盞、也不會擋額滿
-- （瀏覽器 console 會印一行指名這個檔案）。在 Supabase 後台 SQL Editor 整段貼上執行即可，可重跑。

CREATE OR REPLACE FUNCTION public.get_lamp_choice_counts(p_service_id text, p_since timestamptz)
RETURNS TABLE (choice text, n bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT btrim(substring(notes FROM '^【[^】]{1,20}】([^\n]*)')) AS choice, count(*) AS n
  FROM public.lamp_registrations
  WHERE service_id::text = p_service_id
    AND created_at >= p_since
    AND coalesce(status, '') <> '已取消'
    AND notes LIKE '【%'
  GROUP BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_lamp_choice_counts(text, timestamptz) TO anon, authenticated;

-- 驗證：應該回一張「神明 → 盞數」的表（還沒有人選過就是空的）
-- SELECT * FROM public.get_lamp_choice_counts('<專屬神明燈的 id>', '2026-09-01T00:00:00+08:00');
