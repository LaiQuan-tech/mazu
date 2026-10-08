-- 洗澡車打卡簡化：拿掉每台車一把鑰匙的設計（廟方 2026-10-08：「太複雜了」）
-- 請在 Supabase Dashboard > SQL Editor 執行此檔案（可重複執行）
--
-- ── 為什麼改 ──
-- 原本每台車一把 checkin_key，連結長 /shower/checkin?k=<32 個十六進位字元>。
-- 安全性是夠的，但代價全落在最不該付的人身上：
--   廟方要進 SQL 或後台才拿得到連結，還要小心別把 32 個字元複製錯；
--   志工每台車一條不同的網址，換車、換人就要重發；
--   連結一旦在 LINE 群組被轉傳，整套鑰匙管理就失去意義——而那幾乎一定會發生。
-- 廟方判斷「打卡連結不會公開」，並要求把「請勿公開」寫在頁面上。
-- **這是廟方的風險選擇，不是疏漏**：洗澡車位置被亂填的後果是香客白跑一趟，
-- 不涉及個資與金流；拿它換「志工開了就能按」是划算的。
--
-- ── 改成什麼 ──
-- 一條固定網址 /shower/checkin，不帶任何參數。志工進去選一次是哪一台車
-- （只有一台就自動選好），之後瀏覽器記住，開了直接按。
-- 打卡 RPC 改收 truck_id——那是公開資料（香客頁本來就看得到車名與 id），
-- 不再是憑證，所以沒有「外洩」可言。

-- 舊的鑰匙版函式要先丟掉：參數不同會變成多載，兩支並存等於留了一條舊路徑
DROP FUNCTION IF EXISTS public.shower_checkin(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.shower_checkin(
  p_truck_id UUID,
  p_lat      DOUBLE PRECISION DEFAULT NULL,
  p_lng      DOUBLE PRECISION DEFAULT NULL,
  p_place    TEXT DEFAULT NULL,
  p_note     TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  -- 仍然只認「上架中」的車：進香結束後廟方把車隱藏起來，這條路徑就自動關掉
  SELECT name INTO v_name FROM public.shower_trucks
  WHERE id = p_truck_id AND is_active;
  IF NOT FOUND THEN
    RETURN NULL;   -- 車不存在或已隱藏。前台顯示「這台車已停用」
  END IF;

  IF p_lat IS NULL AND (p_place IS NULL OR btrim(p_place) = '') THEN
    RAISE EXCEPTION '請至少提供座標或地標';
  END IF;

  INSERT INTO public.shower_checkins (truck_id, lat, lng, place, note)
  VALUES (p_truck_id, p_lat, p_lng, nullif(btrim(p_place), ''), nullif(btrim(p_note), ''));

  RETURN v_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.shower_checkin(UUID, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.shower_checkin(UUID, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) TO anon, authenticated;

-- 鑰匙欄位整個拿掉。留著是「看起來有保護其實沒有」，比沒有更糟——
-- 下一個人看到這個欄位會以為打卡有驗證。
ALTER TABLE public.shower_trucks DROP COLUMN IF EXISTS checkin_key;

-- 確認：欄位應該不見了，函式參數應該是 uuid
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'shower_trucks' ORDER BY ordinal_position;
