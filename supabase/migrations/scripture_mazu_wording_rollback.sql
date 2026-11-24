-- 還原 scripture_mazu_wording.sql
do $$
declare r record; n int;
begin
  for r in select * from (values
    (1, '天上聖母（媽祖）林默娘誕生', '天上聖母林默娘誕生'),
    (3, '媽祖祖籍在湄州', '聖母祖籍在湄州'),
    (17, '媽祖得道後，', '聖母得道後，'),
    (17, '一日媽祖巡至東海', '一日聖母巡至東海'),
    (18, '相傳媽祖二十三歲時', '相傳聖母二十三歲時'),
    (18, '二妖果然靠近，媽祖大聲', '二妖果然靠近，聖母大聲'),
    (18, '媽祖施展神咒', '聖母施展神咒'),
    (19, '神將輔佐媽祖', '神將輔佐聖母'),
    (19, '媽祖當時已是', '聖母當時已是'),
    (19, '三月廿三日媽祖誕辰', '三月廿三日聖母誕辰'),
    (20, '媽祖二十九歲時', '聖母二十九歲時'),
    (21, '媽祖飛昇之後', '聖母飛昇之後'),
    (21, '蒙媽祖顯靈相救', '蒙聖母顯靈相救'),
    (22, '祈求媽祖庇佑', '祈求聖母庇佑'),
    (22, '這是媽祖顯靈助戰', '這是聖母顯靈助戰')
  ) as t(sec, old_text, new_text)
  loop
    update scripture_verses
       set annotation = replace(annotation, r.old_text, r.new_text), updated_at = now()
     where section_number = r.sec and strpos(annotation, r.old_text) > 0;
    get diagnostics n = row_count;
    if n <> 1 then
      raise exception '第 % 段找不到「%」，全部不改', r.sec, r.old_text;
    end if;
  end loop;
end $$;
