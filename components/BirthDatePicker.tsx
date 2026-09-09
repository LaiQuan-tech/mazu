/**
 * BirthDatePicker —— 農曆 / 國曆 生日選擇器（可重複使用）
 * 與 MemberPortal.tsx 的通訊錄生日欄位邏輯相同，
 * 適用於點燈、問事、祈福等前台服務報名表。
 */
import React, { useState } from 'react';
import { Solar, Lunar, LunarYear } from 'lunar-javascript';
import { LUNAR_MONTH_VALUES, LUNAR_MONTH_LABELS_BASE, LUNAR_DAYS } from '../services/lunarCalendar';
import { RefreshCw } from 'lucide-react';
import { ZodiacSign } from '../types';

// ── 常數（與 MemberPortal.tsx 保持一致）────────────────────────────────────────

const SHENGXIAO_MAP: Record<string, ZodiacSign> = {
  '鼠': ZodiacSign.RAT,   '牛': ZodiacSign.OX,     '虎': ZodiacSign.TIGER,
  '兔': ZodiacSign.RABBIT,'龙': ZodiacSign.DRAGON,  '龍': ZodiacSign.DRAGON,
  '蛇': ZodiacSign.SNAKE, '马': ZodiacSign.HORSE,   '馬': ZodiacSign.HORSE,
  '羊': ZodiacSign.GOAT,  '猴': ZodiacSign.MONKEY,  '鸡': ZodiacSign.ROOSTER,
  '雞': ZodiacSign.ROOSTER,'狗': ZodiacSign.DOG,    '猪': ZodiacSign.PIG,
  '豬': ZodiacSign.PIG,
};

const THIS_YEAR = new Date().getFullYear();

// 國曆與農曆年份一律以民國年顯示（民國72年），value 仍為西元年供換算
const YEAR_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '吉年' },
  ...Array.from({ length: THIS_YEAR - 1911 }, (_, i) => {
    const g = THIS_YEAR - i;
    const roc = g - 1911;
    return { value: g, label: `民國${roc === 1 ? '元' : roc}年` };
  }),
];

