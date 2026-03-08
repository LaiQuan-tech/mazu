import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { getBookings, updateBookingStatus, getDonations, getBulletins, createBulletin, updateBulletin, deleteBulletin, getRegistrations, deleteRegistration, getSiteImages, uploadSiteImage, getSiteImagePublicUrl, getDeities, createDeity, updateDeity, deleteDeity, uploadDeityImage, getHeroSlides, uploadHeroSlide, deleteHeroSlide, getScriptureVerses, updateScriptureVerse, uploadScriptureImage, deleteScriptureImage, getLampServiceConfigs, createLampServiceConfig, updateLampServiceConfig, deleteLampServiceConfig, getLampRegistrations, updateLampRegistrationStatus, deleteLampRegistration, supabase } from '../services/supabase';
import { BookingRecord, BookingStatus, BulletinCategory, BulletinData, BulletinRecord, DeityData, DeityRecord, DonationRecord, HeroSlideRecord, LampRegistrationRecord, LampRegistrationStatus, LampServiceConfig, LampServiceConfigData, RegistrationRecord, ScriptureVerseRecord, SiteImageRecord, SiteImageSection, ZodiacSign } from '../types';
import {
  ArrowLeft, RefreshCw, Calendar, Clock, User, Phone,
  FileText, CheckCircle, XCircle, Clock3, LayoutDashboard,
  BookOpen, HeartHandshake, Search, Download, ChevronDown,
  TrendingUp, Users, Banknote, AlertCircle, LogOut,
  Megaphone, Plus, Edit2, Trash2, Pin, PinOff, X, UserPlus, ClipboardList, ArrowRight,
  Image as ImageIcon, Upload, Flame, GripVertical, Save, BookOpenCheck, List
} from 'lucide-react';

type Tab = 'overview' | 'bookings' | 'donations' | 'members' | 'bulletins' | 'photos' | 'deities' | 'scripture' | 'lamps';

