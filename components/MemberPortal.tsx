import React, { useState, useEffect } from 'react';
import { X, User, LogOut, Plus, Pencil, Trash2, CheckCircle2, AlertCircle, Eye, EyeOff, BookUser, RefreshCw, ClipboardList, Flame, Calendar, HeartHandshake, Users } from 'lucide-react';
import { supabase } from '../services/supabase';
import { getMemberContacts, createMemberContact, updateMemberContact, deleteMemberContact, getProfile, saveProfile, getMyLampRegistrations, getMyBookings, getMyBlessingRegistrations, getLampServiceConfigs, getBlessingEvents, getMySharedHistory, getMyFahuiRegistrations } from '../services/supabase';
import { SERVICE_PATH, SHARED_LABEL, confirmAndDeleteSharedSession } from '../services/sharedSessionStore';
import { ENABLE_LINE_LOGIN, signInWithLine, linkLineAccount, hasLineIdentity, takeAuthErrorFromUrl } from '../services/lineAuth';
import { LineIcon } from './SocialLinks';
import { SharedSessionRecord, SharedServiceType } from '../types';
import { TAG_GOLD, TAG_BROWN, TAG_GOLD_OUTLINE, TAG_STATE_OPEN, TAG_STATE_DONE, TAG_STATE_OVER } from './tagStyles';
import { MemberContact, MemberContactData, ProfileData, ZodiacSign, LampRegistrationStatus, BookingStatus, BlessingStatus } from '../types';
import BirthDatePicker from './BirthDatePicker';

/**
 * Supabase 的 user 轉成畫面要顯示的身分。
 *
 * **email 可能是 null**：LINE 登入回給我們的只有 userId／暱稱／頭像（見 services/lineAuth.ts），
 * 這裡原本三處都寫 `setCurrentUser({ email: user.email })`，LINE 帳號會整個登入不進來。
 * 沒有 email 就退到 LINE 暱稱，再沒有就顯示「會員」——登入狀態不可以因為少一個欄位就壞掉。
 */
