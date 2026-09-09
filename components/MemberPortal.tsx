import React, { useState, useEffect } from 'react';
import { X, User, LogOut, Plus, Pencil, Trash2, CheckCircle2, AlertCircle, Eye, EyeOff, BookUser, RefreshCw, ClipboardList, Flame, Calendar, HeartHandshake } from 'lucide-react';
import { supabase } from '../services/supabase';
import { getMemberContacts, createMemberContact, updateMemberContact, deleteMemberContact, getProfile, saveProfile, getMyLampRegistrations, getMyBookings, getMyBlessingRegistrations, getLampServiceConfigs, getBlessingEvents } from '../services/supabase';
import { MemberContact, MemberContactData, ProfileData, ZodiacSign, LampRegistrationStatus, BookingStatus, BlessingStatus } from '../types';
import BirthDatePicker from './BirthDatePicker';

// ── 報名紀錄顯示用型別 ──────────────────────────────────────────────────────
type PortalRecord =
  | { kind: 'lamp';     id: string; name: string; zodiac?: string; serviceName: string; status: LampRegistrationStatus; createdAt: string; }
  | { kind: 'booking';  id: string; name: string; zodiac?: string; consultType: string;  bookingDate: string; status: BookingStatus; divineMessage?: string; createdAt: string; }
  | { kind: 'blessing'; id: string; name: string; zodiac?: string; eventTitle: string;  packageName?: string; packageFee?: number; status: BlessingStatus; createdAt: string; };

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
const MemberPortal: React.FC<MemberPortalProps> = ({ onClose, pendingPhone }) => {
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
  const [portalTab, setPortalTab] = useState<'profile' | 'contacts' | 'records'>('profile');

  // ── profile state ──
  const [profile, setProfile] = useState<ProfileData | null>(null);

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
      if (user?.email) {
        setCurrentUser({ email: user.email });
        loadContacts();
        loadProfile();
      }
    });
  }, []);

  const loadRecords = async () => {
    setRecordsLoading(true);
    try {
      const prof = await getProfile();
      if (!prof?.phone) { setAllRecords([]); return; }
      const [lamps, bookings, blessings, lampCfgs, events] = await Promise.all([
        getMyLampRegistrations(prof.phone),
        getMyBookings(prof.phone),
        getMyBlessingRegistrations(prof.phone),
        getLampServiceConfigs(),
        getBlessingEvents(),
      ]);
      const lampMap  = new Map(lampCfgs.map(c => [c.id, c.name]));
      const eventMap = new Map(events.map(e => [e.id, e.title]));
      const all: PortalRecord[] = [
        ...lamps.map(r => ({ kind: 'lamp'     as const, id: r.id, name: r.name, zodiac: r.zodiac, serviceName: lampMap.get(r.serviceId) ?? r.serviceId, status: r.status, createdAt: r.createdAt })),
        ...bookings.map(r => ({ kind: 'booking' as const, id: r.id, name: r.name, zodiac: r.zodiac, consultType: r.type, bookingDate: (r as any).bookingDate, status: r.status as any, divineMessage: r.divineMessage, createdAt: (r as any).createdAt })),
        ...blessings.map(r => ({ kind: 'blessing' as const, id: r.id, name: r.name, zodiac: r.zodiac, eventTitle: eventMap.get(r.eventId) ?? '法會', packageName: r.packageName, packageFee: r.packageFee, status: r.status, createdAt: r.createdAt })),
      ];
      all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setAllRecords(all);
    } catch { setAllRecords([]); }
    finally { setRecordsLoading(false); }
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
      if (error) {
        if (error.message === 'Email not confirmed') {
          setAuthError('信箱尚未確認，請至您的信箱點擊確認連結後再登入。若未收到信，請檢查垃圾郵件。');
        } else {
          setAuthError('帳號或密碼錯誤，請再試一次。');
        }
        return;
      }
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
        setCurrentUser({ email: data.user!.email! });
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
                        <span className="mt-0.5 shrink-0">💡</span>
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
                    ) : !allRecords || allRecords.length === 0 ? (
                      <div className="text-center py-10">
                        <ClipboardList className="w-10 h-10 mx-auto text-gray-200 mb-3" />
                        <p className="text-gray-400 text-sm">尚無報名紀錄</p>
                        <p className="text-gray-300 text-xs mt-1">完成點燈、問事或祈福報名後會顯示於此</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {allRecords.map(rec => {
                          const kindLabel  = rec.kind === 'lamp' ? '點燈' : rec.kind === 'booking' ? '問事' : '祈福';
                          const kindColor  = rec.kind === 'lamp' ? 'bg-orange-100 text-orange-700' : rec.kind === 'booking' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';
                          const kindIcon   = rec.kind === 'lamp' ? <Flame className="w-3 h-3" /> : rec.kind === 'booking' ? <Calendar className="w-3 h-3" /> : <HeartHandshake className="w-3 h-3" />;
                          const statusStr = String(rec.status ?? '');   // status 可能為 null（後台手動建資料時），避免整頁白屏
                          const statusColor =
                            statusStr.includes('待') ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                            statusStr.includes('確認') ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            statusStr.includes('完成') ? 'bg-green-50 text-green-700 border border-green-200' :
                            'bg-gray-50 text-gray-500 border border-gray-200';
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
                                  </p>
                                </div>
                                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
                                  {rec.status}
                                </span>
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
