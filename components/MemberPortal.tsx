import React, { useState, useEffect } from 'react';
import { X, User, LogOut, Plus, Pencil, Trash2, CheckCircle2, AlertCircle, Eye, EyeOff, BookUser, RefreshCw } from 'lucide-react';
import { Solar, Lunar, LunarYear } from 'lunar-javascript';
import { supabase } from '../services/supabase';
import { getMemberContacts, createMemberContact, updateMemberContact, deleteMemberContact, getProfile, saveProfile } from '../services/supabase';
import { MemberContact, MemberContactData, ProfileData, ZodiacSign } from '../types';

// 簡繁對映（lunar-javascript 部分生肖用簡體）
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
  // Month = '0' → only year (if any)
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
  // Day = 0 → year + month only (no day, can't compute zodiac)
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
  // 提取時辰（結尾兩字）
  const hourMatch = s.match(/([子丑寅卯辰巳午未申酉戌亥]時)$/);
  const birthHour = hourMatch ? hourMatch[1] : '';
  const d = birthHour ? s.slice(0, -2) : s;
  if (!d) return { gregorianYear: 0, monthValue: '0', dayNum: 0, birthHour };
  // 民國XX年農曆[閏]XX月XX
  const full = d.match(/^民國(\d+)年農曆(閏?)(.+)月(.+)$/);
  if (full) {
    const mi = LUNAR_MONTH_VALUES.indexOf(full[3]) + 1;
    const di = LUNAR_DAYS.indexOf(full[4]) + 1;
    if (mi > 0 && di > 0) return { gregorianYear: parseInt(full[1]) + 1911, monthValue: full[2] === '閏' ? `L${mi}` : String(mi), dayNum: di, birthHour };
  }
  // 民國XX年農曆[閏]XX月（無日）
  const monthOnly = d.match(/^民國(\d+)年農曆(閏?)(.+)月$/);
  if (monthOnly) {
    const mi = LUNAR_MONTH_VALUES.indexOf(monthOnly[3]) + 1;
    if (mi > 0) return { gregorianYear: parseInt(monthOnly[1]) + 1911, monthValue: monthOnly[2] === '閏' ? `L${mi}` : String(mi), dayNum: 0, birthHour };
  }
  // 民國XX年（無月日）
  const yearOnly = d.match(/^民國(\d+)年$/);
  if (yearOnly) return { gregorianYear: parseInt(yearOnly[1]) + 1911, monthValue: '0', dayNum: 0, birthHour };
  // 農曆[閏]XX月XX（無年）
  const short = d.match(/^農曆(閏?)(.+)月(.+)$/);
  if (short) {
    const mi = LUNAR_MONTH_VALUES.indexOf(short[2]) + 1;
    const di = LUNAR_DAYS.indexOf(short[3]) + 1;
    if (mi > 0 && di > 0) return { gregorianYear: 0, monthValue: short[1] === '閏' ? `L${mi}` : String(mi), dayNum: di, birthHour };
  }
  // 農曆[閏]XX月（無年無日）
  const shortMonth = d.match(/^農曆(閏?)(.+)月$/);
  if (shortMonth) {
    const mi = LUNAR_MONTH_VALUES.indexOf(shortMonth[2]) + 1;
    if (mi > 0) return { gregorianYear: 0, monthValue: shortMonth[1] === '閏' ? `L${mi}` : String(mi), dayNum: 0, birthHour };
  }
  return null;
}

interface MemberPortalProps {
  onClose: () => void;
}

const ZODIAC_OPTIONS = Object.values(ZodiacSign);

const LABEL_OPTIONS = ['父母親', '兒女', '手足', '親戚', '朋友', '師長'] as const;
const GENDER_OPTIONS = ['信士', '信女', '小兒（16歲以下）', '小女兒（16歲以下）'] as const;

const emptyContactForm = (): MemberContactData => ({
  label: '',
  name: '',
  phone: '',
  birthDate: '',
  zodiac: undefined,
  gender: undefined,
  address: undefined,
});

