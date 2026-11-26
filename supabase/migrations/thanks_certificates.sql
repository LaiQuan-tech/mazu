-- 感謝狀（2026-11-27）：法會、點燈、祈福、捐獻四種都要有感謝狀編號，
-- 後台可預覽、列印紙本，也能把電子版連結發給信眾（LINE 優先、沒有就 email）。
--
-- ── 為什麼另開一張表，不把內容存在報名表上 ──
-- 報名表的 INSERT 對訪客開放。若把「感謝狀內容」存成報名表的欄位，懂技術的人可以自己
-- 送一筆帶著假感謝狀的報名，再用公開頁把它印成「和聖壇頒發」的樣子。
-- 放在這張只有後台寫得進去的表，訪客就無從偽造；公開頁只能用 RPC、憑一組猜不到的 id 讀一張。
--
-- ── 內容是快照 ──
-- 姓名、項目、金額、日期在發送／預覽那一刻存下來（同收據：金額是快照）。之後報名資料
-- 再改，信眾手上那張連結不會跟著變；要改就在後台重新存一次（同一個 id，連結不變）。
--
-- 只新增欄位與新表，不動既有資料，可重複執行。還原見 thanks_certificates_rollback.sql。

-- 1. 點燈、捐獻也要能填感謝狀編號（祈福與法會共用 blessing_registrations，早就有這欄）。
--    public_insert_guard 的 patch 已經含 'thanks_letter'：訪客送出時一律被清成 NULL，不用改那支。
ALTER TABLE public.lamp_registrations ADD COLUMN IF NOT EXISTS thanks_letter text;
ALTER TABLE public.donations          ADD COLUMN IF NOT EXISTS thanks_letter text;
ALTER TABLE public.blessing_registrations ADD COLUMN IF NOT EXISTS thanks_letter text;

-- 2. 感謝狀快照
CREATE TABLE IF NOT EXISTS public.thanks_certificates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL CHECK (source_table IN ('lamp_registrations', 'blessing_registrations', 'donations')),
  source_id    text NOT NULL,
  cert_no      text NOT NULL CHECK (btrim(cert_no) <> ''),
  name         text NOT NULL,
  item         text NOT NULL,
  amount       integer NOT NULL DEFAULT 0 CHECK (amount >= 0),
  cert_date    date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Taipei')::date,
  temple_name  text NOT NULL DEFAULT '和聖壇',
  thanks_text  text,
  sent_at      timestamptz,
  sent_via     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_table, source_id)
);

ALTER TABLE public.thanks_certificates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.thanks_certificates FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.thanks_certificates TO authenticated;

DROP POLICY IF EXISTS thanks_certificates_admin ON public.thanks_certificates;
CREATE POLICY thanks_certificates_admin ON public.thanks_certificates
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. 信眾打開連結時讀一張：只回感謝狀上印的東西，不回來源是哪一筆報名
CREATE OR REPLACE FUNCTION public.get_thanks_certificate(p_id uuid)
RETURNS TABLE(cert_no text, name text, item text, amount integer, cert_date date, temple_name text, thanks_text text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT c.cert_no, c.name, c.item, c.amount, c.cert_date, c.temple_name, c.thanks_text
    FROM public.thanks_certificates c WHERE c.id = p_id;
$$;
REVOKE ALL ON FUNCTION public.get_thanks_certificate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_thanks_certificate(uuid) TO anon, authenticated;

-- 驗證：應看到三張表各一行 thanks_letter、以及 thanks_certificates 表
SELECT table_name, column_name FROM information_schema.columns
 WHERE table_schema = 'public' AND column_name = 'thanks_letter'
   AND table_name IN ('lamp_registrations', 'donations', 'blessing_registrations')
UNION ALL
SELECT 'thanks_certificates', count(*)::text FROM public.thanks_certificates;
