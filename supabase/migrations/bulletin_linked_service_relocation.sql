-- 公告的「連結服務」多一個選項：遷址募資
-- （2026-10-23 廟方：「首頁公布欄，置頂的遷址募資，內容最後要加上按鈕導引去募款頁」）
--
-- 前端已經支援，這一支只處理一件事：**萬一 bulletins.linked_service 身上有
-- CHECK 約束，新的值會被擋下來**。那一欄的 DDL 不在 repo 裡（是當初在 Supabase
-- 後台手動建的），所以這裡不假設它長什麼樣，而是先查再改。
--
-- **沒有 CHECK 的話這一支什麼都不做**——刻意不順手補一條：原本沒有驗證就維持原狀，
-- 新加一條等於替日後多立一個「忘了跑 migration 就存檔失敗」的關卡，而值本來就
-- 由後台的下拉決定，不是自由輸入。
--
-- 跑了也不會有副作用；不跑的症狀很窄：廟方在公佈欄管理把「連結服務」選成
-- 「遷址募資」時存檔失敗（23514），其餘四個選項完全不受影響。

do $$
declare
  c record;
  n int := 0;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as def
      from pg_constraint
     where conrelid = 'public.bulletins'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%linked_service%'
  loop
    n := n + 1;
    raise notice '找到舊約束 % ： %', c.conname, c.def;
    execute format('alter table public.bulletins drop constraint %I', c.conname);
  end loop;

  if n = 0 then
    raise notice 'linked_service 沒有 CHECK 約束，不必改，這一支到此為止。';
  else
    -- 原本就有驗證就把驗證補回去，只是多一個值。**不要只 drop 不 add**：
    -- 那會把打錯字的值放進來，而這一欄的值要與 types.ts 的 union 一致。
    execute $ck$
      alter table public.bulletins
        add constraint bulletins_linked_service_check
        check (linked_service is null or linked_service in
               ('lamp','blessing','booking','donation','relocation'))
    $ck$;
    raise notice '已換成含 relocation 的新約束。';
  end if;
end $$;

comment on column public.bulletins.linked_service is
  '展開公告時那顆「前往○○」連到哪一個服務。值要與 types.ts 的 BulletinRecord.linkedService 一致；加新值時 App.tsx 的 SERVICE_PAGE 也要補';
