-- 伺服器自己會改的秘密值（2026-11-09，目前只有 Instagram 的權杖）
-- 請在 Supabase Dashboard > SQL Editor 執行（可重複執行）
--
-- 為什麼不放 site_settings：那張表 anon 讀得到（訪客要讀追蹤碼與社群連結），
-- 權杖放進去等於公開給所有人。
-- 為什麼不只放 Vercel 環境變數：IG 的權杖 60 天過期、要續期，而函式在執行中改不了
-- 自己的環境變數。api/ig.ts 每 7 天續一次，新的權杖寫回這裡。
--
-- **RLS 打開、一條政策都不給**：anon 與登入者完全讀不到，只有 service role（伺服器）可以。

CREATE TABLE IF NOT EXISTS public.app_secrets (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_secrets FROM PUBLIC, anon, authenticated;

-- 驗證：應該只看到表存在、沒有任何政策
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'app_secrets';
SELECT count(*) AS policies FROM pg_policies WHERE tablename = 'app_secrets';
