/**
 * 沐浴車備註的顯示文字（/shower 與 /shower/checkin 共用）
 *
 * 志工在現場打字，打的是「22:00」這種最短的東西——而香客看到孤零零一個
 * 「22:00」不知道那是什麼意思（開始供應？停止供應？下一次打卡時間？）。
 * 廟方 2026-10-16：「時間直接帶入『供應到今晚』」。
 *
 * 所以**只認「整串就是一個時間」的那一種**，自動補成完整的句子；
 * 志工若打了完整的句子（「供應到今晚 23:00」「11 點收攤」）就原樣顯示，
 * 否則會變成「供應到今晚 供應到今晚 23:00」。
 *
 * **「今晚」不能無條件套**：志工填 09:00 指的是明天早上收攤，寫成「今晚 09:00」
 * 是假訊息，而香客會照著它決定要不要現在過去。所以傍晚到清晨才講「今晚」，
 * 其餘時段講「今天」——兩種都不會說錯。
 */

/** `22:00`／`22：00`／`22點`／`22點30分`；整串必須就是時間，前後不能有別的字 */
const BARE_TIME = /^\s*(\d{1,2})\s*(?:[:：]\s*(\d{1,2})|點\s*(?:(\d{1,2})\s*分?)?)\s*$/;

export const formatShowerNote = (note?: string | null): string => {
  const raw = (note ?? '').trim();
  if (!raw) return '';

  const m = BARE_TIME.exec(raw);
  if (!m) return raw;

  const h = Number(m[1]);
  const min = Number(m[2] ?? m[3] ?? 0);
  if (!Number.isFinite(h) || h > 23 || !Number.isFinite(min) || min > 59) return raw;

  // 17:00–04:59 叫「今晚」，其餘叫「今天」
  const when = h >= 17 || h <= 4 ? '今晚' : '今天';
  return `供應到${when} ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};
