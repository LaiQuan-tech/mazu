# 盤點用唯讀查詢

把 `表名` 換掉；表不存在時會直接報錯，這是正常的。每次只貼需要的；結果可能含個資的不要 `SELECT *`。

```sql
-- 欄位
SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
 WHERE table_schema='public' AND table_name='表名' ORDER BY ordinal_position;
```
```sql
-- 限制與外鍵（外鍵定義含 ON DELETE 行為）
SELECT conrelid::regclass AS 在哪張表, conname, contype, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid='public.表名'::regclass OR confrelid='public.表名'::regclass;
```
```sql
-- RLS 是否開啟、有哪些規則
SELECT c.relname, c.relrowsecurity, p.policyname, p.cmd, p.roles, p.qual, p.with_check
  FROM pg_class c LEFT JOIN pg_policies p ON p.schemaname='public' AND p.tablename=c.relname
 WHERE c.oid='public.表名'::regclass ORDER BY p.cmd;
```
```sql
-- 全站寬鬆規則；只抓字面 true，auth.role()='authenticated' 之類的要看上一段全文（INSERT 報名與公開內容的 SELECT 是刻意的，其餘要有理由）
SELECT tablename, policyname, cmd, roles, qual, with_check FROM pg_policies
 WHERE schemaname IN ('public','storage') AND (qual='true' OR with_check='true') ORDER BY 1,3;
```
```sql
-- 沒開 RLS 的表（應為 0 列）
SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p') AND NOT relrowsecurity;
```
```sql
-- 表的權限（備份表不應出現 anon／authenticated）
SELECT grantee, string_agg(privilege_type, ',') FROM information_schema.role_table_grants
 WHERE table_schema='public' AND table_name='表名' GROUP BY 1;
```
```sql
-- 觸發器
SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='public.表名'::regclass AND NOT tgisinternal;
```
```sql
-- 函式定義、是否 SECURITY DEFINER、誰能執行（proacl 為 NULL ＝ PUBLIC 可執行）
SELECT p.oid::regprocedure, p.prosecdef, p.proconfig, p.proacl, pg_get_functiondef(p.oid)
  FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname='函式名';
```
```sql
-- 筆數與金額（改資料前後各跑一次；各表金額欄不同，先用第一段查欄位）
SELECT count(*) AS 筆數, coalesce(sum(total_amount),0) AS 法會金額
  FROM public.blessing_registrations WHERE entries IS NOT NULL;
```

# 清測試資料範本（第二段會刪資料，先取得使用者同意）

```sql
SELECT id, created_at, left(name, 4) AS 姓名開頭 FROM public.表名 WHERE name LIKE '測試%' ORDER BY created_at;
```
```sql
DO $$
DECLARE n int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.receipt_items WHERE source_id::text IN ('id1','id2'))
     OR EXISTS (SELECT 1 FROM public.voucher_items WHERE source_id::text IN ('id1','id2')) THEN
    RAISE EXCEPTION '已開收據或憑證，不刪'; END IF;
  DELETE FROM public.表名 WHERE id::text IN ('id1','id2') AND name LIKE '測試%';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION '預期 2 筆，實際 % 筆，全部不刪', n; END IF;
END $$;
SELECT count(*) AS 應為0 FROM public.表名 WHERE id::text IN ('id1','id2');
```
