-- 歲時節令：神明聖誕與每年重複的節日
-- 請在 Supabase Dashboard > SQL Editor 執行此檔案（可重複執行）
--
-- ── 為什麼不放進 blessing_events ──
-- blessing_events 存的是「單次活動」：有確定的國曆起訖日、報名截止、費用方案。
-- 聖誕是完全不同的東西——**每年重複，而且記的是農曆日期**，換算成國曆每年都不一樣
-- （媽祖聖誕農曆三月廿三：2026 是 5/9、2027 是 4/29、2028 是 4/17）。
-- 硬塞進 blessing_events 就得每年手動新增 38 筆，那正是這張表要避免的事。
--
-- 分工：這張表＝「每年都會到的日子」，blessing_events＝「今年辦的活動」。
-- 前台 /calendar 把兩者合併後依日期排序。
--
-- ── 三種日期型態 ──
-- lunar 農曆固定日（絕大多數聖誕）。閏月用 is_leap_month 表示，
--       換算時 lunar-javascript 以負數月份代表閏月（Lunar.fromYmd(y, -5, 15)）。
-- solar 國曆固定日（安座紀念、廟慶這類直接訂在國曆的日子）。
-- jieqi 節氣（冬至、清明）。這類既不是農曆固定日也不是國曆固定日，
--       要由節氣演算法求出，所以獨立一種型態。
--
-- ── 刻意不預帶任何資料 ──
-- 本壇供奉 38 尊，其中「茉莉媽祖」「老駕太子」「和緣太子」「顧爐太子」
-- 「菁埔夫人」「順天夫人」是本壇特有的，外部查不到聖誕日期；
-- 就連看似通用的也有地域差異（關聖帝君有六月廿四與五月十三兩說）。
-- 日期填錯會讓信眾白跑一趟，所以一律由廟方輸入，不由程式猜。

CREATE TABLE IF NOT EXISTS public.deity_feasts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 顯示名稱，例如「天上聖母聖誕」「天公生」「中元普渡」
  title         TEXT NOT NULL,
  -- 選填：關聯到本壇供奉的神尊。刪神尊時只解除關聯，不連帶刪掉行事曆那一筆
  deity_id      UUID REFERENCES public.deities(id) ON DELETE SET NULL,

  calendar_type TEXT NOT NULL DEFAULT 'lunar',

  -- calendar_type = 'lunar'
  lunar_month   SMALLINT,
  lunar_day     SMALLINT,
  is_leap_month BOOLEAN NOT NULL DEFAULT FALSE,
  -- calendar_type = 'solar'
  solar_month   SMALLINT,
  solar_day     SMALLINT,
  -- calendar_type = 'jieqi'
  jieqi         TEXT,

  note          TEXT,
  is_visible    BOOLEAN NOT NULL DEFAULT TRUE,
  -- 同一天有多筆時的排序
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT deity_feasts_type_valid
    CHECK (calendar_type IN ('lunar', 'solar', 'jieqi')),

  -- 型態與欄位必須對得上。少了這條，前台會拿到「型態是 lunar 但月份是 null」
  -- 的資料，換算時整筆消失而且沒有任何錯誤訊息——那種靜默失敗最難查。
  CONSTRAINT deity_feasts_date_fields CHECK (
    (calendar_type = 'lunar'
      AND lunar_month BETWEEN 1 AND 12 AND lunar_day BETWEEN 1 AND 30)
    OR (calendar_type = 'solar'
      AND solar_month BETWEEN 1 AND 12 AND solar_day BETWEEN 1 AND 31)
    OR (calendar_type = 'jieqi'
      AND jieqi IS NOT NULL AND length(btrim(jieqi)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS deity_feasts_order_idx
  ON public.deity_feasts (calendar_type, lunar_month, lunar_day, sort_order);

ALTER TABLE public.deity_feasts ENABLE ROW LEVEL SECURITY;

-- 訪客只讀得到「顯示中」的：還沒跟廟方確認的日期留在後台不會外流
DROP POLICY IF EXISTS "public_read_deity_feasts" ON public.deity_feasts;
CREATE POLICY "public_read_deity_feasts" ON public.deity_feasts
  FOR SELECT TO anon, authenticated USING (is_visible = TRUE);

-- 管理員可讀全部（含未顯示的）並增刪改
DROP POLICY IF EXISTS "admin_all_deity_feasts" ON public.deity_feasts;
CREATE POLICY "admin_all_deity_feasts" ON public.deity_feasts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 確認結果（新建時應為 0 筆）
SELECT calendar_type, COUNT(*) FROM public.deity_feasts GROUP BY calendar_type;
