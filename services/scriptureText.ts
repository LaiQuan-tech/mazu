import { ScriptureVerseRecord } from '../types';

/**
 * 天上聖母經全文的「句」——全文頁（`ScriptureFullText`）與後台全文編輯共用同一條拆法，
 * 後台預覽算出來的句數才會跟前台排出來的一樣。
 *
 * 一句到「。，、；！？」為止，標點跟著那一句；換行與空白一律不算數（廟方在後台怎麼換行
 * 都可以，前台一律四句一行重排）。沒有標點的舊資料就是一行一句。
 *
 * `scripts/prerender.js` 有自己的一份（它是 node 直接跑的 ESM，import 不了這支 TS），
 * 規則改了兩邊要一起改。
 */
export const scripturePhrases = (text: string): string[] =>
  text.split('\n')
    .map(l => l.replace(/\s+/g, ''))
    .filter(Boolean)
    .flatMap(l => l.match(/[^。，、；！？]+[。，、；！？]?/g) ?? [l]);

/** 後台還沒另存全文時，用 136 段經文接起來當全文（2026-11-09 之前全文頁就是這樣來的） */
export const fullTextFromVerses = (verses: ScriptureVerseRecord[]): string =>
  verses.map(v => v.verse).join('\n');

/** 給後台編輯框用的排版：四句一行，跟前台看到的一樣，比較好對照 */
export const formatFourPerLine = (text: string): string => {
  const ph = scripturePhrases(text);
  const lines: string[] = [];
  for (let i = 0; i < ph.length; i += 4) lines.push(ph.slice(i, i + 4).join(''));
  return lines.join('\n');
};
