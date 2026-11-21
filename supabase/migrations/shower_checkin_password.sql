-- 沐浴車打卡加一組共用密碼（廟方 2026-11-21：「可以簡單做一個密碼輸入嗎？不需要做到會員帳號密碼」）
-- 請在 Supabase Dashboard > SQL Editor 執行此檔案（可重複執行）
--
-- ── 為什麼是一組共用密碼，不是帳號 ──
-- 2026-10-08 拿掉每台車一把鑰匙，是因為「志工開了就能按」最重要；那個前提沒變。
-- 一組密碼是兩者之間的點：廟方口頭或私訊告訴志工一次，手機記住之後就跟以前一樣快；
-- 連結被轉傳出去，拿到的人也改不了位置。
--
-- ── 為什麼要在資料庫比對，不能只在前端擋 ──
-- 打卡走的是公開 RPC，前端擋住畫面，別人照樣能直接呼叫 shower_checkin。
-- 所以密碼由 shower_checkin 自己比對，前端那個輸入框只是讓人有地方打。
--
-- ── 密碼存在哪 ──
-- 一張只有一列的表，RLS 只開給管理員（後台「沐浴車」分頁設定）。
-- **不可以放 site_settings**：那張 anon 讀得到，等於把密碼公開。
-- 存明碼是刻意的：廟方要看得到才能告訴志工，它保護的是「位置不被亂改」，不是個資。
--
-- ── 還沒設密碼時 ──
-- password 是 NULL 或空字串＝不需要密碼，打卡照舊。
-- 所以執行這支之後什麼都不會變，到後台設了密碼才開始要求。

CREATE TABLE IF NOT EXISTS public.shower_checkin_password (
  -- 只允許一列：主鍵固定是 TRUE
  id         BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  password   TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.shower_checkin_password (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.shower_checkin_password ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_shower_checkin_password" ON public.shower_checkin_password;
CREATE POLICY "admin_all_shower_checkin_password" ON public.shower_checkin_password
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 密碼對不對（或根本不需要密碼）。打卡頁一進來先問這支，決定要不要顯示密碼框。
-- 只回 true/false，不回任何其他資訊。
CREATE OR REPLACE FUNCTION public.shower_checkin_verify(p_password TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT password IS NULL OR btrim(password) = '' OR password = coalesce(p_password, '')
     FROM public.shower_checkin_password WHERE id),
    TRUE);
$$;
REVOKE EXECUTE ON FUNCTION public.shower_checkin_verify(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.shower_checkin_verify(TEXT) TO anon, authenticated;

-- 打卡本身多收一個密碼。舊的五個參數版本要丟掉，否則留著就是一條不用密碼的後門。
DROP FUNCTION IF EXISTS public.shower_checkin(UUID, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.shower_checkin(
  p_truck_id UUID,
  p_lat      DOUBLE PRECISION DEFAULT NULL,
  p_lng      DOUBLE PRECISION DEFAULT NULL,
  p_place    TEXT DEFAULT NULL,
  p_note     TEXT DEFAULT NULL,
  p_password TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  -- 密碼錯用固定的錯誤碼（28P01 = invalid_password），前台據此叫志工重新輸入，
  -- 跟「網路不通」「這台車停用」分得開
  IF NOT public.shower_checkin_verify(p_password) THEN
    RAISE EXCEPTION '打卡密碼不正確' USING ERRCODE = '28P01';
  END IF;

  SELECT name INTO v_name FROM public.shower_trucks
  WHERE id = p_truck_id AND is_active;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF p_lat IS NULL AND (p_place IS NULL OR btrim(p_place) = '') THEN
    RAISE EXCEPTION '請至少提供座標或地標';
  END IF;

  INSERT INTO public.shower_checkins (truck_id, lat, lng, place, note)
  VALUES (p_truck_id, p_lat, p_lng, nullif(btrim(p_place), ''), nullif(btrim(p_note), ''));

  RETURN v_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.shower_checkin(UUID, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.shower_checkin(UUID, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT) TO anon, authenticated;

-- 讓 PostgREST 立刻認得新的函式簽名
NOTIFY pgrst, 'reload schema';

-- 確認：應該看到一列、密碼是空的（＝還不需要密碼）
SELECT id, password, public.shower_checkin_verify(NULL) AS 目前不需密碼 FROM public.shower_checkin_password;
