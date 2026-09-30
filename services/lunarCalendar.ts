/**
 * 農曆共用工具
 *
 * ── 為什麼要有這個檔 ──
 * 月份／日期的中文字表原本只寫在 BirthDatePicker.tsx 裡。歲時節令也要顯示
 * 「農曆三月廿三」，若在那邊再抄一份，就會變成兩份平行維護的字表——會員中心
 * 當初複製整套曆法邏輯，正是資料庫裡出現兩種生日格式的原因（見 CLAUDE.md）。
 * 所以先抽到這裡共用，兩邊只有一份。
 *
 * **月份一律用這裡的字表，不要用 lunar-javascript 的 getMonthInChinese()**：
 * 函式庫在十二月會給簡體「腊」，而全站與資料庫用的是繁體「臘」。舊資料曾因此
 * 讓 parseBirthDate 的 indexOf 找不到而靜默解析失敗。
 */
import { Lunar, Solar } from 'lunar-javascript';
import { DeityFeast } from '../types';

// 索引 = 月數 - 1
export const LUNAR_MONTH_VALUES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '臘'];
export const LUNAR_MONTH_LABELS_BASE = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '臘月'];
export const LUNAR_DAYS = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

/** 二十四節氣，依一年之中的先後排列 */
export const JIEQI_NAMES = [
  '小寒', '大寒', '立春', '雨水', '驚蟄', '春分', '清明', '穀雨', '立夏', '小滿', '芒種', '夏至',
  '小暑', '大暑', '立秋', '處暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
];

/** 「三月廿三」。isLeap 為真時前面加「閏」 */
export function formatLunarMonthDay(month: number, day: number, isLeap = false): string {
  const m = LUNAR_MONTH_LABELS_BASE[month - 1] ?? `${month}月`;
  const d = LUNAR_DAYS[day - 1] ?? `${day}日`;
  return `${isLeap ? '閏' : ''}${m}${d}`;
}

/**
 * 農曆轉國曆。回傳 'YYYY-MM-DD'，該年沒有這個日子則回傳 null。
 *
 * 兩種會回 null 的情況都要留給呼叫端處理，不要自己吞掉：
 * (1) 指定了閏月但該年沒有那個閏月（閏月每 19 年才輪 7 次）；
 * (2) 農曆三十日，但該月只有二十九天（小月）。
 * 靜默改用鄰近日期會讓廟方看到錯的日期卻毫無察覺。
 */
export function lunarToSolar(year: number, month: number, day: number, isLeap = false): string | null {
  try {
    // lunar-javascript 用負數月份代表閏月
    const lunar = Lunar.fromYmd(year, isLeap ? -month : month, day);
    const solar = lunar.getSolar();
    // 反查確認：日期不存在時函式庫會回傳鄰近的日子而不是報錯
    const back = solar.getLunar();
    if (Math.abs(back.getMonth()) !== month || back.getDay() !== day) return null;
    if ((back.getMonth() < 0) !== isLeap) return null;
    return solar.toYmd();
  } catch {
    return null;
  }
}

/**
 * 求指定國曆年裡某個節氣落在哪一天，回傳 'YYYY-MM-DD'。
 *
 * 不用 getJieQiTable()：那張表是以「農曆年」為範圍的，查 2026 會拿到
 * 2025-12-21 的冬至（實測），跟「2026 年的冬至」不是同一件事。
 * 這裡直接掃過該國曆年的每一天，慢一點但語意明確、不會弄錯年份。
 */
export function jieQiInYear(name: string, year: number): string | null {
  for (let m = 1; m <= 12; m++) {
    const daysInMonth = new Date(year, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      if (Lunar.fromDate(new Date(year, m - 1, d)).getJieQi() === name) {
        return Solar.fromYmd(year, m, d).toYmd();
      }
    }
  }
  return null;
}

