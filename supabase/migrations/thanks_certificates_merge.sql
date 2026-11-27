-- 感謝狀合開（2026-11-27 廟方：會員幫很多親友報名，通常只開一張感謝狀）。
--
-- 規則：**同一個編號＝同一張感謝狀**。財務在幾筆報名填同一個號碼，後台就把它們
-- 合成一張（受謝人寫「報名人 闔家」、項目逐一列出、金額加總）。
-- 所以快照改成「一個編號一張」，不再是「一筆報名一張」：
--   - 拿掉 (source_table, source_id) 唯一：那一對現在只代表「主要的那一筆」（發送對象），
--     主要那筆改了編號時，舊編號那張快照還留著，新編號要能另存一張。
--   - 加上 cert_no 唯一：存檔用它 upsert。
--
-- 只改約束，不動資料。若已有重複編號的快照（理論上不會：功能今天才上線），
-- 整支停下來列出是哪幾號，請先確認要留哪一張，不自動刪。
-- 還原見 thanks_certificates_merge_rollback.sql。

DO $$
DECLARE dup text; c text;
BEGIN
  SELECT string_agg(cert_no, '、') INTO dup FROM (
    SELECT cert_no FROM public.thanks_certificates GROUP BY cert_no HAVING count(*) > 1) d;
  IF dup IS NOT NULL THEN RAISE EXCEPTION '這幾個編號有不只一張快照，請先確認要留哪一張：%', dup; END IF;

  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'public.thanks_certificates'::regclass AND contype = 'u'
              AND pg_get_constraintdef(oid) = 'UNIQUE (source_table, source_id)' LOOP
    EXECUTE format('ALTER TABLE public.thanks_certificates DROP CONSTRAINT %I', c);
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'thanks_certificates_cert_no_key') THEN
    ALTER TABLE public.thanks_certificates ADD CONSTRAINT thanks_certificates_cert_no_key UNIQUE (cert_no);
  END IF;
END $$;

-- 驗證：應只看到一行 UNIQUE (cert_no)
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = 'public.thanks_certificates'::regclass AND contype = 'u';