// ── ContactForm（新增 / 編輯用的行內 modal）────────────────────────────────
const ContactFormModal = ({
  initial,
  onSave,
  onCancel,
  saving,
  savedAddresses,
}: {
  initial: MemberContactData;
  onSave: (d: MemberContactData) => void;
  onCancel: () => void;
  saving: boolean;
  savedAddresses: string[];
}) => {
  const parsedInitial = parseBirthDate(initial.birthDate || '');
  const [inputMode, setInputMode] = useState<'solar' | 'lunar'>(() => parsedInitial ? 'lunar' : 'solar');
  const [form, setForm] = useState<MemberContactData>(initial);

  // 國曆下拉 state（0 = 吉）
  const [solarYear, setSolarYear] = useState(0);
  const [solarMonth, setSolarMonth] = useState(0);
  const [solarDay, setSolarDay] = useState(0);

  // 農曆下拉 state（'0'/0 = 吉）
  const [lunarYear, setLunarYear] = useState(() => parsedInitial?.gregorianYear ?? 0);
  const [lunarMonthValue, setLunarMonthValue] = useState(() => parsedInitial?.monthValue ?? '0');
  const [lunarDay, setLunarDay] = useState(() => parsedInitial?.dayNum ?? 0);

  // 時辰（'' = 吉）
  const [birthHour, setBirthHour] = useState(() => parsedInitial?.birthHour ?? '');

  const set = (key: keyof MemberContactData, val: string) =>
    setForm(f => ({ ...f, [key]: val || undefined }));

  const applySolar = (y: number, m: number, d: number) => {
    const result = buildSolarResult(y, m, d);
    if (result) setForm(f => ({ ...f, birthDate: result.birthDate + birthHour, zodiac: result.zodiac }));
    else setForm(f => ({ ...f, birthDate: birthHour }));
  };

  const applyLunar = (y: number, mv: string, d: number) => {
    const result = buildLunarResult(y, mv, d);
    if (result) setForm(f => ({ ...f, birthDate: result.birthDate + birthHour, zodiac: result.zodiac ?? f.zodiac }));
    else setForm(f => ({ ...f, birthDate: birthHour }));
  };

  const solarMaxDays = (solarYear > 0 && solarMonth > 0) ? solarDaysInMonth(solarYear, solarMonth) : 31;
  const lunarMonthOptions = getLunarMonthOptions(lunarYear);
  const lunarMonthValid = lunarMonthOptions.some(o => o.value === lunarMonthValue);

  const handleSolarYearChange = (y: number) => {
    setSolarYear(y);
    const maxD = (y > 0 && solarMonth > 0) ? solarDaysInMonth(y, solarMonth) : 31;
    const d = solarDay > 0 ? Math.min(solarDay, maxD) : 0;
    setSolarDay(d);
    applySolar(y, solarMonth, d);
  };
  const handleSolarMonthChange = (m: number) => {
    setSolarMonth(m);
    const maxD = (solarYear > 0 && m > 0) ? solarDaysInMonth(solarYear, m) : 31;
    const d = solarDay > 0 ? Math.min(solarDay, maxD) : 0;
    setSolarDay(d);
    applySolar(solarYear, m, d);
  };
  const handleSolarDayChange = (d: number) => { setSolarDay(d); applySolar(solarYear, solarMonth, d); };

  const handleLunarYearChange = (y: number) => {
    setLunarYear(y);
    const newOptions = getLunarMonthOptions(y);
    let mv = lunarMonthValue;
    if (mv !== '0' && !newOptions.some(o => o.value === mv)) {
      mv = mv.startsWith('L') ? mv.slice(1) : mv;
      setLunarMonthValue(mv);
    }
    applyLunar(y, mv, lunarDay);
  };
  const handleLunarMonthChange = (mv: string) => { setLunarMonthValue(mv); applyLunar(lunarYear, mv, lunarDay); };
  const handleLunarDayChange = (d: number) => { setLunarDay(d); applyLunar(lunarYear, lunarMonthValue, d); };

  const handleBirthHourChange = (hour: string) => {
    setBirthHour(hour);
    setForm(f => {
      const base = f.birthDate.replace(/[子丑寅卯辰巳午未申酉戌亥]時$/, '');
      return { ...f, birthDate: base + hour };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label) { alert('請選擇稱謂'); return; }
    if (!form.name.trim()) { alert('請填寫姓名'); return; }
    onSave(form);
  };

  const selCls = "w-full px-2 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none bg-white";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <h3 className="text-lg font-bold text-temple-dark font-serif mb-5 flex items-center gap-2">
          <BookUser className="w-5 h-5 text-temple-red" />
          {initial.name ? '編輯聯絡人' : '新增聯絡人'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 稱謂 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">稱謂 / 關係 *</label>
            <div className="flex flex-wrap gap-2">
              {LABEL_OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, label: opt }))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    form.label === opt
                      ? 'bg-temple-red text-white border-temple-red'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-temple-red/50 hover:text-temple-red'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {!form.label && <p className="text-xs text-gray-400 mt-1.5">請選擇稱謂</p>}
          </div>

          {/* 性別 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">性別</label>
            <select
              value={form.gender || ''}
              onChange={e => setForm(f => ({ ...f, gender: e.target.value || undefined }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none bg-white"
            >
              <option value="">不指定</option>
              {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* 姓名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
            <input
              type="text" required placeholder="王小明"
              value={form.name} onChange={e => set('name', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
            />
          </div>

          {/* 電話（僅本人顯示） */}
          {form.label === '本人' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電話 *</label>
              <input
                type="tel" placeholder="0912-345-678"
                value={form.phone} onChange={e => set('phone', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
              />
            </div>
          )}

          {/* 居住地址 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">居住地址</label>
            <input
              list="address-suggestions"
              type="text" placeholder="台北市中正區和平西路一段…"
              value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value || undefined }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
            />
            {savedAddresses.length > 0 && (
              <datalist id="address-suggestions">
                {savedAddresses.map((a, i) => <option key={i} value={a} />)}
              </datalist>
            )}
          </div>

          {/* 生日 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">生日</label>
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
                {form.birthDate && (
                  <div className="flex items-center gap-1.5 bg-temple-bg border border-temple-gold/30 rounded-lg px-3 py-2">
                    <RefreshCw className="w-3.5 h-3.5 text-temple-gold flex-shrink-0" />
                    <span className="text-sm text-temple-dark font-medium">{form.birthDate}</span>
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
                {form.birthDate && (
                  <div className="flex items-center gap-1.5 bg-temple-bg border border-temple-gold/30 rounded-lg px-3 py-2 flex-wrap">
                    <span className="text-sm text-temple-dark font-medium">{form.birthDate}</span>
                    {!lunarYear && (
                      <span className="text-xs text-gray-400 ml-1">（未填年份，生肖請手動選）</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 時辰 */}
            <div className="mt-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">時辰</label>
              <select value={birthHour} onChange={e => handleBirthHourChange(e.target.value)} className={selCls}>
                {SHICHEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* 生肖（自動帶入，可手動修改） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">生肖</label>
            <select
              value={form.zodiac || ''}
              onChange={e => set('zodiac', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
            >
              <option value="">不指定</option>
              {ZODIAC_OPTIONS.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              取消
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-temple-red text-white rounded-lg text-sm font-medium hover:bg-[#5C1A04] transition-colors disabled:opacity-60">
              {saving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── ProfileFormInline（個人資料，行內表單，非 modal）──────────────────────────
const ProfileFormInline = ({
  initial,
  onSave,
  savedAddresses,
}: {
  initial: ProfileData;
  onSave: (d: ProfileData) => Promise<void>;
  savedAddresses: string[];
}) => {
  const parsedInitial = parseBirthDate(initial.birthDate || '');
  const [inputMode, setInputMode] = useState<'solar' | 'lunar'>(() => parsedInitial ? 'lunar' : 'solar');
  const [form, setForm] = useState<ProfileData>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [solarYear, setSolarYear] = useState(0);
  const [solarMonth, setSolarMonth] = useState(0);
  const [solarDay, setSolarDay] = useState(0);

  const [lunarYear, setLunarYear] = useState(() => parsedInitial?.gregorianYear ?? 0);
  const [lunarMonthValue, setLunarMonthValue] = useState(() => parsedInitial?.monthValue ?? '0');
  const [lunarDay, setLunarDay] = useState(() => parsedInitial?.dayNum ?? 0);
  const [birthHour, setBirthHour] = useState(() => parsedInitial?.birthHour ?? '');

  // 當 profile 從 DB 載入後同步到表單
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (synced || !initial.name) return;
    const parsed = parseBirthDate(initial.birthDate || '');
    setForm(initial);
    setInputMode(parsed ? 'lunar' : 'solar');
    setLunarYear(parsed?.gregorianYear ?? 0);
    setLunarMonthValue(parsed?.monthValue ?? '0');
    setLunarDay(parsed?.dayNum ?? 0);
    setBirthHour(parsed?.birthHour ?? '');
    setSynced(true);
  }, [initial.name]);

  const set = (key: keyof ProfileData, val: string) =>
    setForm(f => ({ ...f, [key]: val || undefined }));

  const applySolar = (y: number, m: number, d: number) => {
    const result = buildSolarResult(y, m, d);
    if (result) setForm(f => ({ ...f, birthDate: result.birthDate + birthHour, zodiac: result.zodiac }));
    else setForm(f => ({ ...f, birthDate: birthHour }));
  };

  const applyLunar = (y: number, mv: string, d: number) => {
    const result = buildLunarResult(y, mv, d);
    if (result) setForm(f => ({ ...f, birthDate: result.birthDate + birthHour, zodiac: result.zodiac ?? f.zodiac }));
    else setForm(f => ({ ...f, birthDate: birthHour }));
  };

  const solarMaxDays = (solarYear > 0 && solarMonth > 0) ? solarDaysInMonth(solarYear, solarMonth) : 31;
  const lunarMonthOptions = getLunarMonthOptions(lunarYear);
  const lunarMonthValid = lunarMonthOptions.some(o => o.value === lunarMonthValue);

  const handleSolarYearChange = (y: number) => {
    setSolarYear(y);
    const maxD = (y > 0 && solarMonth > 0) ? solarDaysInMonth(y, solarMonth) : 31;
    const d = solarDay > 0 ? Math.min(solarDay, maxD) : 0;
    setSolarDay(d);
    applySolar(y, solarMonth, d);
  };
  const handleSolarMonthChange = (m: number) => {
    setSolarMonth(m);
    const maxD = (solarYear > 0 && m > 0) ? solarDaysInMonth(solarYear, m) : 31;
    const d = solarDay > 0 ? Math.min(solarDay, maxD) : 0;
    setSolarDay(d);
    applySolar(solarYear, m, d);
  };
  const handleSolarDayChange = (d: number) => { setSolarDay(d); applySolar(solarYear, solarMonth, d); };

  const handleLunarYearChange = (y: number) => {
    setLunarYear(y);
    const newOptions = getLunarMonthOptions(y);
    let mv = lunarMonthValue;
    if (mv !== '0' && !newOptions.some(o => o.value === mv)) {
      mv = mv.startsWith('L') ? mv.slice(1) : mv;
      setLunarMonthValue(mv);
    }
    applyLunar(y, mv, lunarDay);
  };
  const handleLunarMonthChange = (mv: string) => { setLunarMonthValue(mv); applyLunar(lunarYear, mv, lunarDay); };
  const handleLunarDayChange = (d: number) => { setLunarDay(d); applyLunar(lunarYear, lunarMonthValue, d); };

  const handleBirthHourChange = (hour: string) => {
    setBirthHour(hour);
    setForm(f => {
      const base = f.birthDate.replace(/[子丑寅卯辰巳午未申酉戌亥]時$/, '');
      return { ...f, birthDate: base + hour };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { alert('請填寫姓名'); return; }
    setSaving(true);
    setSaved(false);
    try {
      await onSave(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('儲存失敗，請稍後再試。');
    } finally {
      setSaving(false);
    }
  };

  const selCls = "w-full px-2 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none bg-white";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 性別 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">性別</label>
        <select
          value={form.gender || ''}
          onChange={e => setForm(f => ({ ...f, gender: e.target.value || undefined }))}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none bg-white"
        >
          <option value="">不指定</option>
          {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* 姓名 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
        <input
          type="text" required placeholder="王小明"
          value={form.name} onChange={e => set('name', e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
        />
      </div>

      {/* 聯絡電話（個人資料必填） */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">聯絡電話 *</label>
        <input
          type="tel" required placeholder="0912-345-678"
          value={form.phone} onChange={e => set('phone', e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
        />
      </div>

      {/* 居住地址 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">居住地址</label>
        <input
          list="profile-address-suggestions"
          type="text" placeholder="台北市中正區和平西路一段…"
          value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value || undefined }))}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
        />
        {savedAddresses.length > 0 && (
          <datalist id="profile-address-suggestions">
            {savedAddresses.map((a, i) => <option key={i} value={a} />)}
          </datalist>
        )}
      </div>

      {/* 生日 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">生日</label>
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
            <select value={solarYear} onChange={e => handleSolarYearChange(Number(e.target.value))} className={selCls}>
              {YEAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
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
            {form.birthDate && (
              <div className="flex items-center gap-1.5 bg-temple-bg border border-temple-gold/30 rounded-lg px-3 py-2">
                <RefreshCw className="w-3.5 h-3.5 text-temple-gold flex-shrink-0" />
                <span className="text-sm text-temple-dark font-medium">{form.birthDate}</span>
                <span className="text-xs text-gray-400 ml-1">（農曆換算）</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <select value={lunarYear} onChange={e => handleLunarYearChange(Number(e.target.value))} className={selCls}>
              {YEAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
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
            {form.birthDate && (
              <div className="flex items-center gap-1.5 bg-temple-bg border border-temple-gold/30 rounded-lg px-3 py-2 flex-wrap">
                <span className="text-sm text-temple-dark font-medium">{form.birthDate}</span>
                {!lunarYear && (
                  <span className="text-xs text-gray-400 ml-1">（未填年份，生肖請手動選）</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* 時辰 */}
        <div className="mt-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">時辰</label>
          <select value={birthHour} onChange={e => handleBirthHourChange(e.target.value)} className={selCls}>
            {SHICHEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* 生肖 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">生肖</label>
        <select
          value={form.zodiac || ''}
          onChange={e => set('zodiac', e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
        >
          <option value="">不指定</option>
          {ZODIAC_OPTIONS.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full py-2.5 bg-temple-red text-white rounded-lg text-sm font-medium hover:bg-[#5C1A04] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {saving ? '儲存中…' : saved ? <><CheckCircle2 className="w-4 h-4" /> 已儲存</> : '儲存個人資料'}
      </button>
    </form>
  );
};

// ── MemberPortal 主元件 ───────────────────────────────────────────────────────
const MemberPortal: React.FC<MemberPortalProps> = ({ onClose }) => {
  // ── auth state ──
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [currentUser, setCurrentUser] = useState<{ email: string } | null>(null);

  // ── portal tab ──
  const [portalTab, setPortalTab] = useState<'profile' | 'contacts'>('profile');

  // ── profile state ──
  const [profile, setProfile] = useState<ProfileData | null>(null);

  // ── contacts state ──
  const [contacts, setContacts] = useState<MemberContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingContact, setEditingContact] = useState<MemberContact | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── init：check session ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (user?.email) {
        setCurrentUser({ email: user.email });
        loadContacts();
        loadProfile();
      }
    });
  }, []);

  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const data = await getMemberContacts();
      setContacts(data);
    } catch {
      // 資料表尚未建立時靜默處理
    } finally {
      setLoadingContacts(false);
    }
  };

  const loadProfile = async () => {
    try {
      const data = await getProfile();
      setProfile(data);
    } catch {
      // 靜默處理
    }
  };

  const handleSaveProfile = async (data: ProfileData) => {
    await saveProfile(data);
    setProfile(data);
  };

  // ── auth handlers ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setAuthError('帳號或密碼錯誤，請再試一次。'); return; }
      if (data.user?.email) {
        setCurrentUser({ email: data.user.email });
        loadContacts();
        loadProfile();
      }
    } catch {
      setAuthError('登入失敗，請稍後再試。');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setAuthError('兩次密碼不相符'); return; }
    if (password.length < 6) { setAuthError('密碼至少需 6 個字元'); return; }
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) { setAuthError(error.message); return; }
      setAuthSuccess('註冊成功！請至信箱確認後即可登入。');
      setAuthTab('login');
    } catch {
      setAuthError('註冊失敗，請稍後再試。');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setContacts([]);
    setProfile(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setAuthError('');
    setAuthSuccess('');
  };

  // ── contact handlers ──
  const handleSaveContact = async (data: MemberContactData) => {
    // 「本人」必須有電話
    if (data.label === '本人' && !data.phone?.trim()) {
      alert('本人資料需填寫電話號碼。');
      return;
    }
    setSaving(true);
    try {
      if (editingContact) {
        await updateMemberContact(editingContact.id, data);
      } else {
        await createMemberContact(data);
      }
      setShowFormModal(false);
      setEditingContact(null);
      await loadContacts();
    } catch {
      alert('儲存失敗，請稍後再試。');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除此聯絡人？')) return;
    setDeletingId(id);
    try {
      await deleteMemberContact(id);
      await loadContacts();
    } catch {
      alert('刪除失敗，請稍後再試。');
    } finally {
      setDeletingId(null);
    }
  };

  const openAdd = () => { setEditingContact(null); setShowFormModal(true); };
  const openEdit = (c: MemberContact) => { setEditingContact(c); setShowFormModal(true); };

  // ── render ──
  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col z-10 overflow-hidden">
          {/* Header */}
          <div className="bg-temple-red px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-temple-gold" />
              <span className="text-white font-bold font-serif tracking-wider text-lg">
                {currentUser ? '會員中心' : '會員登入'}
              </span>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {/* ── 未登入：Auth View ── */}
            {!currentUser ? (
              <div className="p-6">
                {/* Tab 切換 */}
                <div className="flex border border-gray-200 rounded-xl overflow-hidden mb-6">
                  {(['login', 'register'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => { setAuthTab(tab); setAuthError(''); setAuthSuccess(''); }}
                      className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                        authTab === tab
                          ? 'bg-temple-red text-white'
                          : 'text-gray-500 hover:text-temple-dark hover:bg-gray-50'
                      }`}
                    >
                      {tab === 'login' ? '登入' : '註冊'}
                    </button>
                  ))}
                </div>

                {/* 錯誤 / 成功提示 */}
                {authError && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-4 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {authError}
                  </div>
                )}
                {authSuccess && (
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3 mb-4 text-sm">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    {authSuccess}
                  </div>
                )}

                {/* 登入表單 */}
                {authTab === 'login' ? (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">電子信箱</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">密碼</label>
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="請輸入密碼"
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(s => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full py-3 bg-temple-red text-white rounded-lg font-medium hover:bg-[#5C1A04] transition-colors disabled:opacity-60 mt-2"
                    >
                      {authLoading ? '登入中…' : '登入'}
                    </button>
                  </form>
                ) : (
                  /* 註冊表單 */
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">電子信箱</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">密碼（至少 6 字元）</label>
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="設定密碼"
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(s => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">確認密碼</label>
                      <input
                        type={showPw ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="再次輸入密碼"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full py-3 bg-temple-red text-white rounded-lg font-medium hover:bg-[#5C1A04] transition-colors disabled:opacity-60 mt-2"
                    >
                      {authLoading ? '註冊中…' : '建立帳號'}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* ── 已登入：Portal View ── */
              <div className="p-6">
                {/* 使用者資訊列 */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">已登入</p>
                    <p className="text-sm font-medium text-temple-dark">{currentUser.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-full transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    登出
                  </button>
                </div>

                {/* Tab 切換 */}
                <div className="flex border border-gray-200 rounded-xl overflow-hidden mb-5">
                  <button
                    onClick={() => setPortalTab('profile')}
                    className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      portalTab === 'profile'
                        ? 'bg-temple-red text-white'
                        : 'text-gray-500 hover:text-temple-dark hover:bg-gray-50'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    個人資料
                  </button>
                  <button
                    onClick={() => setPortalTab('contacts')}
                    className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      portalTab === 'contacts'
                        ? 'bg-temple-red text-white'
                        : 'text-gray-500 hover:text-temple-dark hover:bg-gray-50'
                    }`}
                  >
                    <BookUser className="w-3.5 h-3.5" />
                    親友通訊錄
                  </button>
                </div>

                {/* ── 個人資料 tab ── */}
                {portalTab === 'profile' && (
                  <ProfileFormInline
                    initial={profile ?? { name: '', phone: '', birthDate: '' }}
                    onSave={handleSaveProfile}
                    savedAddresses={Array.from(new Set(contacts.map(c => c.address).filter((a): a is string => !!a)))}
                  />
                )}

                {/* ── 親友通訊錄 tab ── */}
                {portalTab === 'contacts' && (
                  <>
                    {/* 通訊錄標題 + 新增按鈕 */}
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-temple-dark font-serif flex items-center gap-2">
                        <BookUser className="w-4 h-4 text-temple-red" />
                        親友通訊錄
                      </h4>
                      <button
                        onClick={openAdd}
                        className="flex items-center gap-1.5 text-sm font-medium text-white bg-temple-red px-3 py-1.5 rounded-full hover:bg-[#5C1A04] transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        新增
                      </button>
                    </div>

                    {/* 聯絡人列表 */}
                    {loadingContacts ? (
                      <p className="text-center text-gray-400 py-8 text-sm">載入中…</p>
                    ) : contacts.length === 0 ? (
                      <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                        <BookUser className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-400 text-sm mb-1">通訊錄目前為空</p>
                        <p className="text-gray-300 text-xs">點擊上方「新增」儲存親友資料</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {contacts.map(c => (
                          <div
                            key={c.id}
                            className="flex items-start gap-3 bg-temple-bg/60 border border-temple-gold/20 rounded-xl p-4"
                          >
                            {/* Label badge */}
                            <span className="flex-shrink-0 text-xs font-bold bg-temple-red/10 text-temple-red px-2.5 py-1 rounded-full border border-temple-red/20 mt-0.5">
                              {c.label}
                            </span>

                            {/* 資料 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-temple-dark text-sm">{c.name}</p>
                                {c.gender && (
                                  <span className="text-xs bg-temple-red/10 text-temple-red px-1.5 py-0.5 rounded-full">
                                    {c.gender}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                {c.birthDate && <span className="text-xs text-gray-500">{c.birthDate}</span>}
                                {c.zodiac && (
                                  <span className="text-xs bg-temple-gold/15 text-temple-dark px-1.5 rounded">
                                    {c.zodiac}年
                                  </span>
                                )}
                                {c.address && <span className="text-xs text-gray-400 w-full truncate">{c.address}</span>}
                              </div>
                            </div>

                            {/* 操作 */}
                            <div className="flex gap-1 flex-shrink-0">
                              <button
                                onClick={() => openEdit(c)}
                                className="p-1.5 text-gray-400 hover:text-temple-red rounded-lg hover:bg-temple-red/10 transition-colors"
                                title="編輯"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(c.id)}
                                disabled={deletingId === c.id}
                                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                                title="刪除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 說明文字 */}
                    {contacts.length > 0 && (
                      <p className="text-xs text-gray-400 text-center mt-4">
                        在點燈、問事、捐款表單中點擊「通訊錄」可快速帶入資料
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 聯絡人新增 / 編輯 Modal */}
      {showFormModal && (
        <ContactFormModal
          initial={editingContact
            ? { label: editingContact.label, name: editingContact.name, phone: editingContact.phone, birthDate: editingContact.birthDate, zodiac: editingContact.zodiac, gender: editingContact.gender, address: editingContact.address }
            : { ...emptyContactForm(), address: profile?.address || undefined }
          }
          onSave={handleSaveContact}
          onCancel={() => { setShowFormModal(false); setEditingContact(null); }}
          saving={saving}
          savedAddresses={Array.from(new Set(contacts.map(c => c.address).filter((a): a is string => !!a)))}
        />
      )}
    </>
  );
};

export default MemberPortal;
