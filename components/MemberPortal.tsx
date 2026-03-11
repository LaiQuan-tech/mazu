import React, { useState, useEffect } from 'react';
import { X, User, LogOut, Plus, Pencil, Trash2, CheckCircle2, AlertCircle, Eye, EyeOff, BookUser } from 'lucide-react';
import { supabase } from '../services/supabase';
import { getMemberContacts, createMemberContact, updateMemberContact, deleteMemberContact } from '../services/supabase';
import { MemberContact, MemberContactData, ZodiacSign } from '../types';

interface MemberPortalProps {
  onClose: () => void;
}

const ZODIAC_OPTIONS = Object.values(ZodiacSign);

const emptyContactForm = (): MemberContactData => ({
  label: '',
  name: '',
  phone: '',
  birthDate: '',
  zodiac: undefined,
});

// ── ContactForm（新增 / 編輯用的行內 modal）────────────────────────────────
const ContactFormModal = ({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: MemberContactData;
  onSave: (d: MemberContactData) => void;
  onCancel: () => void;
  saving: boolean;
}) => {
  const [form, setForm] = useState<MemberContactData>(initial);

  const set = (key: keyof MemberContactData, val: string) =>
    setForm(f => ({ ...f, [key]: val || undefined }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) { alert('請填寫稱謂'); return; }
    if (!form.name.trim()) { alert('請填寫姓名'); return; }
    onSave(form);
  };

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
            <label className="block text-sm font-medium text-gray-700 mb-1">稱謂 / 關係 *</label>
            <input
              type="text"
              required
              placeholder="本人、媽媽、老公、小孩…"
              value={form.label}
              onChange={e => set('label', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
            />
          </div>

          {/* 姓名 + 電話 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
              <input
                type="text"
                required
                placeholder="王小明"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電話</label>
              <input
                type="tel"
                placeholder="0912-345-678"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
              />
            </div>
          </div>

          {/* 農曆生日 + 生肖 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">農曆生日</label>
              <input
                type="text"
                placeholder="如：正月初一"
                value={form.birthDate}
                onChange={e => set('birthDate', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
              />
            </div>
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
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-temple-red text-white rounded-lg text-sm font-medium hover:bg-[#5C1A04] transition-colors disabled:opacity-60"
            >
              {saving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setAuthError('');
    setAuthSuccess('');
  };

  // ── contact handlers ──
  const handleSaveContact = async (data: MemberContactData) => {
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
              /* ── 已登入：Contacts View ── */
              <div className="p-6">
                {/* 使用者資訊列 */}
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
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
                    <p className="text-gray-300 text-xs">點擊上方「新增」儲存本人或親友資料</p>
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
                          <p className="font-semibold text-temple-dark text-sm">{c.name}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            {c.phone && <span className="text-xs text-gray-500">{c.phone}</span>}
                            {c.birthDate && <span className="text-xs text-gray-500">農曆 {c.birthDate}</span>}
                            {c.zodiac && (
                              <span className="text-xs bg-temple-gold/15 text-temple-dark px-1.5 rounded">
                                {c.zodiac}年
                              </span>
                            )}
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 聯絡人新增 / 編輯 Modal */}
      {showFormModal && (
        <ContactFormModal
          initial={editingContact
            ? { label: editingContact.label, name: editingContact.name, phone: editingContact.phone, birthDate: editingContact.birthDate, zodiac: editingContact.zodiac }
            : emptyContactForm()
          }
          onSave={handleSaveContact}
          onCancel={() => { setShowFormModal(false); setEditingContact(null); }}
          saving={saving}
        />
      )}
    </>
  );
};

export default MemberPortal;
