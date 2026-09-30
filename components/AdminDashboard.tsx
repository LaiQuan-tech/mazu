import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { isValidGa4, isValidGtm, isValidPixel } from './Analytics';
import { getBookings, updateBookingStatus, updateBookingDivineMessage, getDonations, getBulletins, createBulletin, updateBulletin, deleteBulletin, getRegistrations, deleteRegistration, uploadBulletinImage, getAnalyticsSettings, saveAnalyticsSettings, getSocialSettings, saveSocialSettings, getDevoteeOverrides, saveDevoteeOverride, deleteDevoteeOverride, getSiteImages, uploadSiteImage, getSiteImagePublicUrl, getDeities, createDeity, updateDeity, deleteDeity, uploadDeityImage, getDeityHalls, createDeityHall, updateDeityHall, deleteDeityHall, getHeroSlides, uploadHeroSlide, deleteHeroSlide, getScriptureVerses, updateScriptureVerse, uploadScriptureImage, deleteScriptureImage, getLampServiceConfigs, createLampServiceConfig, updateLampServiceConfig, deleteLampServiceConfig, getLampRegistrations, updateLampRegistrationStatus, deleteLampRegistration, getAllMemberProfiles, getMemberContactsByUserId, getMemberContacts, getUsersLastLogin, getBlessingEvents, createBlessingEvent, updateBlessingEvent, deleteBlessingEvent, getBlessingRegistrations, updateBlessingRegistrationStatus, deleteBlessingRegistration, uploadBlessingImage, uploadLampImage, getRepairProjects, getRepairProjectTotals, createRepairProject, updateRepairProject, deleteRepairProject, uploadRepairProjectImage, getLineClickStats, getBookingSessions, createBookingSession, updateBookingSession, deleteBookingSession, getBookingCountsBySession, getFahuiRegistrations, updateFahuiStatus, updateFahuiReconcile, updateFahuiEntries, updateFahuiContact, deleteFahuiRegistration, getVolunteerRegistrations, updateVolunteerStatus, deleteVolunteerRegistration, getAllMemberContactsAdmin, supabase } from '../services/supabase';
import AdminAboutTab from './AdminAboutTab';
import AdminRelocationTab from './AdminRelocationTab';
import AdminFaqTab from './AdminFaqTab';
import AdminVouchersTab from './AdminVouchersTab';
import AdminFeastsTab from './AdminFeastsTab';
import AdminDonationTypesTab from './AdminDonationTypesTab';
import AdminSiteInfoTab from './AdminSiteInfoTab';
import { FAHUI_SERVICE_META, fahuiEntryAmount } from '../services/fahuiServices';
import { buildFahuiSheets } from '../services/fahuiWorkbook';
import { buildDevoteeRoster, toNameKey, toBirthKey, DevoteeOverride, DevoteeRecord, DevoteeRow, RosterSources } from '../services/devoteeRoster';
import { AdminRole, ADMIN_ROLE_LABEL, ROLE_ALLOWED_TABS, AnalyticsSettings, SocialSettings, SOCIAL_KEYS, BlessingAddon, BlessingEventData, BlessingEventPackage, BlessingEventRecord, BlessingRegistrationRecord, BlessingStatus, BookingRecord, BookingSessionData, BookingSessionRecord, BookingStatus, BulletinCategory, BulletinData, BulletinRecord, DeityData, DeityRecord, DonationRecord, FahuiRegistrationRecord, FahuiPaymentMethod, FahuiReconcilePatch, FAHUI_PAYMENT_METHODS, VolunteerRegistrationRecord, HallData, HallRecord, HeroSlideRecord, LampRegistrationRecord, LampRegistrationStatus, LampServiceConfig, LampServiceConfigData, MemberContact, MemberProfileRecord, RegistrationRecord, RepairProject, RepairProjectData, ScriptureVerseRecord, SiteImageRecord, SiteImageSection, ZodiacSign } from '../types';
import {
  ArrowLeft, RefreshCw, Calendar, Clock, User, Phone,
  FileText, CheckCircle, XCircle, Clock3, LayoutDashboard,
  BookOpen, HeartHandshake, Search, Download, ChevronDown,
  TrendingUp, Users, Banknote, AlertCircle, LogOut,
  Megaphone, Plus, Edit2, Trash2, Pin, PinOff, X, Menu, UserPlus, ClipboardList, ArrowRight,
  Image as ImageIcon, Upload, Flame, GripVertical, Save, BookOpenCheck, List, BookUser, Settings, Share2,
  ChevronUp, ChevronsUpDown, CalendarClock, Activity, Sparkles, MapPin, Baby,
  Eye, EyeOff, ShoppingBag, Wrench, Receipt
} from 'lucide-react';

type Tab = 'vouchers' | 'traffic' | 'feasts' | 'analytics' | 'social' | 'siteinfo' | 'about' | 'relocation' | 'faq' | 'overview' | 'fahui' | 'volunteer' | 'roster' | 'bookings' | 'donations' | 'repairs' | 'members' | 'bulletins' | 'photos' | 'deities' | 'scripture' | 'lamps' | 'blessings' | 'receivables';

interface AdminDashboardProps {
  onBack: () => void;
  role: AdminRole;
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

const statusBadge = (status?: BookingStatus | LampRegistrationStatus | BlessingStatus | string) => {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    '待處理': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock3 className="w-3 h-3" /> },
    '待確認': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock3 className="w-3 h-3" /> },
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

/** 多分頁匯出：每個分頁自帶表頭列（aoa[0]）與可選的合併儲存格 */
const exportSheetsExcel = (
  filename: string,
  sheets: { name: string; aoa: (string | number | Date)[][]; merges?: { s: { r: number; c: number }; e: { r: number; c: number } }[] }[],
) => {
  const wb = XLSX.utils.book_new();
  sheets.forEach(s => {
    const ws = XLSX.utils.aoa_to_sheet(s.aoa, { cellDates: true });
    const header = s.aoa[0] || [];
    ws['!cols'] = header.map((_, i) => {
      const bodyMax = s.aoa.slice(1).reduce((max, row) => {
        const len = row[i] instanceof Date ? 10 : String(row[i] ?? '').length;
        return len > max ? len : max;
      }, 0);
      return { wch: Math.min(Math.max(String(header[i] ?? '').length * 2, bodyMax) + 2, 40) };
    });
    if (s.merges) ws['!merges'] = s.merges;
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  });
  XLSX.writeFile(wb, filename);
};

// ─── Gender Badge ────────────────────────────────────────────────────────────
const genderBadge = (gender?: string | null) => {
  if (!gender) return null;
  const map: Record<string, { icon: React.ReactNode; bg: string; text: string; label: string }> = {
    '信士':           { icon: <User className="w-3.5 h-3.5" />, bg: 'bg-blue-50',  text: 'text-blue-600',  label: '信士' },
    '信女':           { icon: <User className="w-3.5 h-3.5" />, bg: 'bg-pink-50',  text: 'text-pink-600',  label: '信女' },
    '小兒（16歲以下）':  { icon: <Baby className="w-3.5 h-3.5" />, bg: 'bg-sky-50',  text: 'text-sky-600',   label: '小兒' },
    '小女兒（16歲以下）': { icon: <Baby className="w-3.5 h-3.5" />, bg: 'bg-rose-50', text: 'text-rose-500',  label: '小女兒' },
  };
  const cfg = map[gender];
  if (!cfg) return <span className="inline-flex items-center text-xs text-gray-500">{gender}</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
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

const PAGE_SIZE = 25;

// ─── Paginator ───────────────────────────────────────────────────────────────
const Paginator = ({ total, page, onChange }: { total: number; page: number; onChange: (p: number) => void }) => {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  const start = page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, total);
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-white">
      <span className="text-sm text-gray-500">{start}–{end} / 共 {total} 筆</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(0)} disabled={page === 0}
          className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">«</button>
        <button onClick={() => onChange(page - 1)} disabled={page === 0}
          className="px-3 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">上一頁</button>
        {Array.from({ length: totalPages }, (_, i) => i).filter(i => Math.abs(i - page) <= 2).map(i => (
          <button key={i} onClick={() => onChange(i)}
            className={`px-3 py-1 text-xs rounded border ${i === page ? 'bg-temple-red text-white border-temple-red' : 'border-gray-200 hover:bg-gray-50'}`}>
            {i + 1}
          </button>
        ))}
        <button onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1}
          className="px-3 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">下一頁</button>
        <button onClick={() => onChange(totalPages - 1)} disabled={page >= totalPages - 1}
          className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">»</button>
      </div>
    </div>
  );
};

// ─── Member Info Modal (點選信眾快速查看) ──────────────────────────────────────

interface RegViewItem {
  name: string;
  phone: string;
  birthDate?: string;
  zodiac?: string;
  gender?: string;
  address?: string;
  notes?: string;
  status?: string;
  serviceLabel?: string;
  createdAt: string;
  contactLabel?: string;
  /** 報名來源（UTM）。與名冊那個「參與管道」的 source 不是同一件事 */
  source?: string;
}

