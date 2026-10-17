-- 緊急祈願燈（/urgent）
-- 請在 Supabase Dashboard > SQL Editor 執行此檔案（可重複執行）
-- 前提：mainsite_rls.sql 已建立 public.is_admin() 與 public.my_phone()。
--
-- ── 為什麼是一張表不是三張 ──
-- 手術住院、升學考試、冥福接引三種的欄位不一樣，但它們是同一件事的三種情況：
-- 「替某個人向神明稟告一件急事」。拆三張表的話，後台要開三個分頁、待辦數字要加三次、
-- 通知信要接三條路徑，而三者的處理流程完全一樣（收到 → 稟告點燈 → 標記已祈福）。
-- 用 kind 區分，不同欄位各自留空。
--
-- ── 欄位為什麼共用 ──
-- place_name／place_address 住院時是醫院、考試時是學校或考場——語意是同一個
-- 「那個人屆時會在哪裡」，分成四欄只會多兩欄永遠是空的。
--
-- ── 這張表沒有金額 ──
-- 「不收取任何費用」是廟方寫在文案裡的承諾（2026-10-17）。所以沒有 fee、沒有
-- 待匯款狀態，status 走的是處理進度（同問事那一套，不是點燈祈福那一套收款語彙）。

CREATE TABLE IF NOT EXISTS public.urgent_prayers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- hospital＝手術或住院、exam＝升學考試或考證照、memorial＝冥福接引
  kind          TEXT NOT NULL,

  -- 被祈願的那一位。memorial 時是先人，其餘兩種通常就是登記人自己
  name          TEXT NOT NULL,
  birth_date    TEXT,          -- 合併格式（民國72年6月20日（農曆五月初十）），見 BirthDatePicker
  zodiac        TEXT,
  address       TEXT,

  -- 登記人的聯絡方式。文案裡沒有列，但沒有電話廟方回不了電，
  -- 而且全站的報名紀錄都是以電話為鍵（my_phone()），少了它會員就看不到自己這一筆
  phone         TEXT NOT NULL,
  email         TEXT,

  -- hospital／exam 共用：那個人屆時會在哪裡
  place_name    TEXT,          -- 醫院名稱／學校・考場名稱
  place_address TEXT,          -- 醫院地址／學校・考場地址
  room_no       TEXT,          -- 病房號（hospital）
  condition     TEXT,          -- 詳細現況（hospital）
  event_date    TEXT,          -- 考試日期（exam）
  exam_no       TEXT,          -- 准考證號碼（exam）

  -- memorial
  death_date    TEXT,          -- 農曆卒日
  tablet_place  TEXT,          -- 安奉位置（牌位）
  kin_confirmed BOOLEAN NOT NULL DEFAULT FALSE,  -- 已確認為三等親內親屬

  -- 待處理 → 已祈福（已取消）。**刻意不加 CHECK**：這是送出路徑，
  -- CHECK 擋下來整筆登記就失敗，而這是急事——寧可收到一個沒看過的值。
  status        TEXT NOT NULL DEFAULT '待處理',

  source           TEXT,        -- UTM 來源，見 services/attribution.ts
  confirm_sent_at  TIMESTAMPTZ  -- 寄過確認信沒有，見 lib/notify-deliver.ts
);

-- 舊版已建表時補欄位（可重複執行）
ALTER TABLE public.urgent_prayers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.urgent_prayers ADD COLUMN IF NOT EXISTS confirm_sent_at TIMESTAMPTZ;
ALTER TABLE public.urgent_prayers ADD COLUMN IF NOT EXISTS source TEXT;

-- 後台最常問的是「還有哪些沒處理」，其次是「今天進來幾筆」
CREATE INDEX IF NOT EXISTS urgent_prayers_created_idx ON public.urgent_prayers (created_at DESC);
CREATE INDEX IF NOT EXISTS urgent_prayers_status_idx  ON public.urgent_prayers (status);

ALTER TABLE public.urgent_prayers ENABLE ROW LEVEL SECURITY;

-- 訪客只能送出。**TO anon, authenticated 兩者都要給**：只給 anon 的話，
-- 管理員或會員登入後送出會走 authenticated 角色而被 RLS 擋下（CLAUDE.md 記過這個坑）。
DROP POLICY IF EXISTS "anon_insert_urgent" ON public.urgent_prayers;
CREATE POLICY "anon_insert_urgent" ON public.urgent_prayers
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 管理員全看；會員看得到以自己電話登記的那幾筆（同其他報名紀錄，my_phone()）
DROP POLICY IF EXISTS "read_urgent" ON public.urgent_prayers;
CREATE POLICY "read_urgent" ON public.urgent_prayers
  FOR SELECT TO authenticated
  USING (public.is_admin() OR (phone IS NOT NULL AND phone = public.my_phone()));

DROP POLICY IF EXISTS "admin_update_urgent" ON public.urgent_prayers;
CREATE POLICY "admin_update_urgent" ON public.urgent_prayers
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_urgent" ON public.urgent_prayers;
CREATE POLICY "admin_delete_urgent" ON public.urgent_prayers
  FOR DELETE TO authenticated USING (public.is_admin());