const SOLAR_MONTH_OPTIONS = [
  { value: 0, label: '吉月' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}月` })),
];

// 農曆字表已抽到 services/lunarCalendar.ts 共用（歲時祭曆也要用同一份）。
// 兩份平行維護正是會員中心當初長出兩種生日格式的原因，見 CLAUDE.md。

const SHICHEN_OPTIONS = [
  { value: '', label: '吉' },
  { value: '子時', label: '子時（23–01時）' },
  { value: '丑時', label: '丑時（01–03時）' },
  { value: '寅時', label: '寅時（03–05時）' },
  { value: '卯時', label: '卯時（05–07時）' },
  { value: '辰時', label: '辰時（07–09時）' },
  { value: '巳時', label: '巳時（09–11時）' },
  { value: '午時', label: '午時（11–13時）' },
  { value: '未時', label: '未時（13–15時）' },
  { value: '申時', label: '申時（15–17時）' },
  { value: '酉時', label: '酉時（17–19時）' },
  { value: '戌時', label: '戌時（19–21時）' },
  { value: '亥時', label: '亥時（21–23時）' },
];

// ── 工具函式 ────────────────────────────────────────────────────────────────────

function solarDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getLunarMonthOptions(gregorianYear: number): { value: string; label: string }[] {
  let leapMonth = 0;
  if (gregorianYear > 0) {
    try { leapMonth = LunarYear.fromYear(gregorianYear).getLeapMonth(); } catch { leapMonth = 0; }
  }
  const opts: { value: string; label: string }[] = [{ value: '0', label: '吉月' }];
  for (let m = 1; m <= 12; m++) {
    opts.push({ value: String(m), label: LUNAR_MONTH_LABELS_BASE[m - 1] });
    if (m === leapMonth) opts.push({ value: `L${m}`, label: `閏${LUNAR_MONTH_LABELS_BASE[m - 1]}` });
  }
  return opts;
}

function buildSolarResult(y: number, m: number, d: number): { birthDate: string; zodiac: ZodiacSign } | null {
  if (!y || !m || !d) return null;
  try {
    const lunar = Solar.fromYmd(y, m, d).getLunar();
    const isLeap = lunar.getMonth() < 0;
    // 農曆年不等於國曆年！春節之前的國曆日期，農曆仍屬前一年。
    // 例：國曆 2018-02-01（民國107）→ 農曆 2017（民國106）臘月十六。
    // 這裡若沿用國曆年，會寫出「民國107年農曆臘月十六」這種不存在的日期。
    const lunarRoc = lunar.getYear() - 1911;
    // 月份用專案自己的字表（依月數取），不要用函式庫的 getMonthInChinese()：
    // 它十二月回傳簡體「腊」，與下拉選單的「臘」不一致，會導致回頭解析失敗。
    const monthChinese = LUNAR_MONTH_VALUES[Math.abs(lunar.getMonth()) - 1];
    return {
      birthDate: `民國${lunarRoc}年農曆${isLeap ? '閏' : ''}${monthChinese}月${lunar.getDayInChinese()}`,
      zodiac: SHENGXIAO_MAP[lunar.getYearShengXiao()] ?? ZodiacSign.RAT,
    };
  } catch { return null; }
}

function buildLunarResult(gregorianYear: number, monthValue: string, dayNum: number): { birthDate: string; zodiac?: ZodiacSign } | null {
  if (monthValue === '0' || !monthValue) {
    if (gregorianYear > 0) return { birthDate: `民國${gregorianYear - 1911}年` };
    return null;
  }
  const isLeap = monthValue.startsWith('L');
  const monthNum = parseInt(isLeap ? monthValue.slice(1) : monthValue);
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return null;
  const monthChinese = LUNAR_MONTH_VALUES[monthNum - 1];
  const leapPrefix = isLeap ? '閏' : '';
  const monthStr = `農曆${leapPrefix}${monthChinese}月`;
  if (dayNum <= 0) {
    if (gregorianYear > 0) return { birthDate: `民國${gregorianYear - 1911}年${monthStr}` };
    return { birthDate: monthStr };
  }
  const dayChinese = LUNAR_DAYS[dayNum - 1];
  const prefix = `${monthStr}${dayChinese}`;
  if (gregorianYear > 0) {
    const rocYear = gregorianYear - 1911;
    try {
      const lunar = Lunar.fromYmd(gregorianYear, isLeap ? -monthNum : monthNum, dayNum);
      return { birthDate: `民國${rocYear}年${prefix}`, zodiac: SHENGXIAO_MAP[lunar.getYearShengXiao()] };
    } catch {
      return { birthDate: `民國${rocYear}年${prefix}` };
    }
  }
  return { birthDate: prefix };
}

function parseBirthDate(s: string): { gregorianYear: number; monthValue: string; dayNum: number; birthHour: string; solarYear?: number; solarMonth?: number; solarDay?: number } | null {
  if (!s) return null;
  const hourMatch = s.match(/([子丑寅卯辰巳午未申酉戌亥]時)$/);
  const birthHour = hourMatch ? hourMatch[1] : '';
  const d = birthHour ? s.slice(0, -2) : s;
  if (!d) return { gregorianYear: 0, monthValue: '0', dayNum: 0, birthHour };
  // 合併格式（本站的標準）：民國72年6月20日（農曆五月初十）
  // 括號外是國曆、括號內是農曆；跨年時農曆會多帶年份：（農曆68年臘月初八）
  // 這一段必須放在最前面——底下的農曆規則會誤判它，把「6月20日（農曆五」當成月份。
  const merged = d.match(/^民國(\d+)年(\d+)月(\d+)日（農曆(?:(\d+)年)?(閏?)(.+?)月(.+?)）$/);
  if (merged) {
    const mi = LUNAR_MONTH_VALUES.indexOf(merged[6]) + 1;
    const di = LUNAR_DAYS.indexOf(merged[7]) + 1;
    if (mi > 0 && di > 0) {
      return {
        gregorianYear: (merged[4] ? parseInt(merged[4]) : parseInt(merged[1])) + 1911,
        monthValue: merged[5] === '閏' ? `L${mi}` : String(mi),
        dayNum: di,
        birthHour,
        // 國曆欄位：讓選單能直接還原成使用者當初填的那三個值
        solarYear: parseInt(merged[1]) + 1911,
        solarMonth: parseInt(merged[2]),
        solarDay: parseInt(merged[3]),
      };
    }
  }

  const full = d.match(/^民國(\d+)年農曆(閏?)(.+)月(.+)$/);
  if (full) {
    const mi = LUNAR_MONTH_VALUES.indexOf(full[3]) + 1;
    const di = LUNAR_DAYS.indexOf(full[4]) + 1;
    if (mi > 0 && di > 0) return { gregorianYear: parseInt(full[1]) + 1911, monthValue: full[2] === '閏' ? `L${mi}` : String(mi), dayNum: di, birthHour };
  }
  const monthOnly = d.match(/^民國(\d+)年農曆(閏?)(.+)月$/);
  if (monthOnly) {
    const mi = LUNAR_MONTH_VALUES.indexOf(monthOnly[3]) + 1;
    if (mi > 0) return { gregorianYear: parseInt(monthOnly[1]) + 1911, monthValue: monthOnly[2] === '閏' ? `L${mi}` : String(mi), dayNum: 0, birthHour };
  }
  const yearOnly = d.match(/^民國(\d+)年$/);
  if (yearOnly) return { gregorianYear: parseInt(yearOnly[1]) + 1911, monthValue: '0', dayNum: 0, birthHour };
  const short = d.match(/^農曆(閏?)(.+)月(.+)$/);
  if (short) {
    const mi = LUNAR_MONTH_VALUES.indexOf(short[2]) + 1;
    const di = LUNAR_DAYS.indexOf(short[3]) + 1;
    if (mi > 0 && di > 0) return { gregorianYear: 0, monthValue: short[1] === '閏' ? `L${mi}` : String(mi), dayNum: di, birthHour };
  }
  const shortMonth = d.match(/^農曆(閏?)(.+)月$/);
  if (shortMonth) {
    const mi = LUNAR_MONTH_VALUES.indexOf(shortMonth[2]) + 1;
    if (mi > 0) return { gregorianYear: 0, monthValue: shortMonth[1] === '閏' ? `L${mi}` : String(mi), dayNum: 0, birthHour };
  }
  return null;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface BirthDatePickerProps {
  /** 當前農曆生日字串（初始化用），父元件維護 */
  birthDate: string;
  /** 當前生肖（初始化顯示用），父元件維護 */
  zodiac?: ZodiacSign;
  /**
   * 使用者改變生日時觸發
   * @param birthDate 新農曆生日字串
   * @param zodiac 自動推算的生肖（可能為 undefined）
   */
  onChange: (birthDate: string, zodiac?: ZodiacSign) => void;
  /** 隱藏內建「生日」標題列（由外層自訂標題時使用） */
  hideLabel?: boolean;
}

// ── 元件 ───────────────────────────────────────────────────────────────────────

const BirthDatePicker: React.FC<BirthDatePickerProps> = ({ birthDate: initBirthDate, onChange, hideLabel }) => {
  const parsedInitial = parseBirthDate(initBirthDate);

  // **一律以國曆為預設**。以前部分表單只要有舊值就切到農曆模式，
  // 造成同一個網站兩種輸入法、兩種儲存格式。現在只有一種主路徑，
  // 「我只知道農曆」是給不記得國曆生日的長者用的次要入口。
  const [inputMode, setInputMode] = useState<'solar' | 'lunar'>('solar');
  const [currentBirthDate, setCurrentBirthDate] = useState(initBirthDate);

  // 國曆下拉
  const [solarYear, setSolarYear] = useState(() => parsedInitial?.solarYear ?? 0);
  const [solarMonth, setSolarMonth] = useState(() => parsedInitial?.solarMonth ?? 0);
  const [solarDay, setSolarDay] = useState(() => parsedInitial?.solarDay ?? 0);

  // 農曆下拉
  const [lunarYear, setLunarYear] = useState(() => parsedInitial?.gregorianYear ?? 0);
  const [lunarMonthValue, setLunarMonthValue] = useState(() => parsedInitial?.monthValue ?? '0');
  const [lunarDay, setLunarDay] = useState(() => parsedInitial?.dayNum ?? 0);

  // 時辰
  const [birthHour, setBirthHour] = useState(() => parsedInitial?.birthHour ?? '');

  // ── apply helpers ──────────────────────────────────────────────────────────

  const applySolar = (y: number, m: number, d: number, hour: string) => {
    const result = buildSolarResult(y, m, d);
    let dateStr = result ? result.birthDate : '';
    // **全站統一的儲存格式**：同時含完整國曆與農曆，例「民國72年6月20日（農曆正月廿六）」。
    // 後台可直接拆成國曆／農曆兩欄，不必回頭換算。
    if (result && y > 0 && m > 0 && d > 0) {
      const solarRoc = y - 1911;
      const parts = result.birthDate.match(/^民國(\d+)年(.+)$/);
      const lunarRoc = parts ? Number(parts[1]) : solarRoc;
      const lunarPart = parts ? parts[2] : result.birthDate; // 「農曆臘月十六」
      // 春節前的日期，農曆年會比國曆年少一年。這種情況要把農曆年標出來，
      // 否則「民國107年2月1日（農曆臘月十六）」會被讀成 107 年的臘月，差了整整一年。
      const lunarLabel = lunarRoc === solarRoc
        ? lunarPart
        : lunarPart.replace(/^農曆/, `農曆${lunarRoc}年`);
      dateStr = `民國${solarRoc}年${m}月${d}日（${lunarLabel}）`;
    }
    const newDate = dateStr + hour;
    setCurrentBirthDate(newDate);
    onChange(newDate, result?.zodiac);
  };

  const applyLunar = (y: number, mv: string, d: number, hour: string) => {
    const result = buildLunarResult(y, mv, d);
    let dateStr = result ? result.birthDate : '';
    // 從農曆推回國曆，輸出與國曆輸入完全相同的合併格式。
    //
    // 為什麼要這樣：以前農曆模式只存「民國72年農曆五月初十」，國曆模式存合併字串，
    // 同一個欄位存在兩種格式，後台匯出要分兩路處理，而且看到一筆純農曆的資料時
    // 無從得知使用者當初是不是選錯了模式。統一之後只有一種格式。
    if (result && y > 0 && mv !== '0' && d > 0) {
      const isLeap = mv.startsWith('L');
      const monthNum = parseInt(isLeap ? mv.slice(1) : mv);
      try {
        const solar = Lunar.fromYmd(y, isLeap ? -monthNum : monthNum, d).getSolar();
        const solarRoc = solar.getYear() - 1911;
        const parts = result.birthDate.match(/^民國(\d+)年(.+)$/);
        const lunarRoc = parts ? Number(parts[1]) : solarRoc;
        const lunarPart = parts ? parts[2] : result.birthDate;
        // 農曆年與國曆年不同時（春節前出生）要把農曆年標出來，理由同 buildSolarResult
        const lunarLabel = lunarRoc === solarRoc
          ? lunarPart
          : lunarPart.replace(/^農曆/, `農曆${lunarRoc}年`);
        dateStr = `民國${solarRoc}年${solar.getMonth()}月${solar.getDay()}日（${lunarLabel}）`;
      } catch { /* 換算失敗就沿用純農曆字串，總比什麼都不存好 */ }
    }
    const newDate = dateStr + hour;
    setCurrentBirthDate(newDate);
    onChange(newDate, result?.zodiac);
  };

  // ── 計算值 ─────────────────────────────────────────────────────────────────

  const solarMaxDays = (solarYear > 0 && solarMonth > 0) ? solarDaysInMonth(solarYear, solarMonth) : 31;
  const lunarMonthOptions = getLunarMonthOptions(lunarYear);
  const lunarMonthValid = lunarMonthOptions.some(o => o.value === lunarMonthValue);

  // ── 事件處理 ───────────────────────────────────────────────────────────────

  const handleSolarYearChange = (y: number) => {
    setSolarYear(y);
    const maxD = (y > 0 && solarMonth > 0) ? solarDaysInMonth(y, solarMonth) : 31;
    const d = solarDay > 0 ? Math.min(solarDay, maxD) : 0;
    setSolarDay(d);
    applySolar(y, solarMonth, d, birthHour);
  };
  const handleSolarMonthChange = (m: number) => {
    setSolarMonth(m);
    const maxD = (solarYear > 0 && m > 0) ? solarDaysInMonth(solarYear, m) : 31;
    const d = solarDay > 0 ? Math.min(solarDay, maxD) : 0;
    setSolarDay(d);
    applySolar(solarYear, m, d, birthHour);
  };
  const handleSolarDayChange = (d: number) => { setSolarDay(d); applySolar(solarYear, solarMonth, d, birthHour); };

  const handleLunarYearChange = (y: number) => {
    setLunarYear(y);
    const newOptions = getLunarMonthOptions(y);
    let mv = lunarMonthValue;
    if (mv !== '0' && !newOptions.some(o => o.value === mv)) {
      mv = mv.startsWith('L') ? mv.slice(1) : mv;
      setLunarMonthValue(mv);
    }
    applyLunar(y, mv, lunarDay, birthHour);
  };
  const handleLunarMonthChange = (mv: string) => { setLunarMonthValue(mv); applyLunar(lunarYear, mv, lunarDay, birthHour); };
  const handleLunarDayChange = (d: number) => { setLunarDay(d); applyLunar(lunarYear, lunarMonthValue, d, birthHour); };

  const handleBirthHourChange = (hour: string) => {
    setBirthHour(hour);
    // 時辰不影響生肖，直接重算整個日期（帶入新時辰），讓 zodiac 正確傳給父層
    if (inputMode === 'solar') {
      applySolar(solarYear, solarMonth, solarDay, hour);
    } else {
      applyLunar(lunarYear, lunarMonthValue, lunarDay, hour);
    }
  };

  // ── 樣式 ───────────────────────────────────────────────────────────────────

  const selCls = "w-full px-2 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none bg-white";

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      {/*
        以前這裡是「國曆／農曆」兩顆對等的切換鈕。問題不在複雜，而在**選錯無法察覺**：
        信眾在農曆模式下填了國曆生日，系統照收，事後沒有任何方法分辨對錯。
        改成國曆為唯一主路徑，農曆是一行不起眼的次要入口——會走進去的，
        是真的只記得農曆的人。
      */}
      <div className={`flex items-center justify-between gap-2 ${hideLabel ? 'hidden' : ''}`}>
        <label className="text-xs font-medium text-gray-600">
          生日{inputMode === 'solar' ? '（請填國曆，自動換算農曆）' : '（農曆輸入，自動換算國曆）'}
        </label>
        {/* py-1.5 是為了點擊區：只有文字時實測 16px 高，低於 WCAG 2.2 的 24px。
            這顆特別重要——它是給不記得國曆生日的長者用的入口，那正是最需要
            大一點目標的人。加內距不影響版面（同一列的 label 本來就比較高）。 */}
        <button
          type="button"
          onClick={() => setInputMode(m => (m === 'solar' ? 'lunar' : 'solar'))}
          className="text-xs text-temple-red underline underline-offset-2 hover:text-temple-dark shrink-0 py-1.5 -my-1.5"
        >
          {inputMode === 'solar' ? '我只知道農曆' : '改用國曆'}
        </button>
      </div>

      {inputMode === 'solar' ? (
        <div className="space-y-2">
          {/* 年 */}
          <select aria-label="出生年（國曆）" value={solarYear} onChange={e => handleSolarYearChange(Number(e.target.value))} className={selCls}>
            {YEAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {/* 月 + 日 */}
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="出生月（國曆）" value={solarMonth} onChange={e => handleSolarMonthChange(Number(e.target.value))} className={selCls}>
              {SOLAR_MONTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select aria-label="出生日（國曆）" value={solarDay} onChange={e => handleSolarDayChange(Number(e.target.value))} className={selCls}>
              <option value={0}>吉日</option>
              {Array.from({ length: solarMaxDays }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>{d}日</option>
              ))}
            </select>
          </div>
          {/* 換算結果 */}
          {currentBirthDate && (
            <div className="flex items-center gap-1.5 bg-temple-bg border border-temple-gold/30 rounded-lg px-3 py-2">
              <RefreshCw className="w-3.5 h-3.5 text-temple-gold flex-shrink-0" />
              <span className="text-sm text-temple-dark font-medium">{currentBirthDate}</span>
              <span className="text-xs text-gray-400 ml-1">（自動換算）</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* 年 */}
          <select aria-label="出生年（農曆）" value={lunarYear} onChange={e => handleLunarYearChange(Number(e.target.value))} className={selCls}>
            {YEAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {/* 月 + 日 */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={lunarMonthValid ? lunarMonthValue : (lunarMonthOptions[0]?.value ?? '1')}
              onChange={e => handleLunarMonthChange(e.target.value)} className={selCls}>
              {lunarMonthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select aria-label="出生日（農曆）" value={lunarDay} onChange={e => handleLunarDayChange(Number(e.target.value))} className={selCls}>
              <option value={0}>吉日</option>
              {LUNAR_DAYS.map((d, i) => <option key={i} value={i + 1}>{d}</option>)}
            </select>
          </div>
          {/* 目前結果 */}
          {currentBirthDate && (
            <div className="flex items-center gap-1.5 bg-temple-bg border border-temple-gold/30 rounded-lg px-3 py-2 flex-wrap">
              <span className="text-sm text-temple-dark font-medium">{currentBirthDate}</span>
              {!lunarYear && (
                <span className="text-xs text-gray-400 ml-1">（未填年份，生肖請手動選）</span>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default BirthDatePicker;