const MemberInfoModal = ({
  reg,
  memberProfiles,
  onClose,
}: {
  reg: RegViewItem;
  memberProfiles: MemberProfileRecord[];
  onClose: () => void;
}) => {
  const member = reg.phone
    ? memberProfiles.find(m => m.phone === reg.phone)
    : memberProfiles.find(m => m.name === reg.name);

  const initials = (name: string) => name ? name.slice(-2) : '?';

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            信眾資料
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Registration Info */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">登記資訊</p>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              {reg.serviceLabel && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-400 w-14 shrink-0 pt-0.5">服務</span>
                  <span className="text-sm font-medium text-gray-800">{reg.serviceLabel}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-14 shrink-0">姓名</span>
                <span className="text-sm font-semibold text-gray-800">
                  {reg.name}
                  {reg.contactLabel && (
                    <span className="ml-1.5 text-xs bg-temple-gold/20 text-temple-dark px-1.5 py-0.5 rounded-full font-medium">
                      #{reg.contactLabel}
                    </span>
                  )}
                </span>
              </div>
              {reg.gender && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-14 shrink-0">性別</span>
                  <span className="text-sm text-gray-700">{reg.gender}</span>
                </div>
              )}
              {reg.birthDate && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-14 shrink-0">農曆生日</span>
                  <span className="text-sm text-gray-700">
                    {reg.birthDate}{reg.zodiac ? `　生肖：${reg.zodiac}` : ''}
                  </span>
                </div>
              )}
              {reg.address && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-400 w-14 shrink-0 pt-0.5">地址</span>
                  <span className="text-sm text-gray-700">{reg.address}</span>
                </div>
              )}
              {reg.notes && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-400 w-14 shrink-0 pt-0.5">備註</span>
                  <span className="text-sm text-gray-700">{reg.notes}</span>
                </div>
              )}
              {reg.status && (
                <div className="flex items-center gap-2 pt-0.5 border-t border-gray-200 mt-1">
                  <span className="text-xs text-gray-400 w-14 shrink-0">狀態</span>
                  <span className="text-sm font-medium text-gray-700">{reg.status}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-14 shrink-0">登記時間</span>
                <span className="text-xs text-gray-400">{fmtDate(reg.createdAt)}</span>
              </div>
              {reg.source && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-14 shrink-0">報名來源</span>
                  {/* 等寬字：這是機器產生的字串，斜線分段用等寬才看得清楚 */}
                  <span className="text-xs text-gray-400 font-mono">{reg.source}</span>
                </div>
              )}
            </div>
          </div>

          {/* Member Profile */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">會員帳號資料</p>
            {member ? (
              <div className="bg-temple-red/5 border border-temple-red/15 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-temple-red flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {initials(member.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{member.name}</p>
                    {member.phone && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />{member.phone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  {member.birthDate && (
                    <p className="text-xs text-gray-600">
                      農曆生日：{member.birthDate}{member.zodiac ? `　生肖：${member.zodiac}` : ''}
                    </p>
                  )}
                  {member.gender && <p className="text-xs text-gray-600">性別：{member.gender}</p>}
                  {member.address && <p className="text-xs text-gray-600">地址：{member.address}</p>}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-4 text-center">
                {reg.phone ? '此電話尚無對應會員帳號' : '無法連結會員帳號'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── useDragSort (共用拖拉排序 hook) ──────────────────────────────────────────

function useDragSort<T extends { id: string }>(
  items: T[],
  onSaveOrder: (sorted: T[]) => Promise<void>,
) {
  const [localItems, setLocalItems]   = useState<T[]>([]);
  const [draggingId, setDraggingId]   = useState<string | null>(null);
  const [overIndex,  setOverIndex]    = useState<number | null>(null);
  const [isSaving,   setIsSaving]     = useState(false);
  const dragIndexRef                  = React.useRef(-1);

  useEffect(() => { setLocalItems(items); }, [items]);

  const onDragStart = (id: string, idx: number) => {
    setDraggingId(id);
    dragIndexRef.current = idx;
  };
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIndex(idx);
  };
  /** 重排並寫回。拖拉放開與手機的上下鍵都走這一支，不要各寫一份。 */
  const applyOrder = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || toIdx >= localItems.length) return;
    const next = [...localItems];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setLocalItems(next);
    setIsSaving(true);
    try { await onSaveOrder(next); } catch { alert('排序儲存失敗'); }
    finally { setIsSaving(false); }
  };
  const onDrop = async (dropIdx: number) => {
    const fromIdx = dragIndexRef.current;
    setDraggingId(null);
    setOverIndex(null);
    await applyOrder(fromIdx, dropIdx);
  };
  const onDragEnd = () => { setDraggingId(null); setOverIndex(null); };
  /** 觸控裝置不會觸發 HTML5 的 drag 事件，手機上一律用這支搬移。 */
  const move = (idx: number, dir: -1 | 1) => applyOrder(idx, idx + dir);

  return { localItems, draggingId, overIndex, isSaving, onDragStart, onDragOver, onDrop, onDragEnd, move };
}

// ─── Fahui (法會報名) Tab ──────────────────────────────────────────────────────

const fahuiStatusBadge = (status: string) => {
  const cfg = status === 'paid'
    ? { bg: 'bg-green-100', text: 'text-green-800', label: '已收款', icon: <CheckCircle className="w-3 h-3" /> }
    : { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '待匯款', icon: <Clock3 className="w-3 h-3" /> };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${cfg.bg} ${cfg.text}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

/** 生日字串拆成國曆／農曆兩欄。新格式「民國72年6月20日（農曆正月廿六）」→ {國曆, 農曆}；
 *  舊格式（只有農曆）→ 國曆留空、農曆放全部。 */
const splitBirthday = (s?: string): { solar: string; lunar: string } => {
  if (!s) return { solar: '', lunar: '' };
  const m = s.match(/^(.*?)（(.+)）$/);
  if (m) return { solar: m[1], lunar: m[2] };
  return { solar: '', lunar: s };
};

/** 報名日期（本地時區）落在 [from, to] 內；from/to 為 yyyy-mm-dd，可留空 */
const inDateRange = (iso: string, from: string, to: string): boolean => {
  if (!from && !to) return true;
  if (!iso) return true;
  const d = new Date(iso);
  const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (from && ds < from) return false;
  if (to && ds > to) return false;
  return true;
};

/** 報名日期區間篩選器（共用 UI） */
// flex-wrap 是必要的：兩個 date input 加標籤實測要 384px，手機（390px 扣掉頁面
// 左右內距）只有 348px，不換行會整頁橫向溢出。桌機夠寬時不會觸發，版面不變。
// 法會與志工兩個分頁也用這支，一起受惠。
const DateRangeFilter = ({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) => (
  <div className="flex flex-wrap items-center gap-1.5 text-sm">
    <span className="text-gray-400 text-xs shrink-0">報名日期</span>
    <input type="date" value={from} onChange={e => onFrom(e.target.value)}
      className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
    <span className="text-gray-400">～</span>
    <input type="date" value={to} onChange={e => onTo(e.target.value)}
      className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
    {(from || to) && (
      <button onClick={() => { onFrom(''); onTo(''); }} className="text-xs text-gray-400 hover:text-gray-700 underline shrink-0">清除</button>
    )}
  </div>
);

// ─── 信眾名冊 Tab ─────────────────────────────────────────────────────────────

/** 並列比對用的紀錄表：把一個人底下的每一筆原始紀錄攤開，人才判斷得出是不是同一個人 */
const RecordTable = ({ records }: { records: DevoteeRecord[] }) => (
  <div className="overflow-x-auto rounded-lg border border-gray-200">
    <table className="admin-table w-full text-xs">
      <thead className="bg-gray-50 text-gray-500">
        <tr>
          {['日期', '管道', '性別', '生日', '生肖', '電話', '地址', '金額'].map(h => (
            <th key={h} className="px-2.5 py-2 text-left font-medium whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {records.map((rec, i) => (
          <tr key={i} className="hover:bg-gray-50/60">
            <td data-label="日期" className="px-2.5 py-2 text-gray-400 whitespace-nowrap">{rec.at || '—'}</td>
            <td data-label="管道" className="px-2.5 py-2 whitespace-nowrap">
              <span className="px-1.5 py-0.5 rounded-full bg-[#C49820]/10 text-[#7C5C1E]">{rec.source}</span>
            </td>
            <td data-label="性別" className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{rec.gender || '—'}</td>
            <td data-label="生日" className="px-2.5 py-2 text-gray-700 whitespace-nowrap">{rec.birthDate || '—'}</td>
            <td data-label="生肖" className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{rec.zodiac || '—'}</td>
            <td data-label="電話" className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{rec.phone || '—'}</td>
            <td data-label="地址" className="px-2.5 py-2 text-gray-500 max-w-[200px] truncate" title={rec.address}>{rec.address || '—'}</td>
            <td data-label="金額" className="px-2.5 py-2 text-right text-gray-700 whitespace-nowrap">{rec.amount > 0 ? `$${rec.amount.toLocaleString()}` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** 依生日把紀錄分群（沒填生日的另外一群），供拆分時並列比對 */
const groupByBirth = (records: DevoteeRecord[]): { key: string; label: string; records: DevoteeRecord[] }[] => {
  const map = new Map<string, DevoteeRecord[]>();
  const noBirth: DevoteeRecord[] = [];
  records.forEach(r => {
    if (!r.birthKey) { noBirth.push(r); return; }
    const arr = map.get(r.birthKey) ?? [];
    arr.push(r);
    map.set(r.birthKey, arr);
  });
  const out = [...map.entries()].map(([key, recs]) => ({
    key, label: recs.find(r => r.birthDate)?.birthDate ?? key, records: recs,
  }));
  // 紀錄多的排前面，通常是「本尊」
  out.sort((a, b) => b.records.length - a.records.length);
  if (noBirth.length > 0) out.push({ key: '', label: '未填生日', records: noBirth });
  return out;
};

/** 參與總次數（本專案 Object.values 推導會退化成 unknown，改以 key 逐項加總） */
const rosterTotalCount = (counts: Record<string, number>): number =>
  Object.keys(counts).reduce((sum, k) => sum + (counts[k] || 0), 0);

const ROSTER_SOURCES = ['法會報名', '法會陽上', '志工', '會員', '通訊錄', '問事', '捐款', '點燈', '活動報名'];

const RosterTab = ({ sources }: { sources: RosterSources }) => {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [onlyConflicts, setOnlyConflicts] = useState(false);

  // ── 人工校正 ──
  const [overrides, setOverrides] = useState<DevoteeOverride[]>([]);
  const [busy, setBusy] = useState(false);
  /** 合併模式：先選來源列，再點另一列作為併入目標 */
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  /** 檢視／拆分視窗：把該姓名底下的紀錄依生日並列 */
  const [inspect, setInspect] = useState<DevoteeRow | null>(null);
  /** 合併確認視窗：兩人的紀錄並列比對 */
  const [compare, setCompare] = useState<{ from: DevoteeRow; to: DevoteeRow } | null>(null);

  const reloadOverrides = () => { getDevoteeOverrides().then(setOverrides).catch(() => {}); };
  useEffect(reloadOverrides, []);

  const rows = useMemo(() => buildDevoteeRoster(sources, overrides), [sources, overrides]);

  const apply = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); reloadOverrides(); }
    catch { alert('操作失敗。若是第一次使用，請先在 Supabase 執行 devotee_overrides.sql'); }
    finally { setBusy(false); }
  };

  /** 確認這個姓名底下確實是同一個人，不再顯示警示 */
  const confirmSame = (r: DevoteeRow) => apply(() =>
    saveDevoteeOverride({ kind: 'confirm_same', nameKey: toNameKey(r.splitFrom ?? r.name), note: r.conflictHint }));

  /** 送出拆分（主要生日＝沒填生日的紀錄要歸給誰） */
  const doSplit = (r: DevoteeRow, mainKey: string) => apply(async () => {
    await saveDevoteeOverride({
      kind: 'split', nameKey: toNameKey(r.name),
      payload: { main: mainKey },
      note: `${r.name}：${r.conflictHint}`,
    });
    setInspect(null);
  });

  /** 把 from 併進 to（兩個不同姓名視為同一人） */
  const doMerge = (from: DevoteeRow, to: DevoteeRow) => apply(async () => {
    await saveDevoteeOverride({
      kind: 'alias', nameKey: toNameKey(from.name), targetKey: toNameKey(to.name),
      note: `${from.name} → ${to.name}`,
    });
    setMergeFrom(null);
    setCompare(null);
  });

  const removeRule = (o: DevoteeOverride) => {
    if (!o.id) return;
    if (!confirm('撤銷這條校正？名冊會恢復成自動判斷的結果。')) return;
    return apply(() => deleteDevoteeOverride(o.id!));
  };

  const filtered = useMemo(() => rows.filter(r => {
    const matchSearch = !search
      || r.name.includes(search)
      || r.phones.some(p => p.includes(search))
      || r.addresses.some(a => a.includes(search));
    const matchSource = !sourceFilter || (r.counts[sourceFilter] ?? 0) > 0;
    return matchSearch && matchSource && (!onlyConflicts || r.nameConflict);
  }), [rows, search, sourceFilter, onlyConflicts]);

  const stats = useMemo(() => ({
    total: rows.length,
    fahui: rows.filter(r => (r.counts['法會報名'] ?? 0) > 0 || (r.counts['法會陽上'] ?? 0) > 0).length,
    repeat: rows.filter(r => rosterTotalCount(r.counts) > 1).length,
    conflicts: rows.filter(r => r.nameConflict).length,
  }), [rows]);

  const handleExport = () => {
    exportExcel('和聖壇信眾名冊.xlsx', filtered.map(r => [
      r.name,
      r.memberNumbers.join('、'),
      r.genders.join('／'),
      r.phones.join('、'),
      r.addresses.join('；'),
      r.birthDates.join('；'),
      r.zodiacs.join('／'),
      r.lineIds.join('、'),
      ROSTER_SOURCES.filter(s => r.counts[s]).map(s => `${s}${r.counts[s]}`).join('、'),
      rosterTotalCount(r.counts),
      r.totalAmount,
      r.firstSeen,
      r.lastSeen,
      r.relatives.join('、'),
      r.nameConflict ? '是' : '',
      r.conflictHint,
    ]), ['姓名', '會員編號', '性別', '電話', '地址', '生日', '生肖', 'LINE', '參與管道', '參與次數', '累計金額', '首次參與', '最近參與', '可能親屬（同電話）', '疑似同名不同人', '判斷依據']);
  };

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">信眾人數</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">曾參與法會</p>
          <p className="text-2xl font-bold text-[#C49820]">{stats.fahui}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">參與 2 次以上</p>
          <p className="text-2xl font-bold text-green-600">{stats.repeat}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">疑似同名不同人</p>
          <p className="text-2xl font-bold text-temple-red">{stats.conflicts}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-800">信眾資訊
            <span className="ml-2 text-sm font-normal text-gray-400">共 {filtered.length} 人</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            凡報名過任一服務者皆為信眾（法會、志工、問事、點燈、捐款、活動、通訊錄，含註冊會員）。
            以姓名彙整；同電話者僅提示可能親屬，不會合併成同一人。
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button onClick={() => setShowRules(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
              showRules ? 'bg-gray-100 border-gray-300 text-gray-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}>
            已校正 {overrides.length}
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-[#7C5C1E] text-white rounded-lg text-sm hover:bg-[#5C441A] transition-colors">
            <Download className="w-4 h-4" /> 匯出名冊
          </button>
        </div>
      </div>

      {/* 合併模式提示：選好來源後，點另一列即完成併入 */}
      {mergeFrom && (
        <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-center gap-3 flex-wrap">
          <span>正在合併：<strong>{mergeFrom}</strong> → 請點選要併入的那一列（下方「併入此人」）</span>
          <button onClick={() => setMergeFrom(null)} className="ml-auto text-xs underline hover:text-blue-900">取消</button>
        </div>
      )}

      {/* 已套用的校正規則，可逐條撤銷 */}
      {showRules && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-sm font-medium text-gray-700">
            人工校正規則
            <span className="ml-2 text-xs font-normal text-gray-400">校正只改名冊的呈現方式，原始報名資料不會被更動</span>
          </div>
          {overrides.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">尚無校正規則</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {overrides.map(o => (
                <li key={o.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    o.kind === 'alias' ? 'bg-blue-50 text-blue-600'
                    : o.kind === 'split' ? 'bg-amber-50 text-amber-700'
                    : 'bg-green-50 text-green-600'
                  }`}>
                    {o.kind === 'alias' ? '合併' : o.kind === 'split' ? '拆分' : '確認同一人'}
                  </span>
                  <span className="text-gray-700 truncate">{o.note || o.nameKey}</span>
                  <button onClick={() => removeRule(o)} disabled={busy}
                    className="ml-auto text-xs text-red-500 hover:underline shrink-0 disabled:opacity-40">撤銷</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋姓名 / 電話 / 地址"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
        </div>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none">
          <option value="">全部管道</option>
          {ROSTER_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap px-1">
          <input type="checkbox" checked={onlyConflicts} onChange={e => setOnlyConflicts(e.target.checked)}
            className="rounded border-gray-300 text-temple-red focus:ring-temple-red/30" />
          只看疑似同名
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-20">尚無符合條件的信眾</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="admin-table w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-medium">姓名</th>
                <th className="px-4 py-3 text-left font-medium">性別</th>
                <th className="px-4 py-3 text-left font-medium">電話</th>
                <th className="px-4 py-3 text-left font-medium">地址</th>
                <th className="px-4 py-3 text-left font-medium">參與管道</th>
                <th className="px-4 py-3 text-right font-medium">累計金額</th>
                <th className="px-4 py-3 text-left font-medium">最近參與</th>
                <th className="px-4 py-3 text-left font-medium">可能親屬</th>
                <th className="px-4 py-3 text-center font-medium">校正</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr key={r.name} className="hover:bg-gray-50/60">
                  <td data-label="姓名" className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                    {r.name}
                    {/* 有會員編號＝此人同時是註冊會員，可回「會員資訊」看登入紀錄 */}
                    {r.memberNumbers.length > 0 && (
                      <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200"
                        title="此信眾同時是註冊會員">
                        會員 {r.memberNumbers.join('、')}
                      </span>
                    )}
                    {r.nameConflict && (
                      <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200"
                        title={`可能是不同人：${r.conflictHint}`}>
                        疑似同名
                      </span>
                    )}
                  </td>
                  <td data-label="性別" className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.genders.join('／')}</td>
                  <td data-label="電話" className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.phones.join('、') || '—'}</td>
                  <td data-label="地址" className="px-4 py-3 text-gray-500 max-w-[220px] truncate" title={r.addresses.join('；')}>{r.addresses[0] || '—'}</td>
                  <td data-label="參與管道" className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {ROSTER_SOURCES.filter(s => r.counts[s]).map(s => (
                        <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-[#C49820]/10 text-[#7C5C1E] whitespace-nowrap">
                          {s}{r.counts[s] > 1 ? ` ${r.counts[s]}` : ''}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td data-label="累計金額" className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                    {r.totalAmount > 0 ? `$${r.totalAmount.toLocaleString()}` : '—'}
                  </td>
                  <td data-label="最近參與" className="px-4 py-3 text-gray-400 whitespace-nowrap">{r.lastSeen || '—'}</td>
                  <td data-label="可能親屬" className="px-4 py-3 text-gray-500 max-w-[160px] truncate" title={r.relatives.join('、')}>
                    {r.relatives.join('、') || '—'}
                  </td>
                  <td data-label="校正" className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      {mergeFrom ? (
                        mergeFrom === r.name
                          ? <span className="text-xs text-blue-500">來源</span>
                          : <button
                              onClick={() => {
                                const from = rows.find(x => x.name === mergeFrom);
                                if (from) setCompare({ from, to: r });
                              }}
                              disabled={busy}
                              className="text-xs px-2 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-40">
                              比對併入
                            </button>
                      ) : (
                        <>
                          {/* 一律提供「檢視」：不看原始紀錄無從判斷該拆還是該併 */}
                          <button onClick={() => setInspect(r)} disabled={busy} title="查看這個人的每一筆原始紀錄"
                            className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                            檢視 {r.records.length}
                          </button>
                          {/* 拆分產生的列不能當合併來源：它沒有獨立的姓名，併了會把兩半又黏回去 */}
                          {!r.splitFrom && (
                            <button onClick={() => setMergeFrom(r.name)} disabled={busy} title="把這個人併入另一個姓名"
                              className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                              合併
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 檢視／拆分：把紀錄依生日並列，看完再決定是同一人還是要拆開 */}
      {inspect && (() => {
        const groups = groupByBirth(inspect.records);
        const splittable = groups.filter(g => g.key).length >= 2;
        return (
          <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/50" onClick={() => setInspect(null)}>
            <div className="flex min-h-full items-start justify-center p-4">
              <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl my-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div>
                    <h3 className="font-semibold text-gray-800">{inspect.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      共 {inspect.records.length} 筆紀錄
                      {inspect.nameConflict && <span className="text-red-500 ml-2">· {inspect.conflictHint}</span>}
                    </p>
                  </div>
                  <button onClick={() => setInspect(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
                </div>

                <div className="px-6 py-5 space-y-5">
                  {groups.length > 1 && (
                    <p className="text-sm text-gray-500">
                      以下依生日分成 {groups.length} 組並列。請比對電話、地址、性別，判斷這是同一個人（生日可能填錯），還是不同人。
                    </p>
                  )}
                  {groups.map((g, gi) => (
                    <div key={g.key || `none-${gi}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${g.key ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                          {g.key ? `生日：${g.label}` : '未填生日'}
                        </span>
                        <span className="text-xs text-gray-400">{g.records.length} 筆</span>
                        {splittable && g.key && (
                          <button onClick={() => doSplit(inspect, g.key)} disabled={busy}
                            className="ml-auto text-xs px-2.5 py-1 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-40">
                            拆分，未填生日者歸這位
                          </button>
                        )}
                      </div>
                      <RecordTable records={g.records} />
                    </div>
                  ))}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                  {inspect.nameConflict && (
                    <button onClick={() => { confirmSame(inspect); setInspect(null); }} disabled={busy}
                      className="px-4 py-2 rounded-lg text-sm border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-40">
                      確認是同一人（消除警示）
                    </button>
                  )}
                  {!splittable && groups.length > 1 && (
                    <span className="text-xs text-gray-400">只有一組有生日，無法依生日拆分</span>
                  )}
                  <button onClick={() => setInspect(null)} className="ml-auto px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-gray-200">
                    關閉
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 合併確認：兩個人的紀錄左右並列，確認真的是同一人再併 */}
      {compare && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/50" onClick={() => setCompare(null)}>
          <div className="flex min-h-full items-start justify-center p-4">
            <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl my-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h3 className="font-semibold text-gray-800">
                    合併比對：{compare.from.name} <span className="text-gray-400">併入</span> {compare.to.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">確認兩邊是同一個人再執行；合併後統計與匯出都會算成一人，可隨時撤銷</p>
                </div>
                <button onClick={() => setCompare(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>

              <div className="px-6 py-5 grid md:grid-cols-2 gap-5">
                {[compare.from, compare.to].map((p, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${i === 0 ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-600'}`}>
                        {i === 0 ? '來源（將被併入）' : '目標（保留此姓名）'}
                      </span>
                      <span className="font-semibold text-gray-800">{p.name}</span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2 space-y-0.5">
                      <p>電話：{p.phones.join('、') || '—'}</p>
                      <p>地址：{p.addresses.join('；') || '—'}</p>
                      <p>生日：{p.birthDates.join('；') || '—'}　生肖：{p.zodiacs.join('／') || '—'}</p>
                    </div>
                    <RecordTable records={p.records} />
                  </div>
                ))}
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-2">
                <button onClick={() => doMerge(compare.from, compare.to)} disabled={busy}
                  className="px-5 py-2 rounded-lg text-sm bg-temple-red text-white hover:bg-[#5C1A04] disabled:opacity-40">
                  {busy ? '處理中…' : `確認合併為「${compare.to.name}」`}
                </button>
                <button onClick={() => setCompare(null)} className="px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-gray-200">
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** 後台編輯報名內容：修正錯字、回補既有報名缺少的欄位（例如性別，疏文需要）。
 *  整包 entries 一次覆寫，按「儲存」才寫入，避免編到一半就送出。 */
const FahuiEntriesEditor = ({ r, onSaved }: { r: FahuiRegistrationRecord; onSaved: () => void }) => {
  const [entries, setEntries] = useState<Record<string, Array<Record<string, string>>>>(
    () => JSON.parse(JSON.stringify(r.entries || {})),
  );
  const [gender, setGender] = useState(r.contactGender || '');
  const [email, setEmail] = useState(r.email || '');
  const [saving, setSaving] = useState(false);

  const setField = (serviceKey: string, idx: number, fieldKey: string, val: string) => {
    setEntries(prev => {
      const next = { ...prev };
      const arr = [...(next[serviceKey] || [])];
      arr[idx] = { ...arr[idx], [fieldKey]: val };
      next[serviceKey] = arr;
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateFahuiEntries(r.id, entries);
      const contactPatch: { gender?: string; email?: string } = {};
      if (gender !== (r.contactGender || '')) contactPatch.gender = gender;
      if (email.trim() !== (r.email || '')) contactPatch.email = email.trim();
      if (Object.keys(contactPatch).length > 0) await updateFahuiContact(r.id, contactPatch);
      onSaved();
    } catch { alert('儲存失敗，請重試'); }
    finally { setSaving(false); }
  };

  const genderBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-lg border text-sm transition-colors ${
      active ? 'bg-[#C49820] text-white border-[#C49820] font-medium' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
    }`;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-[#C49820]/30 px-4 py-3 space-y-3">
        <div>
          <p className="text-xs text-gray-500 mb-1.5">聯絡人性別</p>
          <div className="flex gap-2">
            {['信士', '信女'].map(g => (
              <button key={g} onClick={() => setGender(gender === g ? '' : g)} className={genderBtn(gender === g)}>{g}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1.5">電子郵件</p>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="未填寫"
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#C49820]/40 focus:border-[#C49820] outline-none"
          />
        </div>
      </div>

      {FAHUI_SERVICE_META.filter(meta => (entries[meta.key] || []).length > 0).map(meta => (
        <div key={meta.key}>
          <p className="text-sm font-semibold text-gray-700 mb-2">{meta.title}</p>
          <div className="space-y-2">
            {(entries[meta.key] || []).map((entry, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 px-3 py-2.5">
                <p className="text-xs text-gray-400 mb-2">第 {i + 1} {meta.unitsField ? '筆' : meta.unit}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {meta.fields.map(f => (
                    <label key={f.key} className="text-xs text-gray-500">
                      {f.label}
                      {f.key === 'gender' ? (
                        <div className="mt-1 flex gap-2">
                          {['信士', '信女'].map(g => (
                            <button key={g} onClick={() => setField(meta.key, i, 'gender', entry.gender === g ? '' : g)}
                              className={genderBtn(entry.gender === g)}>{g}</button>
                          ))}
                        </div>
                      ) : (
                        <input
                          value={entry[f.key] ?? ''}
                          onChange={e => setField(meta.key, i, f.key, e.target.value)}
                          className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-temple-red"
                        />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving}
          className="px-4 py-2 rounded-lg bg-[#C49820] text-white text-sm font-medium hover:bg-[#A87F16] transition-colors disabled:opacity-50">
          {saving ? '儲存中…' : '儲存修改'}
        </button>
        <span className="text-xs text-gray-400">修改會直接覆寫報名資料，並反映在匯出的表單</span>
      </div>
    </div>
  );
};

/** 後台對帳欄位編輯（付款方式／付費日期／帳號後五碼／三項確認／備註）。
 *  下拉與勾選即存；文字欄離開焦點才存，避免每打一個字就送出。 */
const FahuiReconcileBlock = ({ r, onSaved }: { r: FahuiRegistrationRecord; onSaved: () => void }) => {
  const [saving, setSaving] = useState(false);
  const [last5, setLast5] = useState(r.accountLast5 || '');
  const [thanksNo, setThanksNo] = useState(r.thanksLetter || '');
  const [note, setNote] = useState(r.adminNote || '');

  useEffect(() => { setLast5(r.accountLast5 || ''); setNote(r.adminNote || ''); }, [r.accountLast5, r.adminNote]);
  useEffect(() => { setThanksNo(r.thanksLetter || ''); }, [r.thanksLetter]);

  const save = async (patch: FahuiReconcilePatch) => {
    setSaving(true);
    try { await updateFahuiReconcile(r.id, patch); onSaved(); }
    catch { alert('對帳欄位儲存失敗'); }
    finally { setSaving(false); }
  };

  // 感謝狀不在這裡：它要填的是感謝狀上的編號，不是「有沒有寄」，所以獨立成文字欄位
  const checks: { label: string; key: 'financeCheck' | 'accountingCheck'; value: boolean }[] = [
    { label: '財務確認', key: 'financeCheck', value: r.financeCheck },
    { label: '會計確認', key: 'accountingCheck', value: r.accountingCheck },
  ];

  return (
    <div className="bg-white rounded-lg border border-[#C49820]/30 px-4 py-3">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-sm font-semibold text-[#7C5C1E]">對帳資料</p>
        {saving && <span className="text-xs text-gray-400">儲存中…</span>}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="text-xs text-gray-500">付款方式
          <select value={r.paymentMethod || ''} disabled={saving}
            onChange={e => save({ paymentMethod: (e.target.value || null) as FahuiPaymentMethod | null })}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-temple-red">
            <option value="">未設定</option>
            {FAHUI_PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500">付費日期
          <input type="date" value={r.paymentDate || ''} disabled={saving}
            onChange={e => save({ paymentDate: e.target.value || null })}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-temple-red" />
        </label>
        <label className="text-xs text-gray-500">帳號後五碼
          <input value={last5} maxLength={5} inputMode="numeric" placeholder="轉帳末五碼"
            onChange={e => setLast5(e.target.value.replace(/\D/g, ''))}
            onBlur={() => { if (last5 !== (r.accountLast5 || '')) save({ accountLast5: last5 }); }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-temple-red" />
        </label>
        {/* 感謝狀編號：印在實體感謝狀上的號碼，由財務人員自行填寫，不預設任何值。
            不限制只能數字——實務上可能寫成 456-1 或帶字首，擋掉反而卡住填表的人。 */}
        <label className="text-xs text-gray-500">感謝狀編號
          <input value={thanksNo} maxLength={20} placeholder="例：456"
            onChange={e => setThanksNo(e.target.value)}
            onBlur={() => { if (thanksNo !== (r.thanksLetter || '')) save({ thanksLetter: thanksNo }); }}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-temple-red" />
        </label>
        <div className="text-xs text-gray-500">確認項目
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {checks.map(c => (
              <label key={c.key} className="inline-flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={c.value} disabled={saving}
                  onChange={e => save({ [c.key]: e.target.checked } as FahuiReconcilePatch)}
                  className="rounded border-gray-300 text-temple-red focus:ring-temple-red/30" />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      </div>
      <label className="block text-xs text-gray-500 mt-3">備註（後台對帳用，報名者看不到）
        <textarea value={note} rows={2} placeholder="例：已核對匯款、感謝狀寄送狀況"
          onChange={e => setNote(e.target.value)}
          onBlur={() => { if (note !== (r.adminNote || '')) save({ adminNote: note }); }}
          className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-temple-red resize-y" />
      </label>
    </div>
  );
};

const FahuiTab = ({ registrations, onRefresh }: { registrations: FahuiRegistrationRecord[]; onRefresh: () => void }) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = useMemo(() => registrations.filter(r => {
    // 後五碼也納入搜尋：對帳時最常見的動作就是拿銀行明細的後五碼回頭找報名
    const kw = search.trim().toLowerCase();
    const matchSearch = !kw
      || r.name.toLowerCase().includes(kw)
      || r.phone.includes(kw)
      || (r.lineId || '').toLowerCase().includes(kw)
      || (r.email || '').toLowerCase().includes(kw)
      || (r.accountLast5 || '').includes(kw);
    const matchStatus = !filterStatus || r.status === filterStatus;
    return matchSearch && matchStatus && inDateRange(r.createdAt, dateFrom, dateTo);
  }), [registrations, search, filterStatus, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const totalAmount = registrations.reduce((s, r) => s + r.totalAmount, 0);
    const paidAmount = registrations.filter(r => r.status === 'paid').reduce((s, r) => s + r.totalAmount, 0);
    const pending = registrations.filter(r => r.status !== 'paid').length;
    return { count: registrations.length, totalAmount, paidAmount, pending };
  }, [registrations]);

  const countEntries = (r: FahuiRegistrationRecord) =>
    Object.values(r.entries).reduce((s, arr) => s + (arr?.length ?? 0), 0);

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleStatusToggle = async (r: FahuiRegistrationRecord) => {
    setBusyId(r.id);
    try {
      await updateFahuiStatus(r.id, r.status === 'paid' ? 'pending' : 'paid');
      onRefresh();
    } catch { alert('更新狀態失敗'); } finally { setBusyId(null); }
  };

  const handleDelete = async (r: FahuiRegistrationRecord) => {
    if (!confirm(`確定刪除 ${r.name} 的報名？此動作無法復原。`)) return;
    setBusyId(r.id);
    try { await deleteFahuiRegistration(r.id); onRefresh(); }
    catch { alert('刪除失敗'); } finally { setBusyId(null); }
  };

  /** 匯出：每個牌位/戶一列，方便製作牌位與對帳 */
  const handleExportDetail = () => {
    const rows: (string | number)[][] = [];
    filtered.forEach(r => {
      FAHUI_SERVICE_META.forEach(meta => {
        (r.entries[meta.key] || []).forEach((entry, idx) => {
          const bd = splitBirthday(entry.birthdate);
          rows.push([
            r.name, r.phone, r.lineId || '',
            meta.title, `第${idx + 1}${meta.unitsField ? '筆' : meta.unit}`,
            entry.donor || entry.penitent || '', entry.object || [entry.petType, entry.petName].filter(Boolean).join('／') || '',
            entry.units || '', entry.position || '', entry.address || '', bd.solar, bd.lunar, entry.zodiac || '',
            fahuiEntryAmount(meta, entry), r.status === 'paid' ? '已收款' : '待匯款', fmtDate(r.createdAt),
            r.source || '',
          ]);
        });
      });
    });
    exportExcel('法會報名明細.xlsx', rows,
      ['報名人', '電話', 'LINE', '項目', '序', '陽上姓名/捐贈人', '超薦對象/寵物（類別與名）', '單位數', '牌位地址', '地址', '出生日期(國曆)', '出生日期(農曆)', '生肖', '金額', '狀態', '報名時間', '報名來源']);
  };

  /** 匯出：依範本產生的多分頁活頁簿（每個項目一頁 ＋ 平安餐 ＋ 收入計算表） */
  const handleExportWorkbook = () => {
    exportSheetsExcel('和聖壇佛道兩儀普渡法會報名表單.xlsx', buildFahuiSheets(filtered));
  };

  /** 匯出：按需求範例的完整格式——每個品項各佔一列（同一筆報名的列群組在一起，聯絡人資料放第一列），方便編輯 */
  const handleExportTemplate = () => {
    const rows: (string | number)[][] = [];
    // 每個項目在 35 欄中的欄位位置與填法
    const fillers: Array<{ key: string; fill: (row: (string | number)[], e: Record<string, string>) => void }> = [
      { key: 'zanpu',    fill: (row, e) => { row[5] = e.donor || ''; row[6] = e.address || ''; } },
      { key: 'ancestor', fill: (row, e) => { row[8] = e.donor || ''; row[9] = e.object || ''; row[10] = e.position || ''; } },
      { key: 'person',   fill: (row, e) => { row[11] = e.donor || ''; row[12] = e.object || ''; row[13] = e.position || ''; } },
      { key: 'dizhu',    fill: (row, e) => { row[14] = e.donor || ''; row[15] = e.address || ''; } },
      { key: 'debt',     fill: (row, e) => { const b = splitBirthday(e.birthdate); row[16] = e.donor || ''; row[17] = b.solar; row[18] = b.lunar; row[19] = e.zodiac || ''; row[20] = e.address || ''; } },
      { key: 'baby',     fill: (row, e) => { const b = splitBirthday(e.birthdate); row[21] = e.donor || ''; row[22] = b.solar; row[23] = b.lunar; row[24] = e.zodiac || ''; row[25] = e.address || ''; } },
      { key: 'animal',   fill: (row, e) => { row[26] = e.donor || e.penitent || ''; row[27] = e.petType || ''; row[28] = e.petName || ''; row[29] = e.position || ''; } },
      { key: 'donation', fill: (row, e) => { row[30] = e.donor || ''; row[31] = e.units || ''; row[32] = e.address || ''; } },
    ];

    filtered.forEach(r => {
      const regRows: (string | number)[][] = [];
      fillers.forEach(({ key, fill }) => {
        (r.entries[key] || []).forEach(e => {
          const row: (string | number)[] = Array(35).fill('');
          fill(row, e);
          regRows.push(row);
        });
      });
      if (regRows.length === 0) regRows.push(Array(35).fill(''));   // 只贊助平安餐、無項目時仍出一列

      // 聯絡人資料每一列都填（方便搜尋、排序）；報名層級欄位（供品處理/平安餐/留言）只放第一列避免加總重複
      const cbd = splitBirthday(r.contactBirthDate);
      regRows.forEach(row => {
        row[0] = r.name; row[1] = r.phone; row[2] = r.address; row[3] = cbd.solar; row[4] = cbd.lunar;
      });
      const first = regRows[0];
      first[7] = r.zanpuOffering || '';
      first[33] = r.mealSponsor || '';
      first[34] = r.notes || '';

      regRows.forEach(row => rows.push(row));
    });

    exportExcel('法會報名完整表.xlsx', rows, [
      '聯絡人資料-姓名', '聯絡人資料-電話', '聯絡人資料-住家地址', '聯絡人資料-生日(國曆)', '聯絡人資料-生日(農曆)',
      '中元贊普-陽上姓名', '中元贊普-地址', '中元贊普-供品處理方式',
      '超渡歷代祖先-陽上姓名', '超渡歷代祖先-超薦對象', '超渡歷代祖先-牌位地址',
      '超渡先人-陽上姓名', '超渡先人-超薦對象', '超渡先人-牌位地址',
      '超薦地基主-陽上姓名', '超薦地基主-地址',
      '解冤親債主-陽上姓名', '解冤親債主-生日(國曆)', '解冤親債主-生日(農曆)', '解冤親債主-生肖', '解冤親債主-陽上地址',
      '超渡嬰靈-陽上姓名', '超渡嬰靈-生日(國曆)', '超渡嬰靈-生日(農曆)', '超渡嬰靈-生肖', '超渡嬰靈-地址',
      '超渡動物靈-陽上姓名', '超渡動物靈-寵物類別', '超渡動物靈-寵物名', '超渡動物靈-寵物的牌位地址',
      '物資捐贈做功德-捐贈人', '物資捐贈做功德-捐贈單位數量', '物資捐贈做功德-地址',
      '平安餐與茶飲贊助', '其他需求與留言',
    ]);
  };

  /** 匯出：每筆報名一列（含合計金額），方便對帳 */
  const handleExportSummary = () => {
    exportExcel('法會報名總表.xlsx', filtered.map(r => {
      const cbd = splitBirthday(r.contactBirthDate);
      return [
        r.name, r.phone, r.lineId || '', r.email || '', r.address,
        cbd.solar, cbd.lunar, r.contactZodiac || '',
        countEntries(r), r.mealSponsor || 0, r.totalAmount,
        r.accountLast5 || '', r.zanpuOffering || '', r.notes || '',
        r.status === 'paid' ? '已收款' : '待匯款', fmtDate(r.createdAt), r.source || '',
      ];
    }), ['報名人', '電話', 'LINE', '電子郵件', '地址', '聯絡人生日(國曆)', '聯絡人生日(農曆)', '聯絡人生肖', '項目數', '平安餐贊助', '應匯金額', '帳號後五碼', '贊普供品', '留言', '狀態', '報名時間', '報名來源']);
  };

  return (
    <div>
      {/* 統計卡 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">報名筆數</p>
          <p className="text-2xl font-bold text-gray-800">{stats.count}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">待匯款</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">總金額</p>
          <p className="text-2xl font-bold text-temple-red">${stats.totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">已收款金額</p>
          <p className="text-2xl font-bold text-green-600">${stats.paidAmount.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="text-xl font-bold text-gray-800">法會報名
          <span className="ml-2 text-sm font-normal text-gray-400">共 {filtered.length} 筆</span>
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleExportWorkbook}
            className="flex items-center gap-2 px-4 py-2 bg-[#C49820] text-white rounded-lg text-sm hover:bg-[#A87F16] transition-colors">
            <Download className="w-4 h-4" /> 法會表單（分頁）
          </button>
          <button onClick={handleExportTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-[#7C5C1E] text-white rounded-lg text-sm hover:bg-[#5C441A] transition-colors">
            <Download className="w-4 h-4" /> 完整報名表
          </button>
          <button onClick={handleExportSummary}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors">
            <Download className="w-4 h-4" /> 對帳總表
          </button>
          <button onClick={handleExportDetail}
            className="flex items-center gap-2 px-4 py-2 bg-temple-red text-white rounded-lg text-sm hover:bg-[#5C1A04] transition-colors">
            <Download className="w-4 h-4" /> 牌位明細
          </button>
        </div>
      </div>

      {/* 篩選 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋姓名 / 電話 / LINE / 信箱 / 後五碼"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none">
          <option value="">全部狀態</option>
          <option value="pending">待匯款</option>
          <option value="paid">已收款</option>
        </select>
        <DateRangeFilter from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-20">尚無符合條件的報名資料</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const isOpen = expanded.has(r.id);
            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4">
                  <button onClick={() => toggleExpand(r.id)} className="shrink-0 text-gray-400 hover:text-gray-700">
                    {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">{r.name}</span>
                      <span className="text-sm text-gray-400">{r.phone}</span>
                      {r.lineId && <span className="text-xs bg-[#06C755]/10 text-[#06C755] px-2 py-0.5 rounded-full">LINE: {r.lineId}</span>}
                      {r.accountLast5 && <span className="text-xs bg-[#C49820]/10 text-[#7C5C1E] px-2 py-0.5 rounded-full">後五碼: {r.accountLast5}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {countEntries(r)} 個項目・{fmtDate(r.createdAt)}
                      {r.email && <span className="ml-2 text-gray-400">{r.email}</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-temple-red">${r.totalAmount.toLocaleString()}</p>
                  </div>
                  <div className="shrink-0">{fahuiStatusBadge(r.status)}</div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleStatusToggle(r)} disabled={busyId === r.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                        r.status === 'paid' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-600 text-white hover:bg-green-700'
                      }`}>
                      {r.status === 'paid' ? '改回待匯款' : '標記已收款'}
                    </button>
                    <button onClick={() => handleDelete(r)} disabled={busyId === r.id}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-gray-500">
                        聯絡地址：{r.address}
                        {r.contactGender && <span className="ml-2 text-gray-400">性別：{r.contactGender}</span>}
                        {r.source && <span className="ml-2 text-gray-400">來源：<span className="font-mono">{r.source}</span></span>}
                      </p>
                      <button
                        onClick={() => setEditingId(editingId === r.id ? null : r.id)}
                        className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-[#C49820]/50 text-[#7C5C1E] hover:bg-[#C49820]/10 transition-colors"
                      >
                        {editingId === r.id ? '取消編輯' : '編輯報名內容'}
                      </button>
                    </div>

                    {editingId === r.id ? (
                      <FahuiEntriesEditor r={r} onSaved={() => { setEditingId(null); onRefresh(); }} />
                    ) : (
                    <>
                    {FAHUI_SERVICE_META.filter(meta => (r.entries[meta.key] || []).length > 0).map(meta => {
                      const entries = r.entries[meta.key];
                      const units = meta.unitsField ? entries.reduce((s, e) => s + (Number(e[meta.unitsField!]) || 1), 0) : entries.length;
                      const subtotal = entries.reduce((s, e) => s + fahuiEntryAmount(meta, e), 0);
                      return (
                      <div key={meta.key}>
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                          {meta.title} <span className="text-gray-400 font-normal">× {units} {meta.unit}・${subtotal.toLocaleString()}</span>
                        </p>
                        <div className="space-y-2">
                          {entries.map((entry, i) => (
                            <div key={i} className="bg-white rounded-lg border border-gray-100 px-3 py-2 text-sm flex flex-wrap gap-x-5 gap-y-1">
                              <span className="text-gray-400">第{i + 1}{meta.unitsField ? '筆' : meta.unit}</span>
                              {meta.fields.map(f => entry[f.key] ? (
                                <span key={f.key} className="text-gray-700">
                                  <span className="text-gray-400">{f.label}：</span>{entry[f.key]}
                                </span>
                              ) : null)}
                            </div>
                          ))}
                        </div>
                      </div>
                      );
                    })}
                    {r.zanpuOffering && (
                      <div className="text-sm"><span className="text-gray-400">贊普供品：</span><span className="text-gray-700">{r.zanpuOffering}</span></div>
                    )}
                    {r.mealSponsor > 0 && (
                      <div className="text-sm"><span className="text-gray-400">平安餐贊助：</span><span className="text-gray-700">${r.mealSponsor.toLocaleString()}</span></div>
                    )}
                    {r.notes && (
                      <div className="text-sm"><span className="text-gray-400">留言：</span><span className="text-gray-700">{r.notes}</span></div>
                    )}
                    </>
                    )}
                    <FahuiReconcileBlock r={r} onSaved={onRefresh} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Volunteer (志工報名) Tab ──────────────────────────────────────────────────

/** 把出勤時段整理成一行可讀字串，例：「9/11: 全天｜9/12: 上午場,下午場」 */
const fmtAvailability = (av?: Record<string, string[]>): string => {
  if (!av) return '';
  return Object.entries(av)
    .filter(([, slots]) => slots && slots.length)
    .map(([day, slots]) => `${day}: ${slots.join('、')}`)
    .join('｜');
};

const VolunteerTab = ({ registrations, onRefresh }: { registrations: VolunteerRegistrationRecord[]; onRefresh: () => void }) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => registrations.filter(r => {
    const matchSearch = !search || r.name.includes(search) || r.phone.includes(search) || (r.lineId || '').includes(search);
    const matchStatus = !filterStatus || r.status === filterStatus;
    return matchSearch && matchStatus && inDateRange(r.createdAt, dateFrom, dateTo);
  }), [registrations, search, filterStatus, dateFrom, dateTo]);

  const pendingCount = registrations.filter(r => r.status !== 'contacted').length;

  const handleStatusToggle = async (r: VolunteerRegistrationRecord) => {
    setBusyId(r.id);
    try { await updateVolunteerStatus(r.id, r.status === 'contacted' ? 'pending' : 'contacted'); onRefresh(); }
    catch { alert('更新狀態失敗'); } finally { setBusyId(null); }
  };

  const handleDelete = async (r: VolunteerRegistrationRecord) => {
    if (!confirm(`確定刪除 ${r.name} 的志工報名？此動作無法復原。`)) return;
    setBusyId(r.id);
    try { await deleteVolunteerRegistration(r.id); onRefresh(); }
    catch { alert('刪除失敗'); } finally { setBusyId(null); }
  };

  const handleExport = () => {
    exportExcel('志工報名名單.xlsx', filtered.map(r => {
      const bd = splitBirthday(r.birthDate);
      return [
        r.name, r.phone, r.address, r.diet || '', bd.solar, bd.lunar, r.zodiac || '', r.lineId || '',
        fmtAvailability(r.availability), r.availabilityNote || '',
        r.status === 'contacted' ? '已聯絡' : '待聯絡', fmtDate(r.createdAt), r.source || '',
      ];
    }), ['姓名', '電話', '通訊地址', '用餐習慣', '生日(國曆)', '生日(農曆)', '生肖', 'LINE', '可出勤時段', '其他時段說明', '狀態', '報名時間', '報名來源']);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">志工報名數</p>
          <p className="text-2xl font-bold text-gray-800">{registrations.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">待聯絡</p>
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="text-xl font-bold text-gray-800">志工報名
          <span className="ml-2 text-sm font-normal text-gray-400">共 {filtered.length} 筆</span>
        </h2>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors">
          <Download className="w-4 h-4" /> 匯出 Excel
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋姓名 / 電話 / LINE"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none">
          <option value="">全部狀態</option>
          <option value="pending">待聯絡</option>
          <option value="contacted">已聯絡</option>
        </select>
        <DateRangeFilter from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-20">尚無符合條件的志工報名</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800">{r.name}</span>
                  <span className="text-sm text-gray-400">{r.phone}</span>
                  {r.lineId && <span className="text-xs bg-[#06C755]/10 text-[#06C755] px-2 py-0.5 rounded-full">LINE: {r.lineId}</span>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{r.address}</p>
                {r.diet && (
                  <span className="inline-block text-xs bg-[#C49820]/10 text-[#7C5C1E] px-2 py-0.5 rounded-full mt-1">{r.diet}</span>
                )}
                {(r.birthDate || r.zodiac) && (
                  <p className="text-xs text-gray-400 mt-0.5">{r.birthDate}{r.zodiac ? `（${r.zodiac}）` : ''}</p>
                )}
                {fmtAvailability(r.availability) && (
                  <p className="text-xs text-[#7C5C1E] mt-0.5">出勤：{fmtAvailability(r.availability)}</p>
                )}
                {r.availabilityNote && (
                  <p className="text-xs text-gray-400 mt-0.5">其他：{r.availabilityNote}</p>
                )}
                <p className="text-[11px] text-gray-300 mt-0.5">{fmtDate(r.createdAt)}</p>
                {r.source && <p className="text-[11px] text-gray-300 font-mono">{r.source}</p>}
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                r.status === 'contacted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {r.status === 'contacted' ? '已聯絡' : '待聯絡'}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleStatusToggle(r)} disabled={busyId === r.id}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                    r.status === 'contacted' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-600 text-white hover:bg-green-700'
                  }`}>
                  {r.status === 'contacted' ? '改回待聯絡' : '標記已聯絡'}
                </button>
                <button onClick={() => handleDelete(r)} disabled={busyId === r.id}
                  className="p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Overview Tab ─────────────────────────────────────────────────────────────

const OverviewTab = ({
  bookings, donations, lampRegistrations, blessingRegistrations, lampConfigs, blessingEvents, lineStats,
}: {
  bookings:             BookingRecord[];
  donations:            DonationRecord[];
  lampRegistrations:    LampRegistrationRecord[];
  blessingRegistrations: BlessingRegistrationRecord[];
  lampConfigs:          LampServiceConfig[];
  blessingEvents:       BlessingEventRecord[];
  lineStats:            { today: number; total: number };
}) => {
  const [activeService, setActiveService] = useState<'lamps' | 'blessing' | 'donation' | 'booking'>('lamps');

  const now = Date.now();
  const h24 = 24 * 60 * 60 * 1000;

  // name maps
  const lampConfigMap    = Object.fromEntries(lampConfigs.map(c => [c.id, c.name]));
  const blessingEventMap = Object.fromEntries(blessingEvents.map(e => [e.id, e.title]));

  // pending / new counts per service
  const lampPending     = lampRegistrations.filter(r => r.status === LampRegistrationStatus.PENDING).length;
  const blessingPending = blessingRegistrations.filter(r => r.status === BlessingStatus.PENDING).length;
  const bookingPending  = bookings.filter(b => b.status === BookingStatus.PENDING).length;
  const donationRecent  = donations.filter(d => d.createdAt && (now - new Date(d.createdAt).getTime()) < h24).length;

  // stat totals
  const totalRegistrations = lampRegistrations.length + blessingRegistrations.length + bookings.length;
  const allPending         = lampPending + blessingPending + bookingPending;
  const totalDonation      = donations.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const uniquePhones       = new Set([
    ...lampRegistrations.map(r => r.phone),
    ...blessingRegistrations.map(r => r.phone),
    ...bookings.map(b => b.phone),
    ...donations.map(d => d.phone),
  ]).size;

  // latest 5 per service (newest first)
  const latestLamps     = [...lampRegistrations].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 5);
  const latestBlessings = [...blessingRegistrations].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 5);
  const latestDonations = [...donations].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 5);
  const latestBookings  = [...bookings].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 5);

  const serviceTabs = [
    { key: 'booking'  as const, label: '問事', badge: bookingPending  },
    { key: 'lamps'    as const, label: '點燈', badge: lampPending     },
    { key: 'blessing' as const, label: '祈福', badge: blessingPending },
    { key: 'donation' as const, label: '捐獻', badge: donationRecent  },
  ];

  const rowCls = 'flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0';
  const nameCls = 'font-medium text-sm text-gray-800';
  const subCls  = 'text-xs text-gray-400 ml-2';
  const dateCls = 'text-xs text-gray-400';

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">總覽</h2>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <StatCard icon={<ClipboardList className="w-5 h-5 text-blue-600" />}   label="總報名數"    value={totalRegistrations}                         sub="全部服務"    color="bg-blue-50" />
        <StatCard icon={<AlertCircle className="w-5 h-5 text-yellow-600" />}   label="待處理報名"  value={allPending}                                 sub="需要處理"    color="bg-yellow-50" />
        <StatCard icon={<Banknote className="w-5 h-5 text-green-600" />}       label="累計捐款"    value={`NT$ ${totalDonation.toLocaleString()}`}    sub="全部紀錄"    color="bg-green-50" />
        <StatCard icon={<Users className="w-5 h-5 text-purple-600" />}         label="不重複信眾"  value={uniquePhones}                               sub="依電話計算"  color="bg-purple-50" />
      </div>

      {/* LINE 導流統計 */}
      <div className="bg-[#06C755]/5 border border-[#06C755]/30 rounded-xl p-5 mb-8 flex flex-col sm:flex-row items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-[#06C755] rounded-xl p-3 shrink-0">
            <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-0.5">LINE 官方帳號導流</p>
            <p className="text-xs text-gray-400">統計加入好友點擊次數</p>
          </div>
        </div>
        <div className="flex items-center gap-8 sm:ml-auto">
          <div className="text-center">
            <p className="text-3xl font-bold text-[#06C755]">{lineStats.today}</p>
            <p className="text-xs text-gray-500 mt-0.5">今日點擊</p>
          </div>
          <div className="w-px h-12 bg-[#06C755]/20" />
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-700">{lineStats.total}</p>
            <p className="text-xs text-gray-500 mt-0.5">累計點擊</p>
          </div>
        </div>
      </div>

      {/* 最新報名 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-temple-red" /> 最新報名
        </h3>

        {/* Service tabs */}
        <div className="flex gap-1 mb-5 bg-gray-50 p-1 rounded-lg">
          {serviceTabs.map(({ key, label, badge }) => (
            <button key={key} onClick={() => setActiveService(key)}
              className={`relative flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                activeService === key ? 'bg-white text-temple-red shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {label}
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-1 leading-none">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 點燈 */}
        {activeService === 'lamps' && (
          latestLamps.length === 0 ? <p className="text-gray-400 text-sm py-4 text-center">尚無點燈報名</p> : (
            <div className="space-y-0.5">
              {latestLamps.map(r => (
                <div key={r.id} className={rowCls}>
                  <div><span className={nameCls}>{r.name}</span><span className={subCls}>{lampConfigMap[r.serviceId] ?? r.serviceId}</span></div>
                  <div className="flex items-center gap-2"><span className={dateCls}>{(r.createdAt ?? '').slice(0, 10)}</span>{statusBadge(r.status)}</div>
                </div>
              ))}
            </div>
          )
        )}

        {/* 祈福 */}
        {activeService === 'blessing' && (
          latestBlessings.length === 0 ? <p className="text-gray-400 text-sm py-4 text-center">尚無祈福報名</p> : (
            <div className="space-y-0.5">
              {latestBlessings.map(r => (
                <div key={r.id} className={rowCls}>
                  <div><span className={nameCls}>{r.name}</span><span className={subCls}>{blessingEventMap[r.eventId] ?? r.eventId}</span></div>
                  <div className="flex items-center gap-2"><span className={dateCls}>{(r.createdAt ?? '').slice(0, 10)}</span>{statusBadge(r.status)}</div>
                </div>
              ))}
            </div>
          )
        )}

        {/* 捐獻 */}
        {activeService === 'donation' && (
          latestDonations.length === 0 ? <p className="text-gray-400 text-sm py-4 text-center">尚無捐獻紀錄</p> : (
            <div className="space-y-0.5">
              {latestDonations.map(d => (
                <div key={d.id} className={rowCls}>
                  <div><span className={nameCls}>{d.name}</span><span className={subCls}>{d.type}</span></div>
                  <div className="flex items-center gap-2">
                    <span className={dateCls}>{(d.createdAt ?? '').slice(0, 10)}</span>
                    <span className="text-xs font-semibold text-green-600">NT$ {Number(d.amount).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* 問事 */}
        {activeService === 'booking' && (
          latestBookings.length === 0 ? <p className="text-gray-400 text-sm py-4 text-center">尚無問事報名</p> : (
            <div className="space-y-0.5">
              {latestBookings.map(b => (
                <div key={b.id} className={rowCls}>
                  <div><span className={nameCls}>{b.name}</span><span className={subCls}>{b.type} · {b.bookingDate}</span></div>
                  <div className="flex items-center gap-2"><span className={dateCls}>{(b.createdAt ?? '').slice(0, 10)}</span>{statusBadge(b.status)}</div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

// ─── Bookings Tab ─────────────────────────────────────────────────────────────

const BookingsTab = ({ bookings, onStatusChange, updatingId, memberProfiles }: {
  bookings: BookingRecord[];
  onStatusChange: (id: string, status: BookingStatus) => void;
  updatingId: string | null;
  memberProfiles: MemberProfileRecord[];
}) => {
  // ── 場次管理狀態 ──
  const [sessions, setSessions] = useState<BookingSessionRecord[]>([]);
  const [sCountMap, setSCountMap] = useState<Record<string, number>>({});
  const [sessionLoading, setSessionLoading] = useState(true);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newSessionTime, setNewSessionTime] = useState('晚上 19:00–21:00');
  const [newSessionMaxSlots, setNewSessionMaxSlots] = useState(15);
  const [savingSession, setSavingSession] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [filterSession, setFilterSession] = useState('');

  const loadSessions = async () => {
    setSessionLoading(true);
    try {
      const [sess, counts] = await Promise.all([getBookingSessions(false), getBookingCountsBySession()]);
      setSessions(sess);
      setSCountMap(counts);
    } catch (e: any) {
      setSessionError('載入場次失敗：' + (e?.message ?? String(e)));
    }
    setSessionLoading(false);
  };

  useEffect(() => { loadSessions(); }, []);

  const handleAddSession = async () => {
    if (!newSessionDate || !newSessionTime) return;
    setSavingSession(true);
    setSessionError('');
    try {
      await createBookingSession({ sessionDate: newSessionDate, sessionTime: newSessionTime, maxSlots: newSessionMaxSlots, isActive: true });
      setNewSessionDate('');
      setNewSessionTime('晚上 19:00–21:00');
      setNewSessionMaxSlots(15);
      setShowSessionForm(false);
      await loadSessions();
    } catch (e: any) {
      setSessionError('新增場次失敗：' + (e?.message ?? String(e)));
    }
    setSavingSession(false);
  };

  const handleToggleSession = async (s: BookingSessionRecord) => {
    setSessionError('');
    try {
      await updateBookingSession(s.id, { isActive: !s.isActive });
      await loadSessions();
    } catch (e: any) {
      setSessionError('更新場次失敗：' + (e?.message ?? String(e)));
    }
  };

  const handleDeleteSession = async (s: BookingSessionRecord) => {
    const count = sCountMap[s.id] || 0;
    if (!confirm(`確定刪除此場次？${count > 0 ? `（已有 ${count} 筆預約）` : ''}`)) return;
    setSessionError('');
    try {
      await deleteBookingSession(s.id);
      await loadSessions();
    } catch (e: any) {
      setSessionError('刪除場次失敗：' + (e?.message ?? String(e)));
    }
  };

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'name'>('time');
  const [page, setPage] = useState(0);
  const [quickView, setQuickView] = useState<RegViewItem | null>(null);
  const [divineEdit, setDivineEdit] = useState<{ id: string; name: string; text: string } | null>(null);
  const [divineSaving, setDivineSaving] = useState(false);

  const handleSaveDivine = async () => {
    if (!divineEdit) return;
    setDivineSaving(true);
    try {
      await updateBookingDivineMessage(divineEdit.id, divineEdit.text);
      setDivineEdit(null);
    } catch (e: any) {
      alert('儲存失敗：' + (e?.message ?? String(e)));
    }
    setDivineSaving(false);
  };

  const filtered = useMemo(() => {
    const result = bookings.filter(b => {
      const q = search.toLowerCase();
      const matchSearch = !q || b.name.toLowerCase().includes(q) || b.phone.includes(q);
      const matchStatus = !filterStatus || b.status === filterStatus;
      const matchType = !filterType || b.type === filterType;
      const matchSession = !filterSession || (b as any).sessionId === filterSession;
      return matchSearch && matchStatus && matchType && matchSession;
    });
    if (sortBy === 'name') result.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'));
    return result;
  }, [bookings, search, filterStatus, filterType, filterSession, sortBy]);

  useEffect(() => { setPage(0); }, [search, filterStatus, filterType, filterSession, sortBy]);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExport = () => {
    exportExcel('預約資料.xlsx', filtered.map(b => [
      b.name, b.phone, b.gender || '', b.birthDate, b.zodiac || '', b.address || '', b.bookingDate,
      b.bookingTime === 'evening' ? '晚上' : b.bookingTime,
      b.type, b.status || '', b.notes || '', fmtDate(b.createdAt), b.source || ''
    ]), ['姓名', '電話', '性別', '農曆生日', '生肖', '現居地址', '預約日期', '時段', '問事項目', '狀態', '備註', '建立時間', '報名來源']);
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

      {sessionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{sessionError}</span>
        </div>
      )}

      {/* 場次管理 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-temple-red" /> 場次管理
          </h3>
          <button onClick={() => setShowSessionForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-temple-red text-white rounded-lg text-sm hover:bg-[#5C1A04] transition-colors">
            <Plus className="w-4 h-4" /> 新增場次
          </button>
        </div>

        {showSessionForm && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">日期</label>
              <input type="date" value={newSessionDate} onChange={e => setNewSessionDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">時段</label>
              <input type="text" value={newSessionTime} onChange={e => setNewSessionTime(e.target.value)}
                placeholder="晚上 19:00–21:00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">名額上限</label>
              <input type="number" min={1} max={100} value={newSessionMaxSlots} onChange={e => setNewSessionMaxSlots(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
            </div>
            <div className="flex items-end">
              <button onClick={handleAddSession} disabled={savingSession || !newSessionDate}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition-colors">
                {savingSession ? '儲存中...' : '確認新增'}
              </button>
            </div>
          </div>
        )}

        {sessionLoading ? (
          <div className="text-center text-gray-400 text-sm py-4">載入中...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-4">尚無場次，請新增。</div>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => {
              const booked = sCountMap[s.id] || 0;
              const remaining = s.maxSlots - booked;
              const d = new Date(s.sessionDate + 'T12:00:00');
              const days = ['日', '一', '二', '三', '四', '五', '六'];
              const label = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${days[d.getDay()]}）${s.sessionTime}`;
              return (
                <div key={s.id} className={`flex items-center justify-between px-4 py-3 rounded-lg border ${s.isActive ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                      {s.isActive ? '開放中' : '已關閉'}
                    </span>
                    <span className="text-sm font-medium text-gray-800">{label}</span>
                    <span className="text-xs text-gray-500">{booked}/{s.maxSlots} 位 · {remaining <= 0 ? <span className="text-red-500 font-medium">額滿</span> : `剩 ${remaining}`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleToggleSession(s)}
                      className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors">
                      {s.isActive ? '關閉' : '開放'}
                    </button>
                    <button onClick={() => handleDeleteSession(s)}
                      className="text-xs px-2.5 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                      刪除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
        <select value={filterSession} onChange={e => setFilterSession(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red">
          <option value="">全部場次</option>
          {sessions.map(s => {
            const d = new Date(s.sessionDate + 'T12:00:00');
            const days = ['日', '一', '二', '三', '四', '五', '六'];
            return <option key={s.id} value={s.id}>{d.getMonth()+1}月{d.getDate()}日（{days[d.getDay()]}）{s.sessionTime}</option>;
          })}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as 'time' | 'name')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red">
          <option value="time">依時間排序</option>
          <option value="name">依姓名排序</option>
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
            <table className="admin-table min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['信眾資訊', '預約時間 / 項目', '備註', '神明的話', '狀態', '操作'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paged.map(b => (
                  <tr key={b.id}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                    onClick={() => setQuickView({ name: b.name, phone: b.phone, gender: b.gender || undefined, birthDate: b.birthDate, zodiac: b.zodiac || undefined, address: b.address || undefined, notes: b.notes || undefined, status: b.status, serviceLabel: `問事 · ${b.type}`, createdAt: b.createdAt, contactLabel: b.contactLabel, source: b.source })}
                  >
                    <td data-label="信眾資訊" className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-temple-red/10 rounded-full flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-temple-red" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{b.name}</p>
                            {b.contactLabel && <span className="text-xs bg-temple-gold/20 text-temple-dark px-1.5 py-0.5 rounded-full font-medium">#{b.contactLabel}</span>}
                          </div>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{b.phone}</p>
                          {b.gender && <span className="text-xs text-gray-400">{b.gender}</span>}
                          <p className="text-xs text-gray-400">生日：{b.birthDate}{b.zodiac ? `　生肖：${b.zodiac}` : ''}</p>
                          {b.address && <p className="text-xs text-gray-400 mt-0.5">地址：{b.address}</p>}
                        </div>
                      </div>
                    </td>
                    <td data-label="預約時間 / 項目" className="px-5 py-4">
                      <p className="text-sm text-gray-800 flex items-center gap-1.5 mb-1"><Calendar className="w-3.5 h-3.5 text-gray-400" />{b.bookingDate}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-2"><Clock className="w-3.5 h-3.5 text-gray-400" />
                        {b.bookingTime === 'evening' ? '晚上 (19:00-21:00)' : b.bookingTime}
                      </p>
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">{b.type}</span>
                    </td>
                    <td data-label="備註" className="px-5 py-4 max-w-[180px]">
                      <p className="text-sm text-gray-700 truncate">{b.notes || <span className="text-gray-300 italic">無備註</span>}</p>
                      <p className="text-xs text-gray-400 mt-1">{fmtDate(b.createdAt)}</p>
                    </td>
                    <td data-label="神明的話" className="px-5 py-4 max-w-[160px]" onClick={e => e.stopPropagation()}>
                      {b.divineMessage
                        ? <p className="text-xs text-amber-800 line-clamp-2 cursor-pointer hover:text-amber-900"
                            onClick={() => setDivineEdit({ id: b.id, name: b.name, text: b.divineMessage! })}>
                            {b.divineMessage}
                          </p>
                        : <button onClick={() => setDivineEdit({ id: b.id, name: b.name, text: '' })}
                            className="text-xs text-gray-400 hover:text-temple-red transition-colors flex items-center gap-1">
                            <Plus className="w-3 h-3" /> 填寫
                          </button>
                      }
                    </td>
                    <td data-label="狀態" className="px-5 py-4">{statusBadge(b.status)}</td>
                    <td data-label="操作" className="px-5 py-4" onClick={e => e.stopPropagation()}>
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
            <Paginator total={filtered.length} page={page} onChange={setPage} />
          </div>
        )}
      </div>
      {quickView && <MemberInfoModal reg={quickView} memberProfiles={memberProfiles} onClose={() => setQuickView(null)} />}

      {/* 神明的話 編輯 Modal */}
      {divineEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDivineEdit(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="text-temple-gold text-lg">✦</span> 神明的話
                <span className="text-sm font-normal text-gray-500 ml-1">— {divineEdit.name}</span>
              </h3>
              <button onClick={() => setDivineEdit(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <textarea
              value={divineEdit.text}
              onChange={e => setDivineEdit(d => d ? { ...d, text: e.target.value } : d)}
              placeholder="在此填寫聖母的指示、訓示或建議..."
              rows={6}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-temple-gold/40 focus:border-temple-gold outline-none resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setDivineEdit(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                取消
              </button>
              <button onClick={handleSaveDivine} disabled={divineSaving}
                className="flex-1 px-4 py-2 bg-temple-gold text-white rounded-lg text-sm hover:bg-temple-gold/90 disabled:opacity-50 transition-colors font-medium">
                {divineSaving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Donations Tab ────────────────────────────────────────────────────────────

const DonationsTab = ({ donations, memberProfiles, onRefresh }: { donations: DonationRecord[]; memberProfiles: MemberProfileRecord[]; onRefresh: () => void }) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'name'>('time');
  const [page, setPage] = useState(0);
  const [quickView, setQuickView] = useState<RegViewItem | null>(null);

  const filtered = useMemo(() => {
    const result = donations.filter(d => {
      const q = search.toLowerCase();
      const matchSearch = !q || d.name.toLowerCase().includes(q) || d.phone.includes(q);
      const matchType = !filterType || d.type === filterType;
      return matchSearch && matchType;
    });
    if (sortBy === 'name') result.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'));
    return result;
  }, [donations, search, filterType, sortBy]);

  useEffect(() => { setPage(0); }, [search, filterType, sortBy]);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const total = filtered.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const types = [...new Set(donations.map(d => d.type))];

  const handleExport = () => {
    exportExcel('捐款資料.xlsx', filtered.map(d => [
      d.name, d.phone, d.gender || '', d.address || '', Number(d.amount), d.type, d.repairProjectName || '', d.notes || '', fmtDate(d.createdAt), d.source || ''
    ]), ['姓名', '電話', '性別', '現居地址', '金額', '捐款類型', '修復神尊', '備註', '建立時間', '報名來源']);
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

      {/* 捐款類別設定：預設收合，不擋住每天要看的捐款列表 */}
      <AdminDonationTypesTab donations={donations} onRefresh={onRefresh} />

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
        <select value={sortBy} onChange={e => setSortBy(e.target.value as 'time' | 'name')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red">
          <option value="time">依時間排序</option>
          <option value="name">依姓名排序</option>
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
            <table className="admin-table min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['信眾資訊', '捐款金額', '類型', '修復神尊', '備註', '時間'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paged.map(d => (
                  <tr key={d.id}
                    className="hover:bg-green-50/40 transition-colors cursor-pointer"
                    onClick={() => setQuickView({ name: d.name, phone: d.phone, gender: d.gender || undefined, address: d.address || undefined, notes: d.notes || undefined, serviceLabel: `捐獻 · ${d.type}　NT$${Number(d.amount).toLocaleString()}`, createdAt: d.createdAt, contactLabel: d.contactLabel, source: d.source })}
                  >
                    <td data-label="信眾資訊" className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                          <HeartHandshake className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{d.name}</p>
                            {d.contactLabel && <span className="text-xs bg-temple-gold/20 text-temple-dark px-1.5 py-0.5 rounded-full font-medium">#{d.contactLabel}</span>}
                          </div>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{d.phone}</p>
                          {d.gender && <span className="text-xs text-gray-400">{d.gender}</span>}
                          {d.address && <p className="text-xs text-gray-400 mt-0.5">地址：{d.address}</p>}
                        </div>
                      </div>
                    </td>
                    <td data-label="捐款金額" className="px-5 py-4">
                      <p className="text-base font-bold text-green-700">NT$ {Number(d.amount).toLocaleString()}</p>
                    </td>
                    <td data-label="類型" className="px-5 py-4">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800">{d.type}</span>
                    </td>
                    <td data-label="修復神尊" className="px-4 py-3 text-sm text-gray-500">
                      {d.repairProjectName
                        ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                            <Wrench className="w-3 h-3" />{d.repairProjectName}
                          </span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td data-label="備註" className="px-5 py-4 max-w-[180px]">
                      <p className="text-sm text-gray-700 truncate">{d.notes || <span className="text-gray-300 italic">無備註</span>}</p>
                    </td>
                    <td data-label="時間" className="px-5 py-4">
                      <p className="text-xs text-gray-500">{fmtDate(d.createdAt)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Paginator total={filtered.length} page={page} onChange={setPage} />
          </div>
        )}
      </div>
      {quickView && <MemberInfoModal reg={quickView} memberProfiles={memberProfiles} onClose={() => setQuickView(null)} />}
    </div>
  );
};

// ─── Members Tab ─────────────────────────────────────────────────────────────

// ── 統計小標籤 ──────────────────────────────────────────────────────────────────
const StatBadges = ({ lamps, bookingCount, activities, donation }: { lamps: number; bookingCount: number; activities: number; donation: number }) => (
  <div className="flex flex-wrap gap-1.5">
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-medium">
      <Flame className="w-3 h-3" />{lamps} 燈
    </span>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">
      <Sparkles className="w-3 h-3" />{activities} 祈福
    </span>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">
      <HeartHandshake className="w-3 h-3" />{donation > 0 ? `NT$${donation.toLocaleString()}` : '—'}
    </span>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">
      <BookOpen className="w-3 h-3" />{bookingCount} 問事
    </span>
  </div>
);

type MemberSortKey = 'default' | 'lamps' | 'bookings' | 'activities' | 'donation' | 'lastLogin';
type MemberSortDir = 'asc' | 'desc';

const MembersTab = ({ bookings, donations, lampRegistrations, registrations, blessingRegistrations, blessingEvents, lampConfigs, memberProfiles, usersLastLogin }: {
  bookings: BookingRecord[];
  donations: DonationRecord[];
  lampRegistrations: LampRegistrationRecord[];
  registrations: RegistrationRecord[];
  blessingRegistrations: BlessingRegistrationRecord[];
  blessingEvents: BlessingEventRecord[];
  lampConfigs: LampServiceConfig[];
  memberProfiles: MemberProfileRecord[];
  usersLastLogin: Record<string, string>;
}) => {
  // 已註冊會員詳情
  const [selectedProfile, setSelectedProfile] = useState<MemberProfileRecord | null>(null);
  const [profileContacts, setProfileContacts] = useState<MemberContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  // 親友詳情 modal
  const [selectedContact, setSelectedContact] = useState<MemberContact | null>(null);
  // 歷史紀錄 tab
  const [historyTab, setHistoryTab] = useState<'lamp' | 'booking' | 'blessing' | 'donation'>('lamp');
  // 排序
  const [sortBy, setSortBy] = useState<MemberSortKey>('default');
  const [sortDir, setSortDir] = useState<MemberSortDir>('desc');

  const handleSort = (key: MemberSortKey) => {
    if (key === 'default') return;
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  // ── 統計 helpers ──
  const getStatsByPhone = (phone: string) => {
    const lamps = lampRegistrations.filter(l => l.phone === phone).length;
    const bkCount = bookings.filter(b => b.phone === phone).length;
    const acts = registrations.filter(r => r.phone === phone).length;
    const dn = donations.filter(d => d.phone === phone);
    return { lamps, bookingCount: bkCount, activities: acts, donation: dn.reduce((s, d) => s + Number(d.amount), 0) };
  };

  const getContactStats = (memberPhone: string, contactName: string) => {
    const lamps = lampRegistrations.filter(l => l.phone === memberPhone && l.name === contactName).length;
    const bkCount = bookings.filter(b => b.phone === memberPhone && b.name === contactName).length;
    const acts = registrations.filter(r => r.phone === memberPhone && r.name === contactName).length;
    const dn = donations.filter(d => d.phone === memberPhone && d.name === contactName);
    return { lamps, bookingCount: bkCount, activities: acts, donation: dn.reduce((s, d) => s + Number(d.amount), 0) };
  };

  // ── 計算排序後的 rows ──
  const sortedProfiles = useMemo(() => {
    const rows = memberProfiles.map(p => {
      const lamps = lampRegistrations.filter(l => l.phone === p.phone).length;
      const bookingCount = bookings.filter(b => b.phone === p.phone).length;
      const activitiesCount = registrations.filter(r => r.phone === p.phone).length;
      const donation = donations.filter(d => d.phone === p.phone).reduce((s, d) => s + Number(d.amount), 0);
      const lastLogin = usersLastLogin[p.userId] ?? null;
      return { ...p, stats: { lamps, bookingCount, activities: activitiesCount, donation }, lastLogin };
    });
    rows.sort((a, b) => {
      if (sortBy === 'lamps')       { const d = a.stats.lamps - b.stats.lamps; return sortDir === 'asc' ? d : -d; }
      if (sortBy === 'bookings')    { const d = a.stats.bookingCount - b.stats.bookingCount; return sortDir === 'asc' ? d : -d; }
      if (sortBy === 'activities')  { const d = a.stats.activities - b.stats.activities; return sortDir === 'asc' ? d : -d; }
      if (sortBy === 'donation')    { const d = a.stats.donation - b.stats.donation; return sortDir === 'asc' ? d : -d; }
      if (sortBy === 'lastLogin') {
        const ta = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
        const tb = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
        const d = ta - tb;
        return sortDir === 'asc' ? d : -d;
      }
      // default: 加入時間 desc
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return rows;
  }, [memberProfiles, lampRegistrations, bookings, donations, registrations, usersLastLogin, sortBy, sortDir]);

  // ── 可排序表頭 ──
  const SortTh = ({ col, label, align = 'left' }: { col: MemberSortKey; label: string; align?: 'left' | 'center' | 'right' }) => (
    <th
      className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-temple-red transition-colors whitespace-nowrap text-${align}`}
      onClick={() => handleSort(col)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : ''}`}>
        {label}
        {sortBy === col
          ? sortDir === 'asc'
            ? <ChevronUp className="w-3.5 h-3.5 text-temple-red" />
            : <ChevronDown className="w-3.5 h-3.5 text-temple-red" />
          : <ChevronsUpDown className="w-3.5 h-3.5 opacity-30" />}
      </span>
    </th>
  );

  // ── 已註冊會員詳情頁 ──
  if (selectedProfile) {
    const stats = selectedProfile.phone ? getStatsByPhone(selectedProfile.phone) : { lamps: 0, bookingCount: 0, activities: 0, donation: 0 };
    const lastLogin = usersLastLogin[selectedProfile.userId];
    return (
      <div>
        {/* 親友詳情 Modal */}
        {selectedContact && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelectedContact(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  <span className="text-xs bg-temple-red/10 text-temple-red px-2.5 py-1 rounded-full font-medium">{selectedContact.label}</span>
                  {selectedContact.name}
                </h3>
                <button onClick={() => setSelectedContact(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-2 text-sm">
                {selectedContact.gender && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">身份：</span>
                    {genderBadge(selectedContact.gender)}
                  </div>
                )}
                {selectedContact.phone && <p className="text-gray-600 flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{selectedContact.phone}</p>}
                {selectedContact.birthDate && <p className="text-gray-600">生日：{selectedContact.birthDate}</p>}
                {selectedContact.zodiac && <p className="text-gray-600">生肖：{selectedContact.zodiac}年</p>}
                {selectedContact.address && <p className="text-gray-600">地址：{selectedContact.address}</p>}
              </div>
            </div>
          </div>
        )}

        <button onClick={() => { setSelectedProfile(null); setProfileContacts([]); setSelectedContact(null); }}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> 返回會員列表
        </button>

        {/* 個人資料卡（詳細） */}
        <div className="bg-white rounded-xl border border-temple-gold/30 shadow-sm p-5 mb-5">
          <div className="flex flex-wrap items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-temple-red/10 rounded-full flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-temple-red" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                {selectedProfile.name || '（未填姓名）'}
                {selectedProfile.gender && <span className="text-xs bg-temple-red/10 text-temple-red px-2 py-0.5 rounded-full font-normal">{selectedProfile.gender}</span>}
                {selectedProfile.memberNumber && <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-normal">#{String(selectedProfile.memberNumber).padStart(3, '0')}</span>}
              </h2>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-gray-500">
                {selectedProfile.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{selectedProfile.phone}</span>}
                {selectedProfile.birthDate && <span>{selectedProfile.birthDate}</span>}
                {selectedProfile.zodiac && <span>{selectedProfile.zodiac}年</span>}
                {selectedProfile.address && <span>{selectedProfile.address}</span>}
              </div>
              <div className="flex flex-wrap gap-x-4 mt-1 text-xs text-gray-400">
                <span>{new Date(selectedProfile.createdAt).toLocaleDateString('zh-TW')} 加入</span>
                {lastLogin && <span>最後登入：{new Date(lastLogin).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}</span>}
              </div>
            </div>
          </div>
          <StatBadges lamps={stats.lamps} bookingCount={stats.bookingCount} activities={stats.activities} donation={stats.donation} />
        </div>

        {/* ── 歷史紀錄 ── */}
        {(() => {
          const phone = selectedProfile.phone ?? '';
          const myLamps      = lampRegistrations.filter(l => l.phone === phone);
          const myBookings   = bookings.filter(b => b.phone === phone);
          const myBlessings  = blessingRegistrations.filter(br => br.phone === phone);
          const myDonations  = donations.filter(d => d.phone === phone);

          const tabs: { key: typeof historyTab; label: string; count: number; icon: React.ReactNode }[] = [
            { key: 'lamp',     label: '點燈',   count: myLamps.length,     icon: <Flame className="w-3.5 h-3.5" /> },
            { key: 'blessing', label: '祈福',   count: myBlessings.length, icon: <Sparkles className="w-3.5 h-3.5" /> },
            { key: 'donation', label: '捐獻',   count: myDonations.length, icon: <HeartHandshake className="w-3.5 h-3.5" /> },
            { key: 'booking',  label: '問事',   count: myBookings.length,  icon: <BookOpen className="w-3.5 h-3.5" /> },
          ];

          return (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-temple-red" />
                <h3 className="font-semibold text-gray-700">服務歷史紀錄</h3>
              </div>

              {/* Tab Bar */}
              <div className="flex border-b border-gray-100 bg-gray-50/60">
                {tabs.map(t => (
                  <button key={t.key} type="button"
                    onClick={() => setHistoryTab(t.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-all border-b-2 ${
                      historyTab === t.key
                        ? 'border-temple-red text-temple-red bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}>
                    {t.icon}{t.label}
                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${historyTab === t.key ? 'bg-temple-red/10 text-temple-red' : 'bg-gray-200 text-gray-500'}`}>{t.count}</span>
                  </button>
                ))}
              </div>

              {/* 點燈 */}
              {historyTab === 'lamp' && (
                myLamps.length === 0
                  ? <p className="px-5 py-6 text-sm text-gray-400">尚無點燈紀錄</p>
                  : <div className="divide-y divide-gray-50">
                      {myLamps.map(l => {
                        const svcName = lampConfigs.find(c => c.id === l.serviceId)?.name ?? '（服務項目）';
                        return (
                          <div key={l.id} className="px-5 py-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{l.name}{l.contactLabel && <span className="ml-1.5 text-xs font-normal text-temple-red bg-temple-red/10 px-1.5 py-0.5 rounded-full">{l.contactLabel}</span>}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{svcName}{l.zodiac && ` ・ ${l.zodiac}年`}{l.address && ` ・ ${l.address}`}</p>
                              {l.notes && <p className="text-xs text-gray-400 mt-0.5">備註：{l.notes}</p>}
                              <p className="text-xs text-gray-300 mt-0.5">{fmtDate(l.createdAt)}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 pt-0.5">
                              {statusBadge(l.status)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
              )}

              {/* 問事 */}
              {historyTab === 'booking' && (
                myBookings.length === 0
                  ? <p className="px-5 py-6 text-sm text-gray-400">尚無問事紀錄</p>
                  : <div className="divide-y divide-gray-50">
                      {myBookings.map(b => (
                        <div key={b.id} className="px-5 py-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{b.name}{b.contactLabel && <span className="ml-1.5 text-xs font-normal text-temple-red bg-temple-red/10 px-1.5 py-0.5 rounded-full">{b.contactLabel}</span>}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{b.type} ・ 預約 {b.bookingDate} {b.bookingTime === 'evening' ? '晚上' : b.bookingTime}</p>
                            {b.zodiac && <p className="text-xs text-gray-400 mt-0.5">{b.zodiac}年{b.address && ` ・ ${b.address}`}</p>}
                            {b.notes && <p className="text-xs text-gray-400 mt-0.5">備註：{b.notes}</p>}
                            <p className="text-xs text-gray-300 mt-0.5">{fmtDate(b.createdAt)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 pt-0.5">
                            {statusBadge(b.status)}
                          </div>
                        </div>
                      ))}
                    </div>
              )}

              {/* 法會 */}
              {historyTab === 'blessing' && (
                myBlessings.length === 0
                  ? <p className="px-5 py-6 text-sm text-gray-400">尚無法會報名紀錄</p>
                  : <div className="divide-y divide-gray-50">
                      {myBlessings.map(br => {
                        const evtTitle = blessingEvents.find(e => e.id === br.eventId)?.title ?? '（活動）';
                        return (
                          <div key={br.id} className="px-5 py-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{br.name}</p>
                              <p className="text-xs text-amber-700 font-medium mt-0.5">{evtTitle}</p>
                              {br.packageName && <p className="text-xs text-gray-500 mt-0.5">方案：{br.packageName}{br.packageFee != null ? ` NT$${br.packageFee.toLocaleString()}` : ''}</p>}
                              {br.zodiac && <p className="text-xs text-gray-400 mt-0.5">{br.zodiac}年{br.address && ` ・ ${br.address}`}</p>}
                              {br.notes && <p className="text-xs text-gray-400 mt-0.5">備註：{br.notes}</p>}
                              <p className="text-xs text-gray-300 mt-0.5">{fmtDate(br.createdAt)}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 pt-0.5">
                              {statusBadge(br.status)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
              )}

              {/* 捐獻 */}
              {historyTab === 'donation' && (
                myDonations.length === 0
                  ? <p className="px-5 py-6 text-sm text-gray-400">尚無捐獻紀錄</p>
                  : <div className="divide-y divide-gray-50">
                      {myDonations.map(d => (
                        <div key={d.id} className="px-5 py-3 flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{d.name}{d.contactLabel && <span className="ml-1.5 text-xs font-normal text-temple-red bg-temple-red/10 px-1.5 py-0.5 rounded-full">{d.contactLabel}</span>}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{d.type}</p>
                            {d.notes && <p className="text-xs text-gray-400 mt-0.5">備註：{d.notes}</p>}
                            <p className="text-xs text-gray-300 mt-0.5">{fmtDate(d.createdAt)}</p>
                          </div>
                          <p className="text-base font-bold text-green-700 shrink-0">NT${Number(d.amount).toLocaleString()}</p>
                        </div>
                      ))}
                      <div className="px-5 py-3 bg-green-50 flex items-center justify-between">
                        <span className="text-sm font-semibold text-green-700">總捐獻金額</span>
                        <span className="text-lg font-bold text-green-700">NT${myDonations.reduce((s, d) => s + Number(d.amount), 0).toLocaleString()}</span>
                      </div>
                    </div>
              )}
            </div>
          );
        })()}

        {/* 親友通訊錄（列表只顯示統計，點進去看個資） */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <BookUser className="w-4 h-4 text-temple-red" />
            <h3 className="font-semibold text-gray-700">親友通訊錄
              {!contactsLoading && <span className="ml-1.5 text-xs font-normal text-gray-400">{profileContacts.length} 筆</span>}
            </h3>
          </div>
          {contactsLoading ? (
            <p className="px-5 py-6 text-sm text-gray-400">載入中…</p>
          ) : profileContacts.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400">尚未建立通訊錄</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {profileContacts.map(c => {
                const cStats = selectedProfile.phone ? getContactStats(selectedProfile.phone, c.name) : { lamps: 0, bookingCount: 0, activities: 0, donation: 0 };
                return (
                  <button key={c.id} type="button" onClick={() => setSelectedContact(c)}
                    className="w-full px-5 py-3 flex items-center gap-3 hover:bg-temple-bg/60 transition-all text-left">
                    <span className="text-xs bg-temple-red/10 text-temple-red px-2.5 py-1 rounded-full font-medium shrink-0">{c.label}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                        {genderBadge(c.gender)}
                      </div>
                      <div className="mt-1">
                        <StatBadges lamps={cStats.lamps} bookingCount={cStats.bookingCount} activities={cStats.activities} donation={cStats.donation} />
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 列表頁（排序表格） ──
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="text-xl font-bold text-gray-800">
          會員管理
          <span className="ml-2 text-sm font-normal text-gray-400">{memberProfiles.length} 位</span>
        </h2>
      </div>

      {memberProfiles.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-gray-400 text-sm">
          尚無已註冊會員
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-temple-gold/30 overflow-hidden">
          <div className="px-5 py-3 bg-temple-gold/10 border-b border-temple-gold/20 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-temple-red" />
            <h3 className="font-semibold text-temple-dark text-sm">已註冊會員帳號</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="admin-table w-full min-w-[640px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">編號</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">姓名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">性別</th>
                  <SortTh col="lamps"      label="點燈"   align="center" />
                  <SortTh col="activities" label="祈福"   align="center" />
                  <SortTh col="donation"   label="捐獻"   align="right" />
                  <SortTh col="bookings"   label="問事"   align="center" />
                  <SortTh col="lastLogin"  label="最後登入" align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedProfiles.map(p => (
                  <tr key={p.userId}
                    onClick={async () => {
                      setSelectedProfile(p); setContactsLoading(true);
                      try { setProfileContacts(await getMemberContactsByUserId(p.userId)); }
                      catch { setProfileContacts([]); }
                      finally { setContactsLoading(false); }
                    }}
                    className="cursor-pointer hover:bg-temple-bg/60 transition-all group"
                  >
                    <td data-label="編號" className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-400">
                        {p.memberNumber ? `#${String(p.memberNumber).padStart(3, '0')}` : '—'}
                      </span>
                    </td>
                    <td data-label="姓名" className="px-4 py-3">
                      <span className="text-sm font-semibold text-gray-800 group-hover:text-temple-red transition-colors">
                        {p.name || <span className="text-gray-400 font-normal italic">（未填）</span>}
                      </span>
                    </td>
                    <td data-label="性別" className="px-4 py-3">
                      {p.gender
                        ? <span className="text-xs bg-temple-red/10 text-temple-red px-2 py-0.5 rounded-full">{p.gender}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td data-label="點燈" className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-amber-700 text-sm font-medium">
                        <Flame className="w-3.5 h-3.5" />{p.stats.lamps}
                      </span>
                    </td>
                    <td data-label="祈福" className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-blue-700 text-sm font-medium">
                        <Sparkles className="w-3.5 h-3.5" />{p.stats.activities}
                      </span>
                    </td>
                    <td data-label="捐獻" className="px-4 py-3 text-right text-sm">
                      {p.stats.donation > 0
                        ? <span className="text-green-700 font-medium">NT${p.stats.donation.toLocaleString()}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td data-label="問事" className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-purple-700 text-sm font-medium">
                        <BookOpen className="w-3.5 h-3.5" />{p.stats.bookingCount}
                      </span>
                    </td>
                    <td data-label="最後登入" className="px-4 py-3 text-right text-xs text-gray-400 whitespace-nowrap">
                      {p.lastLogin
                        ? new Date(p.lastLogin).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })
                        : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};


// ─── Analytics Tab (追蹤碼設定) ────────────────────────────────────────────────

const AnalyticsTab = () => {
  const [form, setForm] = useState<AnalyticsSettings>({ ga4Id: '', metaPixelId: '', gtmId: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getAnalyticsSettings().then(s => { setForm(s); setLoading(false); });
  }, []);

  // 只收編號、不收整段程式碼：後台若能貼任意 <script>，帳號一被盜就能對所有訪客植入惡意腳本
  const fields: Array<{ key: keyof AnalyticsSettings; label: string; placeholder: string; hint: string; valid: (v: string) => boolean }> = [
    { key: 'ga4Id', label: 'GA4 評估 ID', placeholder: 'G-XXXXXXXXXX', hint: '在 GA4 後台「管理 → 資料串流」可看到，開頭是 G-', valid: isValidGa4 },
    { key: 'metaPixelId', label: 'Meta 像素 ID', placeholder: '1052685297347380', hint: '在 Meta 事件管理工具可看到，是一串 15-16 位數字', valid: isValidPixel },
    { key: 'gtmId', label: 'GTM 容器 ID', placeholder: 'GTM-XXXXXXX', hint: '在代碼管理工具右上角，開頭是 GTM-。若已用 GTM 掛 GA4 或像素，上面兩欄就請留空', valid: isValidGtm },
  ];

  const invalid = fields.filter(f => form[f.key].trim() !== '' && !f.valid(form[f.key]));

  const handleSave = async () => {
    if (invalid.length > 0) return alert('以下欄位格式不正確：\n' + invalid.map(f => f.label).join('\n'));
    setSaving(true);
    try {
      await saveAnalyticsSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert('儲存失敗，請再試一次');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-400">載入中…</p>;

  const bothGtmAndDirect = isValidGtm(form.gtmId) && (isValidGa4(form.ga4Id) || isValidPixel(form.metaPixelId));

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-gray-800 mb-1">追蹤碼設定</h2>
      <p className="text-sm text-gray-500 mb-6">
        填入編號即可，不必貼整段程式碼——網站會自動用官方標準寫法載入。留空代表不啟用。
      </p>

      {bothGtmAndDirect && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <strong>注意可能重複計算：</strong>你同時填了 GTM 與 GA4／Meta 像素。
          如果 GA4 或像素已經掛在 GTM 容器裡面，同一次瀏覽會被記錄兩次，數據會灌水。
          請擇一：<u>要嘛只填 GTM（在 GTM 裡設定 GA4 與像素）</u>，要嘛只填 GA4 與像素兩欄。
        </div>
      )}

      <div className="space-y-5">
        {fields.map(f => {
          const val = form[f.key];
          const bad = val.trim() !== '' && !f.valid(val);
          return (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input
                type="text"
                value={val}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className={`w-full px-4 py-2.5 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 ${
                  bad ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-temple-red/20 focus:border-temple-red'
                }`}
              />
              <p className={`text-xs mt-1 ${bad ? 'text-red-500' : 'text-gray-400'}`}>
                {bad ? `格式不正確，應為 ${f.placeholder} 這樣的形式` : f.hint}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-temple-red text-white rounded-xl text-sm font-medium hover:bg-[#5C1A04] disabled:opacity-50 transition-colors"
        >
          {saving ? '儲存中…' : '儲存設定'}
        </button>
        {saved && <span className="text-sm text-green-600">已儲存，重新整理前台即可生效</span>}
      </div>

      <div className="mt-8 p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 leading-relaxed">
        <p className="font-medium text-gray-600 mb-1">說明</p>
        <p>· 後台頁面本身不計入流量統計（那是內部作業，不是訪客行為）。</p>
        <p>· 網站是單頁式的，切換到問事、點燈等分頁時會自動補送一次瀏覽事件，報表才看得到各分頁的流量。</p>
        <p>· 追蹤碼是在網站載入後才向資料庫取得設定並掛上，會比寫死在原始碼慢幾百毫秒，統計數字可能與平台官方數據有極小差距，屬正常。</p>
      </div>
    </div>
  );
};

// ─── Social Tab (社群帳號設定) ─────────────────────────────────────────────────

const SocialTab = () => {
  const empty: SocialSettings = { lineUrl: '', facebookUrl: '', facebookGroupUrl: '', instagramUrl: '', tiktokUrl: '' };
  const [form, setForm] = useState<SocialSettings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSocialSettings().then(s => { setForm(s); setLoading(false); });
  }, []);

  const hints: Record<keyof SocialSettings, string> = {
    lineUrl: '官方帳號的分享連結，例如 https://lin.ee/xxxxxxx。清空則前台的 LINE 圖示與右下角浮動按鈕都不顯示',
    facebookUrl: '粉絲專頁網址，例如 https://www.facebook.com/xxxxxxxxx',
    facebookGroupUrl: '社團網址，例如 https://www.facebook.com/groups/xxxxxxxxx',
    instagramUrl: 'IG 個人檔案網址，例如 https://www.instagram.com/xxxxxxx',
    tiktokUrl: '抖音／TikTok 個人檔案網址，例如 https://www.tiktok.com/@xxxxxxx',
  };

  // 只擋明顯錯誤（沒有 http 開頭）。各平台網址格式常改版，寫死太細反而擋掉合法網址。
  const badUrl = (v: string): boolean => v.trim() !== '' && !/^https?:\/\/.+/i.test(v.trim());
  const invalid = SOCIAL_KEYS.filter(k => badUrl(form[k.field]));

  const handleSave = async () => {
    if (invalid.length > 0) return alert('以下網址要以 http:// 或 https:// 開頭：\n' + invalid.map(k => k.label).join('\n'));
    setSaving(true);
    try {
      await saveSocialSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert('儲存失敗，請再試一次');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-400">載入中…</p>;

  const shownCount = SOCIAL_KEYS.filter(k => form[k.field].trim() !== '').length;

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-gray-800 mb-1">社群帳號設定</h2>
      <p className="text-sm text-gray-500 mb-6">
        填入完整網址就會顯示在前台（首頁左側與頁尾）；<strong>留空的平台不會出現</strong>，不會留下空位或死連結。
      </p>

      <div className="space-y-5">
        {SOCIAL_KEYS.map(k => {
          const val = form[k.field];
          const bad = badUrl(val);
          return (
            <div key={k.field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {k.label}
                {val.trim() === '' && <span className="ml-2 text-xs text-gray-400 font-normal">（留空＝不顯示）</span>}
              </label>
              <input
                type="text"
                value={val}
                onChange={e => setForm({ ...form, [k.field]: e.target.value })}
                placeholder="https://"
                className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 ${
                  bad ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-temple-red/20 focus:border-temple-red'
                }`}
              />
              <p className={`text-xs mt-1 ${bad ? 'text-red-500' : 'text-gray-400'}`}>
                {bad ? '網址要以 http:// 或 https:// 開頭' : hints[k.field]}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-temple-red text-white rounded-xl text-sm font-medium hover:bg-[#5C1A04] disabled:opacity-50 transition-colors"
        >
          {saving ? '儲存中…' : '儲存設定'}
        </button>
        {saved && <span className="text-sm text-green-600">已儲存，重新整理前台即可生效</span>}
        <span className="text-sm text-gray-400 ml-auto">目前會顯示 {shownCount} 個平台</span>
      </div>
    </div>
  );
};

// ─── Bulletins Tab (公佈欄管理) ────────────────────────────────────────────────

const BulletinsTab = ({ bulletins, onRefresh }: { bulletins: BulletinRecord[]; onRefresh: () => void }) => {
  const emptyForm: BulletinData = {
    title: '', content: '', category: BulletinCategory.GENERAL,
    isPinned: false, publishAt: null, linkedService: null, imageUrl: null,
  };
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BulletinData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const filtered = bulletins.filter(b =>
    b.title.includes(search) || b.content.includes(search) || b.category.includes(search)
  );

  useEffect(() => { setPage(0); }, [search]);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (b: BulletinRecord) => {
    setEditingId(b.id);
    setForm({
      title: b.title,
      content: b.content,
      category: b.category as BulletinCategory,
      isPinned: b.isPinned,
      publishAt: b.publishAt ?? null,
      linkedService: b.linkedService ?? null,
      imageUrl: b.imageUrl ?? null,
    });
    setShowModal(true);
  };

  const handleImagePick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('請選擇圖片檔');
    // 上傳前會自動縮到長邊 1600px，所以這裡放寬到 20MB 只擋離譜的檔案
    if (file.size > 20 * 1024 * 1024) return alert('圖片請小於 20MB');
    setUploading(true);
    try {
      const url = await uploadBulletinImage(file);
      setForm(f => ({ ...f, imageUrl: url }));
    } catch {
      alert('照片上傳失敗，請再試一次');
    } finally {
      setUploading(false);
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
    if (cat === '點燈公告') return 'bg-orange-100 text-orange-700';
    if (cat === '祈福公告') return 'bg-purple-100 text-purple-700';
    if (cat === '問事公告') return 'bg-blue-100 text-blue-700';
    if (cat === '捐獻公告') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-600';
  };

  const serviceLabel: Record<string, string> = {
    lamp: '點燈', blessing: '祈福', booking: '問事', donation: '捐獻',
  };

  const publishStatus = (b: BulletinRecord) => {
    if (!b.publishAt) return null;
    const pub = new Date(b.publishAt);
    if (pub > new Date()) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
          <Clock className="w-3 h-3" />
          {pub.toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} 排程
        </span>
      );
    }
    return null;
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
          className="flex items-center gap-2 px-4 py-2.5 bg-temple-red text-white rounded-xl text-sm font-medium hover:bg-[#5C1A04] transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> 新增公告
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="admin-table w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3 text-left">標題</th>
              <th className="px-5 py-3 text-left">分類</th>
              <th className="px-5 py-3 text-left">發布狀態</th>
              <th className="px-5 py-3 text-center">置頂</th>
              <th className="px-5 py-3 text-center">連結服務</th>
              <th className="px-5 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">尚無公告</td></tr>
            ) : paged.map(b => (
              <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                <td data-label="標題" className="px-5 py-4 font-medium text-gray-800">
                  <div className="flex items-center gap-3">
                    {b.imageUrl && (
                      <div className="h-9 flex items-center shrink-0">
                        <img src={b.imageUrl} alt="" className="max-h-9 max-w-12 w-auto h-auto rounded-md" />
                      </div>
                    )}
                    <span>{b.title}</span>
                  </div>
                </td>
                <td data-label="分類" className="px-5 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${categoryColor(b.category)}`}>{b.category}</span>
                </td>
                <td data-label="發布狀態" className="px-5 py-4 text-gray-500">
                  {publishStatus(b) ?? <span className="text-xs text-green-600">已發布</span>}
                  <div className="text-xs text-gray-400 mt-0.5">{fmtDate(b.createdAt)}</div>
                </td>
                <td data-label="置頂" className="px-5 py-4 text-center">
                  <button onClick={() => handleTogglePin(b)}
                    className={`p-1.5 rounded-lg transition-colors ${b.isPinned ? 'text-temple-gold hover:bg-yellow-50' : 'text-gray-300 hover:bg-gray-100'}`}>
                    {b.isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                  </button>
                </td>
                <td data-label="連結服務" className="px-5 py-4 text-center">
                  {b.linkedService ? (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${categoryColor(b.category)}`}>
                      {serviceLabel[b.linkedService] ?? b.linkedService}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td data-label="操作" className="px-5 py-4 text-center">
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
        <Paginator total={filtered.length} page={page} onChange={setPage} />
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  活動照片 <span className="text-gray-400 font-normal">（選填）</span>
                </label>
                {form.imageUrl ? (
                  <div className="flex items-start gap-3">
                    {/* 廟方就是在這裡確認照片，裁切的話等於看不到自己傳了什麼。
                        給上限不給固定值，直式與橫式都完整呈現。 */}
                    <img src={form.imageUrl} alt="活動照片" className="max-h-40 max-w-40 w-auto h-auto rounded-xl" />
                    <div className="flex flex-col gap-2">
                      <label className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer text-center">
                        更換照片
                        <input type="file" accept="image/*" className="hidden"
                          onChange={e => { handleImagePick(e.target.files?.[0]); e.target.value = ''; }} />
                      </label>
                      <button type="button" onClick={() => setForm({ ...form, imageUrl: null })}
                        className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
                        移除照片
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className={`flex items-center justify-center gap-2 w-full px-4 py-6 border-2 border-dashed rounded-xl text-sm cursor-pointer transition-colors ${
                    uploading ? 'border-gray-200 text-gray-400' : 'border-gray-300 text-gray-500 hover:border-temple-red/50 hover:text-temple-red'
                  }`}>
                    {uploading ? '處理中…' : '點此選擇活動照片（會自動縮小）'}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading}
                      onChange={e => { handleImagePick(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                )}
                <p className="text-xs text-gray-400 mt-1">照片會顯示在「最新活動」的公告卡片上</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  連結服務 <span className="text-gray-400 font-normal">（選填）</span>
                </label>
                <select value={form.linkedService ?? ''} onChange={e => setForm({...form, linkedService: (e.target.value || null) as BulletinData['linkedService']})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red">
                  <option value="">無連結</option>
                  <option value="lamp">點燈</option>
                  <option value="blessing">祈福</option>
                  <option value="booking">問事</option>
                  <option value="donation">捐獻</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">設定後，信眾展開公告時可直接點擊按鈕前往該服務登記表單</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  定時發布 <span className="text-gray-400 font-normal">（選填，留空 = 立即發布）</span>
                </label>
                <input type="datetime-local"
                  value={form.publishAt ? form.publishAt.slice(0, 16) : ''}
                  onChange={e => setForm({...form, publishAt: e.target.value || null})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.isPinned} onChange={e => setForm({...form, isPinned: e.target.checked})}
                  className="w-4 h-4 text-temple-red rounded border-gray-300 focus:ring-temple-red" />
                <span className="text-sm text-gray-700">置頂公告</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">取消</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-temple-red text-white text-sm font-medium rounded-lg hover:bg-[#5C1A04] transition-colors disabled:opacity-50">
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

// ─── Deities Tab (神明管理) ──────────────────────────────────────────────────────

const DeitiesTab = ({ deities, halls, onRefresh }: { deities: DeityRecord[]; halls: HallRecord[]; onRefresh: () => void }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DeityData>({ name: '', title: '', description: '', imagePath: null, displayOrder: 0, isVisible: true, hallId: null });
  // ── Hall management ──
  const [newHallName, setNewHallName] = useState('');
  const [addingHall, setAddingHall] = useState(false);
  const [editingHallId, setEditingHallId] = useState<string | null>(null);
  const [editingHallName, setEditingHallName] = useState('');
  const [savingHall, setSavingHall] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Drag sort ──
  const sortedDeities = useMemo(() => [...deities].sort((a, b) => a.displayOrder - b.displayOrder), [deities]);
  const { localItems: localDeities, draggingId: dDragId, overIndex: dOverIdx, isSaving: dSaving,
          onDragStart: dDragStart, onDragOver: dDragOver, onDrop: dDrop, onDragEnd: dDragEnd, move: dMove,
  } = useDragSort(sortedDeities, async (sorted) => {
    await Promise.all(sorted.map((d, i) => updateDeity(d.id, { displayOrder: i + 1 })));
    onRefresh();
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', title: '', description: '', imagePath: null, displayOrder: deities.length + 1, isVisible: true, hallId: null });
    setImageFile(null);
    setImagePreview(null);
    setShowModal(true);
  };

  const handleToggleVisible = async (d: DeityRecord) => {
    setTogglingId(d.id);
    try {
      await updateDeity(d.id, { isVisible: !d.isVisible });
      onRefresh();
    } catch { alert('操作失敗'); }
    finally { setTogglingId(null); }
  };

  const openEdit = (d: DeityRecord) => {
    setEditingId(d.id);
    setForm({ name: d.name, title: d.title, description: d.description, imagePath: d.imagePath, displayOrder: d.displayOrder, isVisible: d.isVisible, hallId: d.hallId ?? null });
    setImageFile(null);
    setImagePreview(d.imagePath ? getSiteImagePublicUrl(d.imagePath) : null);
    setShowModal(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 20 * 1024 * 1024) { alert('圖片大小不能超過 20MB'); return; } // 上傳前會自動縮圖
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

  const handleAddHall = async () => {
    if (!newHallName.trim()) return;
    setSavingHall(true);
    try {
      await createDeityHall({ name: newHallName.trim(), displayOrder: halls.length + 1 });
      setNewHallName('');
      setAddingHall(false);
      onRefresh();
    } catch { alert('新增失敗'); }
    finally { setSavingHall(false); }
  };

  const handleUpdateHall = async (id: string) => {
    if (!editingHallName.trim()) return;
    setSavingHall(true);
    try {
      await updateDeityHall(id, { name: editingHallName.trim() });
      setEditingHallId(null);
      onRefresh();
    } catch { alert('更新失敗'); }
    finally { setSavingHall(false); }
  };

  const handleDeleteHall = async (id: string, name: string) => {
    if (!confirm(`確定要刪除「${name}」殿？所有屬於此殿的神明將改為「未分殿」。`)) return;
    try {
      await deleteDeityHall(id);
      onRefresh();
    } catch { alert('刪除失敗'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">神明管理</h3>
          <p className="text-sm text-gray-500">管理前台「神明介紹」區塊的神明資料。</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-temple-red text-white rounded-xl text-sm font-medium hover:bg-[#5C1A04] transition-colors">
          <Plus className="w-4 h-4" /> 新增神明
        </button>
      </div>

      {/* 殿管理 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">殿管理</h4>
          {!addingHall && (
            <button onClick={() => setAddingHall(true)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-temple-red/10 text-temple-red rounded-lg hover:bg-temple-red/20 transition-colors">
              <Plus className="w-3 h-3" /> 新增殿
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {halls.map(h => (
            <div key={h.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
              {editingHallId === h.id ? (
                <>
                  <input autoFocus value={editingHallName} onChange={e => setEditingHallName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleUpdateHall(h.id); if (e.key === 'Escape') setEditingHallId(null); }}
                    className="text-sm border border-gray-300 rounded px-2 py-0.5 w-24 focus:outline-none focus:ring-1 focus:ring-temple-red/40" />
                  <button onClick={() => handleUpdateHall(h.id)} disabled={savingHall}
                    className="text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-40">確認</button>
                  <button onClick={() => setEditingHallId(null)} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
                </>
              ) : (
                <>
                  <span className="text-sm text-gray-700">{h.name}</span>
                  <button onClick={() => { setEditingHallId(h.id); setEditingHallName(h.name); }}
                    className="text-gray-400 hover:text-blue-500 transition-colors"><Edit2 className="w-3 h-3" /></button>
                  <button onClick={() => handleDeleteHall(h.id, h.name)}
                    className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                </>
              )}
            </div>
          ))}
          {halls.length === 0 && !addingHall && (
            <p className="text-xs text-gray-400">尚未建立任何殿，點擊「新增殿」開始建立</p>
          )}
          {addingHall && (
            <div className="flex items-center gap-2">
              <input autoFocus value={newHallName} onChange={e => setNewHallName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddHall(); if (e.key === 'Escape') setAddingHall(false); }}
                placeholder="殿名稱" className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-32 focus:outline-none focus:ring-1 focus:ring-temple-red/40" />
              <button onClick={handleAddHall} disabled={savingHall || !newHallName.trim()}
                className="text-xs px-3 py-1.5 bg-temple-red text-white rounded-lg hover:bg-[#5C1A04] disabled:opacity-40 transition-colors">新增</button>
              <button onClick={() => { setAddingHall(false); setNewHallName(''); }}
                className="text-xs text-gray-400 hover:text-gray-600">取消</button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {dSaving && <div className="px-6 py-2 bg-blue-50 text-blue-600 text-xs flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> 儲存排序中…</div>}
        <table className="admin-table w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-3 py-3 w-8"></th>
              <th className="px-6 py-3 text-left">圖片</th>
              <th className="px-6 py-3 text-left">名稱</th>
              <th className="px-6 py-3 text-left">殿</th>
              <th className="px-6 py-3 text-left">尊稱</th>
              <th className="px-6 py-3 text-left">介紹</th>
              <th className="px-6 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {localDeities.map((d, idx) => (
              <tr key={d.id}
                draggable
                onDragStart={() => dDragStart(d.id, idx)}
                onDragOver={(e) => dDragOver(e, idx)}
                onDrop={() => dDrop(idx)}
                onDragEnd={dDragEnd}
                className={`transition-colors select-none ${!d.isVisible ? 'opacity-50' : ''} ${dDragId === d.id ? 'opacity-30 bg-gray-50' : ''} ${dOverIdx === idx && dDragId !== d.id ? 'border-t-2 border-temple-red' : 'hover:bg-gray-50'}`}>
                <td className="px-3 py-4 text-gray-300 lg:cursor-grab lg:active:cursor-grabbing">
                  <GripVertical className="w-4 h-4 hidden lg:block" />
                  {/* 手機沒有拖拉：HTML5 的 drag 事件在觸控裝置不會觸發，改用上下鍵搬移 */}
                  <div className="flex items-center gap-1 lg:hidden">
                    <button type="button" onClick={() => dMove(idx, -1)} disabled={idx === 0}
                      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30" aria-label="上移">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => dMove(idx, 1)} disabled={idx === localDeities.length - 1}
                      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30" aria-label="下移">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </td>
                <td data-label="圖片" className="px-6 py-4">
                  {/* 整張縮小、不裁切（廟方 2026-09-20 要求）。**不加底色框**：先前用灰底直式框
                      裝縮小的照片，照片比例一不同就露出上下兩截灰邊，廟方說像藥丸。
                      改成照片本身依比例縮到 64px 高以內，外層只固定列高讓各列對齊。 */}
                  {d.imagePath ? (
                    <div className="h-16 flex items-center">
                      <img src={getSiteImagePublicUrl(d.imagePath)} alt={d.name} className="max-h-16 max-w-16 w-auto h-auto rounded-md" />
                    </div>
                  ) : (
                    <div className="w-12 h-16 rounded-lg bg-gray-100 flex items-center justify-center"><Flame className="w-5 h-5 text-gray-300" /></div>
                  )}
                </td>
                <td data-label="名稱" className="px-6 py-4 font-medium text-gray-800">
                  {d.name}
                  {!d.isVisible && <span className="ml-2 text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">已隱藏</span>}
                </td>
                <td data-label="殿" className="px-6 py-4 text-gray-500">
                  {d.hallId ? (halls.find(h => h.id === d.hallId)?.name ?? '-') : '-'}
                </td>
                <td data-label="尊稱" className="px-6 py-4 text-gray-500">{d.title || '-'}</td>
                <td data-label="介紹" className="px-6 py-4 text-gray-500 max-w-xs truncate">{d.description}</td>
                <td data-label="操作" className="px-6 py-4 text-right flex items-center justify-end gap-3">
                  <button onClick={() => handleToggleVisible(d)} disabled={togglingId === d.id}
                    title={d.isVisible ? '點擊隱藏' : '點擊顯示'}
                    className={`transition-colors disabled:opacity-40 ${d.isVisible ? 'text-gray-400 hover:text-orange-500' : 'text-orange-500 hover:text-gray-400'}`}>
                    {d.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit(d)} className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(d.id, d.name)} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {deities.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">尚無神明資料</td></tr>
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
              {halls.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">所屬殿</label>
                  <select value={form.hallId || ''} onChange={e => setForm({ ...form, hallId: e.target.value || null })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none text-sm bg-white">
                    <option value="">— 不指定殿 —</option>
                    {halls.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}
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
                <label className="flex items-baseline justify-between text-sm font-medium text-gray-700 mb-1">
                  <span>介紹 *</span>
                  {/* 前台卡片可完整顯示約 60 字，超過會被截斷，所以把字數顯示出來 */}
                  <span className={`text-xs font-normal ${form.description.length > 60 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {form.description.length} / 60 字
                  </span>
                </label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={6}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none resize-y" placeholder="神明介紹文字（前台卡片約可顯示 60 字）" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">圖片</label>
                {imagePreview ? (
                  <div className="flex items-start gap-3 mb-2">
                    {/* 整張縮小預覽、不裁切、不加底色框（廟方 2026-09-20 要求，理由同列表縮圖）。
                        這裡原本刻意模擬前台 3:4 的裁切結果；改成完整顯示後，前台會裁的事
                        改用文字說明，別讓廟方以為前台也是整張。 */}
                    <div className="relative shrink-0">
                      <img src={imagePreview} alt="Preview" className="max-h-40 max-w-40 w-auto h-auto rounded-xl" />
                      <button onClick={() => { setImageFile(null); setImagePreview(null); setForm({ ...form, imagePath: null }); }}
                        className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-1 hover:bg-black/80" aria-label="移除圖片"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      左側為整張照片縮小預覽。<br />
                      前台神尊卡片是 3:4 直式，比例不同的照片會裁掉超出的部分，建議上傳直式照片。
                    </p>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-32 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-temple-red/40 transition-colors">
                    <Upload className="w-6 h-6 text-gray-300 mb-1" />
                    <span className="text-sm text-gray-500">點擊上傳圖片</span>
                    <span className="text-xs text-gray-400 mt-1">建議尺寸：600 × 800 px（直式）</span>
                    <span className="text-xs text-gray-300">JPG、PNG、WebP・上傳後會自動縮小</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                  </label>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isVisible} onChange={e => setForm({ ...form, isVisible: e.target.checked })}
                  className="w-4 h-4 accent-temple-red rounded border-gray-300 focus:ring-temple-red" />
                <span className="text-sm text-gray-700">顯示於前台</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} disabled={saving}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">取消</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.description.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-temple-red text-white text-sm font-medium rounded-lg hover:bg-[#5C1A04] transition-colors disabled:opacity-50">
                <Save className="w-4 h-4" />
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
        <label className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors ${uploading ? 'bg-gray-100 text-gray-400' : 'bg-temple-red text-white hover:bg-[#5C1A04]'}`}>
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
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-temple-red text-white rounded-xl text-sm font-medium hover:bg-[#5C1A04] transition-colors disabled:opacity-50">
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

// 由環境變數推導，避免專案搬遷時圖片 404
const SCRIPTURE_STORAGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/site-images`;

const ScriptureTab = ({ verses, onRefresh }: { verses: ScriptureVerseRecord[]; onRefresh: () => void }) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
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

  useEffect(() => { setPage(0); }, [search]);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
        <table className="admin-table w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium w-20">插圖</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">經文</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">註解</th>
              <th className="text-center px-4 py-3 text-gray-500 font-medium w-20">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paged.map(v => (
              <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                <td data-label="插圖" className="px-4 py-3">
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
                <td data-label="經文" className="px-4 py-3 text-gray-700 max-w-[200px]">
                  <p className="truncate">{v.verse.replace(/\n/g, ' ')}</p>
                </td>
                <td data-label="註解" className="px-4 py-3 text-gray-500 max-w-[300px]">
                  <p className="truncate">{v.annotation.substring(0, 50)}...</p>
                </td>
                <td data-label="操作" className="px-4 py-3 text-center">
                  <button
                    onClick={() => openEdit(v)}
                    className="p-1.5 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
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
        <Paginator total={filtered.length} page={page} onChange={setPage} />
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
              <button onClick={closeEdit} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm text-white bg-temple-red rounded-lg hover:bg-[#5C1A04] transition-colors disabled:opacity-50"
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
  configs, registrations, onRefresh, memberProfiles,
}: {
  configs: LampServiceConfig[];
  registrations: LampRegistrationRecord[];
  onRefresh: () => void;
  memberProfiles: MemberProfileRecord[];
}) => {
  const [view, setView] = useState<'configs' | 'registrations'>('configs');
  const [quickView, setQuickView] = useState<RegViewItem | null>(null);

  // ── Service config state ──
  const [editingConfig, setEditingConfig] = useState<LampServiceConfig | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState<LampServiceConfigData>({ name: '', fee: 0, description: '', imageUrl: '', isActive: true, displayOrder: 0 });
  const [savingConfig, setSavingConfig] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingLampImg, setUploadingLampImg] = useState(false);

  // ── Registration state ──
  const [regSearch, setRegSearch] = useState('');
  const [regServiceFilter, setRegServiceFilter] = useState('');
  const [regStatusFilter, setRegStatusFilter] = useState('');
  const [updatingRegId, setUpdatingRegId] = useState<string | null>(null);
  const [regPage, setRegPage] = useState(0);

  // ── Drag sort for configs ──
  const sortedConfigs = useMemo(() => [...configs].sort((a, b) => a.displayOrder - b.displayOrder), [configs]);
  const { localItems: localConfigs, draggingId: cDragId, overIndex: cOverIdx, isSaving: cSaving,
          onDragStart: cDragStart, onDragOver: cDragOver, onDrop: cDrop, onDragEnd: cDragEnd, move: cMove,
  } = useDragSort(sortedConfigs, async (sorted) => {
    await Promise.all(sorted.map((c, i) => updateLampServiceConfig(c.id, { displayOrder: i + 1 })));
    onRefresh();
  });

  // ── Config helpers ──
  const openAddConfig = () => {
    setEditingConfig(null);
    setConfigForm({ name: '', fee: 0, description: '', imageUrl: '', isActive: true, displayOrder: configs.length });
    setShowConfigModal(true);
  };

  const openEditConfig = (c: LampServiceConfig) => {
    setEditingConfig(c);
    setConfigForm({ name: c.name, fee: c.fee, description: c.description, imageUrl: c.imageUrl || '', isActive: c.isActive, displayOrder: c.displayOrder });
    setShowConfigModal(true);
  };

  const handleLampImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLampImg(true);
    try {
      const url = await uploadLampImage(file);
      setConfigForm(f => ({ ...f, imageUrl: url }));
    } catch { alert('圖片上傳失敗，請稍後再試'); }
    finally { setUploadingLampImg(false); e.target.value = ''; }
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

  useEffect(() => { setRegPage(0); }, [regSearch, regServiceFilter, regStatusFilter]);
  const pagedRegs = filteredRegs.slice(regPage * PAGE_SIZE, (regPage + 1) * PAGE_SIZE);

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
      getServiceName(r.serviceId), r.name, r.phone, r.gender || '', r.birthDate, r.zodiac || '', r.address || '',
      r.status, r.notes || '', fmtDate(r.createdAt), r.source || ''
    ]), ['服務項目', '姓名', '電話', '性別', '農曆生日', '生肖', '現居地址', '狀態', '備註', '建立時間', '報名來源']);
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
              className="flex items-center gap-2 px-4 py-2 bg-temple-red text-white rounded-lg text-sm font-medium hover:bg-[#5C1A04] transition-colors"
            >
              <Plus className="w-4 h-4" /> 新增服務
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {cSaving && <div className="px-4 py-2 bg-blue-50 text-blue-600 text-xs flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> 儲存排序中…</div>}
            <table className="admin-table w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 w-8"></th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium w-16">圖片</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium w-20">啟用</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">服務名稱</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium w-32">費用</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">說明</th>
                  <th className="text-center px-4 py-3 text-gray-500 font-medium w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {localConfigs.map((c, idx) => (
                  <tr key={c.id}
                    draggable
                    onDragStart={() => cDragStart(c.id, idx)}
                    onDragOver={(e) => cDragOver(e, idx)}
                    onDrop={() => cDrop(idx)}
                    onDragEnd={cDragEnd}
                    className={`select-none transition-colors ${cDragId === c.id ? 'opacity-30 bg-gray-50' : ''} ${cOverIdx === idx && cDragId !== c.id ? 'border-t-2 border-temple-red' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-3 py-3 text-gray-300 lg:cursor-grab lg:active:cursor-grabbing">
                      <GripVertical className="w-4 h-4 hidden lg:block" />
                      {/* 手機沒有拖拉：HTML5 的 drag 事件在觸控裝置不會觸發，改用上下鍵搬移 */}
                      <div className="flex items-center gap-1 lg:hidden">
                        <button type="button" onClick={() => cMove(idx, -1)} disabled={idx === 0}
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30" aria-label="上移">
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => cMove(idx, 1)} disabled={idx === localConfigs.length - 1}
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30" aria-label="下移">
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td data-label="圖片" className="px-4 py-3">
                      {c.imageUrl
                        ? <img src={c.imageUrl} alt={c.name} className="w-10 h-10 object-cover rounded-lg border border-gray-100" />
                        : <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center"><Flame className="w-4 h-4 text-gray-300" /></div>}
                    </td>
                    <td data-label="啟用" className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(c)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${c.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${c.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td data-label="服務名稱" className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                    <td data-label="費用" className="px-4 py-3 text-temple-red font-semibold">NT$ {c.fee.toLocaleString()}</td>
                    <td data-label="說明" className="px-4 py-3 text-gray-500 max-w-xs">
                      <p className="truncate">{c.description}</p>
                    </td>
                    <td data-label="操作" className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditConfig(c)}
                          className="p-1.5 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                          title="編輯"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteConfig(c.id)}
                          disabled={deletingId === c.id}
                          className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
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
            {pagedRegs.map(r => (
              <div key={r.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start gap-4 cursor-pointer hover:border-orange-200 hover:bg-orange-50/30 transition-colors"
                onClick={() => setQuickView({ name: r.name, phone: r.phone, gender: r.gender || undefined, birthDate: r.birthDate || undefined, zodiac: r.zodiac || undefined, address: r.address || undefined, notes: r.notes || undefined, status: r.status, serviceLabel: `點燈 · ${getServiceName(r.serviceId)}`, createdAt: r.createdAt, contactLabel: r.contactLabel, source: r.source })}
              >
                <div className="p-2.5 rounded-xl bg-orange-50 shrink-0">
                  <Flame className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-800">{r.name}</p>
                    {r.contactLabel && <span className="text-xs bg-temple-gold/20 text-temple-dark px-1.5 py-0.5 rounded-full font-medium">#{r.contactLabel}</span>}
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                      {getServiceName(r.serviceId)}
                    </span>
                    {lampStatusBadge(r.status)}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    <Phone className="w-3 h-3 inline mr-1" />{r.phone}
                  </p>
                  {r.gender && <span className="text-xs text-gray-400">{r.gender}</span>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    生日：{r.birthDate}{r.zodiac ? `　生肖：${r.zodiac}` : ''}
                  </p>
                  {r.address && <p className="text-xs text-gray-400 mt-0.5">地址：{r.address}</p>}
                  {r.notes && <p className="text-xs text-gray-400 mt-0.5">備註：{r.notes}</p>}
                  <p className="text-xs text-gray-300 mt-1">{fmtDate(r.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
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
            {filteredRegs.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <Paginator total={filteredRegs.length} page={regPage} onChange={setRegPage} />
              </div>
            )}
          </div>
        </div>
      )}

      {quickView && <MemberInfoModal reg={quickView} memberProfiles={memberProfiles} onClose={() => setQuickView(null)} />}

      {/* ── Config Modal ── */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowConfigModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">{editingConfig ? '編輯服務項目' : '新增服務項目'}</h3>
              <button onClick={() => setShowConfigModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* 圖片上傳 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">服務圖片</label>
                {configForm.imageUrl && (
                  <div className="relative mb-2 inline-block">
                    <img src={configForm.imageUrl} alt="預覽" className="h-28 w-full object-cover rounded-lg border border-gray-200" />
                    <button type="button" onClick={() => setConfigForm(f => ({ ...f, imageUrl: '' }))}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <label className={`flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg text-sm cursor-pointer transition-colors ${uploadingLampImg ? 'opacity-50 cursor-not-allowed' : 'border-gray-300 hover:border-temple-red hover:text-temple-red text-gray-500'}`}>
                  <Upload className="w-4 h-4" />
                  {uploadingLampImg ? '上傳中…' : configForm.imageUrl ? '更換圖片' : '上傳圖片'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingLampImg} onChange={handleLampImageUpload} />
                </label>
              </div>
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
              <button onClick={() => setShowConfigModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">取消</button>
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="flex items-center gap-2 px-5 py-2 bg-temple-red text-white text-sm font-medium rounded-lg hover:bg-[#5C1A04] transition-colors disabled:opacity-50"
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

// ─── Blessings Tab (祈福管理) ─────────────────────────────────────────────────

const BLESSING_EVENT_TYPES = ['法會', '進香', '祭典', '祈福', '其他'];

const emptyBlessingForm = (): BlessingEventData => ({
  title: '', description: '', eventType: '法會',
  startDate: '', endDate: '', registrationDeadline: '',
  fee: 0, packages: [], addons: [], offerings: [], imageUrl: '', isActive: true, sortOrder: 0,
});

/** 將 DB 的 UTC ISO 時間轉成 datetime-local 需要的「本地時間」字串（避免每次編輯儲存都往前漂 8 小時） */
const toLocalDatetimeInput = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const BlessingsTab = ({ events, registrations, onRefresh, memberProfiles }: {
  events: BlessingEventRecord[];
  registrations: BlessingRegistrationRecord[];
  onRefresh: () => void;
  memberProfiles: MemberProfileRecord[];
}) => {
  const [view, setView] = useState<'list' | 'regs'>('list');
  const [selectedEvent, setSelectedEvent] = useState<BlessingEventRecord | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BlessingEventData>(emptyBlessingForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingRegId, setUpdatingRegId] = useState<string | null>(null);
  const [deletingRegId, setDeletingRegId] = useState<string | null>(null);
  const [regSearch, setRegSearch] = useState('');
  const [uploadingBlessingImg, setUploadingBlessingImg] = useState(false);
  const [quickView, setQuickView] = useState<RegViewItem | null>(null);

  // ── Drag sort for events ──
  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.sortOrder - b.sortOrder), [events]);
  const { localItems: localEvents, draggingId: eDragId, overIndex: eOverIdx, isSaving: eSaving,
          onDragStart: eDragStart, onDragOver: eDragOver, onDrop: eDrop, onDragEnd: eDragEnd, move: eMove,
  } = useDragSort(sortedEvents, async (sorted) => {
    await Promise.all(sorted.map((e, i) => updateBlessingEvent(e.id, { sortOrder: i + 1 })));
    onRefresh();
  });

  const handleBlessingImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBlessingImg(true);
    try {
      const url = await uploadBlessingImage(file);
      setForm(f => ({ ...f, imageUrl: url }));
    } catch { alert('圖片上傳失敗，請稍後再試'); }
    finally { setUploadingBlessingImg(false); e.target.value = ''; }
  };

  const openNew = () => { setEditingId(null); setForm(emptyBlessingForm()); setShowModal(true); };
  const openEdit = (e: BlessingEventRecord) => {
    setEditingId(e.id);
    setForm({
      title: e.title, description: e.description || '',
      eventType: e.eventType, startDate: e.startDate, endDate: e.endDate,
      registrationDeadline: e.registrationDeadline ? toLocalDatetimeInput(e.registrationDeadline) : '',
      fee: e.fee, packages: e.packages || [], addons: e.addons || [], offerings: e.offerings || [], imageUrl: e.imageUrl || '', isActive: e.isActive, sortOrder: e.sortOrder,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.startDate || !form.endDate) { alert('請填寫活動名稱及日期'); return; }
    setSaving(true);
    try {
      const payload: BlessingEventData = {
        ...form,
        endDate: form.endDate || form.startDate,
        registrationDeadline: form.registrationDeadline ? new Date(form.registrationDeadline).toISOString() : undefined,
        fee: Number(form.fee) || 0,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editingId) { await updateBlessingEvent(editingId, payload); }
      else            { await createBlessingEvent(payload); }
      setShowModal(false); onRefresh();
    } catch { alert('儲存失敗，請稍後再試'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除此祈福活動？所有報名資料也會一併刪除。')) return;
    setDeletingId(id);
    try { await deleteBlessingEvent(id); onRefresh(); }
    catch { alert('刪除失敗'); }
    finally { setDeletingId(null); }
  };

  const handleRegStatus = async (id: string, status: BlessingStatus) => {
    setUpdatingRegId(id);
    try { await updateBlessingRegistrationStatus(id, status); onRefresh(); }
    catch { alert('更新失敗'); }
    finally { setUpdatingRegId(null); }
  };

  const handleDeleteReg = async (id: string) => {
    if (!confirm('確定刪除此報名？')) return;
    setDeletingRegId(id);
    try { await deleteBlessingRegistration(id); onRefresh(); }
    catch { alert('刪除失敗'); }
    finally { setDeletingRegId(null); }
  };

  const viewRegs = (e: BlessingEventRecord) => { setSelectedEvent(e); setRegSearch(''); setView('regs'); };

  const eventRegs = selectedEvent
    ? registrations.filter(r => r.eventId === selectedEvent.id)
    : [];
  const filteredRegs = regSearch
    ? eventRegs.filter(r => r.name.includes(regSearch) || r.phone.includes(regSearch))
    : eventRegs;

  const exportRegs = () => {
    if (!selectedEvent) return;
    exportExcel(
      `祈福報名_${selectedEvent.title}.xlsx`,
      filteredRegs.map(r => [
        r.name, r.phone, r.packageName || '', r.packageFee ?? '',
        (r.selectedAddons || []).map(a => `${a.name}(NT$${a.fee})`).join(' / '),
        (r.selectedAddons || []).reduce((s, a) => s + a.fee, 0) || '',
        r.gender || '', r.birthDate || '', r.zodiac || '', r.address || '', r.notes || '', r.status, fmtDate(r.createdAt), r.source || ''
      ]),
      ['姓名', '電話', '方案', '費用', '加購項目', '加購小計', '性別', '生日', '生肖', '地址', '備註', '狀態', '報名時間', '報名來源']
    );
  };

  const fmtDateRange = (start: string, end: string) => {
    if (start === end) return start;
    return `${start} ~ ${end}`;
  };

  const isDeadlinePassed = (deadline?: string) => deadline ? new Date(deadline) < new Date() : false;

  // ── 報名管理頁 ──
  if (view === 'regs' && selectedEvent) {
    return (
      <div>
        <button onClick={() => setView('list')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> 返回活動列表
        </button>
        <div className="bg-white rounded-xl border border-temple-gold/30 shadow-sm p-5 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-temple-red/10 rounded-full flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-temple-red" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-800">{selectedEvent.title}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {fmtDateRange(selectedEvent.startDate, selectedEvent.endDate)}
                {selectedEvent.packages && selectedEvent.packages.length > 0
                  ? <span className="ml-3">{selectedEvent.packages.length} 個方案・起 NT${Math.min(...selectedEvent.packages.map(p => p.fee)).toLocaleString()}</span>
                  : selectedEvent.fee > 0 && <span className="ml-3">費用：NT${selectedEvent.fee.toLocaleString()}</span>}
              </p>
            </div>
            <span className="text-sm font-semibold text-temple-red">{eventRegs.length} 筆報名</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={regSearch} onChange={e => setRegSearch(e.target.value)}
                placeholder="搜尋姓名、電話…" className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" />
            </div>
            <button onClick={exportRegs} className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <Download className="w-4 h-4" /> 匯出 Excel
            </button>
          </div>
          {filteredRegs.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-400">尚無報名資料</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table w-full min-w-[700px]">
                <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">姓名</th>
                    <th className="px-4 py-3 text-left">電話</th>
                    <th className="px-4 py-3 text-left">方案</th>
                    <th className="px-4 py-3 text-left">加購</th>
                    <th className="px-4 py-3 text-left">生日 / 生肖</th>
                    <th className="px-4 py-3 text-left">地址</th>
                    <th className="px-4 py-3 text-left">備註</th>
                    <th className="px-4 py-3 text-left">狀態</th>
                    <th className="px-4 py-3 text-left">報名時間</th>
                    <th className="px-4 py-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredRegs.map(r => (
                    <tr key={r.id}
                      className="hover:bg-purple-50/40 transition-colors cursor-pointer"
                      onClick={() => setQuickView({ name: r.name, phone: r.phone, birthDate: r.birthDate || undefined, zodiac: r.zodiac || undefined, gender: r.gender || undefined, address: r.address || undefined, notes: r.notes || undefined, status: r.status, serviceLabel: `祈福 · ${selectedEvent?.title ?? ''}`, createdAt: r.createdAt, source: r.source })}
                    >
                      <td data-label="姓名" className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                        {r.gender && <span className="text-xs text-gray-400">{r.gender}</span>}
                      </td>
                      <td data-label="電話" className="px-4 py-3 text-sm text-gray-600">{r.phone}</td>
                      <td data-label="方案" className="px-4 py-3 text-sm text-gray-500">
                        {r.packageName
                          ? <span className="inline-flex flex-col gap-0.5">
                              <span className="text-xs font-medium text-temple-red">{r.packageName}</span>
                              {r.packageFee !== undefined && <span className="text-xs text-gray-400">NT${r.packageFee.toLocaleString()}</span>}
                            </span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td data-label="加購" className="px-4 py-3 text-sm text-gray-500 max-w-[200px]">
                        {r.selectedAddons && r.selectedAddons.length > 0 && (
                          <span className="text-xs leading-relaxed">
                            {r.selectedAddons.map(a => `${a.name}(NT$${a.fee.toLocaleString()})`).join(' / ')}
                          </span>
                        )}
                        {r.claimedOfferings && r.claimedOfferings.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {r.claimedOfferings.map(o => (
                              <span key={o.id} className="inline-flex items-center gap-0.5 bg-orange-100 text-orange-700 text-[11px] font-medium px-1.5 py-0.5 rounded-full">
                                🕯 {o.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {(!r.selectedAddons || r.selectedAddons.length === 0) && (!r.claimedOfferings || r.claimedOfferings.length === 0) && (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td data-label="生日 / 生肖" className="px-4 py-3 text-sm text-gray-500">
                        {r.birthDate && <p>{r.birthDate}</p>}
                        {r.zodiac && <p className="text-xs">{r.zodiac}年</p>}
                      </td>
                      <td data-label="地址" className="px-4 py-3 text-sm text-gray-500 max-w-[140px] truncate">{r.address || '—'}</td>
                      <td data-label="備註" className="px-4 py-3 text-sm text-gray-500 max-w-[120px] truncate">{r.notes || '—'}</td>
                      <td data-label="狀態" className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <select value={r.status} disabled={updatingRegId === r.id}
                          onChange={e => handleRegStatus(r.id, e.target.value as BlessingStatus)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-temple-red">
                          {Object.values(BlessingStatus).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td data-label="報名時間" className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                      <td data-label="操作" className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleDeleteReg(r.id)} disabled={deletingRegId === r.id}
                          className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-40">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {quickView && <MemberInfoModal reg={quickView} memberProfiles={memberProfiles} onClose={() => setQuickView(null)} />}
      </div>
    );
  }

  // ── 活動列表頁 ──
  return (
    <div>
      {/* Modal 新增/編輯 */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-800 text-lg">{editingId ? '編輯祈福活動' : '新增祈福活動'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              {/* 圖片上傳 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">活動海報</label>
                {/* 整張顯示、不裁切（廟方 2026-10-01：海報是直式的，後台看不出上傳了什麼）。
                    原本 `w-full h-36 object-cover` 把直式海報壓成一條 144px 高的中段。
                    寫法與神明管理、公佈欄一致：只給上限，長寬交給圖自己。 */}
                {form.imageUrl && (
                  <div className="relative mb-2 inline-block">
                    <img src={form.imageUrl} alt="海報預覽" className="max-h-64 max-w-full w-auto h-auto rounded-lg" />
                    <button type="button" onClick={() => setForm(f => ({ ...f, imageUrl: '' }))} aria-label="移除海報"
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <label className={`flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg text-sm cursor-pointer transition-colors ${uploadingBlessingImg ? 'opacity-50 cursor-not-allowed' : 'border-gray-300 hover:border-temple-red hover:text-temple-red text-gray-500'}`}>
                  <Upload className="w-4 h-4" />
                  {uploadingBlessingImg ? '上傳中…' : form.imageUrl ? '更換海報' : '上傳海報'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingBlessingImg} onChange={handleBlessingImageUpload} />
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">活動名稱 *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" placeholder="例：天上聖母聖誕祈福法會" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">類型</label>
                  <select value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red">
                    {BLESSING_EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">預設費用（NT$）</label>
                  <input type="number" min={0} value={form.fee} onChange={e => setForm(f => ({ ...f, fee: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" placeholder="0" />
                </div>
              </div>
              {/* 多方案設定 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">多方案設定</label>
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, packages: [...(f.packages || []), { id: Math.random().toString(36).slice(2), name: '', fee: 0, description: '' }] }))}
                    className="flex items-center gap-1 text-xs text-temple-red hover:text-temple-red/80 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> 新增方案
                  </button>
                </div>
                {(!form.packages || form.packages.length === 0) ? (
                  <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                    無方案（僅使用上方預設費用）。點擊「新增方案」可設定多種護持方案。
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.packages.map((pkg, idx) => (
                      <div key={pkg.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                              <input
                                value={pkg.name}
                                onChange={e => setForm(f => ({ ...f, packages: f.packages.map((p, i) => i === idx ? { ...p, name: e.target.value } : p) }))}
                                placeholder="方案名稱 *"
                                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-temple-red" />
                              <input
                                type="number" min={0}
                                value={pkg.fee}
                                onChange={e => setForm(f => ({ ...f, packages: f.packages.map((p, i) => i === idx ? { ...p, fee: Number(e.target.value) } : p) }))}
                                placeholder="費用 NT$"
                                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-temple-red" />
                              <input
                                type="number" min={1}
                                value={pkg.totalQty ?? ''}
                                onChange={e => setForm(f => ({ ...f, packages: f.packages.map((p, i) => i === idx ? { ...p, totalQty: e.target.value ? Number(e.target.value) : undefined } : p) }))}
                                placeholder="名額上限（空=不限）"
                                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-temple-red" />
                            </div>
                            <input
                              value={pkg.description || ''}
                              onChange={e => setForm(f => ({ ...f, packages: f.packages.map((p, i) => i === idx ? { ...p, description: e.target.value } : p) }))}
                              placeholder="方案說明（選填）"
                              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-temple-red" />
                          </div>
                          <button type="button"
                            onClick={() => setForm(f => ({ ...f, packages: f.packages.filter((_, i) => i !== idx) }))}
                            className="text-red-400 hover:text-red-600 transition-colors shrink-0 mt-0.5">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* 加購品項設定 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4 text-temple-red/70" /> 加購品項
                  </label>
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, addons: [...(f.addons || []), { id: Math.random().toString(36).slice(2), name: '', fee: 0, voluntary: false }] }))}
                    className="flex items-center gap-1 text-xs text-temple-red hover:text-temple-red/80 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> 新增加購品項
                  </button>
                </div>
                {(!form.addons || form.addons.length === 0) ? (
                  <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                    無加購品項。點擊「新增加購品項」可設定固定費用品項或隨喜敬獻。
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(form.addons || []).map((addon, idx) => (
                      <div key={addon.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center gap-2">
                          <input
                            value={addon.name}
                            onChange={e => setForm(f => ({ ...f, addons: (f.addons || []).map((a, i) => i === idx ? { ...a, name: e.target.value } : a) }))}
                            placeholder="品項名稱 *"
                            className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-temple-red" />
                          <input
                            type="number" min={0}
                            value={addon.voluntary ? '' : addon.fee}
                            disabled={!!addon.voluntary}
                            onChange={e => setForm(f => ({ ...f, addons: (f.addons || []).map((a, i) => i === idx ? { ...a, fee: Number(e.target.value) } : a) }))}
                            placeholder={addon.voluntary ? '自填' : '費用 NT$'}
                            className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-temple-red disabled:bg-gray-100 disabled:text-gray-400" />
                          <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap cursor-pointer select-none">
                            <input type="checkbox"
                              checked={!!addon.voluntary}
                              onChange={e => setForm(f => ({ ...f, addons: (f.addons || []).map((a, i) => i === idx ? { ...a, voluntary: e.target.checked, fee: 0 } : a) }))}
                              className="accent-green-600 w-3.5 h-3.5" />
                            隨喜
                          </label>
                          <button type="button"
                            onClick={() => setForm(f => ({ ...f, addons: (f.addons || []).filter((_, i) => i !== idx) }))}
                            className="text-red-400 hover:text-red-600 transition-colors shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── 供品名額 ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-orange-500/70" /> 供品名額（限量認領）
                  </label>
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, offerings: [...(f.offerings || []), { id: Math.random().toString(36).slice(2), name: '', totalQty: 1, fee: 0 }] }))}
                    className="flex items-center gap-1 text-xs text-temple-red hover:text-temple-red/80 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> 新增供品
                  </button>
                </div>
                {(!form.offerings || form.offerings.length === 0) ? (
                  <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                    無供品名額。點擊「新增供品」可設定限量認領項目（如：五果一份、香爐一個）。
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(form.offerings || []).map((off, idx) => (
                      <div key={off.id} className="border border-orange-200 rounded-lg p-3 bg-orange-50/40">
                        <div className="flex items-center gap-2">
                          <input
                            value={off.name}
                            onChange={e => setForm(f => ({ ...f, offerings: (f.offerings || []).map((o, i) => i === idx ? { ...o, name: e.target.value } : o) }))}
                            placeholder="供品名稱 * (e.g. 五果一份)"
                            className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500 whitespace-nowrap">名額</span>
                            <input
                              type="number" min={1}
                              value={off.totalQty}
                              onChange={e => setForm(f => ({ ...f, offerings: (f.offerings || []).map((o, i) => i === idx ? { ...o, totalQty: Number(e.target.value) || 1 } : o) }))}
                              className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-orange-400" />
                          </div>
                          <input
                            type="number" min={0}
                            value={off.fee ?? 0}
                            onChange={e => setForm(f => ({ ...f, offerings: (f.offerings || []).map((o, i) => i === idx ? { ...o, fee: Number(e.target.value) } : o) }))}
                            placeholder="費用 NT$"
                            className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
                          <button type="button"
                            onClick={() => setForm(f => ({ ...f, offerings: (f.offerings || []).filter((_, i) => i !== idx) }))}
                            className="text-red-400 hover:text-red-600 transition-colors shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <input
                          value={off.description || ''}
                          onChange={e => setForm(f => ({ ...f, offerings: (f.offerings || []).map((o, i) => i === idx ? { ...o, description: e.target.value } : o) }))}
                          placeholder="說明（選填）"
                          className="mt-1.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始日期 *</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">結束日期 *</label>
                  <input type="date" value={form.endDate} min={form.startDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">報名截止時間</label>
                <input type="datetime-local" value={form.registrationDeadline || ''} onChange={e => setForm(f => ({ ...f, registrationDeadline: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">活動說明</label>
                <textarea rows={3} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red resize-none" placeholder="活動說明（選填）" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">排序</label>
                  <input type="number" min={0} value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                      className="w-4 h-4 accent-temple-red" />
                    <span className="text-sm text-gray-700">顯示於前台</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 mt-4">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">取消</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-temple-red text-white text-sm font-medium rounded-lg hover:bg-[#5C1A04] transition-colors disabled:opacity-50">
                <Save className="w-4 h-4" />
                {saving ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-800">祈福管理
          <span className="ml-2 text-sm font-normal text-gray-400">{events.length} 個活動</span>
        </h2>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-temple-red text-white text-sm font-semibold rounded-xl hover:bg-temple-red/90 transition-colors">
          <Plus className="w-4 h-4" /> 新增祈福活動
        </button>
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-400 text-sm">
          尚無祈福活動，請點擊「新增」建立第一個活動
        </div>
      ) : (
        <div className="space-y-2">
          {eSaving && <div className="px-4 py-2 bg-blue-50 text-blue-600 text-xs rounded-lg flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> 儲存排序中…</div>}
          {localEvents.map((e, idx) => {
            const count = registrations.filter(r => r.eventId === e.id).length;
            const closed = isDeadlinePassed(e.registrationDeadline);
            return (
              <div key={e.id}
                draggable
                onDragStart={() => eDragStart(e.id, idx)}
                onDragOver={(ev) => eDragOver(ev, idx)}
                onDrop={() => eDrop(idx)}
                onDragEnd={eDragEnd}
                className={`bg-white rounded-xl border shadow-sm p-5 flex flex-wrap items-center gap-4 select-none transition-all ${eDragId === e.id ? 'opacity-30' : ''} ${eOverIdx === idx && eDragId !== e.id ? 'border-temple-red border-2' : 'border-gray-100'}`}>
                <GripVertical className="w-5 h-5 text-gray-300 cursor-grab active:cursor-grabbing shrink-0 hidden lg:block" />
                {/* 手機沒有拖拉：HTML5 的 drag 事件在觸控裝置不會觸發，改用上下鍵搬移 */}
                <div className="flex items-center gap-1 lg:hidden shrink-0">
                  <button type="button" onClick={() => eMove(idx, -1)} disabled={idx === 0}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30" aria-label="上移">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => eMove(idx, 1)} disabled={idx === localEvents.length - 1}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30" aria-label="下移">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                {e.imageUrl
                  ? <img src={e.imageUrl} alt={e.title} className="w-14 h-14 object-cover rounded-xl border border-gray-100 shrink-0" />
                  : <div className="w-10 h-10 bg-temple-red/10 rounded-full flex items-center justify-center shrink-0"><Sparkles className="w-5 h-5 text-temple-red" /></div>}

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800">{e.title}</h3>
                    <span className="text-xs bg-temple-red/10 text-temple-red px-2 py-0.5 rounded-full">{e.eventType}</span>
                    {!e.isActive && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">已下架</span>}
                    {closed && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">報名截止</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDateRange(e.startDate, e.endDate)}</span>
                    {e.packages && e.packages.length > 0
                      ? <span>{e.packages.length} 個方案・起 NT${Math.min(...e.packages.map(p => p.fee)).toLocaleString()}</span>
                      : e.fee > 0 && <span>費用 NT${e.fee.toLocaleString()}</span>}
                    {e.registrationDeadline && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />截止 {fmtDate(e.registrationDeadline)}</span>}
                    <span className="text-temple-red font-medium">{count} 筆報名</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => viewRegs(e)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                    <List className="w-3.5 h-3.5" /> 報名名單
                  </button>
                  <button onClick={() => openEdit(e)} className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(e.id)} disabled={deletingId === e.id}
                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Repair Projects Tab (神尊修復專案) ───────────────────────────────────────

const RepairProjectsTab = ({ onRefresh }: { onRefresh: () => void }) => {
  const [projects, setProjects] = useState<RepairProject[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RepairProjectData>({ name: '', description: '', imageUrl: '', targetAmount: 0, isActive: true, sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [projs, tots] = await Promise.all([getRepairProjects(), getRepairProjectTotals()]);
      setProjects(projs);
      setTotals(tots);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: '', description: '', imageUrl: '', targetAmount: 0, isActive: true, sortOrder: projects.length });
    setShowModal(true);
  };
  const openEdit = (p: RepairProject) => {
    setEditingId(p.id);
    setForm({ name: p.name, description: p.description || '', imageUrl: p.imageUrl || '', targetAmount: p.targetAmount, isActive: p.isActive, sortOrder: p.sortOrder });
    setShowModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const url = await uploadRepairProjectImage(file);
      setForm(f => ({ ...f, imageUrl: url }));
    } catch { alert('圖片上傳失敗，請稍後再試'); }
    finally { setUploadingImg(false); e.target.value = ''; }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert('請輸入神尊名稱'); return; }
    setSaving(true);
    try {
      if (editingId) { await updateRepairProject(editingId, form); }
      else { await createRepairProject(form); }
      setShowModal(false);
      await load();
    } catch { alert('儲存失敗，請稍後再試'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除此修復專案？相關捐獻紀錄的神尊標記將保留。')) return;
    setDeletingId(id);
    try { await deleteRepairProject(id); await load(); }
    catch { alert('刪除失敗'); }
    finally { setDeletingId(null); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-temple-red/20 border-t-temple-red rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">神尊修復專案</h3>
          <p className="text-xs text-gray-400 mt-0.5">管理需要樂捐修復的神尊，信眾捐獻時可指定專案</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-temple-red text-white text-sm font-medium rounded-lg hover:bg-[#5C1A04] transition-colors">
          <Plus className="w-4 h-4" /> 新增修復專案
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Wrench className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="text-sm">尚無修復專案，點擊「新增修復專案」開始建立</p>
        </div>
      ) : (
        /* 直式清單：神尊超過十尊時，卡片牆要一直橫向掃視很難管理。
           一列一尊、縮圖用直式（與前台 3:4 一致，才看得出實際會怎麼呈現）。 */
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white divide-y divide-gray-100">
          {[...projects].sort((a, b) => a.sortOrder - b.sortOrder).map(proj => {
            const raised = totals[proj.id] || 0;
            const pct = proj.targetAmount > 0 ? Math.min(100, Math.round((raised / proj.targetAmount) * 100)) : null;
            return (
              <div key={proj.id} className={`flex items-center gap-4 p-3 sm:p-4 transition-colors hover:bg-gray-50 ${proj.isActive ? '' : 'opacity-55'}`}>
                {/* 直式縮圖：神尊立像是直的，橫幅裁切會把頭冠與衣袍下擺切掉 */}
                <div className="w-14 h-[74px] sm:w-16 sm:h-[85px] shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                  {proj.imageUrl
                    ? <img src={proj.imageUrl} alt={proj.name} className="w-full h-full object-cover" />
                    : <Flame className="w-6 h-6 text-gray-300" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400 font-mono shrink-0">#{proj.sortOrder}</span>
                    <p className="font-semibold text-gray-800 truncate">{proj.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${proj.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                      {proj.isActive ? '啟用' : '已下架'}
                    </span>
                    {!proj.imageUrl && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 shrink-0">缺照片</span>
                    )}
                  </div>
                  {proj.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{proj.description}</p>}
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="flex-1 max-w-xs h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct !== null && pct >= 100 ? 'bg-green-500' : 'bg-temple-red'}`} style={{ width: `${pct ?? 0}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      NT${raised.toLocaleString()}
                      {proj.targetAmount > 0
                        ? ` / ${proj.targetAmount.toLocaleString()}（${pct}%）`
                        : '（未設目標）'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* 上下架直接在清單切換：十尊以上時，為了隱藏一尊而開編輯視窗太費事 */}
                  <button
                    onClick={async () => {
                      try { await updateRepairProject(proj.id, { isActive: !proj.isActive }); await load(); onRefresh(); }
                      catch { alert('更新失敗'); }
                    }}
                    title={proj.isActive ? '點此下架' : '點此啟用'}
                    className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                      proj.isActive
                        ? 'text-gray-500 border-gray-200 hover:bg-gray-100'
                        : 'text-green-600 border-green-200 hover:bg-green-50'
                    }`}>
                    {proj.isActive ? '下架' : '啟用'}
                  </button>
                  <button onClick={() => openEdit(proj)} title="編輯"
                    className="p-2 text-blue-500 border border-blue-100 rounded-lg hover:bg-blue-50 transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(proj.id)} disabled={deletingId === proj.id} title="刪除"
                    className="p-2 text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-temple-red" />
                {editingId ? '編輯修復專案' : '新增修復專案'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* 圖片 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">神像照片</label>
                {form.imageUrl && (
                  <div className="flex items-start gap-3 mb-2">
                    {/* 用 3:4 直式預覽，與前台卡片一致——這樣才看得出上傳的照片會被怎麼裁 */}
                    <div className="w-28 aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 shrink-0">
                      <img src={form.imageUrl} alt="preview" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      前台卡片以 3:4 直式呈現，左側即為實際裁切結果。<br />
                      建議上傳直式照片，橫幅會被裁掉左右兩側。<br />
                      點視窗放大時會完整顯示、不裁切。
                    </p>
                  </div>
                )}
                <label className={`flex items-center justify-center gap-2 w-full py-2.5 border-2 border-dashed rounded-lg cursor-pointer text-sm transition-colors ${uploadingImg ? 'border-gray-200 text-gray-300' : 'border-temple-gold/40 text-temple-red hover:border-temple-gold hover:bg-temple-gold/5'}`}>
                  <Upload className="w-4 h-4" />
                  {uploadingImg ? '處理中...' : (form.imageUrl ? '更換照片' : '上傳照片')}
                  <input type="file" className="hidden" accept="image/*" disabled={uploadingImg} onChange={handleImageUpload} />
                </label>
                <p className="text-xs text-gray-400 mt-1">上傳後會自動縮小，不需要自己先處理</p>
              </div>
              {/* 名稱 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">神尊名稱 *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. 鎮殿媽祖" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" />
              </div>
              {/* 說明 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">修復說明（選填）</label>
                <textarea rows={3} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="修復原因或現況說明"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red resize-none" />
              </div>
              {/* 目標金額 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">目標金額（NT$，0 = 不顯示）</label>
                <input type="number" min={0} value={form.targetAmount}
                  onChange={e => setForm(f => ({ ...f, targetAmount: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" />
              </div>
              {/* 排序 & 啟用 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">排序</label>
                  <input type="number" min={0} value={form.sortOrder}
                    onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? 'bg-green-400' : 'bg-gray-200'}`}
                      onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-sm text-gray-600">{form.isActive ? '啟用中' : '已下架'}</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">取消</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-temple-red text-white text-sm font-medium rounded-lg hover:bg-[#5C1A04] transition-colors disabled:opacity-50">
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

// ─── ReceivablesTab（應收管理）────────────────────────────────────────────────

const ReceivablesTab: React.FC<{
  lampRegistrations:     LampRegistrationRecord[];
  lampConfigs:           LampServiceConfig[];
  blessingRegistrations: BlessingRegistrationRecord[];
  blessingEvents:        BlessingEventRecord[];
  donations:             DonationRecord[];
  memberProfiles:        MemberProfileRecord[];
}> = ({ lampRegistrations, lampConfigs, blessingRegistrations, blessingEvents, donations, memberProfiles }) => {
  const [filter, setFilter] = useState<'all' | 'lamp' | 'blessing' | 'donation'>('all');
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberProfileRecord | null>(null);

  type IncomeRow = {
    id: string; date: string; name: string; phone: string;
    type: '點燈' | '祈福' | '捐獻'; typeKey: 'lamp' | 'blessing' | 'donation';
    detail: string; amount: number; status: string;
  };

  const rows = useMemo<IncomeRow[]>(() => {
    const lampRows: IncomeRow[] = lampRegistrations.map(r => {
      const cfg = lampConfigs.find(c => c.id === r.serviceId);
      return { id: r.id, date: r.createdAt, name: r.name, phone: r.phone,
        type: '點燈', typeKey: 'lamp', detail: cfg?.name || '—', amount: cfg?.fee || 0, status: r.status };
    });
    const blessingRows: IncomeRow[] = blessingRegistrations.map(r => {
      const ev = blessingEvents.find(e => e.id === r.eventId);
      const addonTotal = r.selectedAddons?.reduce((s, a) => s + a.fee, 0) || 0;
      return { id: r.id, date: r.createdAt, name: r.name, phone: r.phone,
        type: '祈福', typeKey: 'blessing', detail: ev?.title || '—',
        amount: (r.packageFee || 0) + addonTotal, status: r.status };
    });
    const donationRows: IncomeRow[] = donations.map(r => ({
      id: r.id, date: r.createdAt, name: r.name, phone: r.phone,
      type: '捐獻', typeKey: 'donation', detail: r.type, amount: r.amount, status: '已完成',
    }));
    return [...lampRows, ...blessingRows, ...donationRows]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [lampRegistrations, lampConfigs, blessingRegistrations, blessingEvents, donations]);

  const filtered = useMemo(() => {
    let r = rows;
    if (filter !== 'all') r = r.filter(row => row.typeKey === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(row => row.name.toLowerCase().includes(q) || row.phone.includes(q));
    }
    return r;
  }, [rows, filter, search]);

  const totalLamp     = useMemo(() => rows.filter(r => r.typeKey === 'lamp').reduce((s, r) => s + r.amount, 0), [rows]);
  const totalBlessing = useMemo(() => rows.filter(r => r.typeKey === 'blessing').reduce((s, r) => s + r.amount, 0), [rows]);
  const totalDonation = useMemo(() => rows.filter(r => r.typeKey === 'donation').reduce((s, r) => s + r.amount, 0), [rows]);
  const total = totalLamp + totalBlessing + totalDonation;

  const findMember = (phone: string) => memberProfiles.find(p => p.phone === phone) || null;

  const typeBadge = (typeKey: 'lamp' | 'blessing' | 'donation', label: string) => {
    const cls =
      typeKey === 'lamp'     ? 'bg-amber-100 text-amber-700' :
      typeKey === 'blessing' ? 'bg-purple-100 text-purple-700' :
                               'bg-green-100 text-green-700';
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* 統計卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {([
          { label: '總收入',   amount: total,         cls: 'text-temple-red' },
          { label: '點燈',     amount: totalLamp,     cls: 'text-amber-600'  },
          { label: '祈福',     amount: totalBlessing, cls: 'text-purple-600' },
          { label: '捐獻',     amount: totalDonation, cls: 'text-green-600'  },
        ] as const).map(({ label, amount, cls }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${cls}`}>NT$ {amount.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* 篩選 + 搜尋 + 表格 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {(['all', 'lamp', 'blessing', 'donation'] as const).map(key => {
              const label = key === 'all' ? '全部' : key === 'lamp' ? '點燈' : key === 'blessing' ? '祈福' : '捐獻';
              return (
                <button key={key} onClick={() => setFilter(key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filter === key ? 'bg-temple-red text-white' : 'text-gray-500 hover:bg-gray-100'
                  }`}>{label}</button>
              );
            })}
          </div>
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜尋姓名 / 電話"
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red w-56" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="admin-table w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-left">
                {['日期', '姓名', '電話', '類型', '項目', '金額', '狀態', '會員'].map(h => (
                  <th key={h} className={`px-5 py-3 font-medium text-gray-500 ${h === '金額' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-gray-400 py-16">暫無資料</td></tr>
              ) : filtered.map(row => {
                const member = findMember(row.phone);
                return (
                  <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td data-label="日期" className="px-5 py-3 text-gray-400 whitespace-nowrap text-xs">{fmtDate(row.date)}</td>
                    <td data-label="姓名" className="px-5 py-3 font-medium text-gray-800">{row.name}</td>
                    <td data-label="電話" className="px-5 py-3 text-gray-500">{row.phone}</td>
                    <td data-label="類型" className="px-5 py-3">{typeBadge(row.typeKey, row.type)}</td>
                    <td data-label="項目" className="px-5 py-3 text-gray-600 max-w-[180px] truncate" title={row.detail}>{row.detail}</td>
                    <td data-label="金額" className="px-5 py-3 text-right font-semibold text-gray-800">NT$ {row.amount.toLocaleString()}</td>
                    <td data-label="狀態" className="px-5 py-3">{statusBadge(row.status)}</td>
                    <td data-label="會員" className="px-5 py-3">
                      {member ? (
                        <button onClick={() => setSelectedMember(member)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium whitespace-nowrap">
                          <User className="w-3 h-3" /> {member.name}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/40">
            <p className="text-sm text-gray-400">共 {filtered.length} 筆</p>
            <p className="text-sm font-semibold text-gray-700">
              篩選合計：NT$ {filtered.reduce((s, r) => s + r.amount, 0).toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* 會員詳情 Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMember(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <User className="w-4 h-4 text-temple-red" /> 會員資訊
              </h3>
              <button onClick={() => setSelectedMember(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2.5 text-sm">
              {([
                ['姓名', selectedMember.name],
                ['電話', selectedMember.phone],
                ['生日', selectedMember.birthDate],
                ['生肖', selectedMember.zodiac || '—'],
                ['性別', selectedMember.gender || '—'],
                ['地址', selectedMember.address || '—'],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <span className="text-gray-400 w-10 shrink-0">{label}</span>
                  <span className="text-gray-800 break-all">{value}</span>
                </div>
              ))}
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">加入時間：{fmtDate(selectedMember.createdAt)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main AdminDashboard ──────────────────────────────────────────────────────

// ─── 流量來源 Tab ─────────────────────────────────────────────────────────────

/**
 * 報名來源（UTM）的總表與明細。
 *
 * 資料來自各報名表的 `source` 欄（由 services/attribution.ts 的 getSource() 產生），
 * 格式是「來源/形式/檔期」的扁平字串如 `line/broadcast/pudu2026`；沒有 UTM 就退回
 * referrer 網域（`google.com`），再沒有就是 `direct`。
 *
 * **`undefined` 與 `direct` 是兩件不同的事**：前者代表這筆早於追蹤上線（2026-09-09），
 * 後者代表有追蹤、但這個人就是沒有來源。統計一律排除前者——把幾百筆舊資料混進來
 * 會把每個來源的比例稀釋到看不出差別；但它的筆數要顯示在卡片上，否則剛上線時
 * 整頁空白會讓人以為功能壞了。
 *
 * 注意：這裡的 source 與信眾名冊那個「參與管道」（ROSTER_SOURCES）完全無關，
 * 識別字不要互相沿用。
 */

const TRAFFIC_SERVICES = ['問事', '點燈', '祈福', '捐獻', '法會', '志工'] as const;

interface TrafficRow {
  service: string;
  name: string;
  amount: number;
  source: string;
  createdAt: string;
}

/** 把扁平字串拆成三段。只有一段的（direct、google.com）就只有平台 */
const splitSource = (s: string): { platform: string; medium: string; campaign: string } => {
  const [platform = '', medium = '', campaign = ''] = s.split('/');
  // 「-」是 getSource() 對「中間那段沒填」的佔位符，不是真的值
  return { platform, medium: medium === '-' ? '' : medium, campaign: campaign === '-' ? '' : campaign };
};

const TrafficTab = ({ bookings, donations, lampRegistrations, lampConfigs, blessingRegistrations, fahuiRegistrations, volunteerRegistrations }: {
  bookings: BookingRecord[];
  donations: DonationRecord[];
  lampRegistrations: LampRegistrationRecord[];
  lampConfigs: LampServiceConfig[];
  blessingRegistrations: BlessingRegistrationRecord[];
  fahuiRegistrations: FahuiRegistrationRecord[];
  volunteerRegistrations: VolunteerRegistrationRecord[];
}) => {
  const [view, setView] = useState<'summary' | 'detail'>('summary');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // 金額的算法與應收管理那頁一致（ReceivablesTab），不要另立一套：
  // 點燈的金額不在報名紀錄上，要去 lampConfigs 對；祈福是方案費加上加購。
  const { rows, untracked } = useMemo(() => {
    // 已取消的報名一律不計：它既不是收入，也不算成功的轉換，
    // 留著會讓「這個管道帶來多少」被灌水。三張表都有「已取消」這個狀態。
    const all: Array<Omit<TrafficRow, 'source'> & { source?: string }> = [
      ...bookings.filter(r => r.status !== BookingStatus.CANCELLED)
        .map(r => ({ service: '問事', name: r.name, amount: 0, source: r.source, createdAt: r.createdAt })),
      ...lampRegistrations.filter(r => r.status !== LampRegistrationStatus.CANCELLED).map(r => ({
        service: '點燈', name: r.name,
        amount: lampConfigs.find(c => c.id === r.serviceId)?.fee || 0,
        source: r.source, createdAt: r.createdAt,
      })),
      ...blessingRegistrations.filter(r => r.status !== BlessingStatus.CANCELLED).map(r => ({
        service: '祈福', name: r.name,
        amount: (r.packageFee || 0) + (r.selectedAddons?.reduce((s, a) => s + a.fee, 0) || 0),
        source: r.source, createdAt: r.createdAt,
      })),
      ...donations.map(r => ({ service: '捐獻', name: r.name, amount: Number(r.amount) || 0, source: r.source, createdAt: r.createdAt })),
      ...fahuiRegistrations.map(r => ({ service: '法會', name: r.name, amount: Number(r.totalAmount) || 0, source: r.source, createdAt: r.createdAt })),
      ...volunteerRegistrations.map(r => ({ service: '志工', name: r.name, amount: 0, source: r.source, createdAt: r.createdAt })),
    ];
    return {
      rows: all.filter((r): r is TrafficRow => !!r.source)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      untracked: all.filter(r => !r.source).length,
    };
  }, [bookings, donations, lampRegistrations, lampConfigs, blessingRegistrations, fahuiRegistrations, volunteerRegistrations]);

  const filtered = useMemo(() => rows.filter(r => inDateRange(r.createdAt, dateFrom, dateTo)), [rows, dateFrom, dateTo]);

  const groups = useMemo(() => {
    const m = new Map<string, { source: string; platform: string; count: number; amount: number; byService: Record<string, number> }>();
    filtered.forEach(r => {
      const g = m.get(r.source) || { source: r.source, platform: splitSource(r.source).platform, count: 0, amount: 0, byService: {} };
      g.count += 1;
      g.amount += r.amount;
      g.byService[r.service] = (g.byService[r.service] || 0) + 1;
      m.set(r.source, g);
    });
    return [...m.values()].sort((a, b) => b.count - a.count || b.amount - a.amount);
  }, [filtered]);

  const totalCount = filtered.length;
  const totalAmount = useMemo(() => filtered.reduce((s, r) => s + r.amount, 0), [filtered]);

  const detail = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? filtered.filter(r => r.name.toLowerCase().includes(q) || r.source.toLowerCase().includes(q) || r.service.includes(q)) : filtered;
  }, [filtered, search]);
  useEffect(() => { setPage(0); }, [search, dateFrom, dateTo, view]);
  const paged = detail.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const exportSummary = () => {
    exportExcel('流量來源總表.xlsx', groups.map(g => {
      const p = splitSource(g.source);
      return [g.source, p.platform, p.medium, p.campaign, g.count, g.amount,
        ...TRAFFIC_SERVICES.map(s => g.byService[s] || 0)];
    }), ['來源', '平台', '形式', '檔期', '筆數', '金額', ...TRAFFIC_SERVICES]);
  };

  const exportDetail = () => {
    exportExcel('流量來源明細.xlsx', detail.map(r => {
      const p = splitSource(r.source);
      // 平台／形式／檔期各自成欄，Excel 才做得出樞紐分析
      return [fmtDate(r.createdAt), r.service, r.name, r.amount || '', r.source, p.platform, p.medium, p.campaign];
    }), ['報名時間', '服務', '姓名', '金額', '來源', '平台', '形式', '檔期']);
  };

  const cards = [
    { label: '有來源的筆數', value: totalCount.toLocaleString(), cls: 'text-gray-800' },
    { label: '不同來源', value: groups.length.toLocaleString(), cls: 'text-gray-800' },
    { label: '報名金額', value: `NT$${totalAmount.toLocaleString()}`, cls: 'text-temple-red' },
    { label: '未追蹤（追蹤上線前）', value: untracked.toLocaleString(), cls: 'text-gray-400' },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.cls}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* 講清楚金額的口徑。不寫的話「報名金額」很容易被當成「已入帳」，
          而法會的待匯款、點燈的待處理都還沒收到錢。 */}
      <p className="text-xs text-gray-400 mb-4 leading-relaxed">
        金額是報名當下的應付金額（法會含待匯款），實際入帳請看「應收管理」；已取消的報名不計入。
        問事與志工沒有金額，只計筆數。
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
          {([['summary', '總表'], ['detail', '明細']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setView(k)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${view === k ? 'bg-temple-red text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <DateRangeFilter from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
        {view === 'detail' && (
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋姓名、來源或服務"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
          </div>
        )}
        <button onClick={view === 'summary' ? exportSummary : exportDetail}
          disabled={(view === 'summary' ? groups.length : detail.length) === 0}
          className="ml-auto shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-temple-red text-white rounded-lg text-sm font-medium hover:bg-temple-red/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <Download className="w-4 h-4" />
          匯出{view === 'summary' ? '總表' : '明細'}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-16 text-center">
          <p className="text-gray-500 mb-2">還沒有任何帶來源的紀錄</p>
          <p className="text-sm text-gray-400 leading-relaxed max-w-xl mx-auto">
            來源是 2026-09-09 才開始記錄的，在那之前的 {untracked.toLocaleString()} 筆算「未追蹤」。<br />
            對外發連結時在網址後面加上
            <span className="font-mono text-gray-500">　?utm_source=line&amp;utm_medium=broadcast&amp;utm_campaign=活動代號　</span>
            信眾從那條連結進來報名，這裡就會出現對應的統計。
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-20">尚無符合條件的紀錄</div>
      ) : view === 'summary' ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['來源', '平台', '筆數', '佔比', '金額', ...TRAFFIC_SERVICES].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {groups.map(g => (
                  <tr key={g.source} className="hover:bg-gray-50/60">
                    <td data-label="來源" className="px-5 py-3">
                      <span className="text-sm font-mono text-gray-800">{g.source}</span>
                    </td>
                    <td data-label="平台" className="px-5 py-3 text-sm text-gray-600">{g.platform}</td>
                    <td data-label="筆數" className="px-5 py-3 text-sm font-semibold text-gray-800">{g.count}</td>
                    <td data-label="佔比" className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                          <div className="h-full bg-temple-gold" style={{ width: `${totalCount ? (g.count / totalCount) * 100 : 0}%` }} />
                        </div>
                        <span className="text-xs text-gray-400">{totalCount ? Math.round((g.count / totalCount) * 100) : 0}%</span>
                      </div>
                    </td>
                    <td data-label="金額" className="px-5 py-3 text-sm text-temple-red">{g.amount ? `NT$${g.amount.toLocaleString()}` : '—'}</td>
                    {TRAFFIC_SERVICES.map(s => (
                      <td key={s} data-label={s} className="px-5 py-3 text-sm text-gray-500">{g.byService[s] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['報名時間', '服務', '姓名', '金額', '來源'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paged.map((r, i) => (
                  <tr key={`${r.createdAt}-${r.name}-${i}`} className="hover:bg-gray-50/60">
                    <td data-label="報名時間" className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                    <td data-label="服務" className="px-5 py-3 text-sm text-gray-600">{r.service}</td>
                    <td data-label="姓名" className="px-5 py-3 text-sm font-medium text-gray-800">{r.name}</td>
                    <td data-label="金額" className="px-5 py-3 text-sm text-temple-red">{r.amount ? `NT$${r.amount.toLocaleString()}` : '—'}</td>
                    <td data-label="來源" className="px-5 py-3 text-sm font-mono text-gray-600">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginator total={detail.length} page={page} onChange={setPage} />
        </div>
      )}
    </div>
  );
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack, role }) => {
  const [tab, setTab] = useState<Tab>(role === 'finance' ? 'receivables' : 'overview');
  /** 手機側邊欄抽屜。桌機（lg 以上）常駐，這個狀態不影響桌機。 */
  const [navOpen, setNavOpen] = useState(false);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [bulletins, setBulletins] = useState<BulletinRecord[]>([]);
  const [siteImages, setSiteImages] = useState<SiteImageRecord[]>([]);
  const [deitiesList, setDeitiesList] = useState<DeityRecord[]>([]);
  const [deityHalls, setDeityHalls] = useState<HallRecord[]>([]);
  const [heroSlidesList, setHeroSlidesList] = useState<HeroSlideRecord[]>([]);
  const [scriptureVerses, setScriptureVerses] = useState<ScriptureVerseRecord[]>([]);
  const [lampConfigs, setLampConfigs] = useState<LampServiceConfig[]>([]);
  const [lampRegistrations, setLampRegistrations] = useState<LampRegistrationRecord[]>([]);
  const [allRegistrations, setAllRegistrations] = useState<RegistrationRecord[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<MemberProfileRecord[]>([]);
  const [allContacts, setAllContacts]       = useState<MemberContact[]>([]);
  const [usersLastLogin, setUsersLastLogin] = useState<Record<string, string>>({});
  const [blessingEvents, setBlessingEvents] = useState<BlessingEventRecord[]>([]);
  const [blessingRegistrations, setBlessingRegistrations] = useState<BlessingRegistrationRecord[]>([]);
  const [fahuiRegistrations, setFahuiRegistrations] = useState<FahuiRegistrationRecord[]>([]);
  const [volunteerRegistrations, setVolunteerRegistrations] = useState<VolunteerRegistrationRecord[]>([]);
  const [lineStats, setLineStats] = useState<{ today: number; total: number }>({ today: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchAll = async (initial = false) => {
    if (initial) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const [b, d, bl, si, dt, hl, hs, sv, lc, lr, mp, ac, ll, ar, be, br, ls, fh, vol] = await Promise.all([getBookings(), getDonations(), getBulletins(true), getSiteImages(), getDeities(), getDeityHalls().catch(() => [] as HallRecord[]), getHeroSlides(), getScriptureVerses(), getLampServiceConfigs().catch(() => [] as LampServiceConfig[]), getLampRegistrations().catch(() => [] as LampRegistrationRecord[]), getAllMemberProfiles().catch(() => [] as MemberProfileRecord[]), getAllMemberContactsAdmin().catch(() => [] as MemberContact[]), getUsersLastLogin().catch(() => ({} as Record<string, string>)), getRegistrations().catch(() => [] as RegistrationRecord[]), getBlessingEvents().catch(() => [] as BlessingEventRecord[]), getBlessingRegistrations().catch(() => [] as BlessingRegistrationRecord[]), getLineClickStats().catch(() => ({ today: 0, total: 0 })), getFahuiRegistrations().catch(() => [] as FahuiRegistrationRecord[]), getVolunteerRegistrations().catch(() => [] as VolunteerRegistrationRecord[])]);
      setBookings(b);
      setDonations(d);
      setBulletins(bl);
      setSiteImages(si);
      setDeitiesList(dt);
      setDeityHalls(hl);
      setHeroSlidesList(hs);
      setScriptureVerses(sv);
      setLampConfigs(lc);
      setLampRegistrations(lr);
      setMemberProfiles(mp);
      setAllContacts(ac);
      setUsersLastLogin(ll);
      setAllRegistrations(ar);
      setBlessingEvents(be);
      setBlessingRegistrations(br);
      setLineStats(ls);
      setFahuiRegistrations(fh);
      setVolunteerRegistrations(vol);
    } catch {
      setError('無法載入資料，請稍後再試。');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(true); }, []);

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

  const allNavItems: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview',  label: '總覽',      icon: <LayoutDashboard className="w-4 h-4" /> },
    { key: 'fahui',     label: '法會報名',   icon: <ClipboardList className="w-4 h-4" /> },
    { key: 'volunteer', label: '志工報名',   icon: <UserPlus className="w-4 h-4" /> },
    { key: 'bulletins', label: '公佈欄管理', icon: <Megaphone className="w-4 h-4" /> },
    { key: 'deities',   label: '神明資訊',   icon: <Flame className="w-4 h-4" /> },
    { key: 'members',   label: '會員資訊',   icon: <Users className="w-4 h-4" /> },
    { key: 'roster',    label: '信眾資訊',   icon: <BookUser className="w-4 h-4" /> },
    { key: 'bookings',  label: '問事管理',   icon: <BookOpen className="w-4 h-4" /> },
    { key: 'lamps',     label: '點燈管理',   icon: <Flame className="w-4 h-4" /> },
    { key: 'blessings', label: '祈福管理',   icon: <Sparkles className="w-4 h-4" /> },
    { key: 'repairs',   label: '修復專案',   icon: <Wrench className="w-4 h-4" /> },
    { key: 'donations',    label: '捐獻管理',   icon: <HeartHandshake className="w-4 h-4" /> },
    { key: 'receivables', label: '應收管理',   icon: <Banknote className="w-4 h-4" /> },
    { key: 'vouchers',    label: '財務憑證',   icon: <Receipt className="w-4 h-4" /> },
    { key: 'traffic',     label: '流量來源',   icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'about',       label: '關於我們',   icon: <FileText className="w-4 h-4" /> },
    { key: 'relocation',  label: '遷址捐款',   icon: <HeartHandshake className="w-4 h-4" /> },
    { key: 'faq',         label: '常見問題',   icon: <BookOpenCheck className="w-4 h-4" /> },
    { key: 'feasts',      label: '歲時節令', icon: <CalendarClock className="w-4 h-4" /> },
    { key: 'photos',      label: '照片管理',   icon: <ImageIcon className="w-4 h-4" /> },
    { key: 'scripture', label: '天上聖母經', icon: <BookOpenCheck className="w-4 h-4" /> },
    { key: 'siteinfo',   label: '基本資料',   icon: <MapPin className="w-4 h-4" /> },
    { key: 'analytics',  label: '追蹤碼設定', icon: <Settings className="w-4 h-4" /> },
    { key: 'social',     label: '社群帳號設定', icon: <Share2 className="w-4 h-4" /> },
  ];
  const allowed = ROLE_ALLOWED_TABS[role];
  const navItems = allNavItems.filter(n => allowed.includes(n.key));

  /** 各分頁的待辦數字。抽屜收起時漢堡鈕要靠總和顯示紅點，所以從 nav 內部抽出來共用。 */
  const badgeFor = (key: Tab): number =>
      key === 'lamps'     ? lampRegistrations.filter(r => r.status === LampRegistrationStatus.PENDING).length
    : key === 'fahui'     ? fahuiRegistrations.filter(r => r.status === 'pending').length
    : key === 'volunteer' ? volunteerRegistrations.filter(r => r.status !== 'contacted').length
    : key === 'blessings' ? blessingRegistrations.filter(r => r.status === BlessingStatus.PENDING).length
    : key === 'bookings'  ? bookings.filter(b => b.status === BookingStatus.PENDING).length
    : key === 'donations' ? donations.filter(d => d.createdAt && (Date.now() - new Date(d.createdAt).getTime()) < 86400000).length
    : 0;
  const totalPending = navItems.reduce((sum, n) => sum + badgeFor(n.key), 0);

  /**
   * 側邊欄分組。
   *
   * 21 個分頁平鋪在手機抽屜裡等於要一直捲才找得到東西（實測回報）。分組之後
   * 手機只展開「常用」，其餘收起，一眼看得完。
   *
   * 「常用」＝手機上真的會用的：有待辦徽章的六個，加上總覽。後台不該、也不會
   * 在手機上做完所有事（改文案、傳照片、設追蹤碼那些本來就該在電腦上做），
   * 所以目標不是每個分頁都好按，是**該在手機上處理的那幾個好按，其餘進得去就好**。
   *
   * 桌機完全不受影響：收合鈕的箭頭是 lg:hidden，內容用 `hidden lg:block`，
   * 所以 lg 以上永遠是展開的一整份清單，只是多了四個小標題。
   */
  const NAV_GROUPS: { title: string; keys: Tab[] }[] = [
    { title: '常用',       keys: ['overview', 'fahui', 'volunteer', 'bookings', 'lamps', 'blessings', 'donations'] },
    { title: '名單與帳務', keys: ['roster', 'members', 'receivables', 'vouchers', 'repairs', 'traffic'] },
    { title: '網站內容',   keys: ['bulletins', 'deities', 'about', 'relocation', 'faq', 'feasts', 'photos', 'scripture'] },
    { title: '系統設定',   keys: ['siteinfo', 'analytics', 'social'] },
  ];
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const groupedKeys = NAV_GROUPS.reduce<Tab[]>((all, g) => all.concat(g.keys), []);
  // 日後新增分頁若忘了歸類，讓它落到最後一組，不要從選單裡靜默消失
  const ungrouped = navItems.filter(n => groupedKeys.indexOf(n.key) < 0);
  const navGroups = NAV_GROUPS
    .map((g, i) => ({
      title: g.title,
      items: navItems.filter(n => g.keys.indexOf(n.key) >= 0)
        .concat(i === NAV_GROUPS.length - 1 ? ungrouped : []),
    }))
    .filter(g => g.items.length > 0);

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* 手機抽屜的遮罩：點一下關閉 */}
      {navOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar：lg 以上常駐佔位，以下改成從左滑出的抽屜（fixed，不佔版面寬度） */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-temple-dark text-white flex flex-col transition-transform duration-200 lg:static lg:z-auto lg:w-56 lg:shrink-0 lg:translate-x-0 ${
        navOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="px-5 py-6 border-b border-white/10 flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">和聖壇</p>
            <h1 className="text-lg font-bold font-serif">後台管理</h1>
            <span className={`inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              role === 'admin'   ? 'bg-temple-red/80 text-white' :
              role === 'staff'   ? 'bg-blue-500/70 text-white'   :
                                   'bg-yellow-500/70 text-white'
            }`}>
              {ADMIN_ROLE_LABEL[role]}
            </span>
          </div>
          <button onClick={() => setNavOpen(false)}
            className="lg:hidden -mr-2 -mt-1 p-2 rounded-lg text-gray-300 hover:bg-white/10 transition-colors"
            aria-label="關閉選單">
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* 分組後仍可能超過螢幕高度（桌機是全展開的），這一段要能自己捲 */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
          {navGroups.map(({ title, items }) => {
            // 沒手動動過的話：「常用」與「正在看的那一組」預設展開
            const containsActive = items.some(n => n.key === tab);
            const open = openGroups[title] ?? (title === '常用' || containsActive);
            const groupBadge = items.reduce((sum, n) => sum + badgeFor(n.key), 0);
            return (
              <div key={title}>
                {/* 桌機按下去是無作用的（內容有 lg:block 撐著），所以不必另外擋 */}
                <button type="button"
                  onClick={() => setOpenGroups(prev => ({ ...prev, [title]: !open }))}
                  aria-expanded={open}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold tracking-widest text-gray-400 lg:cursor-default">
                  <span className="flex-1 text-left">{title}</span>
                  {!open && groupBadge > 0 && (
                    <span className="lg:hidden bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
                      {groupBadge > 9 ? '9+' : groupBadge}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 lg:hidden transition-transform ${open ? '' : '-rotate-90'}`} />
                </button>
                <div className={`space-y-1 ${open ? 'block' : 'hidden lg:block'}`}>
                  {items.map(({ key, label, icon }) => {
                    const badgeCount = badgeFor(key);
                    return (
                      <button key={key} onClick={() => { setTab(key); setNavOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-lg text-sm transition-colors ${
                          tab === key ? 'bg-temple-red text-white' : 'text-gray-300 hover:bg-white/10'
                        }`}>
                        {icon}
                        <span className="flex-1 text-left">{label}</span>
                        {badgeCount > 0 && (
                          <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none shrink-0">
                            {badgeCount > 9 ? '9+' : badgeCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
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

      {/* Main：min-w-0 是必要的——flex 子元素預設 min-width:auto，
          寬表格會把整頁撐寬變成整頁橫捲，而不是捲在表格自己的容器裡 */}
      <main className="flex-1 min-w-0 overflow-auto">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3 sticky top-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setNavOpen(true)}
              className="lg:hidden -ml-2 p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors relative shrink-0"
              aria-label="開啟選單" aria-expanded={navOpen}>
              <Menu className="w-5 h-5" />
              {/* 抽屜收起時看不到各分頁的待辦數字，用一個紅點提示 */}
              {totalPending > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
              )}
            </button>
            <h2 className="font-semibold text-gray-700 truncate">
              {navItems.find(n => n.key === tab)?.label}
            </h2>
          </div>
          <button onClick={() => fetchAll(false)} disabled={refreshing}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-50 shrink-0 p-2 -mr-2">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">重新整理</span>
          </button>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6">
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
              {tab === 'overview'  && <OverviewTab bookings={bookings} donations={donations} lampRegistrations={lampRegistrations} blessingRegistrations={blessingRegistrations} lampConfigs={lampConfigs} blessingEvents={blessingEvents} lineStats={lineStats} />}
              {tab === 'fahui'     && <FahuiTab registrations={fahuiRegistrations} onRefresh={fetchAll} />}
              {tab === 'volunteer' && <VolunteerTab registrations={volunteerRegistrations} onRefresh={fetchAll} />}
              {tab === 'bookings'  && <BookingsTab bookings={bookings} onStatusChange={handleStatusChange} updatingId={updatingId} memberProfiles={memberProfiles} />}
              {tab === 'donations' && <DonationsTab donations={donations} memberProfiles={memberProfiles} onRefresh={fetchAll} />}
              {tab === 'members'   && <MembersTab bookings={bookings} donations={donations} lampRegistrations={lampRegistrations} registrations={allRegistrations} blessingRegistrations={blessingRegistrations} blessingEvents={blessingEvents} lampConfigs={lampConfigs} memberProfiles={memberProfiles} usersLastLogin={usersLastLogin} />}
              {tab === 'roster'    && <RosterTab sources={{ fahui: fahuiRegistrations, volunteers: volunteerRegistrations, members: memberProfiles, contacts: allContacts, bookings, donations, lamps: lampRegistrations, registrations: allRegistrations }} />}
              {tab === 'bulletins' && <BulletinsTab bulletins={bulletins} onRefresh={fetchAll} />}
              {tab === 'deities'  && <DeitiesTab deities={deitiesList} halls={deityHalls} onRefresh={fetchAll} />}
              {tab === 'photos'   && <PhotosTab siteImages={siteImages} heroSlides={heroSlidesList} onRefresh={fetchAll} />}
              {tab === 'scripture' && <ScriptureTab verses={scriptureVerses} onRefresh={fetchAll} />}
              {tab === 'about' && <AdminAboutTab />}
              {tab === 'relocation' && <AdminRelocationTab />}
              {tab === 'faq' && <AdminFaqTab />}
              {tab === 'feasts' && <AdminFeastsTab />}
              {tab === 'siteinfo' && <AdminSiteInfoTab />}
              {tab === 'analytics' && <AnalyticsTab />}
              {tab === 'social' && <SocialTab />}
              {tab === 'lamps'     && <LampsTab configs={lampConfigs} registrations={lampRegistrations} onRefresh={fetchAll} memberProfiles={memberProfiles} />}
              {tab === 'blessings' && <BlessingsTab events={blessingEvents} registrations={blessingRegistrations} onRefresh={fetchAll} memberProfiles={memberProfiles} />}
              {tab === 'repairs'      && <RepairProjectsTab onRefresh={fetchAll} />}
              {tab === 'vouchers'    && <AdminVouchersTab />}
              {tab === 'traffic'     && <TrafficTab bookings={bookings} donations={donations} lampRegistrations={lampRegistrations} lampConfigs={lampConfigs} blessingRegistrations={blessingRegistrations} fahuiRegistrations={fahuiRegistrations} volunteerRegistrations={volunteerRegistrations} />}
              {tab === 'receivables' && <ReceivablesTab lampRegistrations={lampRegistrations} lampConfigs={lampConfigs} blessingRegistrations={blessingRegistrations} blessingEvents={blessingEvents} donations={donations} memberProfiles={memberProfiles} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
