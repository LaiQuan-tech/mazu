/**
 * 太歲點燈的兩件小事，前台、揪團、後台共用。
 *
 * ── 一、標題上的干支年（2026-11-17 廟方：「年度點燈，光明護佑」改成「丁未點燈，太歲護佑」）──
 * 「丁未」寫死的話，明年九月就變成在賣去年的燈，而且沒有人會記得回來改。
 * 所以由日期算：**國曆九月起就換成下一年**——點燈是替「新的一年」點的，
 * 廟方 2026-11 就開始收丁未年（2027）的燈，九月是往前留了旺季前的緩衝。
 * 用算式不用函式庫：`scripts/prerender.js` 有一份同規則的複本（import 不了 TS），改一邊要改另一邊。
 *
 * ── 二、燈種的「請信眾選擇」欄位（同日廟方：「專屬神明燈，還需要有神明燈的表單，須在後台可設定」）──
 * 專屬神明燈要知道是點給哪一尊。後台每個燈種可以設一組「選項名稱＋選項」
 * （例如「指定神明」＋天上聖母／觀世音菩薩⋯⋯），前台選到那個燈種才出現那一格、而且必填。
 *
 * **設定存在 `site_settings` 的 `lamp_choices`（JSON），不加欄位**；
 * **信眾選的值寫進那一筆報名的 `notes` 開頭，格式「【指定神明】天上聖母」**，也不加欄位。
 * 理由是本專案的 DDL 全部要人到 Supabase 後台手動跑，而好幾支 migration 到現在還沒跑——
 * 新開一欄的話，在 migration 跑之前 `insertOptional` 會把那一欄安靜地丟掉，
 * **信眾選了神明、廟方卻看不到**，那比沒有這個欄位更糟。
 * 寫進 notes 則是後台列表、匯出 Excel、通知信全部原本就會顯示，零設定就到得了廟方手上。
 * 要拆成正式欄位時，用 `readChoiceTag()` 把舊資料讀出來回填即可。
 */

const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';

/** 某一個國曆年的農曆年干支（2027 → 丁未） */
export const ganZhiOfYear = (y: number): string =>
  STEMS[(((y - 4) % 10) + 10) % 10] + BRANCHES[(((y - 4) % 12) + 12) % 12];

/** 這一季點的是哪一年的燈：九月起算下一年 */
export const lampYearGanZhi = (d: Date = new Date()): string =>
  ganZhiOfYear(d.getMonth() + 1 >= 9 ? d.getFullYear() + 1 : d.getFullYear());

/** 一個燈種要信眾多選的一格 */
export interface LampChoice {
  /** 欄位名稱，例如「指定神明」 */
  label: string;
  /** 下拉的選項，一行一個 */
  options: string[];
}

/** 燈種 id → 那一格的設定。沒有設定的燈種不在裡面 */
export type LampChoices = Record<string, LampChoice>;

/** 這個燈種有沒有要選的東西（有名稱也有選項才算） */
export const choiceFor = (choices: LampChoices, serviceId: string): LampChoice | null => {
  const c = choices[serviceId];
  return c && c.label.trim() && c.options.length > 0 ? c : null;
};

/** 把信眾選的值放到備註最前面。沒選就原樣回傳 */
export const withChoiceTag = (notes: string | undefined, label: string, value: string | undefined): string | undefined => {
  if (!value) return notes;
  const tag = `【${label.trim()}】${value}`;
  return notes?.trim() ? `${tag}\n${notes}` : tag;
};

/** 從備註讀回選擇（後台顯示用）。不是這個格式就回 null */
export const readChoiceTag = (notes: string | undefined): { label: string; value: string; rest: string } | null => {
  const m = (notes || '').match(/^【([^】]{1,20})】([^\n]*)\n?([\s\S]*)$/);
  return m ? { label: m[1], value: m[2].trim(), rest: m[3] } : null;
};
