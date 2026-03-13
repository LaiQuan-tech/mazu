/**
 * BirthDatePicker —— 農曆 / 國曆 生日選擇器（可重複使用）
 * 與 MemberPortal.tsx 的通訊錄生日欄位邏輯相同，
 * 適用於點燈、問事、祈福等前台服務報名表。
 */
import React, { useState } from 'react';
import { Solar, Lunar, LunarYear } from 'lunar-javascript';
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

const YEAR_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '吉' },
  ...Array.from({ length: THIS_YEAR - 1911 }, (_, i) => {
    const g = THIS_YEAR - i;
    const roc = g - 1911;
    return { value: g, label: `${g}年（民國${roc === 1 ? '元' : roc}年）` };
  }),
];

const SOLAR_MONTH_OPTIONS = [
  { value: 0, label: '吉' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}月` })),
];

const LUNAR_MONTH_VALUES = ['正','二','三','四','五','六','七','八','九','十','冬','臘'];
const LUNAR_MONTH_LABELS_BASE = ['正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','冬月','臘月'];
const LUNAR_DAYS = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];

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
  const opts: { value: string; label: string }[] = [{ value: '0', label: '吉' }];
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
    return {
      birthDate: `民國${y - 1911}年農曆${isLeap ? '閏' : ''}${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
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

function parseBirthDate(s: string): { gregorianYear: number; monthValue: string; dayNum: number; birthHour: string } | null {
  if (!s) return null;
  const hourMatch = s.match(/([子丑寅卯辰巳午未申酉戌亥]時)$/);
  const birthHour = hourMatch ? hourMatch[1] : '';
  const d = birthHour ? s.slice(0, -2) : s;
  if (!d) return { gregorianYear: 0, monthValue: '0', dayNum: 0, birthHour };
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
}

// ── 元件 ───────────────────────────────────────────────────────────────────────

const BirthDatePicker: React.FC<BirthDatePickerProps> = ({ birthDate: initBirthDate, onChange }) => {
  const parsedInitial = parseBirthDate(initBirthDate);

  const [inputMode, setInputMode] = useState<'solar' | 'lunar'>(parsedInitial ? 'lunar' : 'solar');
  const [currentBirthDate, setCurrentBirthDate] = useState(initBirthDate);

  // 國曆下拉
  const [solarYear, setSolarYear] = useState(0);
  const [solarMonth, setSolarMonth] = useState(0);
  const [solarDay, setSolarDay] = useState(0);

  // 農曆下拉
  const [lunarYear, setLunarYear] = useState(() => parsedInitial?.gregorianYear ?? 0);
  const [lunarMonthValue, setLunarMonthValue] = useState(() => parsedInitial?.monthValue ?? '0');
  const [lunarDay, setLunarDay] = useState(() => parsedInitial?.dayNum ?? 0);

  // 時辰
  const [birthHour, setBirthHour] = useState(() => parsedInitial?.birthHour ?? '');

  // ── apply helpers ──────────────────────────────────────────────────────────

  const applySolar = (y: number, m: number, d: number, hour: string) => {
    const result = buildSolarResult(y, m, d);
    const newDate = result ? result.birthDate + hour : hour;
    setCurrentBirthDate(newDate);
    onChange(newDate, result?.zodiac);
  };

  const applyLunar = (y: number, mv: string, d: number, hour: string) => {
    const result = buildLunarResult(y, mv, d);
    const newDate = result ? result.birthDate + hour : hour;
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
      {/* 國曆 / 農曆 切換 */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">生日</label>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
          <button type="button" onClick={() => setInputMode('solar')}
            className={`px-3 py-1 transition-colors ${inputMode === 'solar' ? 'bg-temple-red text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            國曆
          </button>
          <button type="button" onClick={() => setInputMode('lunar')}
            className={`px-3 py-1 transition-colors ${inputMode === 'lunar' ? 'bg-temple-red text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            農曆
          </button>
        </div>
      </div>

      {inputMode === 'solar' ? (
        <div className="space-y-2">
          {/* 年 */}
          <select value={solarYear} onChange={e => handleSolarYearChange(Number(e.target.value))} className={selCls}>
            {YEAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {/* 月 + 日 */}
          <div className="grid grid-cols-2 gap-2">
            <select value={solarMonth} onChange={e => handleSolarMonthChange(Number(e.target.value))} className={selCls}>
              {SOLAR_MONTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={solarDay} onChange={e => handleSolarDayChange(Number(e.target.value))} className={selCls}>
              <option value={0}>吉</option>
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
              <span className="text-xs text-gray-400 ml-1">（農曆換算）</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* 年 */}
          <select value={lunarYear} onChange={e => handleLunarYearChange(Number(e.target.value))} className={selCls}>
            {YEAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {/* 月 + 日 */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={lunarMonthValid ? lunarMonthValue : (lunarMonthOptions[0]?.value ?? '1')}
              onChange={e => handleLunarMonthChange(e.target.value)} className={selCls}>
              {lunarMonthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={lunarDay} onChange={e => handleLunarDayChange(Number(e.target.value))} className={selCls}>
              <option value={0}>吉</option>
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

      {/* 時辰 */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">時辰（可選）</label>
        <select value={birthHour} onChange={e => handleBirthHourChange(e.target.value)} className={selCls}>
          {SHICHEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
};

export default BirthDatePicker;