/** 國曆 'YYYY-MM-DD' → 「農曆三月廿三」，供活動列顯示對應的農曆 */
export function solarToLunarLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return '';
  const lunar = Solar.fromYmd(y, m, d).getLunar();
  return `農曆${formatLunarMonthDay(Math.abs(lunar.getMonth()), lunar.getDay(), lunar.getMonth() < 0)}`;
}

/** 'YYYY-MM-DD' → 「日一二三四五六」中的一個字 */
export function weekdayLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return '日一二三四五六'[new Date(y, m - 1, d).getDay()] ?? '';
}

/** resolveFeastDate 的結果 */
export interface ResolvedFeastDate {
  date: string;      // 'YYYY-MM-DD'
  /** 農曆三十遇小月，已改列該月最後一天（廿九）。呼叫端必須在畫面上註明 */
  adjusted: boolean;
}

/**
 * 把一筆行事曆項目換算成指定國曆年的日期；該年沒有這個日子則回傳 null。
 *
 * ── 農曆三十遇小月 ──
 * 農曆月只有二十九或三十天，「三十」講的就是月底最後一天。小月那年沒有三十，
 * 民間一律以廿九為準——**鬼門關（七月三十）年年都關**，2026 這種小月年是提前
 * 一天，不是那年不關。所以這裡回退到廿九並把 adjusted 設為 true，由呼叫端標示
 * 「今年小月，改列廿九」。回 null 讓前台寫「今年無此日」，在這裡是錯的。
 * （實測 2024–2035 十二年，七月是小月的只有 2026、2029、2035 三年。）
 *
 * 指定閏月但該年沒閏則仍回傳 null：那是真的沒有，隨便挑個月頂替會讓廟方看到
 * 錯的日期卻毫無察覺。
 */
export function resolveFeastDate(feast: DeityFeast, year: number): ResolvedFeastDate | null {
  if (feast.calendarType === 'lunar') {
    if (!feast.lunarMonth || !feast.lunarDay) return null;
    const exact = lunarToSolar(year, feast.lunarMonth, feast.lunarDay, feast.isLeapMonth);
    if (exact) return { date: exact, adjusted: false };
    if (feast.lunarDay === 30) {
      // 農曆月至少二十九天，廿九一定存在（除非指定的閏月該年沒有，那就一起回 null）
      const monthEnd = lunarToSolar(year, feast.lunarMonth, 29, feast.isLeapMonth);
      if (monthEnd) return { date: monthEnd, adjusted: true };
    }
    return null;
  }
  if (feast.calendarType === 'solar') {
    if (!feast.solarMonth || !feast.solarDay) return null;
    const d = new Date(year, feast.solarMonth - 1, feast.solarDay);
    // 2/30 這種不存在的日期，Date 會自動滾到下個月，要擋掉
    if (d.getMonth() !== feast.solarMonth - 1 || d.getDate() !== feast.solarDay) return null;
    const ymd = `${year}-${String(feast.solarMonth).padStart(2, '0')}-${String(feast.solarDay).padStart(2, '0')}`;
    return { date: ymd, adjusted: false };
  }
  if (feast.calendarType === 'jieqi' && feast.jieqi) {
    const d = jieQiInYear(feast.jieqi, year);
    return d ? { date: d, adjusted: false } : null;
  }
  return null;
}

/** 「農曆三月廿三」／「國曆 5 月 9 日」／「冬至」——後台與前台共用的日期寫法 */
export function feastRuleLabel(feast: DeityFeast): string {
  if (feast.calendarType === 'lunar' && feast.lunarMonth && feast.lunarDay) {
    return `農曆${formatLunarMonthDay(feast.lunarMonth, feast.lunarDay, feast.isLeapMonth)}`;
  }
  if (feast.calendarType === 'solar' && feast.solarMonth && feast.solarDay) {
    return `國曆 ${feast.solarMonth} 月 ${feast.solarDay} 日`;
  }
  if (feast.calendarType === 'jieqi' && feast.jieqi) return `節氣・${feast.jieqi}`;
  return '（日期未設定）';
}
