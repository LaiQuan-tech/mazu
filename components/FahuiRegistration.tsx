import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Plus, Minus, CheckCircle2 } from 'lucide-react';
import { submitFahuiRegistration } from '../services/supabase';
import { getLineUrl, trackLine } from '../services/lineLink';
import { ZodiacSign } from '../types';
import BirthDatePicker from './BirthDatePicker';

const ZODIAC_OPTIONS = Object.values(ZodiacSign);
const GENDER_OPTIONS = ['信士', '信女'];

// 報名截止日（含當日）。過了這天，報名表自動關閉並改顯示截止說明。
// 若要提前截止（額滿），把日期改早即可；工作人員可用網址加 ?preview=1 預覽表單。
const REGISTRATION_DEADLINE = '2026-09-06';

/** 今天（本地時區，yyyy-mm-dd）——不可用 toISOString，台灣早上 8 點前會差一天 */
const todayLocal = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isRegistrationClosed = (): boolean => todayLocal() > REGISTRATION_DEADLINE;

const isStaffPreview = (): boolean => {
  try { return new URLSearchParams(window.location.search).get('preview') === '1'; }
  catch { return false; }
};

/** 分享給親友：手機優先叫出系統分享（內含 LINE），沒有的話直接開 LINE 分享 */
const SHARE_TEXT = '和聖壇「太上慈悲普渡禮懺法會」線上報名中。國曆 9/13（農曆 8/03）舉行，9/06 截止報名，額滿提前截止。';

