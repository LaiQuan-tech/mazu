import { ScriptureVerseRecord } from '../types';

/**
 * 天上聖母經全文的排版規則——全文頁（`ScriptureFullText`）與後台全文編輯共用。
 *
 * **後台怎麼換行、怎麼空格，前台就照樣顯示**（2026-11-09 廟方：「換行與空白會影響顯示」）。
 * 第一版是「換行與空白一律不算數、前台重排成四句一行」，而且**存檔時就把文字重排掉**——
 * 那只對 510 句都是「三字＋句號」的經文成立。廟方貼進來的是完整經本：有「爐香讚」
 * 「淨心神咒」這種標題、「（唸誦三遍）」這種說明、長短不一的咒語，重排之後標題全黏進
 * 下一句（「爐香讚爐香乍爇。」），而且原本的換行救不回來。
 *
 * 現在：一行就是一行、空行就是段落間的空白、行內的空格照留。
 * 一行太長要折行時，**只在句與句之間折**（每一句是不換行的單位），不會把一句從中間切開；
 * 超過 `MAX_UNBREAKABLE` 字的長句例外，否則手機上會撐出畫面。
 *
 * `scripts/prerender.js` 有自己的一份（它是 node 直接跑的 ESM，import 不了這支 TS），
 * 規則改了兩邊要一起改。
 */

/** 比這更長的一句允許從中間折行（手機一行大約放得下 17 個字） */
export const MAX_UNBREAKABLE = 12;

export type ScriptureToken = { kind: 'phrase'; text: string } | { kind: 'space'; text: string };
/** 一行。`null` 是空行 */
export type ScriptureLine = ScriptureToken[] | null;

/** 一行文字 → 句子與空白。句子到「。，、；！？」為止，標點跟著那一句 */
const tokenize = (line: string): ScriptureToken[] =>
  (line.match(/\s+|[^\s。，、；！？]+[。，、；！？]*|[。，、；！？]+/g) ?? [])
    .map(t => (/^\s+$/.test(t) ? { kind: 'space', text: t } : { kind: 'phrase', text: t }) as ScriptureToken);

export const scriptureLines = (text: string): ScriptureLine[] => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+$/, ''));
  // 頭尾的空行沒有意義，中間連續的空行收成一個
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  const out: ScriptureLine[] = [];
  for (const l of lines) {
    if (!l) { if (out[out.length - 1] !== null) out.push(null); continue; }
    out.push(tokenize(l));
  }
  return out;
};

/** 句數（給後台看的統計） */
export const countPhrases = (text: string): number =>
  scriptureLines(text).reduce((n, l) => n + (l ? l.filter(t => t.kind === 'phrase').length : 0), 0);

/** 後台還沒另存全文時，用 136 段經文接起來、四句一行當起點（2026-11-09 之前全文頁就是這樣來的） */
export const fullTextFromVerses = (verses: ScriptureVerseRecord[]): string => {
  const phrases = verses.map(v => v.verse).join('\n').split('\n')
    .map(l => l.replace(/\s+/g, '')).filter(Boolean)
    .flatMap(l => l.match(/[^。，、；！？]+[。，、；！？]?/g) ?? [l]);
  const lines: string[] = [];
  for (let i = 0; i < phrases.length; i += 4) lines.push(phrases.slice(i, i + 4).join(''));
  return lines.join('\n');
};

/**
 * 解說頁每一段的小標：「第 12 段：林家女。湄州居。…」（2026-11-10 SEO 強化）。
 * 畫面上不顯示（插圖、經文、段號浮水印已經講完了），給搜尋引擎、AI 與讀屏軟體看。
 * **與 scripts/prerender.js 的 `scriptureHeading` 同一套取字**：經文開頭，截在句號上、
 * 34 字以內；沒有經文的段（42 段是純解說）取解說的第一句。兩邊不一致的話，
 * 不執行 JS 的檢索器看到的小標與 Google 算繪後看到的就不同。
 */
const CLIP = 34;
const joinVerse = (s: string) => s.split(/\n+/).map(x => x.trim()).filter(Boolean)
  .reduce((acc, x) => acc + (!acc || /[。，、；：]$/.test(acc) ? '' : '　') + x, '')
  .replace(/[ \t]+/g, '　');
const clipAt = (s: string, n: number) => {
  if (s.length <= n) return s.replace(/。+$/, '');
  const cut = s.slice(0, n);
  const i = cut.lastIndexOf('。');
  return (i >= 8 ? cut.slice(0, i) : cut) + '…';
};
const annProse = (s: string) => {
  const lines = s.split('\n').map(x => x.trim()).filter(Boolean);
  return lines.filter(x => !x.startsWith('•')).join('') || lines.join('');
};
export const sectionHeading = (v: { sectionNumber: number; verse: string; annotation: string }): string => {
  const lead = clipAt(joinVerse(v.verse || '') || annProse(v.annotation || '').split('。')[0], CLIP);
  return lead ? `第 ${v.sectionNumber} 段：${lead}` : `第 ${v.sectionNumber} 段`;
};
