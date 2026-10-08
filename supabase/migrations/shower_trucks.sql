-- 進香洗澡車定位（白沙屯媽祖進香，廟方 2026-10-08 提出）
-- 請在 Supabase Dashboard > SQL Editor 執行此檔案（可重複執行）
--
-- ── 要解決的事 ──
-- 白沙屯媽祖進香每年十萬人隨行，而且**沒有固定路線**（媽祖轎子走到哪算哪）。
-- 有團體開移動式洗澡車免費提供香客盥洗，車停在哪只有現場的人知道。
-- 這張表讓現場志工「打卡」目前位置，香客在 /shower 查得到並直接導航過去。
--
-- ── 為什麼是兩張表 ──
-- shower_trucks 是「有哪幾台車」（長期不變），shower_checkins 是「它去過哪些地方」
-- （一天好幾筆）。合成一張就得一直 UPDATE 同一列，位置歷史會被蓋掉——
-- 事後要檢討「那天到底停了幾個點」就沒有資料了。
-- 目前位置＝該車最新的一筆打卡，由 RPC 算給前台。
--
-- ── 為什麼志工不用登入 ──
-- 打卡的人是現場志工，不是廟方管理員。半夜在田埂邊要他先註冊帳號、記密碼，
-- 這個功能就不會有人用（廟方 2026-10-08 選了「專屬連結」）。
-- 每台車一把 checkin_key，連結長這樣：/shower/checkin?k=<key>
-- **那把鑰匙就是憑證**，所以：
--   1. shower_trucks **不開放 anon SELECT**——開了等於把所有鑰匙公開。
--      香客要看的資料改由 SECURITY DEFINER 的 RPC 給，那支不回傳 key。
--   2. 打卡也走 RPC，函式內部自己比對 key。anon 對這兩張表沒有任何直接權限。
--   3. 鑰匙外洩就重發（後台一個按鈕），舊連結立刻失效。
CREATE TABLE IF NOT EXISTS public.shower_trucks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 顯示給香客看的名字，例：「洗澡車①」「北區洗澡車」
  name        TEXT NOT NULL,
  -- 志工打卡用的鑰匙。32 個十六進位字元，猜不到；重發就是換一個新的
  checkin_key TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  -- 關掉＝連結失效、香客頁也不列出。進香結束後整批關掉即可，不必刪
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shower_checkins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id   UUID NOT NULL REFERENCES public.shower_trucks(id) ON DELETE CASCADE,
  -- 經緯度。**可以是 NULL**：室內、拒絕定位權限、GPS 抓不到的時候，
  -- 志工只填地標文字也要能打卡——有地名總比什麼都沒有好。
  lat        DOUBLE PRECISION,
  lng        DOUBLE PRECISION,
  -- 地標文字，例「通霄鎮文昌祖廟旁」。香客看的是這一行，座標只是拿來導航
  place      TEXT,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 座標要嘛兩個都有、要嘛兩個都沒有；只有一個是壞資料，導航會跑到外海
  CONSTRAINT shower_checkins_latlng_pair CHECK (
    (lat IS NULL AND lng IS NULL) OR (lat IS NOT NULL AND lng IS NOT NULL)
  ),
  CONSTRAINT shower_checkins_latlng_range CHECK (
    lat IS NULL OR (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180)
  ),
  -- 座標與地標至少要有一個，否則這筆打卡沒有任何資訊
  CONSTRAINT shower_checkins_has_location CHECK (
    lat IS NOT NULL OR (place IS NOT NULL AND btrim(place) <> '')
  )
);

-- 「某台車最新的一筆」是唯一的查詢樣式
CREATE INDEX IF NOT EXISTS shower_checkins_truck_time_idx
  ON public.shower_checkins (truck_id, created_at DESC);

-- ── RLS：anon 對這兩張表沒有任何直接權限，全部走 RPC ──
ALTER TABLE public.shower_trucks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shower_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_shower_trucks" ON public.shower_trucks;
CREATE POLICY "admin_all_shower_trucks" ON public.shower_trucks
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_all_shower_checkins" ON public.shower_checkins;
CREATE POLICY "admin_all_shower_checkins" ON public.shower_checkins
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 香客頁讀的資料。**不含 checkin_key** ──
-- 每台上架中的車一筆，附它最新的那次打卡。沒打過卡的車也要回傳
-- （前台顯示「尚未回報位置」），所以是 LEFT JOIN 不是 INNER。
CREATE OR REPLACE FUNCTION public.get_shower_locations()
RETURNS json
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT coalesce(json_agg(x ORDER BY x.sort_order, x.name), '[]'::json)
  FROM (
    SELECT t.id, t.name, t.sort_order,
           c.lat, c.lng, c.place, c.note, c.created_at AS checked_at
    FROM public.shower_trucks t
    LEFT JOIN LATERAL (
      SELECT lat, lng, place, note, created_at
      FROM public.shower_checkins
      WHERE truck_id = t.id
      ORDER BY created_at DESC
      LIMIT 1
    ) c ON TRUE
    WHERE t.is_active
  ) x;
$$;

GRANT EXECUTE ON FUNCTION public.get_shower_locations() TO anon, authenticated;

-- ── 志工打卡。鑰匙對了才寫得進去 ──
-- 回傳車名給前台顯示「○○ 已更新」，鑰匙錯就回 NULL（前台顯示連結失效）。
-- 刻意不回傳任何其他欄位：這支是公開的，拿錯鑰匙的人不該換到任何資訊。
CREATE OR REPLACE FUNCTION public.shower_checkin(
  p_key   TEXT,
  p_lat   DOUBLE PRECISION DEFAULT NULL,
  p_lng   DOUBLE PRECISION DEFAULT NULL,
  p_place TEXT DEFAULT NULL,
  p_note  TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_truck public.shower_trucks%ROWTYPE;
BEGIN
  SELECT * INTO v_truck FROM public.shower_trucks
  WHERE checkin_key = p_key AND is_active;
  IF NOT FOUND THEN
    RETURN NULL;   -- 鑰匙錯、或這台車已停用
  END IF;

  -- 兩者都空就不寫：CHECK 會擋，但在這裡先擋可以回一個看得懂的錯誤
  IF p_lat IS NULL AND (p_place IS NULL OR btrim(p_place) = '') THEN
    RAISE EXCEPTION '請至少提供座標或地標';
  END IF;

  INSERT INTO public.shower_checkins (truck_id, lat, lng, place, note)
  VALUES (v_truck.id, p_lat, p_lng, nullif(btrim(p_place), ''), nullif(btrim(p_note), ''));

  RETURN v_truck.name;
END;
$$;

-- 同 get_my_shared_history 的教訓：PUBLIC 與 anon 要一起收再指定授權。
-- 這支本來就要給 anon（志工沒有帳號），寫在這裡是為了語意明確而不是靠預設值。
REVOKE EXECUTE ON FUNCTION public.shower_checkin(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.shower_checkin(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) TO anon, authenticated;

-- 確認：新建時 0 台車、RPC 回 []
SELECT (SELECT count(*) FROM public.shower_trucks) AS 洗澡車數, public.get_shower_locations() AS 香客頁資料;
