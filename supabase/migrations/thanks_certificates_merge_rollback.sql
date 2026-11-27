-- 還原 thanks_certificates_merge.sql：改回「一筆報名一張」。
-- 若已經有合開的感謝狀、或同一筆報名換過編號，加回舊約束會失敗——那代表已經在用合開了，不要還原。
ALTER TABLE public.thanks_certificates DROP CONSTRAINT IF EXISTS thanks_certificates_cert_no_key;
ALTER TABLE public.thanks_certificates ADD CONSTRAINT thanks_certificates_source_table_source_id_key UNIQUE (source_table, source_id);