const shareFahui = async (): Promise<void> => {
  // 不帶 ?preview=1 之類的參數，避免把工作人員的預覽網址轉傳出去
  const url = `${window.location.origin}${window.location.pathname}`;
  const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title: '和聖壇法會線上報名', text: SHARE_TEXT, url });
      return;
    } catch {
      return;   // 使用者取消分享，不要再跳出其他視窗
    }
  }
  const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(SHARE_TEXT)}`;
  window.open(lineUrl, '_blank', 'noopener,noreferrer');
};

// 草稿自動暫存（避免填到一半資料遺失）
const DRAFT_KEY = 'fahui_registration_draft_v1';
const loadDraft = (): any => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; }
};

// ── Types ────────────────────────────────────────────────────────────────────

interface ContactInfo {
  name: string;
  gender: string;
  phone: string;
  address: string;
  lineId: string;
  email: string;
  /** 匯款帳號後五碼。表單送出時多半還沒匯款，因此為選填 */
  accountLast5: string;
  birthDate: string;
  zodiac: string;
}

/** 聯絡人欄位的空白初始值。新增欄位時只改這裡，初始化與重設才不會漏掉 */
const EMPTY_CONTACT: ContactInfo = {
  name: '', gender: '', phone: '', address: '',
  lineId: '', email: '', accountLast5: '', birthDate: '', zodiac: '',
};

interface FieldConfig {
  key: string;
  label: string;
  placeholder?: string;
  sameAsContactType?: 'name' | 'address' | 'birthday' | 'zodiac' | 'gender';
  /** 'quantity' = 數量選擇器；'birthdate' = 國曆/農曆生日選擇器；'zodiac' = 生肖下拉；'gender' = 信士／信女 */
  kind?: 'quantity' | 'birthdate' | 'zodiac' | 'gender';
  max?: number;
  /** 選填欄位（送出時不強制驗證） */
  optional?: boolean;
}

interface ServiceConfig {
  key: string;
  title: string;
  unit: string;        // 計價單位（戶／牌位／單位）
  entryNoun?: string;  // 每筆的稱呼（預設同 unit；物資捐贈用「筆」）
  desc?: string;
  price: number;
  icon: string;
  fields: FieldConfig[];
}

type FieldVal = { value: string; sameAs: boolean };
type Entry = Record<string, FieldVal>;
type AllEntries = Record<string, Entry[]>;

// ── Service Configs ───────────────────────────────────────────────────────────

const SERVICE_CONFIGS: ServiceConfig[] = [
  {
    key: 'zanpu', title: '中元贊普', unit: '戶', price: 1200, icon: '',
    fields: [
      { key: 'donor', label: '陽上姓名', sameAsContactType: 'name' },
      { key: 'gender', label: '性別', kind: 'gender', sameAsContactType: 'gender' },
      { key: 'address', label: '地址', sameAsContactType: 'address' },
    ],
  },
  {
    key: 'ancestor', title: '超渡歷代祖先', unit: '牌位', price: 800, icon: '',
    fields: [
      { key: 'donor', label: '陽上姓名', sameAsContactType: 'name' },
      { key: 'gender', label: '性別', kind: 'gender', sameAsContactType: 'gender' },
      { key: 'object', label: '超薦對象', placeholder: '例：王氏歷代祖先' },
      { key: 'position', label: '牌位地址', placeholder: '例：第1排左1（請填完整地址與位置）' },
    ],
  },
  {
    key: 'person', title: '超渡先人', unit: '牌位', price: 800, icon: '',
    fields: [
      { key: 'donor', label: '陽上姓名', sameAsContactType: 'name' },
      { key: 'gender', label: '性別', kind: 'gender', sameAsContactType: 'gender' },
      { key: 'object', label: '超薦對象', placeholder: '例：王大明先人' },
      { key: 'position', label: '牌位地址', placeholder: '例：第2排右3（請填完整地址與位置）' },
    ],
  },
  {
    key: 'dizhu', title: '超薦地基主', unit: '戶', price: 600, icon: '',
    fields: [
      { key: 'donor', label: '陽上姓名', placeholder: '可填個人住家、工作室或公司', sameAsContactType: 'name' },
      { key: 'gender', label: '性別', kind: 'gender', sameAsContactType: 'gender' },
      { key: 'address', label: '地址', sameAsContactType: 'address' },
    ],
  },
  {
    key: 'debt', title: '解冤親債主', unit: '牌位', price: 600, icon: '',
    fields: [
      { key: 'donor', label: '陽上姓名', sameAsContactType: 'name' },
      { key: 'gender', label: '性別', kind: 'gender', sameAsContactType: 'gender' },
      { key: 'birthdate', label: '出生日期', kind: 'birthdate', sameAsContactType: 'birthday' },
      { key: 'zodiac', label: '生肖', kind: 'zodiac', sameAsContactType: 'zodiac', optional: true },
      { key: 'address', label: '陽上地址', sameAsContactType: 'address' },
    ],
  },
  {
    key: 'baby', title: '超渡嬰靈', unit: '牌位', price: 600, icon: '',
    fields: [
      { key: 'donor', label: '陽上姓名', sameAsContactType: 'name' },
      { key: 'gender', label: '性別', kind: 'gender', sameAsContactType: 'gender' },
      { key: 'birthdate', label: '出生日期', kind: 'birthdate', sameAsContactType: 'birthday', optional: true },
      { key: 'zodiac', label: '生肖', kind: 'zodiac', sameAsContactType: 'zodiac', optional: true },
      { key: 'address', label: '陽上地址', sameAsContactType: 'address' },
    ],
  },
  {
    key: 'animal', title: '超渡動物靈', unit: '牌位', price: 600, icon: '',
    fields: [
      { key: 'donor', label: '陽上姓名', sameAsContactType: 'name' },
      { key: 'gender', label: '性別', kind: 'gender', sameAsContactType: 'gender' },
      { key: 'petType', label: '寵物類別', placeholder: '例：狗、貓、兔等', optional: true },
      { key: 'petName', label: '寵物名' },
      { key: 'position', label: '寵物的牌位地址', placeholder: '例：第1排左2（請填完整地址與位置）' },
    ],
  },
  {
    key: 'donation', title: '物資捐贈做功德', unit: '單位', entryNoun: '筆', price: 500, icon: '',
    desc: '幫助弱勢團體，每單位 $500，可報名多筆',
    fields: [
      { key: 'donor', label: '捐贈人', sameAsContactType: 'name' },
      { key: 'gender', label: '性別', kind: 'gender', sameAsContactType: 'gender' },
      { key: 'units', label: '捐贈單位數量', kind: 'quantity', max: 10 },
      { key: 'address', label: '地址', sameAsContactType: 'address' },
    ],
  },
];

const ZANPU_OFFERING_OPTIONS = [
  '我願意，供品捐到弱勢單位做愛心',
  '自行帶回供品（國曆9/13晚上10:00前未領取則愛心捐贈）',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeEntry = (fields: FieldConfig[]): Entry =>
  Object.fromEntries(fields.map(f => [f.key, { value: f.kind === 'quantity' ? '1' : '', sameAs: false }]));

const resolveValue = (field: FieldConfig, entry: Entry, contact: ContactInfo): string => {
  const fv = entry[field.key] ?? { value: '', sameAs: false };
  if (fv.sameAs && field.sameAsContactType) {
    switch (field.sameAsContactType) {
      case 'name': return contact.name;
      case 'address': return contact.address;
      case 'birthday': return contact.birthDate;
      case 'zodiac': return contact.zodiac;
      case 'gender': return contact.gender;
    }
  }
  return fv.value;
};

/** 一筆報名的單位數（一般項目=1；物資捐贈=該筆填的數量） */
const entryUnits = (service: ServiceConfig, entry: Entry): number => {
  const qf = service.fields.find(f => f.kind === 'quantity');
  if (!qf) return 1;
  return Math.max(1, Number(entry[qf.key]?.value) || 1);
};

/** 某項目的總單位數（用於明細顯示） */
const serviceUnitCount = (service: ServiceConfig, entries: Entry[]): number =>
  entries.reduce((sum, e) => sum + entryUnits(service, e), 0);

/** 某項目的小計金額 */
const serviceSubtotal = (service: ServiceConfig, entries: Entry[]): number =>
  entries.reduce((sum, e) => sum + service.price * entryUnits(service, e), 0);

const inputCls =
  'w-full rounded-lg border border-[#C49820]/40 bg-white/80 px-3 py-2.5 text-sm text-[#2E2A22] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C49820]/40 focus:border-[#C49820] transition-all';

// ── Main Component ────────────────────────────────────────────────────────────

interface FahuiVolunteerHandoff { name: string; phone: string; address: string; birthDate: string; zodiac: string; lineId: string }

/** 報名截止後的畫面：不再收件，但保留法會資訊與聯絡方式。
    （收了 onVolunteer 卻沒用到——志工入口只在成功頁，這裡沒有） */
function ClosedScreen({ onBack, onVolunteer }: { onBack?: () => void; onVolunteer?: (contact: FahuiVolunteerHandoff) => void }) {
  return (
    <div className="min-h-screen bg-[#F5F0E8] pb-16">
      <header className="sticky top-0 z-20 bg-[#F5F0E8]/95 backdrop-blur border-b border-[#C49820]/20">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="flex items-center gap-1 text-[#7C5C1E] shrink-0">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm">首頁</span>
            </button>
          )}
          <div>
            <h1 className="font-serif font-bold text-[#7C5C1E] leading-tight">和聖壇法會線上報名</h1>
            <p className="text-[11px] text-gray-500">太上慈悲普渡禮懺法會</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="bg-gradient-to-br from-amber-800 to-amber-950 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-amber-300 text-xs tracking-widest mb-1">普渡慈航・福澤萬世</p>
          <h2 className="font-bold text-2xl font-serif mb-3">太上慈悲普渡禮懺法會</h2>
          <div className="space-y-1.5 text-sm text-amber-100">
            <p>國曆 9/13（日）｜農曆 8/03（日）</p>
            <p>法會地址：台北市中正區晉江街72巷9號</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#C49820]/30 text-center space-y-2">
          <p className="font-serif font-bold text-xl text-[#7C5C1E]">本次法會報名已截止</p>
          <p className="text-sm text-gray-500 leading-relaxed">
            線上報名已於 9/06 結束，感謝十方善信大德發心護持。
            <br />
            如有特殊情況需補報，請直接與本壇聯繫。
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#C49820]/20 text-center space-y-2">
          <p className="text-sm text-[#2E2A22]">
            聯絡電話：
            <a href="tel:0953945349" className="font-semibold text-[#7C5C1E] hover:underline">0953-945-349</a>
          </p>
          {/* 網址取自後台設定、點擊計入導流統計，不要再寫死 lin.ee 短網址 */}
          <a
            href={getLineUrl()}
            onClick={() => trackLine('fahui-form')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-5 py-2.5 rounded-2xl border border-[#C49820] text-[#7C5C1E] text-sm font-medium hover:bg-[#C49820]/10 transition-colors"
          >
            LINE 官方帳號洽詢
          </a>
        </div>

        <footer className="pt-4 text-center space-y-1.5">
          <p className="font-serif font-bold text-[#7C5C1E]">和聖壇</p>
          <p className="text-xs text-gray-500">台北市中正區晉江街72巷9號</p>
        </footer>
      </div>
    </div>
  );
}

export default function FahuiRegistration({ onBack, onVolunteer, onJoinMember }: {
  onBack?: () => void;
  onVolunteer?: (contact: FahuiVolunteerHandoff) => void;
  /**
   * 「加入會員」的入口（2026-10-13 補）。
   * 法會報名原本是獨立的一套流程，成功頁完全沒有提到會員——結果普渡那四十幾位
   * 填完整張表、填牌位、匯了款的信眾，在網站上等於不存在，下次辦法會還是從頭填一次。
   * 問事與點燈的成功頁本來就有這個邀請，這裡照同一個模式補上。
   * 電話帶出去，註冊完就自動對得上這一筆（紀錄是以電話為鍵）。
   */
  onJoinMember?: (phone: string) => void;
}) {
  const draft = useMemo(loadDraft, []);
  // 舊草稿沒有 email／accountLast5，展開順序讓 EMPTY_CONTACT 先補齊欄位再套草稿值
  const [contact, setContact] = useState<ContactInfo>({ ...EMPTY_CONTACT, ...(draft?.contact ?? {}) });
  const [allEntries, setAllEntries] = useState<AllEntries>(() => {
    const base: AllEntries = Object.fromEntries(SERVICE_CONFIGS.map(s => [s.key, []]));
    if (!draft?.allEntries) return base;
    // 正規化還原的草稿：確保每筆都符合目前的欄位結構（避免舊草稿缺欄位造成崩潰）
    for (const s of SERVICE_CONFIGS) {
      const raw = draft.allEntries[s.key];
      if (!Array.isArray(raw)) continue;
      base[s.key] = raw.map((e: any) => {
        const entry = makeEntry(s.fields);
        for (const f of s.fields) {
          const cell = e?.[f.key];
          if (cell && typeof cell === 'object') {
            entry[f.key] = { value: String(cell.value ?? ''), sameAs: !!cell.sameAs };
          }
        }
        return entry;
      });
    }
    return base;
  });
  const [zanpuOffering, setZanpuOffering] = useState<string>(draft?.zanpuOffering ?? '');
  const [mealSponsor, setMealSponsor] = useState<string>(draft?.mealSponsor ?? '');
  const [notes, setNotes] = useState<string>(draft?.notes ?? '');
  const [draftRestored, setDraftRestored] = useState<boolean>(!!draft?.contact?.name || !!draft?.contact?.phone);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 自動暫存草稿
  useEffect(() => {
    const hasContent =
      contact.name || contact.phone || contact.address || contact.lineId || contact.email ||
      SERVICE_CONFIGS.some(s => (allEntries[s.key]?.length ?? 0) > 0) || mealSponsor || notes;
    try {
      if (hasContent) localStorage.setItem(DRAFT_KEY, JSON.stringify({ contact, allEntries, zanpuOffering, mealSponsor, notes }));
    } catch { /* localStorage 不可用時忽略 */ }
  }, [contact, allEntries, zanpuOffering, mealSponsor, notes]);

  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } };

  const resetForm = () => {
    clearDraft();
    setContact({ ...EMPTY_CONTACT });
    setAllEntries(Object.fromEntries(SERVICE_CONFIGS.map(s => [s.key, []])));
    setZanpuOffering(''); setMealSponsor(''); setNotes('');
    setDraftRestored(false); setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const mealAmount = Math.max(0, Number(mealSponsor) || 0);

  const total = useMemo(
    () => SERVICE_CONFIGS.reduce((sum, s) => sum + serviceSubtotal(s, allEntries[s.key] ?? []), 0) + mealAmount,
    [allEntries, mealAmount]
  );

  const summary = useMemo(
    () => {
      const items = SERVICE_CONFIGS
        .filter(s => (allEntries[s.key]?.length ?? 0) > 0)
        .map(s => ({
          title: s.title,
          count: serviceUnitCount(s, allEntries[s.key]),
          unit: s.unit,
          subtotal: serviceSubtotal(s, allEntries[s.key]),
        }));
      if (mealAmount > 0) items.push({ title: '平安餐與茶飲贊助', count: 1, unit: '份', subtotal: mealAmount });
      return items;
    },
    [allEntries, mealAmount]
  );

  const setQuantity = (key: string, qty: number, fields: FieldConfig[]) => {
    setAllEntries(prev => {
      const cur = prev[key] ?? [];
      const next =
        qty > cur.length
          ? [...cur, ...Array.from({ length: qty - cur.length }, () => makeEntry(fields))]
          : cur.slice(0, qty);
      return { ...prev, [key]: next };
    });
  };

  const updateField = (serviceKey: string, entryIdx: number, fieldKey: string, update: Partial<FieldVal>) => {
    setAllEntries(prev => {
      const entries = [...(prev[serviceKey] ?? [])];
      entries[entryIdx] = { ...entries[entryIdx], [fieldKey]: { ...entries[entryIdx][fieldKey], ...update } };
      return { ...prev, [serviceKey]: entries };
    });
  };

  const hasZanpu = (allEntries['zanpu']?.length ?? 0) > 0;

  const handleSubmit = async () => {
    setError('');
    if (!contact.name.trim() || !contact.gender || !contact.phone.trim() || !contact.address.trim() || !contact.email.trim()) {
      setError('請填寫聯絡人的姓名、性別、電話、地址及電子郵件');
      return;
    }
    // 電話格式（台灣手機／市話，9~10 碼、0 開頭）
    const phoneDigits = contact.phone.replace(/\D/g, '');
    if (!/^0\d{8,9}$/.test(phoneDigits)) {
      setError('請填寫正確的電話號碼（例：0912345678 或 02-12345678）');
      return;
    }
    // 電子郵件必填（上面已擋空白），這裡只驗格式——格式錯的信箱寄不到，比空白更難補救
    const email = contact.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('電子郵件格式不正確，請確認（例：mazu@example.com）');
      return;
    }
    // 後五碼仍為選填：多數人是送出後才去匯款
    const last5 = contact.accountLast5.trim();
    if (last5 && !/^\d{5}$/.test(last5)) {
      setError('匯款帳號後五碼請填 5 位數字，尚未匯款可留空');
      return;
    }
    if (total === 0) {
      setError('請至少選擇一項報名，或填寫平安餐贊助金額');
      return;
    }
    if (hasZanpu && !zanpuOffering) {
      setError('報名中元贊普者，請選擇供品處理方式');
      return;
    }
    // 逐筆檢查必填欄位，避免送出空白牌位
    for (const s of SERVICE_CONFIGS) {
      const entries = allEntries[s.key] ?? [];
      for (let i = 0; i < entries.length; i++) {
        for (const f of s.fields) {
          if (f.optional || f.kind === 'quantity') continue;
          if (!resolveValue(f, entries[i], contact).trim()) {
            setError(`「${s.title}」第 ${i + 1} ${s.entryNoun ?? s.unit} 的「${f.label}」尚未填寫`);
            return;
          }
        }
      }
    }

    const entriesJson: Record<string, Array<Record<string, string>>> = {};
    for (const s of SERVICE_CONFIGS) {
      const entries = allEntries[s.key] ?? [];
      if (entries.length > 0) {
        entriesJson[s.key] = entries.map(entry =>
          Object.fromEntries(s.fields.map(f => [f.key, resolveValue(f, entry, contact)]))
        );
      }
    }

    setSubmitting(true);
    try {
      await submitFahuiRegistration({
        contact,
        entries: entriesJson,
        total,
        zanpuOffering: hasZanpu ? zanpuOffering : '',
        mealSponsor: mealAmount,
        notes: notes.trim(),
      });
      clearDraft();
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('送出時發生錯誤，請稍後再試，或透過 LINE 與我們聯繫');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <SuccessScreen onBack={onBack} onVolunteer={onVolunteer} onJoinMember={onJoinMember} contact={contact} summary={summary} total={total} />;
  }

  // 報名截止後不再開放送出（避免收了款卻來不及製作牌位）；工作人員可用 ?preview=1 預覽表單
  if (isRegistrationClosed() && !isStaffPreview()) {
    return <ClosedScreen onBack={onBack} onVolunteer={onVolunteer} />;
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8] pb-28">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-[#F0E9CE]/98 backdrop-blur-md border-b border-[#C49820]/30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 pl-1.5 pr-2.5 py-1.5 rounded-full hover:bg-[#C49820]/10 text-[#2E2A22] transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm">首頁</span>
            </button>
          )}
          <img src="/logo.png" alt="和聖壇" className="w-9 h-9 object-contain shrink-0" />
          <div className="min-w-0">
            <h1 className="font-bold text-[#2E2A22] text-base leading-tight font-serif">和聖壇法會線上報名</h1>
            <p className="text-xs text-[#C49820] truncate">太上慈悲普渡禮懺法會</p>
          </div>
          {total > 0 && (
            <div className="ml-auto text-right shrink-0">
              <p className="text-[10px] text-gray-500">目前合計</p>
              <p className="font-bold text-[#7C5C1E] text-sm">$ {total.toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 space-y-4 pt-4">
        {/* 主視覺 Banner */}
        <div className="rounded-2xl overflow-hidden shadow-lg">
          <img
            src="/fahui-banner.png"
            alt="太上慈悲普渡禮懺法會"
            className="w-full h-auto block"
          />
        </div>

        {/* 已還原草稿提示 */}
        {draftRestored && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-green-800">已還原您上次未完成的填寫內容</span>
            <button
              type="button"
              onClick={resetForm}
              className="shrink-0 text-green-700 underline hover:text-green-900 transition-colors"
            >
              清除重填
            </button>
          </div>
        )}

        {/* Event Banner */}
        <div className="bg-gradient-to-br from-amber-800 to-amber-950 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-amber-300 text-xs tracking-widest mb-1">普渡慈航・福澤萬世</p>
          <h2 className="font-bold text-2xl font-serif mb-3">太上慈悲普渡禮懺法會</h2>
          <div className="space-y-1.5 text-sm text-amber-100">
            <p>國曆 9/13（日）｜農曆 8/03（日）</p>
            <p>截止報名：9/06（日），額滿提前截止</p>
          </div>
          <div className="mt-3 pt-3 border-t border-amber-200/20 space-y-1 text-xs text-amber-100/90 leading-relaxed">
            <p>主辦單位：和聖壇管理委員會</p>
            <p>協辦單位：彰化和美龍華慈惠堂佛經團・禪和道經團</p>
            <p>法會地址：台北市中正區晉江街72巷9號</p>
          </div>
        </div>

        {/* 法會緣起說明 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#C49820]/20 text-center">
          {/* 法會偈語 */}
          <div className="space-y-2 text-[#7C5C1E] font-serif font-bold tracking-[0.3em] mb-4">
            <p>超拔三界　冥陽兩利</p>
            <p>慈悲喜捨　普渡眾生</p>
            <p>兩儀同化　共登覺岸</p>
            <p>法帆遠航　福蔭萬家</p>
          </div>
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="w-10 h-px bg-[#C49820]/50" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#C49820]/70" />
            <span className="w-10 h-px bg-[#C49820]/50" />
          </div>
          <p className="text-sm text-gray-600 leading-loose">
            和聖壇秉持慈悲善念，廣結十方精神，<br />
            謹訂於農曆丙午年中舉辦<br />
            「太上慈悲普渡禮懺法會」，<br />
            禮請諸佛菩薩聖仙，<br />
            超薦拔渡歷代祖先、冤親債主、<br />
            地基主、嬰靈及動物靈等眾，<br />
            廣結善緣、消災解厄、福慧增長。<br />
            誠邀諸善信大德，共臨參與，<br />
            共修殊勝功德，同霑法益。
          </p>
        </div>

        {/* Step 1 – Contact */}
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 bg-[#C49820] text-white rounded-full flex items-center justify-center text-xs shrink-0">1</span>
          <h3 className="font-bold text-[#2E2A22] text-sm">聯絡人資料</h3>
        </div>
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-[#C49820]/20">
          <div className="space-y-3">
            <div>
              <label htmlFor="fahui-contact-name" className="block text-xs text-gray-500 mb-1">姓名 * <span className="text-gray-400">（報名項目可套用「同聯絡人姓名」）</span></label>
              <input
                id="fahui-contact-name"
                name="name"
                autoComplete="name"
                className={inputCls}
                value={contact.name}
                onChange={e => setContact(c => ({ ...c, name: e.target.value }))}
                placeholder="聯絡人姓名"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">性別 * <span className="text-gray-400">（報名項目可套用「同聯絡人性別」）</span></label>
              <div className="flex gap-2">
                {GENDER_OPTIONS.map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setContact(c => ({ ...c, gender: g }))}
                    aria-pressed={contact.gender === g}
                    className={`flex-1 py-2.5 rounded-lg border text-sm transition-all ${
                      contact.gender === g
                        ? 'bg-[#C49820] text-white border-[#C49820] font-medium'
                        : 'bg-white text-[#2E2A22] border-[#C49820]/40 hover:bg-[#C49820]/10'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="fahui-contact-phone" className="block text-xs text-gray-500 mb-1">電話 *</label>
              <input
                id="fahui-contact-phone"
                name="tel"
                autoComplete="tel"
                className={inputCls}
                type="tel"
                value={contact.phone}
                onChange={e => setContact(c => ({ ...c, phone: e.target.value }))}
                placeholder="聯絡電話"
              />
            </div>
            <div>
              <label htmlFor="fahui-contact-address" className="block text-xs text-gray-500 mb-1">住家地址 * <span className="text-gray-400">（報名項目可套用「同聯絡人地址」）</span></label>
              <input
                id="fahui-contact-address"
                name="street-address"
                autoComplete="street-address"
                className={inputCls}
                value={contact.address}
                onChange={e => setContact(c => ({ ...c, address: e.target.value }))}
                placeholder="聯絡人地址"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">生日 <span className="text-gray-400">（選填，請填國曆自動換算農曆，報名項目可套用「同聯絡人生日」）</span></label>
              <BirthDatePicker
                hideLabel
                birthDate={contact.birthDate}
                onChange={(bd, zod) => setContact(c => ({ ...c, birthDate: bd, zodiac: zod ?? '' }))}
              />
            </div>
            <div>
              <label htmlFor="fahui-contact-line" className="block text-xs text-gray-500 mb-1">LINE 名稱 / ID <span className="text-gray-400">（選填）</span></label>
              <input
                id="fahui-contact-line"
                name="line-id"
                className={inputCls}
                value={contact.lineId}
                onChange={e => setContact(c => ({ ...c, lineId: e.target.value }))}
                placeholder="便於後續確認匯款"
              />
            </div>
            <div>
              <label htmlFor="fahui-contact-email" className="block text-xs text-gray-500 mb-1">電子郵件 *</label>
              <input
                id="fahui-contact-email"
                name="email"
                className={inputCls}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={contact.email}
                onChange={e => setContact(c => ({ ...c, email: e.target.value }))}
                placeholder="用於寄送感謝狀與法會通知"
              />
            </div>
          </div>
        </section>

        {/* Step 2 – Services */}
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 bg-[#C49820] text-white rounded-full flex items-center justify-center text-xs shrink-0">2</span>
          <h3 className="font-bold text-[#2E2A22] text-sm">選擇報名項目</h3>
        </div>

        {SERVICE_CONFIGS.map(service => (
          <React.Fragment key={service.key}>
            <ServiceSection
              config={service}
              entries={allEntries[service.key] ?? []}
              contact={contact}
              onQuantityChange={qty => setQuantity(service.key, qty, service.fields)}
              onFieldChange={(ei, fk, upd) => updateField(service.key, ei, fk, upd)}
            />
            {service.key === 'zanpu' && hasZanpu && (
              <div className="bg-amber-50 rounded-2xl p-4 shadow-sm border border-amber-300">
                <p className="font-bold text-amber-800 text-sm mb-1">中元贊普 — 供品處理方式 *</p>
                <p className="text-xs text-amber-700 mb-3">有報名中元贊普者，請務必選擇：</p>
                <div className="space-y-2">
                  {ZANPU_OFFERING_OPTIONS.map(opt => (
                    <label
                      key={opt}
                      className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                        zanpuOffering === opt ? 'bg-white border-[#C49820] shadow-sm' : 'bg-white/60 border-amber-200 hover:border-[#C49820]/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="zanpuOffering"
                        className="mt-0.5 accent-[#C49820]"
                        checked={zanpuOffering === opt}
                        onChange={() => setZanpuOffering(opt)}
                      />
                      <span className="text-sm text-[#2E2A22] leading-snug">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </React.Fragment>
        ))}

        {/* 平安餐與茶飲贊助 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#C49820]/20">
          <p className="font-bold text-[#2E2A22] text-sm">平安餐與茶飲贊助</p>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            普渡當日將提供工作人員平安餐與茶飲，感謝他們辛勞付出、圓滿法會。
            誠摯邀請有緣信眾發心護持，金額不限、隨喜功德，贊助者將於普渡當日一一稟報祈福。
          </p>
          {/* 可見標籤：placeholder 一打字就消失，只靠它的話填到一半分心回來，
              那格有數字卻看不出是什麼 */}
          <label htmlFor="fahui-meal-sponsor" className="block text-xs text-gray-500 mt-3 mb-1">贊助金額（選填）</label>
          <div className="flex items-center gap-2">
            <span className="text-[#7C5C1E] font-bold" aria-hidden="true">$</span>
            <input
              id="fahui-meal-sponsor"
              className={inputCls}
              type="number"
              min={0}
              inputMode="numeric"
              value={mealSponsor}
              onChange={e => setMealSponsor(e.target.value)}
              placeholder="隨喜贊助金額（選填）"
            />
          </div>
        </div>

        {/* Step 3 – 其他需求與留言 */}
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 bg-[#C49820] text-white rounded-full flex items-center justify-center text-xs shrink-0">3</span>
          <h3 className="font-bold text-[#2E2A22] text-sm">其他需求與留言</h3>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#C49820]/20">
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="如有其他需要協助的事項，可留言給工作人員（選填）" aria-label="如有其他需要協助的事項，可留言給工作人員"
          />
        </div>

        {/* Total Breakdown */}
        {total > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#C49820]/20">
            <h3 className="font-bold text-[#2E2A22] mb-3 text-sm">費用明細</h3>
            <div className="space-y-2">
              {SERVICE_CONFIGS.filter(s => (allEntries[s.key]?.length ?? 0) > 0).map(s => (
                <div key={s.key} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {s.title} × {serviceUnitCount(s, allEntries[s.key])} {s.unit}
                  </span>
                  <span className="text-[#2E2A22] font-medium">
                    $ {serviceSubtotal(s, allEntries[s.key]).toLocaleString()}
                  </span>
                </div>
              ))}
              {mealAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">平安餐與茶飲贊助</span>
                  <span className="text-[#2E2A22] font-medium">$ {mealAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t border-[#C49820]/20 pt-2 mt-1 flex justify-between font-bold">
                <span className="text-[#2E2A22]">應匯金額</span>
                <span className="text-[#7C5C1E] text-lg">$ {total.toLocaleString()} 元</span>
              </div>
            </div>
          </div>
        )}

        {/* 匯款帳號後五碼 —— 放在費用明細之後、送出之前，位置貼著付款情境。
            多數人是送出後才去匯款，所以是選填；已先匯款的人可以直接填，省掉 LINE 回報。 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#C49820]/20">
          <label htmlFor="fahui-account-last5" className="block text-xs text-gray-500 mb-1">
            匯款帳號後五碼 <span className="text-gray-400">（選填）</span>
          </label>
          <input
            className={inputCls}
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={contact.accountLast5}
            onChange={e => setContact(c => ({ ...c, accountLast5: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
            placeholder="已完成匯款請填 5 碼數字"
            id="fahui-account-last5"
          />
          <p className="text-[11px] text-gray-400 mt-1.5">
            尚未匯款可先留空，完成匯款後再以 LINE 官方帳號告知即可。
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-4 rounded-2xl bg-amber-800 hover:bg-amber-900 active:scale-[0.98] text-white font-bold text-base shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? '送出中…' : '確認送出報名'}
        </button>

        <p className="text-center text-xs text-gray-400 pb-2">
          送出後請完成銀行匯款，並透過 LINE 告知帳號後五碼
        </p>

        {/* 頁尾 */}
        <footer className="mt-2 pt-6 border-t border-[#C49820]/20 text-center space-y-1.5 pb-4">
          <p className="font-serif font-bold text-[#7C5C1E]">和聖壇</p>
          <p className="text-xs text-gray-500">台北市中正區晉江街72巷9號</p>
          <p className="text-sm text-[#2E2A22]">
            聯絡電話：
            <a href="tel:0953945349" className="font-semibold text-[#7C5C1E] hover:underline">0953-945-349</a>
          </p>
        </footer>
      </div>
    </div>
  );
}

// ── Service Section ───────────────────────────────────────────────────────────

interface ServiceSectionProps {
  config: ServiceConfig;
  entries: Entry[];
  contact: ContactInfo;
  onQuantityChange: (qty: number) => void;
  onFieldChange: (entryIdx: number, fieldKey: string, update: Partial<FieldVal>) => void;
}

function ServiceSection({ config, entries, contact, onQuantityChange, onFieldChange }: ServiceSectionProps) {
  const qty = entries.length;

  return (
    <div
      className={`bg-white rounded-2xl overflow-hidden shadow-sm border transition-all duration-200 ${
        qty > 0 ? 'border-[#C49820] shadow-md ring-1 ring-[#C49820]/30' : 'border-[#C49820]/20'
      }`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <div>
          <span className="font-bold text-[#2E2A22] font-serif text-base">{config.title}</span>
          <p className="text-xs text-[#C49820] mt-0.5">
            每{config.unit} <span className="font-semibold">$ {config.price.toLocaleString()}</span> 元
          </p>
          {config.desc && <p className="text-[11px] text-gray-400 mt-0.5">{config.desc}</p>}
        </div>

        {/* Quantity Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            aria-label="減少數量"
            onClick={() => onQuantityChange(Math.max(0, qty - 1))}
            disabled={qty === 0}
            className="w-11 h-11 rounded-full border border-[#C49820]/40 flex items-center justify-center text-[#C49820] hover:bg-[#C49820]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Minus className="w-5 h-5" />
          </button>
          <span className="w-7 text-center font-bold text-[#2E2A22] text-base tabular-nums">{qty}</span>
          <button
            type="button"
            aria-label="增加數量"
            onClick={() => onQuantityChange(qty + 1)}
            className="w-11 h-11 rounded-full bg-[#C49820] flex items-center justify-center text-white hover:bg-[#B08010] active:scale-90 transition-all"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Entry Cards */}
      {entries.map((entry, idx) => {
        const noun = config.entryNoun ?? config.unit;
        const units = entryUnits(config, entry);
        return (
        <div key={idx} className="border-t border-[#C49820]/15 px-4 py-3 bg-amber-50/40">
          <div className="flex items-center justify-between mb-2.5">
            {qty > 1 ? (
              <p className="text-xs font-semibold text-[#C49820]">第 {idx + 1} {noun}</p>
            ) : <span />}
            {config.fields.some(f => f.kind === 'quantity') && (
              <p className="text-[11px] text-gray-400">小計 ${(config.price * units).toLocaleString()}</p>
            )}
          </div>
          <div className="space-y-3">
            {config.fields.map(field => {
              const fv = entry[field.key] ?? { value: '', sameAs: false };
              const isLocked = fv.sameAs && !!field.sameAsContactType;
              const displayValue = isLocked
                ? field.sameAsContactType === 'name'
                  ? contact.name
                  : contact.address
                : fv.value;

              // 數量選擇器（1~max）
              if (field.kind === 'quantity') {
                const max = field.max ?? 10;
                return (
                  <div key={field.key}>
                    <label className="text-xs text-gray-500 block mb-1.5">{field.label}</label>
                    <select
                      className={inputCls}
                      value={fv.value || '1'}
                      onChange={e => onFieldChange(idx, field.key, { value: e.target.value })}
                    >
                      {Array.from({ length: max }, (_, i) => i + 1).map(n => (
                        <option key={n} value={String(n)}>{n} 單位（${(config.price * n).toLocaleString()}）</option>
                      ))}
                    </select>
                  </div>
                );
              }

              // 生日選擇器（填國曆自動換算農曆，並帶出生肖）；可套用「同聯絡人生日」
              if (field.kind === 'birthdate') {
                const canSameBirthday = field.sameAsContactType === 'birthday' && !!contact.birthDate;
                return (
                  <div key={field.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-gray-500">生日（請填國曆，自動換算農曆）</label>
                      {canSameBirthday && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = !fv.sameAs;
                            onFieldChange(idx, field.key, { sameAs: next });
                            onFieldChange(idx, 'zodiac', { sameAs: next });
                          }}
                          className={`flex items-center gap-1 text-[11px] rounded-full px-2.5 py-0.5 border transition-all ${
                            fv.sameAs
                              ? 'bg-[#C49820] text-white border-[#C49820] font-medium'
                              : 'text-[#C49820] border-[#C49820]/40 hover:bg-[#C49820]/10'
                          }`}
                        >
                          {fv.sameAs && <CheckCircle2 className="w-3 h-3" />}
                          同聯絡人生日
                        </button>
                      )}
                    </div>
                    {fv.sameAs ? (
                      <div className="rounded-lg border border-[#C49820]/40 bg-[#C49820]/10 px-3 py-2.5 text-sm text-[#2E2A22]">
                        {contact.birthDate || '（聯絡人尚未填生日）'}
                      </div>
                    ) : (
                      <BirthDatePicker
                        hideLabel
                        birthDate={fv.value}
                        onChange={(bd, zod) => {
                          onFieldChange(idx, field.key, { value: bd });
                          onFieldChange(idx, 'zodiac', { value: zod ?? '' });
                        }}
                      />
                    )}
                  </div>
                );
              }

              // 性別（信士／信女；可套用聯絡人性別）
              if (field.kind === 'gender') {
                const canSameGender = field.sameAsContactType === 'gender' && !!contact.gender;
                return (
                  <div key={field.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-gray-500">{field.label}</label>
                      {canSameGender && (
                        <button
                          type="button"
                          onClick={() => onFieldChange(idx, field.key, { sameAs: !fv.sameAs })}
                          className={`flex items-center gap-1 text-[11px] rounded-full px-2.5 py-0.5 border transition-all ${
                            fv.sameAs
                              ? 'bg-[#C49820] text-white border-[#C49820] font-medium'
                              : 'text-[#C49820] border-[#C49820]/40 hover:bg-[#C49820]/10'
                          }`}
                        >
                          {fv.sameAs && <CheckCircle2 className="w-3 h-3" />}
                          同聯絡人性別
                        </button>
                      )}
                    </div>
                    {fv.sameAs ? (
                      <div className="rounded-lg border border-[#C49820]/40 bg-[#C49820]/10 px-3 py-2.5 text-sm text-[#2E2A22]">
                        {contact.gender || '（聯絡人尚未選性別）'}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {GENDER_OPTIONS.map(g => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => onFieldChange(idx, field.key, { value: g })}
                            className={`flex-1 py-2.5 rounded-lg border text-sm transition-all ${
                              fv.value === g
                                ? 'bg-[#C49820] text-white border-[#C49820] font-medium'
                                : 'bg-white text-[#2E2A22] border-[#C49820]/40 hover:bg-[#C49820]/10'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // 生肖（填生日自動帶入，可手動調整；同聯絡人生日時鎖定顯示）
              if (field.kind === 'zodiac') {
                // 有生日就由生日推算，不讓人手選。
                //
                // 舊版是「自動帶入之後仍可改」的下拉，結果出現過生日與生肖對不起來的資料
                // （民國112年11月5日是兔年，卻被選成蛇）。生肖是生日的函數，不是獨立的意見，
                // 開放編輯只會製造矛盾——而且矛盾一旦寫進疏文就是錯的。
                // 沒有生日的項目（嬰靈、冤親債主常常不知道生辰）才保留下拉讓人填。
                const bdField = config.fields.find(f => f.kind === 'birthdate');
                const bdValue = bdField ? (entry[bdField.key] ?? { value: '', sameAs: false }) : null;
                const fromBirth = !!bdValue && (bdValue.sameAs ? !!contact.birthDate : !!bdValue.value);
                return (
                  <div key={field.key}>
                    <label className="text-xs text-gray-500 block mb-1.5">{field.label}</label>
                    {fv.sameAs ? (
                      <div className="rounded-lg border border-[#C49820]/40 bg-[#C49820]/10 px-3 py-2.5 text-sm text-[#2E2A22]">
                        {contact.zodiac || '（依聯絡人生日）'}
                      </div>
                    ) : fromBirth ? (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-[#2E2A22] flex items-center justify-between">
                        <span>{fv.value || '—'}</span>
                        <span className="text-[11px] text-gray-400">依生日自動換算</span>
                      </div>
                    ) : (
                      <select
                        className={inputCls}
                        value={fv.value}
                        onChange={e => onFieldChange(idx, field.key, { value: e.target.value })}
                      >
                        <option value="">請選擇（填生日就會自動帶入）</option>
                        {ZODIAC_OPTIONS.map(z => <option key={z} value={z}>{z}</option>)}
                      </select>
                    )}
                  </div>
                );
              }

              return (
                <div key={field.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-gray-500">{field.label}</label>
                    {field.sameAsContactType && (
                      <button
                        type="button"
                        onClick={() => onFieldChange(idx, field.key, { sameAs: !fv.sameAs })}
                        className={`flex items-center gap-1 text-[11px] rounded-full px-2.5 py-0.5 border transition-all ${
                          fv.sameAs
                            ? 'bg-[#C49820] text-white border-[#C49820] font-medium'
                            : 'text-[#C49820] border-[#C49820]/40 hover:bg-[#C49820]/10'
                        }`}
                      >
                        {fv.sameAs && <CheckCircle2 className="w-3 h-3" />}
                        同聯絡人{field.sameAsContactType === 'name' ? '姓名' : '地址'}
                      </button>
                    )}
                  </div>
                  <input
                    className={`${inputCls} ${isLocked ? 'bg-[#C49820]/10 cursor-default' : ''}`}
                    value={displayValue}
                    readOnly={isLocked}
                    placeholder={field.placeholder ?? `請填寫${field.label}`}
                    onChange={e => !isLocked && onFieldChange(idx, field.key, { value: e.target.value })}
                  />
                </div>
              );
            })}
          </div>
        </div>
        );
      })}
    </div>
  );
}

// ── Success Screen ────────────────────────────────────────────────────────────

interface SummaryItem { title: string; count: number; unit: string; subtotal: number }

function SuccessScreen({
  onBack,
  onVolunteer,
  onJoinMember,
  contact,
  summary,
  total,
}: {
  onBack?: () => void;
  onVolunteer?: (contact: FahuiVolunteerHandoff) => void;
  onJoinMember?: (phone: string) => void;
  contact: ContactInfo;
  summary: SummaryItem[];
  total: number;
}) {
  return (
    <div className="min-h-screen bg-[#F5F0E8] pb-12">
      <div className="max-w-2xl mx-auto px-4 pt-10 space-y-4">
        {/* Success Header */}
        <div className="flex flex-col items-center py-8 text-center">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-4 border-2 border-green-200">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="font-bold text-2xl text-[#2E2A22] font-serif">報名成功！</h2>
          <p className="text-gray-500 text-sm mt-1">感謝 {contact.name} 的護持</p>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#C49820]/20">
          <h3 className="font-bold text-[#2E2A22] mb-3 text-sm">報名明細</h3>
          <div className="space-y-2">
            {summary.map(item => (
              <div key={item.title} className="flex justify-between text-sm">
                <span className="text-gray-600">{item.title} × {item.count} {item.unit}</span>
                <span className="font-medium text-[#2E2A22]">$ {item.subtotal.toLocaleString()}</span>
              </div>
            ))}
            <div className="border-t border-[#C49820]/20 pt-2 flex justify-between font-bold">
              <span className="text-[#2E2A22]">應匯金額</span>
              <span className="text-[#7C5C1E] text-lg">$ {total.toLocaleString()} 元</span>
            </div>
          </div>
        </div>

        {/* Bank Info */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm space-y-1.5">
          <p className="font-bold text-amber-800 mb-2 text-base">請完成匯款</p>
          <p className="text-amber-900">銀行：中國信託銀行　代碼 <span className="font-semibold">822</span></p>
          <p className="text-amber-900">分行：大安分行</p>
          <p className="text-amber-900">
            帳號：<span className="font-semibold tracking-widest">6025-4035-6010</span>
          </p>
          <p className="text-amber-900">戶名：王順文</p>
          <p className="text-amber-800 font-bold mt-2">應匯金額：$ {total.toLocaleString()} 元</p>
          <p className="text-amber-700 text-xs mt-2 leading-relaxed">
            匯款完成後，請於 LINE 官方帳號 @725utjch 告知帳號後五碼，
            收到款項即完成登記。
          </p>
        </div>

        {/* LINE CTA */}
        <a
          href={getLineUrl()}
          onClick={() => trackLine('fahui-success')}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-[#06C755] text-white font-bold text-base shadow-md hover:bg-[#05b04c] active:scale-[0.98] transition-all"
        >
          透過 LINE 告知匯款完成
        </a>

        <button
          onClick={shareFahui}
          className="w-full py-3.5 rounded-2xl border-2 border-[#C49820] text-[#7C5C1E] font-bold text-sm hover:bg-[#C49820]/10 active:scale-[0.98] transition-all"
        >
          分享給親友
        </button>
        <p className="text-center text-xs text-gray-400 -mt-1">邀請親友一同報名護持，共霑法益</p>

        <button
          onClick={() => window.location.reload()}
          className="w-full py-3 rounded-2xl border border-[#C49820]/40 text-[#2E2A22] text-sm font-medium hover:bg-[#C49820]/5 transition-colors"
        >
          再報名一筆
        </button>

        {/* 加入會員。放在志工之前：這一個對信眾本人有用（查得到自己的紀錄、
            下次不必重填），志工是對廟方有用，順序照「對誰有用」排。 */}
        {onJoinMember && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#C49820]/30 text-center mt-2">
            <p className="text-sm text-[#2E2A22] mb-1 font-medium">加入會員，查得到這次的報名紀錄</p>
            <p className="text-xs text-gray-400 mb-3">用同一支電話註冊，本次報名會自動連結；下次報名不必再填一次資料</p>
            <button
              onClick={() => onJoinMember(contact.phone)}
              className="w-full py-3 rounded-2xl bg-[#7C5C1E] text-white text-sm font-bold hover:bg-[#5C4310] transition-colors"
            >
              立即加入會員 →
            </button>
          </div>
        )}

        {onVolunteer && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#C49820]/30 text-center mt-2">
            <p className="text-sm text-[#2E2A22] mb-1 font-medium">也想發心護持法會嗎？</p>
            <p className="text-xs text-gray-400 mb-3">歡迎報名法會志工，您的聯絡資料會自動帶入、不需重填</p>
            <button
              onClick={() => onVolunteer(contact)}
              className="w-full py-3 rounded-2xl border border-[#C49820] text-[#7C5C1E] text-sm font-bold hover:bg-[#C49820]/10 transition-colors"
            >
              我要報名志工
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