interface AdminDashboardProps {
  onBack: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (s: any) => {
  if (!s) return '';
  try {
    return new Intl.DateTimeFormat('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(s));
  } catch { return String(s); }
};

const statusBadge = (status?: BookingStatus) => {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    '待處理': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock3 className="w-3 h-3" /> },
    '已確認': { bg: 'bg-blue-100',   text: 'text-blue-800',   icon: <CheckCircle className="w-3 h-3" /> },
    '已完成': { bg: 'bg-green-100',  text: 'text-green-800',  icon: <CheckCircle className="w-3 h-3" /> },
    '已取消': { bg: 'bg-red-100',    text: 'text-red-800',    icon: <XCircle className="w-3 h-3" /> },
  };
  const s = status || '';
  const cfg = map[s] || { bg: 'bg-gray-100', text: 'text-gray-800', icon: null };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${cfg.bg} ${cfg.text}`}>
      {cfg.icon} {s || '未知'}
    </span>
  );
};

const exportExcel = (filename: string, rows: (string | number)[][], headers: string[]) => {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  // 自動調整欄寬
  ws['!cols'] = headers.map((_, i) => ({
    wch: Math.max(
      headers[i].length * 2,
      ...rows.map(r => String(r[i] ?? '').length)
    ) + 2
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '資料');
  XLSX.writeFile(wb, filename);
};

// ─── Stat Card ───────────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
}) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
    <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Overview Tab ─────────────────────────────────────────────────────────────

const OverviewTab = ({ bookings, donations }: { bookings: BookingRecord[]; donations: DonationRecord[] }) => {
  const today = new Date().toISOString().slice(0, 10);
  const todayBookings = bookings.filter(b => b.bookingDate === today).length;
  const pendingCount = bookings.filter(b => b.status === BookingStatus.PENDING).length;
  const totalDonation = donations.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const uniqueNames = new Set(bookings.map(b => b.phone)).size;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">總覽</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Calendar className="w-5 h-5 text-blue-600" />} label="今日預約" value={todayBookings} sub="筆" color="bg-blue-50" />
        <StatCard icon={<AlertCircle className="w-5 h-5 text-yellow-600" />} label="待處理預約" value={pendingCount} sub="需要處理" color="bg-yellow-50" />
        <StatCard icon={<Banknote className="w-5 h-5 text-green-600" />} label="累計捐款" value={`NT$ ${totalDonation.toLocaleString()}`} sub="全部紀錄" color="bg-green-50" />
        <StatCard icon={<Users className="w-5 h-5 text-purple-600" />} label="不重複信眾" value={uniqueNames} sub="依電話計算" color="bg-purple-50" />
      </div>

      {/* 最新 5 筆預約 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-temple-red" /> 最新預約
        </h3>
        {bookings.slice(0, 5).length === 0 ? (
          <p className="text-gray-400 text-sm">尚無預約</p>
        ) : (
          <div className="space-y-3">
            {bookings.slice(0, 5).map(b => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <span className="font-medium text-sm text-gray-800">{b.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{b.bookingDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{b.type}</span>
                  {statusBadge(b.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Bookings Tab ─────────────────────────────────────────────────────────────

const BookingsTab = ({ bookings, onStatusChange, updatingId }: {
  bookings: BookingRecord[];
  onStatusChange: (id: string, status: BookingStatus) => void;
  updatingId: string | null;
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  const filtered = useMemo(() => bookings.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q || b.name.toLowerCase().includes(q) || b.phone.includes(q);
    const matchStatus = !filterStatus || b.status === filterStatus;
    const matchType = !filterType || b.type === filterType;
    return matchSearch && matchStatus && matchType;
  }), [bookings, search, filterStatus, filterType]);

  const handleExport = () => {
    exportExcel('預約資料.xlsx', filtered.map(b => [
      b.name, b.phone, b.birthDate, b.zodiac || '', b.bookingDate,
      b.bookingTime === 'evening' ? '晚上' : b.bookingTime,
      b.type, b.status || '', b.notes || '', fmtDate(b.createdAt)
    ]), ['姓名', '電話', '農曆生日', '生肖', '預約日期', '時段', '問事項目', '狀態', '備註', '建立時間']);
  };

  const types = [...new Set(bookings.map(b => b.type))];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="text-xl font-bold text-gray-800">問事管理
          <span className="ml-2 text-sm font-normal text-gray-400">共 {filtered.length} 筆</span>
        </h2>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors">
          <Download className="w-4 h-4" /> 匯出 Excel
        </button>
      </div>

      {/* 搜尋 & 篩選 */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜尋姓名或電話..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red">
          <option value="">全部狀態</option>
          {Object.values(BookingStatus).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red">
          <option value="">全部項目</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p>沒有符合的預約資料</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['信眾資訊', '預約時間 / 項目', '備註', '狀態', '操作'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-temple-red/10 rounded-full flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-temple-red" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{b.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{b.phone}</p>
                          <p className="text-xs text-gray-400">生日：{b.birthDate}{b.zodiac ? `　生肖：${b.zodiac}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-800 flex items-center gap-1.5 mb-1"><Calendar className="w-3.5 h-3.5 text-gray-400" />{b.bookingDate}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-2"><Clock className="w-3.5 h-3.5 text-gray-400" />
                        {b.bookingTime === 'evening' ? '晚上 (19:00-21:00)' : b.bookingTime}
                      </p>
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">{b.type}</span>
                    </td>
                    <td className="px-5 py-4 max-w-[180px]">
                      <p className="text-sm text-gray-700 truncate">{b.notes || <span className="text-gray-300 italic">無備註</span>}</p>
                      <p className="text-xs text-gray-400 mt-1">{fmtDate(b.createdAt)}</p>
                    </td>
                    <td className="px-5 py-4">{statusBadge(b.status)}</td>
                    <td className="px-5 py-4">
                      <select value={b.status || BookingStatus.PENDING}
                        onChange={e => onStatusChange(b.id, e.target.value as BookingStatus)}
                        disabled={updatingId === b.id}
                        className="block w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red disabled:opacity-50">
                        {Object.values(BookingStatus).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Donations Tab ────────────────────────────────────────────────────────────

const DonationsTab = ({ donations }: { donations: DonationRecord[] }) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');

  const filtered = useMemo(() => donations.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || d.name.toLowerCase().includes(q) || d.phone.includes(q);
    const matchType = !filterType || d.type === filterType;
    return matchSearch && matchType;
  }), [donations, search, filterType]);

  const total = filtered.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const types = [...new Set(donations.map(d => d.type))];

  const handleExport = () => {
    exportExcel('捐款資料.xlsx', filtered.map(d => [
      d.name, d.phone, Number(d.amount), d.type, d.notes || '', fmtDate(d.createdAt)
    ]), ['姓名', '電話', '金額', '捐款類型', '備註', '建立時間']);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-800">捐款管理
            <span className="ml-2 text-sm font-normal text-gray-400">共 {filtered.length} 筆</span>
          </h2>
          <p className="text-sm text-green-600 font-semibold mt-1">
            篩選合計：NT$ {total.toLocaleString()}
          </p>
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors">
          <Download className="w-4 h-4" /> 匯出 Excel
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜尋姓名或電話..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red">
          <option value="">全部類型</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <HeartHandshake className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p>尚無捐款紀錄</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['信眾資訊', '捐款金額', '類型', '備註', '時間'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                          <HeartHandshake className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{d.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{d.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-base font-bold text-green-700">NT$ {Number(d.amount).toLocaleString()}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800">{d.type}</span>
                    </td>
                    <td className="px-5 py-4 max-w-[180px]">
                      <p className="text-sm text-gray-700 truncate">{d.notes || <span className="text-gray-300 italic">無備註</span>}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-xs text-gray-500">{fmtDate(d.createdAt)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Members Tab ─────────────────────────────────────────────────────────────

const MembersTab = ({ bookings, donations }: { bookings: BookingRecord[]; donations: DonationRecord[] }) => {
  const [search, setSearch] = useState('');
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

  // 依電話聚合成「虛擬會員」
  const members = useMemo(() => {
    const map = new Map<string, { phone: string; name: string; bookings: BookingRecord[]; donations: DonationRecord[] }>();

    [...bookings].sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)).forEach(b => {
      if (!map.has(b.phone)) map.set(b.phone, { phone: b.phone, name: b.name, bookings: [], donations: [] });
      const m = map.get(b.phone)!;
      m.bookings.push(b);
      m.name = b.name; // 取最新姓名
    });

    [...donations].sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)).forEach(d => {
      if (!map.has(d.phone)) map.set(d.phone, { phone: d.phone, name: d.name, bookings: [], donations: [] });
      const m = map.get(d.phone)!;
      m.donations.push(d);
      if (!m.name) m.name = d.name;
    });

    return Array.from(map.values()).sort((a, b) =>
      (b.bookings.length + b.donations.length) - (a.bookings.length + a.donations.length)
    );
  }, [bookings, donations]);

  const filtered = useMemo(() => {
    if (!search) return members;
    const q = search.toLowerCase();
    return members.filter(m => m.name.toLowerCase().includes(q) || m.phone.includes(q));
  }, [members, search]);

  const selected = useMemo(() =>
    selectedPhone ? members.find(m => m.phone === selectedPhone) ?? null : null,
    [selectedPhone, members]
  );

  // ── 詳細頁 ──
  if (selected) {
    const totalDonation = selected.donations.reduce((s, d) => s + Number(d.amount), 0);
    return (
      <div>
        <button onClick={() => setSelectedPhone(null)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> 返回會員列表
        </button>

        {/* 會員資訊卡 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5 flex flex-wrap items-center gap-4">
          <div className="w-12 h-12 bg-temple-red/10 rounded-full flex items-center justify-center shrink-0">
            <User className="w-6 h-6 text-temple-red" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-800">{selected.name}</h2>
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3" />{selected.phone}
            </p>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-purple-700">{selected.bookings.length}</p>
              <p className="text-xs text-gray-400">問事次數</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">NT$ {totalDonation.toLocaleString()}</p>
              <p className="text-xs text-gray-400">累計捐款</p>
            </div>
          </div>
        </div>

        {/* 問事紀錄 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-temple-red" />
            <h3 className="font-semibold text-gray-700">
              問事紀錄 <span className="text-gray-400 font-normal text-sm">（{selected.bookings.length} 筆）</span>
            </h3>
          </div>
          {selected.bookings.length === 0 ? (
            <p className="p-5 text-gray-400 text-sm">尚無問事紀錄</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-50">
                <thead className="bg-gray-50">
                  <tr>
                    {['姓名', '預約日期', '問事項目', '狀態', '備註'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {selected.bookings.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-sm font-medium text-gray-800">{b.name}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{b.bookingDate}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">{b.type}</span>
                      </td>
                      <td className="px-5 py-3">{statusBadge(b.status)}</td>
                      <td className="px-5 py-3 text-sm text-gray-500 max-w-[160px] truncate">{b.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 捐款紀錄 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-green-600" />
            <h3 className="font-semibold text-gray-700">
              捐款紀錄 <span className="text-gray-400 font-normal text-sm">（{selected.donations.length} 筆）</span>
            </h3>
          </div>
          {selected.donations.length === 0 ? (
            <p className="p-5 text-gray-400 text-sm">尚無捐款紀錄</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-50">
                <thead className="bg-gray-50">
                  <tr>
                    {['姓名', '日期', '金額', '類型', '備註'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {selected.donations.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-sm font-medium text-gray-800">{d.name}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{fmtDate(d.createdAt)}</td>
                      <td className="px-5 py-3 text-sm font-bold text-green-700">NT$ {Number(d.amount).toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800">{d.type}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500 max-w-[160px] truncate">{d.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 列表頁 ──
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="text-xl font-bold text-gray-800">會員管理
          <span className="ml-2 text-sm font-normal text-gray-400">共 {filtered.length} 位</span>
        </h2>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜尋姓名或電話..."
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p>沒有符合的會員</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['信眾', '電話', '問事次數', '累計捐款', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(m => {
                  const totalDonation = m.donations.reduce((s, d) => s + Number(d.amount), 0);
                  return (
                    <tr key={m.phone} onClick={() => setSelectedPhone(m.phone)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-temple-red/10 rounded-full flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-temple-red" />
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">{m.phone}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">
                          <BookOpen className="w-3 h-3" /> {m.bookings.length} 次
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-green-700">
                        {totalDonation > 0 ? `NT$ ${totalDonation.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-5 py-4 text-right text-xs text-temple-red">
                        查看紀錄 →
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Bulletins Tab (公佈欄管理) ────────────────────────────────────────────────

const BulletinsTab = ({ bulletins, onRefresh }: { bulletins: BulletinRecord[]; onRefresh: () => void }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BulletinData>({ title: '', content: '', category: BulletinCategory.GENERAL, isPinned: false, allowRegistration: false });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [viewRegBulletin, setViewRegBulletin] = useState<BulletinRecord | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [regLoading, setRegLoading] = useState(false);

  const filtered = bulletins.filter(b =>
    b.title.includes(search) || b.content.includes(search) || b.category.includes(search)
  );

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: '', content: '', category: BulletinCategory.GENERAL, isPinned: false, allowRegistration: false });
    setShowModal(true);
  };

  const openEdit = (b: BulletinRecord) => {
    setEditingId(b.id);
    setForm({ title: b.title, content: b.content, category: b.category as BulletinCategory, isPinned: b.isPinned, allowRegistration: b.allowRegistration });
    setShowModal(true);
  };

  const openRegistrations = async (b: BulletinRecord) => {
    setViewRegBulletin(b);
    setRegLoading(true);
    try {
      const regs = await getRegistrations(b.id);
      setRegistrations(regs);
    } catch {
      setRegistrations([]);
    } finally {
      setRegLoading(false);
    }
  };

  const handleDeleteReg = async (id: string) => {
    if (!confirm('確定要刪除這筆報名嗎？')) return;
    try {
      await deleteRegistration(id);
      setRegistrations(prev => prev.filter(r => r.id !== id));
    } catch {
      alert('刪除失敗');
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return alert('請填寫標題和內容');
    setSaving(true);
    try {
      if (editingId) {
        await updateBulletin(editingId, form);
      } else {
        await createBulletin(form);
      }
      setShowModal(false);
      onRefresh();
    } catch {
      alert('儲存失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這則公告嗎？')) return;
    setDeletingId(id);
    try {
      await deleteBulletin(id);
      onRefresh();
    } catch {
      alert('刪除失敗');
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePin = async (b: BulletinRecord) => {
    try {
      await updateBulletin(b.id, { isPinned: !b.isPinned });
      onRefresh();
    } catch {
      alert('更新失敗');
    }
  };

  const categoryColor = (cat: string) => {
    if (cat === '活動公告') return 'bg-blue-100 text-blue-700';
    if (cat === '法會通知') return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="搜尋公告..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red" />
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-temple-red text-white rounded-xl text-sm font-medium hover:bg-red-800 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> 新增公告
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3 text-left">標題</th>
              <th className="px-5 py-3 text-left">分類</th>
              <th className="px-5 py-3 text-left">日期</th>
              <th className="px-5 py-3 text-center">置頂</th>
              <th className="px-5 py-3 text-center">報名</th>
              <th className="px-5 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">尚無公告</td></tr>
            ) : filtered.map(b => (
              <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-4 font-medium text-gray-800">{b.title}</td>
                <td className="px-5 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${categoryColor(b.category)}`}>{b.category}</span>
                </td>
                <td className="px-5 py-4 text-gray-500">{fmtDate(b.createdAt)}</td>
                <td className="px-5 py-4 text-center">
                  <button onClick={() => handleTogglePin(b)}
                    className={`p-1.5 rounded-lg transition-colors ${b.isPinned ? 'text-temple-gold hover:bg-yellow-50' : 'text-gray-300 hover:bg-gray-100'}`}>
                    {b.isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                  </button>
                </td>
                <td className="px-5 py-4 text-center">
                  {b.allowRegistration ? (
                    <button onClick={() => openRegistrations(b)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                      <UserPlus className="w-3 h-3" /> 查看報名
                    </button>
                  ) : (
                    <span className="text-gray-300 text-xs">未開放</span>
                  )}
                </td>
                <td className="px-5 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => openEdit(b)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(b.id)} disabled={deletingId === b.id}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Registration Detail Modal */}
      {viewRegBulletin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewRegBulletin(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-temple-red" /> 報名名單
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">{viewRegBulletin.title}</p>
              </div>
              <button onClick={() => setViewRegBulletin(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto px-6 py-4">
              {regLoading ? (
                <div className="text-center py-12 text-gray-400">載入中...</div>
              ) : registrations.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <UserPlus className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>尚無報名</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="text-sm text-gray-500">共 {registrations.length} 筆報名</span>
                    <span className="text-sm text-gray-500">・</span>
                    <span className="text-sm font-medium text-temple-red">
                      合計 {registrations.reduce((s, r) => s + r.numPeople, 0)} 人
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">姓名</th>
                        <th className="px-4 py-2 text-left">電話</th>
                        <th className="px-4 py-2 text-center">人數</th>
                        <th className="px-4 py-2 text-left">備註</th>
                        <th className="px-4 py-2 text-left">報名時間</th>
                        <th className="px-4 py-2 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {registrations.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{r.name}</td>
                          <td className="px-4 py-3 text-gray-600">{r.phone}</td>
                          <td className="px-4 py-3 text-center">{r.numPeople}</td>
                          <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">{r.notes || '—'}</td>
                          <td className="px-4 py-3 text-gray-500">{fmtDate(r.createdAt)}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => handleDeleteReg(r.id)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">{editingId ? '編輯公告' : '新增公告'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">標題</label>
                <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red" placeholder="公告標題" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分類</label>
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value as BulletinCategory})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red">
                  {Object.values(BulletinCategory).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">內容</label>
                <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={6}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red resize-none" placeholder="公告內容..." />
              </div>
              <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.isPinned} onChange={e => setForm({...form, isPinned: e.target.checked})}
                  className="w-4 h-4 text-temple-red rounded border-gray-300 focus:ring-temple-red" />
                <span className="text-sm text-gray-700">置頂公告</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.allowRegistration} onChange={e => setForm({...form, allowRegistration: e.target.checked})}
                  className="w-4 h-4 text-temple-red rounded border-gray-300 focus:ring-temple-red" />
                <span className="text-sm text-gray-700">開放報名</span>
              </label>
            </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">取消</button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2 text-sm bg-temple-red text-white rounded-xl font-medium hover:bg-red-800 transition-colors disabled:opacity-50">
                {saving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Deities Tab (神明管理) ──────────────────────────────────────────────────────

const DeitiesTab = ({ deities, onRefresh }: { deities: DeityRecord[]; onRefresh: () => void }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DeityData>({ name: '', title: '', description: '', imagePath: null, displayOrder: 0 });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', title: '', description: '', imagePath: null, displayOrder: deities.length + 1 });
    setImageFile(null);
    setImagePreview(null);
    setShowModal(true);
  };

  const openEdit = (d: DeityRecord) => {
    setEditingId(d.id);
    setForm({ name: d.name, title: d.title, description: d.description, imagePath: d.imagePath, displayOrder: d.displayOrder });
    setImageFile(null);
    setImagePreview(d.imagePath ? getSiteImagePublicUrl(d.imagePath) : null);
    setShowModal(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { alert('圖片大小不能超過 5MB'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.description.trim()) return;
    setSaving(true);
    try {
      let imagePath = form.imagePath;
      if (imageFile) {
        imagePath = await uploadDeityImage(imageFile);
      }
      const data = { ...form, imagePath };
      if (editingId) {
        await updateDeity(editingId, data);
      } else {
        await createDeity(data);
      }
      setShowModal(false);
      onRefresh();
    } catch {
      alert('儲存失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`確定要刪除「${name}」嗎？`)) return;
    try {
      await deleteDeity(id);
      onRefresh();
    } catch {
      alert('刪除失敗');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">神明管理</h3>
          <p className="text-sm text-gray-500">管理前台「神明介紹」區塊的神明資料。</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-temple-red text-white rounded-xl text-sm font-medium hover:bg-red-800 transition-colors">
          <Plus className="w-4 h-4" /> 新增神明
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left">排序</th>
              <th className="px-6 py-3 text-left">圖片</th>
              <th className="px-6 py-3 text-left">名稱</th>
              <th className="px-6 py-3 text-left">尊稱</th>
              <th className="px-6 py-3 text-left">介紹</th>
              <th className="px-6 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {deities.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-gray-500"><GripVertical className="w-4 h-4 inline mr-1" />{d.displayOrder}</td>
                <td className="px-6 py-4">
                  {d.imagePath ? (
                    <img src={getSiteImagePublicUrl(d.imagePath)} alt={d.name} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center"><Flame className="w-5 h-5 text-gray-300" /></div>
                  )}
                </td>
                <td className="px-6 py-4 font-medium text-gray-800">{d.name}</td>
                <td className="px-6 py-4 text-gray-500">{d.title || '-'}</td>
                <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{d.description}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => openEdit(d)} className="text-blue-600 hover:text-blue-800 mr-3"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(d.id, d.name)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {deities.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">尚無神明資料</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !saving && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h4 className="font-semibold text-gray-800">{editingId ? '編輯神明' : '新增神明'}</h4>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名稱 *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" placeholder="例如：天上聖母" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">尊稱</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" placeholder="例如：媽祖" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">介紹 *</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none resize-none" placeholder="神明介紹文字..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">圖片</label>
                {imagePreview ? (
                  <div className="relative mb-2">
                    <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-xl" />
                    <button onClick={() => { setImageFile(null); setImagePreview(null); setForm({ ...form, imagePath: null }); }}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-32 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-temple-red/40 transition-colors">
                    <Upload className="w-6 h-6 text-gray-300 mb-1" />
                    <span className="text-sm text-gray-500">點擊上傳圖片</span>
                    <span className="text-xs text-gray-400 mt-1">建議尺寸：600 × 800 px（直式）</span>
                    <span className="text-xs text-gray-300">JPG、PNG、WebP，最大 5MB</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                  </label>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">排序（數字越小越前面）</label>
                <input type="number" value={form.displayOrder} onChange={e => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })}
                  className="w-24 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} disabled={saving} className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">取消</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.description.trim()}
                className="px-6 py-2.5 bg-temple-red text-white rounded-xl text-sm font-medium hover:bg-red-800 transition-colors disabled:opacity-50">
                {saving ? '儲存中...' : (editingId ? '更新' : '新增')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Photos Tab (照片管理) ──────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, { label: string; description: string }> = {
  hero: { label: '首頁背景圖', description: '網站首頁的全螢幕背景圖片（建議尺寸：1920x1080 以上）' },
  about: { label: '關於我們照片', description: '「關於和聖壇」區塊的介紹照片（建議尺寸：800x600 以上）' },
};

const DEFAULT_IMAGES: Record<string, string> = {
  hero: 'https://images.unsplash.com/photo-1542045938-4e8c18731c39?q=80&w=2070&auto=format&fit=crop',
  about: '/picture/Introduction 1.jpg',
};

const HeroSlidesSection = ({ slides, onRefresh }: { slides: HeroSlideRecord[]; onRefresh: () => void }) => {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setUploadError('請選擇圖片檔案'); return; }
    if (file.size > 5 * 1024 * 1024) { setUploadError('圖片大小不能超過 5MB'); return; }
    setUploadError(null);
    setUploading(true);
    try {
      await uploadHeroSlide(file);
      onRefresh();
    } catch {
      setUploadError('上傳失敗，請稍後再試');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (slide: HeroSlideRecord) => {
    if (!confirm(`確定要刪除這張投影片嗎？`)) return;
    setDeleting(slide.id);
    try {
      await deleteHeroSlide(slide.id, slide.imagePath);
      onRefresh();
    } catch {
      alert('刪除失敗，請稍後再試');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-gray-800">首頁輪播圖</h4>
          <p className="text-xs text-gray-400 mt-0.5">自動每 5 秒切換，至少上傳 2 張才會開始輪播</p>
          <p className="text-xs text-gray-400">建議尺寸：1920 × 1080 px（橫式 16:9）・JPG、PNG、WebP，最大 5MB</p>
        </div>
        <label className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors ${uploading ? 'bg-gray-100 text-gray-400' : 'bg-temple-red text-white hover:bg-red-800'}`}>
          {uploading ? <><RefreshCw className="w-4 h-4 animate-spin" /> 上傳中...</> : <><Upload className="w-4 h-4" /> 新增投影片</>}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      <div className="p-6">
        {uploadError && (
          <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {uploadError}
          </div>
        )}
        {slides.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">尚未上傳投影片</p>
            <p className="text-xs mt-1">上傳後會自動顯示在首頁</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {slides.map((slide, i) => (
              <div key={slide.id} className="relative group rounded-xl overflow-hidden aspect-video bg-gray-100">
                <img
                  src={getSiteImagePublicUrl(slide.imagePath)}
                  alt={`投影片 ${i + 1}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                  #{i + 1}
                </div>
                <button
                  onClick={() => handleDelete(slide)}
                  disabled={deleting === slide.id}
                  className="absolute top-1 right-1 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting === slide.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const PhotosTab = ({ siteImages, heroSlides, onRefresh }: { siteImages: SiteImageRecord[]; heroSlides: HeroSlideRecord[]; onRefresh: () => void }) => {
  const [uploading, setUploading] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ section: string; file: File; url: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const getCurrentUrl = (section: string): string | null => {
    const img = siteImages.find(i => i.sectionKey === section);
    if (!img) return null;
    return getSiteImagePublicUrl(img.storagePath);
  };

  const getImageRecord = (section: string) => siteImages.find(i => i.sectionKey === section);

  const handleFileSelect = (section: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('請選擇圖片檔案（JPG、PNG、WebP 等）');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('圖片大小不能超過 5MB');
      return;
    }
    setUploadError(null);
    setPreview({ section, file, url: URL.createObjectURL(file) });
  };

  const handleUpload = async () => {
    if (!preview) return;
    setUploading(preview.section);
    setUploadError(null);
    try {
      await uploadSiteImage(preview.section as SiteImageSection, preview.file);
      URL.revokeObjectURL(preview.url);
      setPreview(null);
      onRefresh();
    } catch {
      setUploadError('上傳失敗，請稍後再試');
    } finally {
      setUploading(null);
    }
  };

  const handleCancelPreview = () => {
    if (preview) {
      URL.revokeObjectURL(preview.url);
      setPreview(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-1">網站照片管理</h3>
        <p className="text-sm text-gray-500">管理網站各區塊的展示照片，上傳後前台會自動更新。</p>
      </div>

      <HeroSlidesSection slides={heroSlides} onRefresh={onRefresh} />

      {uploadError && (
        <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {uploadError}
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(SECTION_LABELS).map(([section, { label, description }]) => {
          const currentUrl = getCurrentUrl(section);
          const displayUrl = currentUrl || DEFAULT_IMAGES[section];
          const imageRecord = getImageRecord(section);
          const isUploading = uploading === section;

          return (
            <div key={section} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h4 className="font-semibold text-gray-800">{label}</h4>
                <p className="text-xs text-gray-400 mt-0.5">{description}</p>
              </div>
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* 目前圖片 */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">目前圖片</p>
                    <div className="relative aspect-video bg-gray-100 rounded-xl overflow-hidden">
                      <img src={displayUrl} alt={label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      {!currentUrl && (
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">預設圖片</div>
                      )}
                    </div>
                    {imageRecord && (
                      <p className="text-xs text-gray-400 mt-2">
                        最後更新：{fmtDate(imageRecord.updatedAt)}
                        {imageRecord.originalFilename && ` (${imageRecord.originalFilename})`}
                      </p>
                    )}
                  </div>

                  {/* 上傳區域 */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">上傳新圖片</p>
                    {preview && preview.section === section ? (
                      <div>
                        <div className="relative aspect-video bg-gray-100 rounded-xl overflow-hidden mb-3">
                          <img src={preview.url} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute top-2 right-2 px-2 py-1 bg-temple-gold text-white text-xs rounded font-medium">預覽</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleUpload} disabled={isUploading}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-temple-red text-white rounded-xl text-sm font-medium hover:bg-red-800 transition-colors disabled:opacity-50">
                            {isUploading ? (<><RefreshCw className="w-4 h-4 animate-spin" /> 上傳中...</>) : (<><Upload className="w-4 h-4" /> 確認上傳</>)}
                          </button>
                          <button onClick={handleCancelPreview} disabled={isUploading}
                            className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50">
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-temple-red/40 hover:bg-red-50/30 transition-colors">
                        <Upload className="w-8 h-8 text-gray-300 mb-2" />
                        <span className="text-sm text-gray-500">點擊選擇圖片</span>
                        <span className="text-xs text-gray-400 mt-1">JPG、PNG、WebP（最大 5MB）</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(section, e)} />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Scripture Tab (聖母經管理) ─────────────────────────────────────────────

const SCRIPTURE_STORAGE_BASE = `https://keosbjepuvqqqhzyuplb.supabase.co/storage/v1/object/public/site-images`;

const ScriptureTab = ({ verses, onRefresh }: { verses: ScriptureVerseRecord[]; onRefresh: () => void }) => {
  const [search, setSearch] = useState('');
  const [editingVerse, setEditingVerse] = useState<ScriptureVerseRecord | null>(null);
  const [formVerse, setFormVerse] = useState('');
  const [formAnnotation, setFormAnnotation] = useState('');
  const [saving, setSaving] = useState(false);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const imgInputRef = React.useRef<HTMLInputElement>(null);
  const annotationRef = React.useRef<HTMLTextAreaElement>(null);

  // 在游標所在行首插入「• 」清單符號
  const insertBullet = () => {
    const el = annotationRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const val = el.value;
    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    const newVal = val.slice(0, lineStart) + '• ' + val.slice(lineStart);
    setFormAnnotation(newVal);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + 2, start + 2);
    });
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return verses;
    const q = search.trim().toLowerCase();
    return verses.filter(v =>
      String(v.sectionNumber).includes(q) ||
      v.verse.toLowerCase().includes(q) ||
      v.annotation.toLowerCase().includes(q)
    );
  }, [verses, search]);

  const openEdit = (v: ScriptureVerseRecord) => {
    setEditingVerse(v);
    setFormVerse(v.verse);
    setFormAnnotation(v.annotation);
    setNewImageFile(null);
    setPreviewUrl(null);
  };

  const closeEdit = () => {
    setEditingVerse(null);
    setNewImageFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('請選擇圖片檔案'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('檔案不可超過 5MB'); return; }
    setNewImageFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!editingVerse) return;
    setSaving(true);
    try {
      let newImagePath = editingVerse.imagePath;

      // Upload new image if selected
      if (newImageFile) {
        const uploadedPath = await uploadScriptureImage(newImageFile);
        // Delete old image if it exists and is different
        if (editingVerse.imagePath && editingVerse.imagePath !== uploadedPath) {
          try { await deleteScriptureImage(editingVerse.imagePath); } catch { /* ignore */ }
        }
        newImagePath = uploadedPath;
      }

      await updateScriptureVerse(editingVerse.id, {
        verse: formVerse,
        annotation: formAnnotation,
        imagePath: newImagePath,
      });

      closeEdit();
      onRefresh();
    } catch (err) {
      alert('儲存失敗：' + (err instanceof Error ? err.message : '未知錯誤'));
    } finally {
      setSaving(false);
    }
  };

  const getImageUrl = (imagePath: string | null) => {
    if (!imagePath) return null;
    return `${SCRIPTURE_STORAGE_BASE}/${imagePath}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">聖母經內容管理</h3>
          <p className="text-sm text-gray-500 mt-1">共 {verses.length} 節・可編輯經文、註解及插圖</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="搜尋節號或關鍵字..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium w-20">插圖</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">經文</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">註解</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium w-20">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(v => (
                <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    {v.imagePath ? (
                      <img
                        src={getImageUrl(v.imagePath)!}
                        alt={`第${v.sectionNumber}節`}
                        className="w-12 h-12 object-cover rounded"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                    <p className="truncate">{v.verse.replace(/\n/g, ' ')}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-[300px]">
                    <p className="truncate">{v.annotation.substring(0, 50)}...</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => openEdit(v)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-temple-red hover:bg-red-50 transition-colors"
                      title="編輯"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">找不到符合的內容</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingVerse && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeEdit}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">編輯插圖與內容</h3>
              <button onClick={closeEdit} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">插圖</label>
                <div className="flex items-start gap-4">
                  <div className="w-32 h-32 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center">
                    {(previewUrl || getImageUrl(editingVerse.imagePath)) ? (
                      <img
                        src={previewUrl || getImageUrl(editingVerse.imagePath)!}
                        alt="插圖預覽"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => imgInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <Upload className="w-4 h-4" /> 更換插圖
                    </button>
                    <input
                      ref={imgInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <p className="text-xs text-gray-400">建議尺寸：600 × 800 px（直式）</p>
                    <p className="text-xs text-gray-400">JPG、PNG、WebP，最大 5MB</p>
                    {newImageFile && (
                      <p className="text-xs text-green-600">已選擇：{newImageFile.name}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Verse */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">經文（每行十個字，換行請按 Enter）</label>
                <textarea
                  value={formVerse}
                  onChange={e => setFormVerse(e.target.value)}
                  rows={8}
                  className="px-3 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none resize-none"
                  style={{ fontFamily: '"Noto Serif TC", "思源宋體", serif', fontSize: '16px', letterSpacing: '0.1em', width: '12em' }}
                  placeholder="每行十個字..."
                />
              </div>

              {/* Annotation */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">註解</label>
                  <button
                    type="button"
                    onClick={insertBullet}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-600 rounded border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                    title="在游標處插入清單項目"
                  >
                    <List className="w-3.5 h-3.5" />
                    插入清單
                  </button>
                </div>
                <textarea
                  ref={annotationRef}
                  value={formAnnotation}
                  onChange={e => setFormAnnotation(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none resize-vertical"
                  placeholder="經文的詳細註解..."
                />
                <p className="text-xs text-gray-400 mt-1">以「• 」開頭的行，前台會顯示為清單項目</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeEdit} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm text-white bg-temple-red rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Lamps Tab (點燈服務管理) ─────────────────────────────────────────────────

const LampsTab = ({
  configs, registrations, onRefresh,
}: {
  configs: LampServiceConfig[];
  registrations: LampRegistrationRecord[];
  onRefresh: () => void;
}) => {
  const [view, setView] = useState<'configs' | 'registrations'>('configs');

  // ── Service config state ──
  const [editingConfig, setEditingConfig] = useState<LampServiceConfig | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState<LampServiceConfigData>({ name: '', fee: 0, description: '', isActive: true, displayOrder: 0 });
  const [savingConfig, setSavingConfig] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Registration state ──
  const [regSearch, setRegSearch] = useState('');
  const [regServiceFilter, setRegServiceFilter] = useState('');
  const [regStatusFilter, setRegStatusFilter] = useState('');
  const [updatingRegId, setUpdatingRegId] = useState<string | null>(null);

  // ── Config helpers ──
  const openAddConfig = () => {
    setEditingConfig(null);
    setConfigForm({ name: '', fee: 0, description: '', isActive: true, displayOrder: configs.length });
    setShowConfigModal(true);
  };

  const openEditConfig = (c: LampServiceConfig) => {
    setEditingConfig(c);
    setConfigForm({ name: c.name, fee: c.fee, description: c.description, isActive: c.isActive, displayOrder: c.displayOrder });
    setShowConfigModal(true);
  };

  const handleSaveConfig = async () => {
    if (!configForm.name.trim()) { alert('請輸入服務名稱'); return; }
    setSavingConfig(true);
    try {
      if (editingConfig) {
        await updateLampServiceConfig(editingConfig.id, configForm);
      } else {
        await createLampServiceConfig(configForm);
      }
      setShowConfigModal(false);
      onRefresh();
    } catch (err) {
      alert('儲存失敗：' + (err instanceof Error ? err.message : '未知錯誤'));
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('確定刪除此服務項目？相關報名紀錄可能受影響。')) return;
    setDeletingId(id);
    try {
      await deleteLampServiceConfig(id);
      onRefresh();
    } catch (err) {
      alert('刪除失敗：' + (err instanceof Error ? err.message : '未知錯誤'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (c: LampServiceConfig) => {
    try {
      await updateLampServiceConfig(c.id, { isActive: !c.isActive });
      onRefresh();
    } catch {
      alert('更新失敗');
    }
  };

  // ── Registration helpers ──
  const filteredRegs = useMemo(() => {
    return registrations.filter(r => {
      const matchSearch = !regSearch.trim() ||
        r.name.toLowerCase().includes(regSearch.toLowerCase()) ||
        r.phone.includes(regSearch);
      const matchService = !regServiceFilter || r.serviceId === regServiceFilter;
      const matchStatus = !regStatusFilter || r.status === regStatusFilter;
      return matchSearch && matchService && matchStatus;
    });
  }, [registrations, regSearch, regServiceFilter, regStatusFilter]);

  const getServiceName = (serviceId: string) =>
    configs.find(c => c.id === serviceId)?.name || serviceId;

  const handleRegStatusChange = async (id: string, status: LampRegistrationStatus) => {
    setUpdatingRegId(id);
    try {
      await updateLampRegistrationStatus(id, status);
      onRefresh();
    } catch {
      alert('更新狀態失敗');
    } finally {
      setUpdatingRegId(null);
    }
  };

  const handleDeleteReg = async (id: string) => {
    if (!confirm('確定刪除此登記紀錄？')) return;
    try {
      await deleteLampRegistration(id);
      onRefresh();
    } catch {
      alert('刪除失敗');
    }
  };

  const exportRegsExcel = () => {
    exportExcel('點燈登記.xlsx', filteredRegs.map(r => [
      getServiceName(r.serviceId), r.name, r.phone, r.birthDate, r.zodiac || '',
      r.status, r.notes || '', fmtDate(r.createdAt)
    ]), ['服務項目', '姓名', '電話', '農曆生日', '生肖', '狀態', '備註', '建立時間']);
  };

  const lampStatusBadge = (status: LampRegistrationStatus) => {
    const map: Record<string, { bg: string; text: string }> = {
      '待處理': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      '已確認': { bg: 'bg-blue-100',   text: 'text-blue-800' },
      '已完成': { bg: 'bg-green-100',  text: 'text-green-800' },
      '已取消': { bg: 'bg-red-100',    text: 'text-red-800' },
    };
    const cfg = map[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>{status}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header + sub-view toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">點燈服務管理</h3>
          <p className="text-sm text-gray-500 mt-1">
            {view === 'configs' ? `共 ${configs.length} 個服務項目` : `共 ${registrations.length} 筆登記紀錄`}
          </p>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setView('configs')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${view === 'configs' ? 'bg-temple-red text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            服務設定
          </button>
          <button
            onClick={() => setView('registrations')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${view === 'registrations' ? 'bg-temple-red text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            登記紀錄
          </button>
        </div>
      </div>

      {/* ── Service Configs View ── */}
      {view === 'configs' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={openAddConfig}
              className="flex items-center gap-2 px-4 py-2 bg-temple-red text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> 新增服務
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium w-20">啟用</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">服務名稱</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium w-32">費用</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">說明</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {configs.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(c)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${c.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${c.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                    <td className="px-4 py-3 text-temple-red font-semibold">NT$ {c.fee.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs">
                      <p className="truncate">{c.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditConfig(c)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-temple-red hover:bg-red-50 transition-colors"
                          title="編輯"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteConfig(c.id)}
                          disabled={deletingId === c.id}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="刪除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {configs.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-400">尚無服務項目，請點「新增服務」建立</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Registrations View ── */}
      {view === 'registrations' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜尋姓名或電話..."
                value={regSearch}
                onChange={e => setRegSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
              />
            </div>
            <select
              value={regServiceFilter}
              onChange={e => setRegServiceFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-temple-red/20"
            >
              <option value="">所有服務</option>
              {configs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={regStatusFilter}
              onChange={e => setRegStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-temple-red/20"
            >
              <option value="">所有狀態</option>
              {Object.values(LampRegistrationStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={exportRegsExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" /> 匯出 Excel
            </button>
          </div>

          {/* Cards */}
          <div className="space-y-3">
            {filteredRegs.map(r => (
              <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-orange-50 shrink-0">
                  <Flame className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-800">{r.name}</p>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                      {getServiceName(r.serviceId)}
                    </span>
                    {lampStatusBadge(r.status)}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    <Phone className="w-3 h-3 inline mr-1" />{r.phone}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    生日：{r.birthDate}{r.zodiac ? `　生肖：${r.zodiac}` : ''}
                  </p>
                  {r.notes && <p className="text-xs text-gray-400 mt-0.5">備註：{r.notes}</p>}
                  <p className="text-xs text-gray-300 mt-1">{fmtDate(r.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={r.status}
                    disabled={updatingRegId === r.id}
                    onChange={e => handleRegStatusChange(r.id, e.target.value as LampRegistrationStatus)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-temple-red/20 disabled:opacity-50"
                  >
                    {Object.values(LampRegistrationStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button
                    onClick={() => handleDeleteReg(r.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="刪除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {filteredRegs.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <Flame className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>尚無符合的登記紀錄</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Config Modal ── */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowConfigModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">{editingConfig ? '編輯服務項目' : '新增服務項目'}</h3>
              <button onClick={() => setShowConfigModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">服務名稱 *</label>
                <input
                  type="text"
                  value={configForm.name}
                  onChange={e => setConfigForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="例：光明燈"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">費用（元）*</label>
                <input
                  type="number"
                  min={0}
                  value={configForm.fee}
                  onChange={e => setConfigForm(p => ({ ...p, fee: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">說明文字</label>
                <textarea
                  rows={3}
                  value={configForm.description}
                  onChange={e => setConfigForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="服務說明..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none resize-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">排序</label>
                  <input
                    type="number"
                    min={0}
                    value={configForm.displayOrder}
                    onChange={e => setConfigForm(p => ({ ...p, displayOrder: Number(e.target.value) }))}
                    className="mt-1 w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 outline-none"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">啟用</label>
                  <button
                    type="button"
                    onClick={() => setConfigForm(p => ({ ...p, isActive: !p.isActive }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${configForm.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${configForm.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowConfigModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="flex items-center gap-2 px-5 py-2 bg-temple-red text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingConfig ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main AdminDashboard ──────────────────────────────────────────────────────

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [bulletins, setBulletins] = useState<BulletinRecord[]>([]);
  const [siteImages, setSiteImages] = useState<SiteImageRecord[]>([]);
  const [deitiesList, setDeitiesList] = useState<DeityRecord[]>([]);
  const [heroSlidesList, setHeroSlidesList] = useState<HeroSlideRecord[]>([]);
  const [scriptureVerses, setScriptureVerses] = useState<ScriptureVerseRecord[]>([]);
  const [lampConfigs, setLampConfigs] = useState<LampServiceConfig[]>([]);
  const [lampRegistrations, setLampRegistrations] = useState<LampRegistrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, d, bl, si, dt, hs, sv, lc, lr] = await Promise.all([getBookings(), getDonations(), getBulletins(), getSiteImages(), getDeities(), getHeroSlides(), getScriptureVerses(), getLampServiceConfigs().catch(() => [] as LampServiceConfig[]), getLampRegistrations().catch(() => [] as LampRegistrationRecord[])]);
      setBookings(b);
      setDonations(d);
      setBulletins(bl);
      setSiteImages(si);
      setDeitiesList(dt);
      setHeroSlidesList(hs);
      setScriptureVerses(sv);
      setLampConfigs(lc);
      setLampRegistrations(lr);
    } catch {
      setError('無法載入資料，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleStatusChange = async (id: string, status: BookingStatus) => {
    setUpdatingId(id);
    try {
      await updateBookingStatus(id, status);
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    } catch {
      alert('更新狀態失敗');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onBack();
  };

  const navItems: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview',  label: '總覽',     icon: <LayoutDashboard className="w-4 h-4" /> },
    { key: 'bookings',  label: '問事管理',  icon: <BookOpen className="w-4 h-4" /> },
    { key: 'donations', label: '捐款管理',  icon: <HeartHandshake className="w-4 h-4" /> },
    { key: 'members',   label: '會員管理',  icon: <Users className="w-4 h-4" /> },
    { key: 'bulletins', label: '公佈欄管理', icon: <Megaphone className="w-4 h-4" /> },
    { key: 'deities',   label: '神明管理',  icon: <Flame className="w-4 h-4" /> },
    { key: 'photos',    label: '照片管理',  icon: <ImageIcon className="w-4 h-4" /> },
    { key: 'scripture', label: '聖母經',    icon: <BookOpenCheck className="w-4 h-4" /> },
    { key: 'lamps',     label: '點燈',      icon: <Flame className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-56 bg-temple-dark text-white flex flex-col shrink-0">
        <div className="px-5 py-6 border-b border-white/10">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">和聖壇</p>
          <h1 className="text-lg font-bold font-serif">後台管理</h1>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                tab === key ? 'bg-temple-red text-white' : 'text-gray-300 hover:bg-white/10'
              }`}>
              {icon} {label}
            </button>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <button onClick={onBack}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-4 h-4" /> 返回前台
          </button>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-red-500/20 hover:text-red-300 transition-colors">
            <LogOut className="w-4 h-4" /> 登出
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <h2 className="font-semibold text-gray-700">
            {navItems.find(n => n.key === tab)?.label}
          </h2>
          <button onClick={fetchAll} disabled={loading}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 重新整理
          </button>
        </div>

        <div className="px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" /> 載入中...
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-20">
              <p>{error}</p>
              <button onClick={fetchAll} className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg">重試</button>
            </div>
          ) : (
            <>
              {tab === 'overview'  && <OverviewTab bookings={bookings} donations={donations} />}
              {tab === 'bookings'  && <BookingsTab bookings={bookings} onStatusChange={handleStatusChange} updatingId={updatingId} />}
              {tab === 'donations' && <DonationsTab donations={donations} />}
              {tab === 'members'   && <MembersTab bookings={bookings} donations={donations} />}
              {tab === 'bulletins' && <BulletinsTab bulletins={bulletins} onRefresh={fetchAll} />}
              {tab === 'deities'  && <DeitiesTab deities={deitiesList} onRefresh={fetchAll} />}
              {tab === 'photos'   && <PhotosTab siteImages={siteImages} heroSlides={heroSlidesList} onRefresh={fetchAll} />}
              {tab === 'scripture' && <ScriptureTab verses={scriptureVerses} onRefresh={fetchAll} />}
              {tab === 'lamps'     && <LampsTab configs={lampConfigs} registrations={lampRegistrations} onRefresh={fetchAll} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