const pickName = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const describeUser = (u: { email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined) => {
  if (!u) return null;
  const m = u.user_metadata ?? {};
  return { email: u.email ?? null, name: pickName(m.name) ?? pickName(m.full_name) };
};


// ── 報名紀錄顯示用型別 ──────────────────────────────────────────────────────
type PortalRecord =
  | { kind: 'lamp';     id: string; name: string; zodiac?: string; serviceName: string; status: LampRegistrationStatus; createdAt: string; }
  | { kind: 'booking';  id: string; name: string; zodiac?: string; consultType: string;  bookingDate: string; status: BookingStatus; divineMessage?: string; createdAt: string; }
  | { kind: 'blessing'; id: string; name: string; zodiac?: string; eventTitle: string;  packageName?: string; packageFee?: number; status: BlessingStatus; createdAt: string; }
  /**
   * 法會報名（2026-10-13 補）。**一筆是「一次報名」不是「一個人」**：
   * 法會一次可以報很多個牌位，整組存在同一列的 entries jsonb 裡，
   * 跟點燈那種一人一列不同，所以顯示的是「共 N 個項目」而不是某個人的名字。
   * status 法會表沒有這個欄位（對帳狀態是另外幾欄），所以給空字串不顯示標籤。
   */
  | { kind: 'fahui';    id: string; name: string; entryCount: number; total: number; status: string; createdAt: string; };

/** 揪團紀錄的一列：場次本身（刪除要用）＋算好的顯示文字 */
interface SharedRow {
  session: SharedSessionRecord;
  /** 服務種類以外的補充：祈福是活動名稱、問事是日期時段；點燈沒有 */
  detail?: string;
  /** 每位親友一行：姓名＋選的項目（燈種／方案／問事類型），對不到就只有姓名 */
  people: string[];
  /** 送出了、還在進行、或連結到期沒送出（那一團沒成，主揪要知道） */
  state: 'submitted' | 'open' | 'expired';
}

/** 揪團場次的顯示狀態。到期與否看 expires_at，資料庫不會主動改 status */
/**
 * 三種服務的標籤色。全站同一組（見 components/tagStyles.ts）——
 * 這裡原本是 orange／blue／purple，在廟紅＋金的版面上是外來色
 * （廟方 2026-10-01：「標籤顏色，還是要維持一致風格」）。
 */
const SERVICE_TAG: Record<SharedServiceType, string> = {
  lamp: TAG_GOLD, booking: TAG_GOLD_OUTLINE, blessing: TAG_BROWN,
};

const sharedState = (s: SharedSessionRecord): SharedRow['state'] =>
  s.status === 'submitted' ? 'submitted'
  : new Date(s.expiresAt).getTime() < Date.now() ? 'expired'
  : 'open';

// 簡繁對映（lunar-javascript 部分生肖用簡體）
/*
 * 這裡原本複製了一整套曆法邏輯（月份字表、SHENGXIAO_MAP、buildSolarResult、
 * buildLunarResult、parseBirthDate…）與兩份生日輸入 UI，跟 BirthDatePicker 平行維護。
 * 結果是全站兩種輸入法、兩種儲存格式——資料庫裡同時存在
 * 「民國72年6月20日（農曆五月初十）」與「民國72年農曆五月初十」兩種寫法。
 *
 * 2026-08-13 全部刪除，改用共用的 <BirthDatePicker />。要改生日的行為只有一個地方。
 */

interface MemberPortalProps {
  onClose: () => void;
  pendingPhone?: string; // 訪客預約電話，用於自動預填個人資料
  /** 在會員中心刪了一張揪團報名表。服務頁的「還沒送出」提示卡拿的是同一批資料，要跟著拿掉 */
  onSharedSessionDeleted?: (id: string) => void;
  /**
   * 個人資料存檔後通知外面。
   * **不能只靠 onClose**：會員可能存完直接從這裡的揪團連結跳去服務頁，沒有經過關閉；
   * 而報名表的自動帶入吃的是 App 那份 memberProfile，不更新就等於沒存
   * （廟方 2026-10-13 回報「LINE 登入後補了資料，報名時沒有自動帶入」）。
   */
  onProfileSaved?: () => void;
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
  const [form, setForm] = useState<MemberContactData>(initial);

  const set = (key: keyof MemberContactData, val: string) =>
    setForm(f => ({ ...f, [key]: val || undefined }));



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

          {/* 電話（所有聯絡人皆可填，選填；前台表單帶入聯絡人時可一併帶電話） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">電話 <span className="text-gray-400 font-normal">（選填）</span></label>
            <input
              type="tel" placeholder="0912-345-678"
              value={form.phone} onChange={e => set('phone', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
            />
          </div>

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

          {/*
            生日改用共用的 BirthDatePicker（與問事／點燈／法會等表單同一個元件）。
            以前這裡有一份自己的換算與 UI，等於全站維護兩套：兩邊的月份字表、
            跨年處理、儲存格式各走各的，這正是資料庫裡出現兩種生日格式的原因。
          */}
          <BirthDatePicker
            birthDate={form.birthDate}
            onChange={(bd, z) => setForm(f => ({ ...f, birthDate: bd, zodiac: z ?? f.zodiac }))}
          />
          {/* 生肖（自動帶入，可手動修改） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">生肖</label>
            {form.zodiac && form.birthDate ? (
              // 生日已經填了就由生日推算，不讓人手選——生肖是生日的函數，不是獨立的意見。
              // 開放編輯只會製造「生日與生肖對不起來」的資料（法會報名出現過一筆）。
              <div className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 flex items-center justify-between">
                <span>{form.zodiac}</span>
                <span className="text-xs text-gray-400">依生日自動換算</span>
              </div>
            ) : (
              <select
              value={form.zodiac || ''}
              onChange={e => set('zodiac', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
              >
              <option value="">不指定</option>
              {ZODIAC_OPTIONS.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            )}
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
  const [form, setForm] = useState<ProfileData>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 當 profile 從 DB 載入後同步到表單
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (synced || !initial.name) return;
    setForm(initial);
    setSynced(true);
  }, [initial.name]);

  const set = (key: keyof ProfileData, val: string) =>
    setForm(f => ({ ...f, [key]: val || undefined }));



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

          {/*
            生日改用共用的 BirthDatePicker（與問事／點燈／法會等表單同一個元件）。
            以前這裡有一份自己的換算與 UI，等於全站維護兩套：兩邊的月份字表、
            跨年處理、儲存格式各走各的，這正是資料庫裡出現兩種生日格式的原因。

            **`key` 一定要跟著 synced 變**：BirthDatePicker 的年月日是三個 useState
            的惰性初始值，**只在掛載時從 birthDate 解析一次**，之後改 prop 畫面不會動。
            這一頁是先掛載空表單、再非同步載入 profile，沒有這個 key 的話生日永遠停在
            「吉年／吉月／吉日」——資料庫裡明明有值，會員看到空的以為沒存到，
            於是一填再填（廟方 2026-09-10 回報「輸入好幾次還是沒有被記錄下來」，
            實際上每一次都存成功了）。
            synced 只會 false→true 一次，所以不會在使用者輸入到一半時把內容洗掉。
            App.tsx 的問事／點燈／祈福三張表用 `_bKey` 做同一件事，這裡是第四處。
          */}
          <BirthDatePicker
            key={`profile-birth-${synced ? 1 : 0}`}
            birthDate={form.birthDate}
            onChange={(bd, z) => setForm(f => ({ ...f, birthDate: bd, zodiac: z ?? f.zodiac }))}
          />
      {/* 生肖 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">生肖</label>
        {form.zodiac && form.birthDate ? (
          // 生日已經填了就由生日推算，不讓人手選——生肖是生日的函數，不是獨立的意見。
          // 開放編輯只會製造「生日與生肖對不起來」的資料（法會報名出現過一筆）。
          <div className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 flex items-center justify-between">
            <span>{form.zodiac}</span>
            <span className="text-xs text-gray-400">依生日自動換算</span>
          </div>
        ) : (
          <select
            value={form.zodiac || ''}
            onChange={e => set('zodiac', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
          >
            <option value="">不指定</option>
            {ZODIAC_OPTIONS.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        )}
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
const MemberPortal: React.FC<MemberPortalProps> = ({ onClose, pendingPhone, onSharedSessionDeleted, onProfileSaved }) => {
  // ── auth state ──
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [currentUser, setCurrentUser] = useState<{ email: string | null; name: string | null } | null>(null);

  // ── portal tab ──
  const [portalTab, setPortalTab] = useState<'profile' | 'contacts' | 'records'>('profile');
  /**
   * 這個帳號開過的每一張揪團報名表（不分狀態、含過期）。
   * 報名紀錄是拿電話比對 lamp_registrations 等表撈的；揪團送出時親友填了自己的
   * 電話那筆就掛親友的，主揪那邊看不到——所以揪團要另外列，直接顯示場次＋名單。
   */
  const [sharedRows, setSharedRows] = useState<SharedRow[] | null>(null);

  // ── profile state ──
  const [profile, setProfile] = useState<ProfileData | null>(null);
  /** 分辨「還沒載入」與「載入了但沒填電話」。沒有這個旗標，提示會在資料回來前先閃一下 */
  const [profileLoaded, setProfileLoaded] = useState(false);
  /** 這個帳號綁了 LINE 沒有（綁了就能直接用 LINE 登入同一個帳號） */
  const [lineLinked, setLineLinked] = useState(false);
  const [linking, setLinking] = useState(false);
  /** 綁定失敗的訊息是從轉回來的網址上讀的，不是 API 回傳值 */
  const [linkError, setLinkError] = useState('');

  // ── records state ──
  const [allRecords, setAllRecords] = useState<PortalRecord[] | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);

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
      if (user) {
        setCurrentUser(describeUser(user));
        loadContacts();
        loadProfile();
        if (ENABLE_LINE_LOGIN) hasLineIdentity().then(setLineLinked);
      }
    });
    // 綁定／登入失敗時 Supabase 把原因放在轉回來的網址上，讀完就清掉。
    // **只有讀到東西才覆寫**：takeAuthErrorFromUrl 只回傳一次，而 StrictMode 在開發模式
    // 會把 effect 跑兩次——無條件 set 的話第二次拿到空字串，剛讀到的訊息又被自己洗掉
    // （2026-10-13 卡在這很久，正式站沒有 StrictMode 所以只有本機看得出來）。
    if (ENABLE_LINE_LOGIN) {
      const urlErr = takeAuthErrorFromUrl();
      if (urlErr) setLinkError(urlErr);
    }
  }, []);

  const loadRecords = async () => {
    setRecordsLoading(true);
    try {
      const [prof, lampCfgs, events, shared] = await Promise.all([
        getProfile(),
        getLampServiceConfigs(),
        getBlessingEvents(),
        getMySharedHistory().catch(() => [] as SharedSessionRecord[]),
      ]);
      const lampMap  = new Map(lampCfgs.map(c => [c.id, c.name]));
      const eventMap = new Map(events.map(e => [e.id, e.title]));

      // 揪團不看電話，沒填電話的會員也看得到自己開的表
      setSharedRows(shared.map(s => {
        const c = s.config;
        const when = c.bookingDate
          ? `${new Date(c.bookingDate).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}${c.bookingTime ? ` ${c.bookingTime}` : ''}`
          : '';
        const extra = s.serviceType === 'blessing' ? (c.eventTitle ?? eventMap.get(c.eventId ?? '')) : s.serviceType === 'booking' ? when : '';
        const packages = s.serviceType === 'blessing' ? events.find(e => e.id === c.eventId)?.packages : undefined;
        return {
          session: s,
          state: sharedState(s),
          detail: extra || undefined,
          people: s.entries.map(e => {
            const pick = s.serviceType === 'lamp' ? lampMap.get(e.serviceId ?? '')
              : s.serviceType === 'blessing' ? packages?.find(p => p.id === e.packageId)?.name
              : e.bookingType;
            return pick ? `${e.name}・${pick}` : e.name;
          }),
        };
      }));

      if (!prof?.phone) { setAllRecords([]); return; }
      const [lamps, bookings, blessings, fahui] = await Promise.all([
        getMyLampRegistrations(prof.phone),
        getMyBookings(prof.phone),
        getMyBlessingRegistrations(prof.phone),
        // 沒跑 fahui_member_read.sql 的話 RLS 會靜默擋成空陣列，不會壞掉
        getMyFahuiRegistrations(prof.phone).catch(() => []),
      ]);
      const all: PortalRecord[] = [
        ...lamps.map(r => ({ kind: 'lamp'     as const, id: r.id, name: r.name, zodiac: r.zodiac, serviceName: lampMap.get(r.serviceId) ?? r.serviceId, status: r.status, createdAt: r.createdAt })),
        ...bookings.map(r => ({ kind: 'booking' as const, id: r.id, name: r.name, zodiac: r.zodiac, consultType: r.type, bookingDate: (r as any).bookingDate, status: r.status as any, divineMessage: r.divineMessage, createdAt: (r as any).createdAt })),
        ...blessings.map(r => ({ kind: 'blessing' as const, id: r.id, name: r.name, zodiac: r.zodiac, eventTitle: eventMap.get(r.eventId) ?? '法會', packageName: r.packageName, packageFee: r.packageFee, status: r.status, createdAt: r.createdAt })),
        ...fahui.map(r => ({ kind: 'fahui' as const, id: r.id, name: r.name, entryCount: r.entryCount, total: r.total, status: '', createdAt: r.createdAt })),
      ];
      all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setAllRecords(all);
    } catch { setAllRecords([]); }
    finally { setRecordsLoading(false); }
  };

  /** 從紀錄裡刪掉一張還沒送出的揪團報名表。警示與刪除跟服務頁共用同一支 */
  const handleDeleteShared = async (session: SharedSessionRecord) => {
    const deleted = await confirmAndDeleteSharedSession(session);
    if (!deleted) return;
    setSharedRows(prev => prev ? prev.filter(r => r.session.id !== session.id) : prev);
    onSharedSessionDeleted?.(session.id);
  };

  // 切換到報名紀錄 tab 時懶加載
  useEffect(() => {
    if (portalTab === 'records' && allRecords === null && !recordsLoading) {
      loadRecords();
    }
  }, [portalTab]);

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
    } finally {
      setProfileLoaded(true);
    }
  };

  const handleSaveProfile = async (data: ProfileData) => {
    await saveProfile(data);
    setProfile(data);
    setProfileLoaded(true);
    onProfileSaved?.();   // 讓報名表的自動帶入立刻拿到新資料，見 onProfileSaved 的說明
  };

  // ── auth handlers ──
  /**
   * 用 LINE 登入。成功的話瀏覽器已經離開這一頁，**不要把 authLoading 關掉**——
   * 關掉會讓按鈕在跳轉前一瞬間變回可按，長輩很容易連按兩次。
   */
  const handleLineLogin = async () => {
    setAuthLoading(true);
    setAuthError('');
    const err = await signInWithLine();
    if (err) { setAuthError(err); setAuthLoading(false); }
  };

  /** 把 LINE 綁到目前這個帳號。成功的話瀏覽器會離開這一頁（同 handleLineLogin） */
  const handleLinkLine = async () => {
    setLinking(true);
    setLinkError('');
    const err = await linkLineAccount();
    if (err) { setLinkError(err); setLinking(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message === 'Email not confirmed') {
          setAuthError('信箱尚未確認，請至您的信箱點擊確認連結後再登入。若未收到信，請檢查垃圾郵件。');
        } else {
          setAuthError('帳號或密碼錯誤，請再試一次。');
        }
        return;
      }
      if (data.user) {
        setCurrentUser(describeUser(data.user));
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
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('already been registered')) {
          setAuthError('此信箱已有帳號，請直接登入。');
        } else if (msg.includes('rate limit')) {
          setAuthError('目前驗證信發送已達上限，請稍後（約1小時後）再試，或聯繫管理員。');
        } else if (msg.includes('invalid email')) {
          setAuthError('信箱格式不正確，請重新確認。');
        } else {
          setAuthError(error.message);
        }
        return;
      }
      setPassword('');
      setConfirmPassword('');
      if (data.session) {
        // Supabase 已關閉 Email 確認要求，直接登入成功
        setCurrentUser(describeUser(data.user));
        loadContacts();
        loadProfile();
        if (pendingPhone) setPortalTab('profile');
      } else {
        // 需要 Email 確認
        setAuthSuccess('註冊成功！請至信箱點擊確認連結，確認後即可登入。');
        setAuthTab('login');
      }
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
                {/* ── LINE 登入 ──
                    **放在信箱登入之前**：本站信眾以長者居多，記 email 與密碼是真實的門檻，
                    而 LINE 在手機上會跳進 App、按一下「允許」就回來，不必打字也不必收驗證信。
                    次要路徑才是信箱（廟方 2026-10-12 決定）。
                    用 LINE 自己的綠（#06C755）不是站上的廟紅：這顆鈕代表的是別人的品牌，
                    照他們的識別色才認得出來，與浮動的加入 LINE 鈕同一個色。
                    設定完成前由 ENABLE_LINE_LOGIN 關著——Supabase 還沒建好供應商時
                    按下去會回 Unsupported provider，那是一顆壞掉的鈕。 */}
                {ENABLE_LINE_LOGIN && (
                  <>
                    <button
                      type="button"
                      onClick={handleLineLogin}
                      disabled={authLoading}
                      className="w-full py-3.5 rounded-lg bg-[#06C755] text-white font-bold text-base flex items-center justify-center gap-2 hover:bg-[#05B34C] transition-colors disabled:opacity-60"
                    >
                      <LineIcon className="w-6 h-6" />
                      用 LINE 帳號登入
                    </button>
                    <p className="mt-2 text-center text-xs text-gray-500 leading-relaxed">
                      不必記密碼。手機會跳到 LINE，按一下「允許」就好。
                    </p>
                    <div className="flex items-center gap-3 my-5" aria-hidden="true">
                      <span className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400">或用信箱</span>
                      <span className="flex-1 h-px bg-gray-200" />
                    </div>
                  </>
                )}

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

                {/* 轉回來的網址上帶著的錯誤。**未登入時也要顯示**：LINE「登入」失敗
                    （不是綁定）的人回來就是未登入狀態，只畫在已登入區塊的話，
                    他看到的是原本的登入表單，變成「按了沒反應」 */}
                {linkError && (
                  <div role="alert" className="flex items-start gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-4 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{linkError}</span>
                  </div>
                )}

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
                    {/* LINE 登入沒有 email，退到暱稱；兩個都沒有也要有東西可顯示 */}
                    <p className="text-sm font-medium text-temple-dark">{currentUser.email ?? currentUser.name ?? '會員'}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-full transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    登出
                  </button>
                </div>

                {/* ── 綁定 LINE ──
                    **這就是「帳號合併」的正解**（廟方 2026-10-13 要求）。
                    直覺的作法是「登入後比對手機號碼、相同就合併」，但手機是會員自己打的、
                    沒有驗證，任何人填別人的號碼就能把對方的通訊錄（家人的姓名生日地址）
                    與揪團名單併過來。改成「先用原本的帳號登入，再把 LINE 接上去」——
                    身分由原帳號自己證明，接上之後用 LINE 登入就是同一個 user id，
                    揪團表、通訊錄、個人資料原封不動。細節見 services/lineAuth.ts。 */}
                {ENABLE_LINE_LOGIN && (
                  <div className="mb-5">
                    {linkError && (
                      <div role="alert" className="mb-3 flex items-start gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{linkError}</span>
                      </div>
                    )}
                    {lineLinked ? (
                      <div className="flex items-center gap-2 rounded-xl border border-[#06C755]/40 bg-[#06C755]/10 px-4 py-2.5">
                        <LineIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                        <p className="text-sm text-gray-700">已綁定 LINE，下次可以直接用 LINE 登入這個帳號。</p>
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-[#06C755] bg-[#06C755]/10 px-4 py-3">
                        <p className="text-sm font-semibold text-gray-800 mb-1">綁定 LINE，下次不必輸入密碼</p>
                        <p className="text-xs text-gray-600 leading-relaxed mb-3">
                          綁定之後用 LINE 登入就是這個帳號，您的報名紀錄、通訊錄與揪團報名表都還在。
                        </p>
                        <button type="button" onClick={handleLinkLine} disabled={linking}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#06C755] text-white text-sm font-bold hover:bg-[#05B34C] transition-colors disabled:opacity-60">
                          <LineIcon className="w-5 h-5" aria-hidden="true" />
                          {linking ? '前往 LINE…' : '綁定 LINE 帳號'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── 還沒留電話 ──
                    **報名紀錄是拿 `profile.phone` 去對三張表的，跟 email 無關**（loadRecords）。
                    LINE 登入回給我們的沒有電話也沒有 email，不講的話信眾登進來看到空的
                    「報名紀錄」，會以為紀錄不見了。信箱註冊的會員沒填電話也是同樣的空畫面，
                    所以這個提示不分登入方式都給。
                    等 profileLoaded 才判斷，否則資料回來前會先閃一下。
                    配色沿用揪團鈕那組（深金框＋淡金底＋深褐字，量過 7.75:1）。 */}
                {profileLoaded && !profile?.phone && (
                  <div className="mb-5 rounded-xl border-2 border-[#A37D15] bg-temple-gold/20 px-4 py-3">
                    <p className="text-sm font-semibold text-[#5C4310] mb-1">還差一步：留下您的手機號碼</p>
                    <p className="text-xs text-[#5C4310] leading-relaxed">
                      廟方是用手機號碼對應您的報名紀錄。請在下方「個人資料」填好並儲存，
                      問事、點燈、祈福的紀錄就會出現在「報名紀錄」。
                    </p>
                    {/* 用 LINE 進來的人若以前有信箱帳號，通訊錄與揪團表都在那一邊
                        （那兩者綁 user id，不是電話）。要指路，不然他會以為資料不見了 */}
                    {!currentUser.email && (
                      <p className="text-xs text-[#5C4310] leading-relaxed mt-2 pt-2 border-t border-[#A37D15]/30">
                        以前用信箱註冊過嗎？請先用信箱登入，在這裡按「綁定 LINE 帳號」，
                        兩邊的紀錄才會合在同一個帳號。
                      </p>
                    )}
                  </div>
                )}

                {/* Tab 切換 */}
                <div className="flex border border-gray-200 rounded-xl overflow-hidden mb-5">
                  <button
                    onClick={() => setPortalTab('profile')}
                    className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
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
                    className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors border-x border-gray-200 ${
                      portalTab === 'contacts'
                        ? 'bg-temple-red text-white'
                        : 'text-gray-500 hover:text-temple-dark hover:bg-gray-50'
                    }`}
                  >
                    <BookUser className="w-3.5 h-3.5" />
                    親友通訊錄
                  </button>
                  <button
                    onClick={() => setPortalTab('records')}
                    className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                      portalTab === 'records'
                        ? 'bg-temple-red text-white'
                        : 'text-gray-500 hover:text-temple-dark hover:bg-gray-50'
                    }`}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    報名紀錄
                  </button>
                </div>

                {/* ── 個人資料 tab ── */}
                {portalTab === 'profile' && (
                  <>
                    {pendingPhone && !profile?.phone && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 flex items-start gap-2">
                        <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rotate-45 bg-blue-400" aria-hidden="true" />
                        <span>已為您預填電話號碼。請確認後儲存，即可在「報名紀錄」查看您的問事預約。</span>
                      </div>
                    )}
                    <ProfileFormInline
                      initial={profile ?? { name: '', phone: pendingPhone || '', birthDate: '' }}
                      onSave={handleSaveProfile}
                      savedAddresses={Array.from(new Set(contacts.map(c => c.address).filter((a): a is string => !!a)))}
                    />
                  </>
                )}

                {/* ── 報名紀錄 tab ── */}
                {portalTab === 'records' && (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-temple-dark font-serif flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-temple-red" />
                        報名紀錄
                      </h4>
                      <button onClick={loadRecords} disabled={recordsLoading}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-temple-red transition-colors disabled:opacity-40">
                        <RefreshCw className={`w-3.5 h-3.5 ${recordsLoading ? 'animate-spin' : ''}`} />
                        重新整理
                      </button>
                    </div>

                    {recordsLoading ? (
                      <div className="text-center py-10 text-gray-400 text-sm">載入中…</div>
                    ) : (
                      <>
                        {/* ── 揪團報名表：整張表為一筆，名單列在裡面 ──
                            個別報名是用電話撈的，親友填了自己電話的那幾筆主揪看不到；
                            這裡才是主揪看得到「整團」的地方。已送出的只能看，不給刪（紀錄要留） */}
                        {sharedRows && sharedRows.length > 0 && (
                          <div className="mb-6">
                            <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5" />揪團報名表
                            </p>
                            <div className="space-y-2.5">
                              {sharedRows.map(({ session, detail, people, state }) => {
                                const t = session.serviceType;
                                const kindLabel = SHARED_LABEL[t];
                                const kindColor = SERVICE_TAG[t];
                                const kindIcon  = t === 'lamp' ? <Flame className="w-3 h-3" /> : t === 'booking' ? <Calendar className="w-3 h-3" /> : <HeartHandshake className="w-3 h-3" />;
                                const stateLabel = state === 'open' ? '進行中' : state === 'submitted' ? '已送出' : '已過期';
                                const stateColor =
                                  state === 'open'      ? TAG_STATE_OPEN :
                                  state === 'submitted' ? TAG_STATE_DONE :
                                  TAG_STATE_OVER;
                                const n = people.length;
                                const summary =
                                  state === 'submitted' ? `已送出 ${n} 人的報名` :
                                  state === 'expired'   ? (n > 0 ? `連結已過期，這 ${n} 人的報名沒有送出` : '連結已過期，沒有人填寫') :
                                  (n > 0 ? `已有 ${n} 人加入，等您送出` : '還沒有人填寫');
                                const dateStr = new Date(session.createdAt).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                return (
                                  <div key={session.id} className="p-3.5 bg-gray-50 border border-gray-100 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="flex items-center gap-1.5">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${kindColor}`}>
                                          {kindIcon}{kindLabel}
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-temple-gold/15 text-temple-dark">
                                          <Users className="w-3 h-3" />揪團
                                        </span>
                                      </span>
                                      <span className="text-xs text-gray-400">{dateStr}</span>
                                    </div>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-800">{summary}</p>
                                        {detail && <p className="text-xs text-gray-500 mt-0.5">{detail}</p>}
                                      </div>
                                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${stateColor}`}>{stateLabel}</span>
                                    </div>
                                    {n > 0 && (
                                      <ul className="text-xs text-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
                                        {people.map((who, i) => <li key={i} className="truncate">{who}</li>)}
                                      </ul>
                                    )}
                                    {state !== 'submitted' && (
                                      // 刪除做小、做淡並與「繼續」拉開，破壞性動作不能挨著主要動作（同服務頁的提示卡）
                                      <div className="flex items-center justify-end gap-3 pt-1">
                                        {state === 'open' && (
                                          // 整頁導向而不是關掉視窗改狀態：?share= 的載入流程只在進站時跑一次
                                          <a href={`${SERVICE_PATH[t]}?share=${session.id}`} className="text-sm font-medium text-temple-red hover:underline">
                                            繼續 →
                                          </a>
                                        )}
                                        <button type="button" onClick={() => handleDeleteShared(session)}
                                          className="flex items-center gap-1 p-2 text-xs text-gray-400 hover:text-red-600 transition-colors">
                                          <Trash2 className="w-4 h-4" />刪除
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {!allRecords || allRecords.length === 0 ? (
                          // 有揪團紀錄時不再說「尚無紀錄」——上面明明列了東西
                          sharedRows && sharedRows.length > 0 ? null : (
                            <div className="text-center py-10">
                              <ClipboardList className="w-10 h-10 mx-auto text-gray-200 mb-3" />
                              <p className="text-gray-400 text-sm">尚無報名紀錄</p>
                              <p className="text-gray-300 text-xs mt-1">完成點燈、問事或祈福報名後會顯示於此</p>
                            </div>
                          )
                        ) : (
                          <>
                            {sharedRows && sharedRows.length > 0 && (
                              <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                                <ClipboardList className="w-3.5 h-3.5" />各筆報名
                              </p>
                            )}
                      <div className="space-y-2.5">
                        {allRecords.map(rec => {
                          const kindLabel  = rec.kind === 'lamp' ? '點燈' : rec.kind === 'booking' ? '問事' : rec.kind === 'fahui' ? '法會' : '祈福';
                          const kindColor  = rec.kind === 'fahui' ? SERVICE_TAG.blessing : SERVICE_TAG[rec.kind];
                          const kindIcon   = rec.kind === 'lamp' ? <Flame className="w-3 h-3" /> : rec.kind === 'booking' ? <Calendar className="w-3 h-3" /> : <HeartHandshake className="w-3 h-3" />;
                          const statusStr = String(rec.status ?? '');   // status 可能為 null（後台手動建資料時），避免整頁白屏
                          /**
                           * 狀態配色要**明確列舉**，不要用「字串裡有沒有某個字」去猜。
                           *
                           * 2026-10-13 點燈／祈福的狀態從「處理進度」改成收款語彙
                           * （待處理／已確認 → 待匯款／已收款），原本那段
                           * `includes('待') || includes('確認') … includes('完成')`
                           * 就漏接了「已收款」——它三個條件都不符，掉到最後的
                           * `TAG_STATE_OVER`（已結束／已過期的褪色樣式）。
                           * **信眾剛把錢匯進來、廟方剛確認，他看到自己的紀錄變灰。**
                           * 猜字串的寫法在改名那一刻必然失效，而且不會報錯。
                           *
                           * 認不出來的一律當「進行中」：褪色代表「這件事結束了」，
                           * 對一筆我們看不懂的紀錄這樣講，比顯得突兀更糟。
                           */
                          const statusColor =
                            ['已收款', '已完成'].includes(statusStr) ? TAG_STATE_DONE :
                            statusStr === '已取消'                   ? TAG_STATE_OVER :
                            TAG_STATE_OPEN;   // 待匯款／待處理／待確認／已確認，與認不出來的
                          const dateStr = new Date(rec.createdAt).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
                          return (
                            <div key={rec.id} className="p-3.5 bg-gray-50 border border-gray-100 rounded-xl space-y-2">
                              <div className="flex items-center justify-between">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${kindColor}`}>
                                  {kindIcon}{kindLabel}
                                </span>
                                <span className="text-xs text-gray-400">{dateStr}</span>
                              </div>
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">
                                    {rec.name}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {rec.kind === 'lamp'     && rec.serviceName}
                                    {rec.kind === 'booking'  && `${rec.consultType}・${new Date(rec.bookingDate).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}`}
                                    {rec.kind === 'blessing' && (rec.packageName ? `${rec.eventTitle}・${rec.packageName}` : rec.eventTitle)}
                                    {rec.kind === 'fahui'    && `共 ${rec.entryCount} 個項目・NT$${rec.total.toLocaleString()}`}
                                  </p>
                                </div>
                                {/* 法會表沒有狀態欄位（對帳狀態是另外幾欄），空的就不要畫一顆空標籤 */}
                                {statusStr && (
                                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
                                    {statusStr}
                                  </span>
                                )}
                              </div>
                              {rec.kind === 'booking' && rec.divineMessage && (
                                <div className="mt-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                                  <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                                    <span>✦</span> 神明的話
                                  </p>
                                  <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">{rec.divineMessage}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                          </>
                        )}
                      </>
                    )}
                  </>
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
