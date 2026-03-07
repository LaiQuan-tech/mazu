import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { getBookings, updateBookingStatus, getDonations, getBulletins, createBulletin, updateBulletin, deleteBulletin, supabase } from '../services/supabase';
import { BookingRecord, BookingStatus, BulletinCategory, BulletinData, BulletinRecord, DonationRecord } from '../types';
import {
  ArrowLeft, RefreshCw, Calendar, Clock, User, Phone,
  FileText, CheckCircle, XCircle, Clock3, LayoutDashboard,
  BookOpen, HeartHandshake, Search, Download, ChevronDown,
  TrendingUp, Users, Banknote, AlertCircle, LogOut,
  Megaphone, Plus, Edit2, Trash2, Pin, PinOff, X
} from 'lucide-react';

type Tab = 'overview' | 'bookings' | 'donations' | 'members' | 'bulletins';

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
      b.name, b.phone, b.birthDate, b.bookingDate,
      b.bookingTime === 'evening' ? '晚上' : b.bookingTime,
      b.type, b.status || '', b.notes || '', fmtDate(b.createdAt)
    ]), ['姓名', '電話', '農曆生日', '預約日期', '時段', '諮詢項目', '狀態', '備註', '建立時間']);
  };

  const types = [...new Set(bookings.map(b => b.type))];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="text-xl font-bold text-gray-800">預約管理
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
                          <p className="text-xs text-gray-400">生日：{b.birthDate}</p>
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
                    {['姓名', '預約日期', '諮詢項目', '狀態', '備註'].map(h => (
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
  const [form, setForm] = useState<BulletinData>({ title: '', content: '', category: BulletinCategory.GENERAL, isPinned: false });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = bulletins.filter(b =>
    b.title.includes(search) || b.content.includes(search) || b.category.includes(search)
  );

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: '', content: '', category: BulletinCategory.GENERAL, isPinned: false });
    setShowModal(true);
  };

  const openEdit = (b: BulletinRecord) => {
    setEditingId(b.id);
    setForm({ title: b.title, content: b.content, category: b.category as BulletinCategory, isPinned: b.isPinned });
    setShowModal(true);
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
              <th className="px-5 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">尚無公告</td></tr>
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
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.isPinned} onChange={e => setForm({...form, isPinned: e.target.checked})}
                  className="w-4 h-4 text-temple-red rounded border-gray-300 focus:ring-temple-red" />
                <span className="text-sm text-gray-700">置頂公告</span>
              </label>
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

// ─── Main AdminDashboard ──────────────────────────────────────────────────────

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [bulletins, setBulletins] = useState<BulletinRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, d, bl] = await Promise.all([getBookings(), getDonations(), getBulletins()]);
      setBookings(b);
      setDonations(d);
      setBulletins(bl);
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
    { key: 'bookings',  label: '預約管理',  icon: <BookOpen className="w-4 h-4" /> },
    { key: 'donations', label: '捐款管理',  icon: <HeartHandshake className="w-4 h-4" /> },
    { key: 'members',   label: '會員管理',  icon: <Users className="w-4 h-4" /> },
    { key: 'bulletins', label: '公佈欄管理', icon: <Megaphone className="w-4 h-4" /> },
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
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
