-- 還原 thanks_certificates.sql。
-- 注意：會刪掉已存的感謝狀快照，已發出去的連結會打不開；財務填的編號也會一起消失。
-- 先備份：SELECT * FROM public.thanks_certificates;
DROP FUNCTION IF EXISTS public.get_thanks_certificate(uuid);
DROP TABLE IF EXISTS public.thanks_certificates;
ALTER TABLE public.lamp_registrations DROP COLUMN IF EXISTS thanks_letter;
ALTER TABLE public.donations          DROP COLUMN IF EXISTS thanks_letter;
-- blessing_registrations.thanks_letter 是法會早就在用的欄位，不要刪
