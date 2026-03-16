import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { getBookings, updateBookingStatus, getDonations, getBulletins, createBulletin, updateBulletin, deleteBulletin, getRegistrations, deleteRegistration, getSiteImages, uploadSiteImage, getSiteImagePublicUrl, getDeities, createDeity, updateDeity, deleteDeity, uploadDeityImage, getDeityHalls, createDeityHall, updateDeityHall, deleteDeityHall, getHeroSlides, uploadHeroSlide, deleteHeroSlide, getScriptureVerses, updateScriptureVerse, uploadScriptureImage, deleteScriptureImage, getLampServiceConfigs, createLampServiceConfig, updateLampServiceConfig, deleteLampServiceConfig, getLampRegistrations, updateLampRegistrationStatus, deleteLampRegistration, getAllMemberProfiles, getMemberContactsByUserId, getMemberContacts, getUsersLastLogin, getBlessingEvents, createBlessingEvent, updateBlessingEvent, deleteBlessingEvent, getBlessingRegistrations, updateBlessingRegistrationStatus, deleteBlessingRegistration, uploadBlessingImage, uploadLampImage, getRepairProjects, getRepairProjectTotals, createRepairProject, updateRepairProject, deleteRepairProject, uploadRepairProjectImage, supabase } from '../services/supabase';
import { AdminRole, ADMIN_ROLE_LABEL, ROLE_ALLOWED_TABS, BlessingAddon, BlessingEventData, BlessingEventPackage, BlessingEventRecord, BlessingRegistrationRecord, BlessingStatus, BookingRecord, BookingStatus, BulletinCategory, BulletinData, BulletinRecord, DeityData, DeityRecord, DonationRecord, HallData, HallRecord, HeroSlideRecord, LampRegistrationRecord, LampRegistrationStatus, LampServiceConfig, LampServiceConfigData, MemberContact, MemberProfileRecord, RegistrationRecord, RepairProject, RepairProjectData, ScriptureVerseRecord, SiteImageRecord, SiteImageSection, ZodiacSign } from '../types';
import {
  ArrowLeft, RefreshCw, Calendar, Clock, User, Phone,
  FileText, CheckCircle, XCircle, Clock3, LayoutDashboard,
  BookOpen, HeartHandshake, Search, Download, ChevronDown,
  TrendingUp, Users, Banknote, AlertCircle, LogOut,
  Megaphone, Plus, Edit2, Trash2, Pin, PinOff, X, UserPlus, ClipboardList, ArrowRight,
  Image as ImageIcon, Upload, Flame, GripVertical, Save, BookOpenCheck, List, BookUser,
  ChevronUp, ChevronsUpDown, CalendarClock, Activity, Sparkles, MapPin, Baby,
  Eye, EyeOff, ShoppingBag, Wrench
} from 'lucide-react';

type Tab = 'overview' | 'bookings' | 'donations' | 'repairs' | 'members' | 'devotees' | 'bulletins' | 'photos' | 'deities' | 'scripture' | 'lamps' | 'blessings' | 'receivables';

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
  const onDrop = async (dropIdx: number) => {
    const fromIdx = dragIndexRef.current;
    setDraggingId(null);
    setOverIndex(null);
    if (fromIdx === dropIdx || fromIdx < 0) return;
    const next = [...localItems];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(dropIdx, 0, moved);
    setLocalItems(next);
    setIsSaving(true);
    try { await onSaveOrder(next); } catch { alert('排序儲存失敗'); }
    finally { setIsSaving(false); }
  };
  const onDragEnd = () => { setDraggingId(null); setOverIndex(null); };

  return { localItems, draggingId, overIndex, isSaving, onDragStart, onDragOver, onDrop, onDragEnd };
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

const OverviewTab = ({
  bookings, donations, lampRegistrations, blessingRegistrations, lampConfigs, blessingEvents,
}: {
  bookings:             BookingRecord[];
  donations:            DonationRecord[];
  lampRegistrations:    LampRegistrationRecord[];
  blessingRegistrations: BlessingRegistrationRecord[];
  lampConfigs:          LampServiceConfig[];
  blessingEvents:       BlessingEventRecord[];
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<ClipboardList className="w-5 h-5 text-blue-600" />}   label="總報名數"    value={totalRegistrations}                         sub="全部服務"    color="bg-blue-50" />
        <StatCard icon={<AlertCircle className="w-5 h-5 text-yellow-600" />}   label="待處理報名"  value={allPending}                                 sub="需要處理"    color="bg-yellow-50" />
        <StatCard icon={<Banknote className="w-5 h-5 text-green-600" />}       label="累計捐款"    value={`NT$ ${totalDonation.toLocaleString()}`}    sub="全部紀錄"    color="bg-green-50" />
        <StatCard icon={<Users className="w-5 h-5 text-purple-600" />}         label="不重複信眾"  value={uniquePhones}                               sub="依電話計算"  color="bg-purple-50" />
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
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'name'>('time');
  const [page, setPage] = useState(0);
  const [quickView, setQuickView] = useState<RegViewItem | null>(null);

  const filtered = useMemo(() => {
    const result = bookings.filter(b => {
      const q = search.toLowerCase();
      const matchSearch = !q || b.name.toLowerCase().includes(q) || b.phone.includes(q);
      const matchStatus = !filterStatus || b.status === filterStatus;
      const matchType = !filterType || b.type === filterType;
      return matchSearch && matchStatus && matchType;
    });
    if (sortBy === 'name') result.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'));
    return result;
  }, [bookings, search, filterStatus, filterType, sortBy]);

  useEffect(() => { setPage(0); }, [search, filterStatus, filterType, sortBy]);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExport = () => {
    exportExcel('預約資料.xlsx', filtered.map(b => [
      b.name, b.phone, b.gender || '', b.birthDate, b.zodiac || '', b.address || '', b.bookingDate,
      b.bookingTime === 'evening' ? '晚上' : b.bookingTime,
      b.type, b.status || '', b.notes || '', fmtDate(b.createdAt)
    ]), ['姓名', '電話', '性別', '農曆生日', '生肖', '現居地址', '預約日期', '時段', '問事項目', '狀態', '備註', '建立時間']);
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
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['信眾資訊', '預約時間 / 項目', '備註', '狀態', '操作'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paged.map(b => (
                  <tr key={b.id}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                    onClick={() => setQuickView({ name: b.name, phone: b.phone, gender: b.gender || undefined, birthDate: b.birthDate, zodiac: b.zodiac || undefined, address: b.address || undefined, notes: b.notes || undefined, status: b.status, serviceLabel: `問事 · ${b.type}`, createdAt: b.createdAt, contactLabel: b.contactLabel })}
                  >
                    <td className="px-5 py-4">
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
                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
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
    </div>
  );
};

// ─── Donations Tab ────────────────────────────────────────────────────────────

const DonationsTab = ({ donations, memberProfiles }: { donations: DonationRecord[]; memberProfiles: MemberProfileRecord[] }) => {
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
      d.name, d.phone, d.gender || '', d.address || '', Number(d.amount), d.type, d.repairProjectName || '', d.notes || '', fmtDate(d.createdAt)
    ]), ['姓名', '電話', '性別', '現居地址', '金額', '捐款類型', '修復神尊', '備註', '建立時間']);
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
            <table className="min-w-full divide-y divide-gray-100">
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
                    onClick={() => setQuickView({ name: d.name, phone: d.phone, gender: d.gender || undefined, address: d.address || undefined, notes: d.notes || undefined, serviceLabel: `捐獻 · ${d.type}　NT$${Number(d.amount).toLocaleString()}`, createdAt: d.createdAt, contactLabel: d.contactLabel })}
                  >
                    <td className="px-5 py-4">
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
                    <td className="px-5 py-4">
                      <p className="text-base font-bold text-green-700">NT$ {Number(d.amount).toLocaleString()}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800">{d.type}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {d.repairProjectName
                        ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                            <Wrench className="w-3 h-3" />{d.repairProjectName}
                          </span>
                        : <span className="text-gray-300">—</span>}
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
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
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
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
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
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-gray-800 group-hover:text-temple-red transition-colors">
                        {p.name || <span className="text-gray-400 font-normal italic">（未填）</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.gender
                        ? <span className="text-xs bg-temple-red/10 text-temple-red px-2 py-0.5 rounded-full">{p.gender}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-amber-700 text-sm font-medium">
                        <Flame className="w-3.5 h-3.5" />{p.stats.lamps}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-blue-700 text-sm font-medium">
                        <Sparkles className="w-3.5 h-3.5" />{p.stats.activities}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {p.stats.donation > 0
                        ? <span className="text-green-700 font-medium">NT${p.stats.donation.toLocaleString()}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-purple-700 text-sm font-medium">
                        <BookOpen className="w-3.5 h-3.5" />{p.stats.bookingCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400 whitespace-nowrap">
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

// ─── Devotees Tab (信眾管理) ─────────────────────────────────────────────────

type DevoteeSortKey = 'default' | 'lamps' | 'bookings' | 'activities' | 'donation';
type DevoteeSortDir = 'asc' | 'desc';

interface DevoteeRow {
  id: string;
  name: string;
  phone?: string;
  gender?: string;
  birthDate?: string;
  zodiac?: string;
  address?: string;
  sourceType: '會員' | '親友';
  sourceLabel: string;
  ownerName?: string;
  ownerPhone?: string;
  stats: { lamps: number; bookingCount: number; activities: number; donation: number };
}

const DevoteesTab = ({
  memberProfiles,
  allContacts,
  bookings,
  donations,
  lampRegistrations,
  registrations,
}: {
  memberProfiles: MemberProfileRecord[];
  allContacts: MemberContact[];
  bookings: BookingRecord[];
  donations: DonationRecord[];
  lampRegistrations: LampRegistrationRecord[];
  registrations: RegistrationRecord[];
}) => {
  const [search, setSearch]               = useState('');
  const [filterGender, setFilterGender]   = useState('');
  const [filterSource, setFilterSource]   = useState<'all' | 'member' | 'contact'>('all');
  const [sortBy, setSortBy]               = useState<DevoteeSortKey>('default');
  const [sortDir, setSortDir]             = useState<DevoteeSortDir>('desc');
  const [page, setPage]                   = useState(0);
  const [selectedDevotee, setSelectedDevotee] = useState<DevoteeRow | null>(null);

  const handleSort = (col: DevoteeSortKey) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortTh = ({ col, label }: { col: DevoteeSortKey; label: string }) => (
    <th
      className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-temple-red transition-colors whitespace-nowrap"
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center justify-center gap-1">
        {label}
        {sortBy === col
          ? sortDir === 'asc'
            ? <ChevronUp className="w-3.5 h-3.5 text-temple-red" />
            : <ChevronDown className="w-3.5 h-3.5 text-temple-red" />
          : <ChevronsUpDown className="w-3.5 h-3.5 opacity-30" />}
      </span>
    </th>
  );

  const rows = useMemo<DevoteeRow[]>(() => {
    const memberRows: DevoteeRow[] = memberProfiles.map(p => {
      const ph = p.phone;
      return {
        id: `m-${p.userId}`,
        name: p.name || '（未填姓名）',
        phone: ph,
        gender: p.gender,
        birthDate: p.birthDate,
        zodiac: p.zodiac,
        address: p.address,
        sourceType: '會員',
        sourceLabel: '會員',
        stats: {
          lamps:        lampRegistrations.filter(l => l.phone === ph).length,
          bookingCount: bookings.filter(b => b.phone === ph).length,
          activities:   registrations.filter(r => r.phone === ph).length,
          donation:     donations.filter(d => d.phone === ph).reduce((s, d) => s + Number(d.amount), 0),
        },
      };
    });

    const contactRows: DevoteeRow[] = allContacts.map(c => {
      const owner = memberProfiles.find(p => p.userId === c.userId);
      const ph = owner?.phone;
      const nm = c.name;
      return {
        id: `c-${c.id}`,
        name: nm,
        phone: c.phone || undefined,
        gender: c.gender,
        birthDate: c.birthDate,
        zodiac: c.zodiac,
        address: c.address,
        sourceType: '親友',
        sourceLabel: c.label,
        ownerName: owner?.name || '（未知）',
        ownerPhone: ph,
        stats: {
          lamps:        lampRegistrations.filter(l => l.phone === ph && l.name === nm).length,
          bookingCount: bookings.filter(b => b.phone === ph && b.name === nm).length,
          activities:   registrations.filter(r => r.phone === ph && r.name === nm).length,
          donation:     donations.filter(d => d.phone === ph && d.name === nm).reduce((s, d) => s + Number(d.amount), 0),
        },
      };
    });

    return [...memberRows, ...contactRows];
  }, [memberProfiles, allContacts, bookings, donations, lampRegistrations, registrations]);

  const genders = ['信士', '信女', '小兒（16歲以下）', '小女兒（16歲以下）'];

  const filtered = useMemo(() => {
    const base = rows.filter(r => {
      if (search && !r.name.includes(search) && !(r.phone || '').includes(search)) return false;
      if (filterGender && r.gender !== filterGender) return false;
      if (filterSource === 'member'  && r.sourceType !== '會員') return false;
      if (filterSource === 'contact' && r.sourceType !== '親友') return false;
      return true;
    });
    base.sort((a, b) => {
      if (sortBy === 'lamps')      { const d = a.stats.lamps - b.stats.lamps;               return sortDir === 'asc' ? d : -d; }
      if (sortBy === 'bookings')   { const d = a.stats.bookingCount - b.stats.bookingCount;  return sortDir === 'asc' ? d : -d; }
      if (sortBy === 'activities') { const d = a.stats.activities - b.stats.activities;      return sortDir === 'asc' ? d : -d; }
      if (sortBy === 'donation')   { const d = a.stats.donation - b.stats.donation;          return sortDir === 'asc' ? d : -d; }
      return 0;
    });
    return base;
  }, [rows, search, filterGender, filterSource, sortBy, sortDir]);

  useEffect(() => { setPage(0); }, [search, filterGender, filterSource, sortBy]);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExport = () => {
    exportExcel('信眾名單.xlsx', filtered.map(r => [
      r.name, r.phone || '', r.gender || '', r.sourceType, r.sourceLabel, r.ownerName || '',
      r.stats.lamps, r.stats.activities, r.stats.donation, r.stats.bookingCount,
    ]), ['姓名', '電話', '性別', '身份類型', '關係/身份', '所屬會員', '點燈', '祈福', '捐獻(NT$)', '問事']);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="text-xl font-bold text-gray-800">
          信眾管理
          <span className="ml-2 text-sm font-normal text-gray-400">{rows.length} 人</span>
          {filtered.length !== rows.length && (
            <span className="ml-1 text-sm font-normal text-temple-red">（篩選後 {filtered.length} 人）</span>
          )}
        </h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-4 py-2 bg-temple-red text-white rounded-xl text-sm font-medium hover:bg-temple-red/90 transition-all shadow-sm"
        >
          <Download className="w-4 h-4" /> 匯出 Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋姓名或電話…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red/20"
          />
        </div>
        <select
          value={filterGender}
          onChange={e => setFilterGender(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-temple-red/20"
        >
          <option value="">全部性別</option>
          {genders.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
          {(['all', 'member', 'contact'] as const).map((v, i) => (
            <button
              key={v}
              onClick={() => setFilterSource(v)}
              className={`px-3 py-2 transition-all ${filterSource === v ? 'bg-temple-red text-white font-semibold' : 'bg-white text-gray-600 hover:bg-gray-50'} ${i > 0 ? 'border-l border-gray-200' : ''}`}
            >
              {v === 'all' ? '全部' : v === 'member' ? '僅會員' : '僅親友'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-temple-gold/15 text-temple-dark">
          <Users className="w-3.5 h-3.5" /> 會員 {memberProfiles.length} 人
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
          <BookUser className="w-3.5 h-3.5" /> 親友 {allContacts.length} 人
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-14 text-gray-400 text-sm">找不到符合的信眾</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">姓名</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">身份</th>
                    <SortTh col="lamps"      label="點燈" />
                    <SortTh col="activities" label="祈福" />
                    <SortTh col="donation"   label="捐獻" />
                    <SortTh col="bookings"   label="問事" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paged.map(r => (
                    <tr key={r.id} className="hover:bg-temple-bg/40 transition-colors cursor-pointer" onClick={() => setSelectedDevotee(r)}>
                      {/* 姓名 + 性別 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-800">{r.name}</span>
                          {genderBadge(r.gender)}
                        </div>
                      </td>
                      {/* 身份 */}
                      <td className="px-4 py-3">
                        {r.sourceType === '會員' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-temple-gold/20 text-temple-dark">
                            <UserPlus className="w-3 h-3" /> 會員
                          </span>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              <BookUser className="w-3 h-3" /> {r.sourceLabel}
                            </span>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {r.ownerName}{r.ownerPhone ? ` · ${r.ownerPhone}` : ''}
                            </p>
                          </div>
                        )}
                      </td>
                      {/* 點燈 */}
                      <td className="px-4 py-3 text-center">
                        {r.stats.lamps > 0
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700"><Flame className="w-3 h-3" />{r.stats.lamps}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      {/* 祈福 */}
                      <td className="px-4 py-3 text-center">
                        {r.stats.activities > 0
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700"><Sparkles className="w-3 h-3" />{r.stats.activities}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      {/* 捐獻 */}
                      <td className="px-4 py-3 text-right">
                        {r.stats.donation > 0
                          ? <span className="text-sm font-bold text-green-700">NT${r.stats.donation.toLocaleString()}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      {/* 問事 */}
                      <td className="px-4 py-3 text-center">
                        {r.stats.bookingCount > 0
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700"><BookOpen className="w-3 h-3" />{r.stats.bookingCount}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginator total={filtered.length} page={page} onChange={setPage} />
          </>
        )}
      </div>

      {/* 信眾詳情 Modal */}
      {selectedDevotee && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelectedDevotee(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                {selectedDevotee.name}
                {genderBadge(selectedDevotee.gender)}
              </h3>
              <button onClick={() => setSelectedDevotee(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* 身份 */}
            <div className="mb-4">
              {selectedDevotee.sourceType === '會員' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-temple-gold/20 text-temple-dark">
                  <UserPlus className="w-3 h-3" /> 會員
                </span>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    <BookUser className="w-3 h-3" /> {selectedDevotee.sourceLabel}
                  </span>
                  <span className="text-xs text-gray-400">所屬：{selectedDevotee.ownerName}{selectedDevotee.ownerPhone ? ` · ${selectedDevotee.ownerPhone}` : ''}</span>
                </div>
              )}
            </div>

            {/* 個人資料 */}
            <div className="space-y-2 text-sm mb-4">
              {selectedDevotee.phone && (
                <p className="text-gray-600 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" />{selectedDevotee.phone}</p>
              )}
              {selectedDevotee.birthDate && (
                <p className="text-gray-600">農曆生日：{selectedDevotee.birthDate}{selectedDevotee.zodiac ? `　生肖：${selectedDevotee.zodiac}` : ''}</p>
              )}
              {selectedDevotee.address && (
                <p className="text-gray-600 flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />{selectedDevotee.address}</p>
              )}
            </div>

            {/* 統計 */}
            <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs text-gray-500">點燈</span>
                <span className="ml-auto text-sm font-bold text-amber-700">{selectedDevotee.stats.lamps}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs text-gray-500">祈福</span>
                <span className="ml-auto text-sm font-bold text-blue-700">{selectedDevotee.stats.activities}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <HeartHandshake className="w-3.5 h-3.5 text-green-500" />
                <span className="text-xs text-gray-500">捐獻</span>
                <span className="ml-auto text-sm font-bold text-green-700">
                  {selectedDevotee.stats.donation > 0 ? `NT$${selectedDevotee.stats.donation.toLocaleString()}` : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-xs text-gray-500">問事</span>
                <span className="ml-auto text-sm font-bold text-purple-700">{selectedDevotee.stats.bookingCount}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Bulletins Tab (公佈欄管理) ────────────────────────────────────────────────

const BulletinsTab = ({ bulletins, onRefresh }: { bulletins: BulletinRecord[]; onRefresh: () => void }) => {
  const emptyForm: BulletinData = {
    title: '', content: '', category: BulletinCategory.GENERAL,
    isPinned: false, publishAt: null, linkedService: null,
  };
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BulletinData>(emptyForm);
  const [saving, setSaving] = useState(false);
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
    });
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
        <table className="w-full text-sm">
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
                <td className="px-5 py-4 font-medium text-gray-800">{b.title}</td>
                <td className="px-5 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${categoryColor(b.category)}`}>{b.category}</span>
                </td>
                <td className="px-5 py-4 text-gray-500">
                  {publishStatus(b) ?? <span className="text-xs text-green-600">已發布</span>}
                  <div className="text-xs text-gray-400 mt-0.5">{fmtDate(b.createdAt)}</div>
                </td>
                <td className="px-5 py-4 text-center">
                  <button onClick={() => handleTogglePin(b)}
                    className={`p-1.5 rounded-lg transition-colors ${b.isPinned ? 'text-temple-gold hover:bg-yellow-50' : 'text-gray-300 hover:bg-gray-100'}`}>
                    {b.isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                  </button>
                </td>
                <td className="px-5 py-4 text-center">
                  {b.linkedService ? (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${categoryColor(b.category)}`}>
                      {serviceLabel[b.linkedService] ?? b.linkedService}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
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
          onDragStart: dDragStart, onDragOver: dDragOver, onDrop: dDrop, onDragEnd: dDragEnd,
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
        <table className="w-full text-sm">
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
                <td className="px-3 py-4 text-gray-300 cursor-grab active:cursor-grabbing"><GripVertical className="w-4 h-4" /></td>
                <td className="px-6 py-4">
                  {d.imagePath ? (
                    <img src={getSiteImagePublicUrl(d.imagePath)} alt={d.name} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center"><Flame className="w-5 h-5 text-gray-300" /></div>
                  )}
                </td>
                <td className="px-6 py-4 font-medium text-gray-800">
                  {d.name}
                  {!d.isVisible && <span className="ml-2 text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">已隱藏</span>}
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {d.hallId ? (halls.find(h => h.id === d.hallId)?.name ?? '-') : '-'}
                </td>
                <td className="px-6 py-4 text-gray-500">{d.title || '-'}</td>
                <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{d.description}</td>
                <td className="px-6 py-4 text-right flex items-center justify-end gap-3">
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

const SCRIPTURE_STORAGE_BASE = `https://keosbjepuvqqqhzyuplb.supabase.co/storage/v1/object/public/site-images`;

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
        <table className="w-full text-sm">
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
          onDragStart: cDragStart, onDragOver: cDragOver, onDrop: cDrop, onDragEnd: cDragEnd,
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
      r.status, r.notes || '', fmtDate(r.createdAt)
    ]), ['服務項目', '姓名', '電話', '性別', '農曆生日', '生肖', '現居地址', '狀態', '備註', '建立時間']);
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
            <table className="w-full text-sm">
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
                    <td className="px-3 py-3 text-gray-300 cursor-grab active:cursor-grabbing"><GripVertical className="w-4 h-4" /></td>
                    <td className="px-4 py-3">
                      {c.imageUrl
                        ? <img src={c.imageUrl} alt={c.name} className="w-10 h-10 object-cover rounded-lg border border-gray-100" />
                        : <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center"><Flame className="w-4 h-4 text-gray-300" /></div>}
                    </td>
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
                onClick={() => setQuickView({ name: r.name, phone: r.phone, gender: r.gender || undefined, birthDate: r.birthDate || undefined, zodiac: r.zodiac || undefined, address: r.address || undefined, notes: r.notes || undefined, status: r.status, serviceLabel: `點燈 · ${getServiceName(r.serviceId)}`, createdAt: r.createdAt, contactLabel: r.contactLabel })}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
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
  fee: 0, packages: [], addons: [], imageUrl: '', isActive: true, sortOrder: 0,
});

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
          onDragStart: eDragStart, onDragOver: eDragOver, onDrop: eDrop, onDragEnd: eDragEnd,
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
      registrationDeadline: e.registrationDeadline ? e.registrationDeadline.slice(0, 16) : '',
      fee: e.fee, packages: e.packages || [], addons: e.addons || [], imageUrl: e.imageUrl || '', isActive: e.isActive, sortOrder: e.sortOrder,
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
        r.gender || '', r.birthDate || '', r.zodiac || '', r.address || '', r.notes || '', r.status, fmtDate(r.createdAt)
      ]),
      ['姓名', '電話', '方案', '費用', '加購項目', '加購小計', '性別', '生日', '生肖', '地址', '備註', '狀態', '報名時間']
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
              <table className="w-full min-w-[700px]">
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
                      onClick={() => setQuickView({ name: r.name, phone: r.phone, birthDate: r.birthDate || undefined, zodiac: r.zodiac || undefined, gender: r.gender || undefined, address: r.address || undefined, notes: r.notes || undefined, status: r.status, serviceLabel: `祈福 · ${selectedEvent?.title ?? ''}`, createdAt: r.createdAt })}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                        {r.gender && <span className="text-xs text-gray-400">{r.gender}</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{r.phone}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {r.packageName
                          ? <span className="inline-flex flex-col gap-0.5">
                              <span className="text-xs font-medium text-temple-red">{r.packageName}</span>
                              {r.packageFee !== undefined && <span className="text-xs text-gray-400">NT${r.packageFee.toLocaleString()}</span>}
                            </span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[160px]">
                        {r.selectedAddons && r.selectedAddons.length > 0
                          ? <span className="text-xs leading-relaxed">
                              {r.selectedAddons.map(a => `${a.name}(NT$${a.fee.toLocaleString()})`).join(' / ')}
                            </span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {r.birthDate && <p>{r.birthDate}</p>}
                        {r.zodiac && <p className="text-xs">{r.zodiac}年</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[140px] truncate">{r.address || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[120px] truncate">{r.notes || '—'}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <select value={r.status} disabled={updatingRegId === r.id}
                          onChange={e => handleRegStatus(r.id, e.target.value as BlessingStatus)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-temple-red">
                          {Object.values(BlessingStatus).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">活動圖片</label>
                {form.imageUrl && (
                  <div className="relative mb-2">
                    <img src={form.imageUrl} alt="預覽" className="w-full h-36 object-cover rounded-lg border border-gray-200" />
                    <button type="button" onClick={() => setForm(f => ({ ...f, imageUrl: '' }))}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <label className={`flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg text-sm cursor-pointer transition-colors ${uploadingBlessingImg ? 'opacity-50 cursor-not-allowed' : 'border-gray-300 hover:border-temple-red hover:text-temple-red text-gray-500'}`}>
                  <Upload className="w-4 h-4" />
                  {uploadingBlessingImg ? '上傳中…' : form.imageUrl ? '更換圖片' : '上傳圖片'}
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
                            <div className="grid grid-cols-2 gap-2">
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
                <GripVertical className="w-5 h-5 text-gray-300 cursor-grab active:cursor-grabbing shrink-0" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...projects].sort((a, b) => a.sortOrder - b.sortOrder).map(proj => {
            const raised = totals[proj.id] || 0;
            const pct = proj.targetAmount > 0 ? Math.min(100, Math.round((raised / proj.targetAmount) * 100)) : null;
            return (
              <div key={proj.id} className={`border rounded-xl overflow-hidden bg-white shadow-sm transition-all ${proj.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                {proj.imageUrl && (
                  <img src={proj.imageUrl} alt={proj.name} className="w-full h-40 object-cover" />
                )}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-800">{proj.name}</p>
                      {proj.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{proj.description}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${proj.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                      {proj.isActive ? '啟用' : '已下架'}
                    </span>
                  </div>
                  {pct !== null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>已募 NT${raised.toLocaleString()}</span>
                        <span>目標 NT${proj.targetAmount.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-temple-red rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-right text-xs font-semibold text-temple-red">{pct}%</p>
                    </div>
                  )}
                  {proj.targetAmount === 0 && (
                    <p className="text-xs text-gray-400">已募 NT${raised.toLocaleString()}</p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => openEdit(proj)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" /> 編輯
                    </button>
                    <button onClick={() => handleDelete(proj.id)} disabled={deletingId === proj.id}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
                  <img src={form.imageUrl} alt="preview" className="w-full h-40 object-cover rounded-lg mb-2" />
                )}
                <label className={`flex items-center justify-center gap-2 w-full py-2.5 border-2 border-dashed rounded-lg cursor-pointer text-sm transition-colors ${uploadingImg ? 'border-gray-200 text-gray-300' : 'border-temple-gold/40 text-temple-red hover:border-temple-gold hover:bg-temple-gold/5'}`}>
                  <Upload className="w-4 h-4" />
                  {uploadingImg ? '上傳中...' : (form.imageUrl ? '更換照片' : '上傳照片')}
                  <input type="file" className="hidden" accept="image/*" disabled={uploadingImg} onChange={handleImageUpload} />
                </label>
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
          <table className="w-full text-sm">
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
                    <td className="px-5 py-3 text-gray-400 whitespace-nowrap text-xs">{fmtDate(row.date)}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{row.name}</td>
                    <td className="px-5 py-3 text-gray-500">{row.phone}</td>
                    <td className="px-5 py-3">{typeBadge(row.typeKey, row.type)}</td>
                    <td className="px-5 py-3 text-gray-600 max-w-[180px] truncate" title={row.detail}>{row.detail}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-800">NT$ {row.amount.toLocaleString()}</td>
                    <td className="px-5 py-3">{statusBadge(row.status)}</td>
                    <td className="px-5 py-3">
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
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

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack, role }) => {
  const [tab, setTab] = useState<Tab>(role === 'finance' ? 'receivables' : 'overview');
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchAll = async (initial = false) => {
    if (initial) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const [b, d, bl, si, dt, hl, hs, sv, lc, lr, mp, ac, ll, ar, be, br] = await Promise.all([getBookings(), getDonations(), getBulletins(true), getSiteImages(), getDeities(), getDeityHalls().catch(() => [] as HallRecord[]), getHeroSlides(), getScriptureVerses(), getLampServiceConfigs().catch(() => [] as LampServiceConfig[]), getLampRegistrations().catch(() => [] as LampRegistrationRecord[]), getAllMemberProfiles().catch(() => [] as MemberProfileRecord[]), getMemberContacts().catch(() => [] as MemberContact[]), getUsersLastLogin().catch(() => ({} as Record<string, string>)), getRegistrations().catch(() => [] as RegistrationRecord[]), getBlessingEvents().catch(() => [] as BlessingEventRecord[]), getBlessingRegistrations().catch(() => [] as BlessingRegistrationRecord[])]);
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
    { key: 'bulletins', label: '公佈欄管理', icon: <Megaphone className="w-4 h-4" /> },
    { key: 'deities',   label: '神明資訊',   icon: <Flame className="w-4 h-4" /> },
    { key: 'members',   label: '會員資訊',   icon: <Users className="w-4 h-4" /> },
    { key: 'devotees',  label: '信眾資訊',   icon: <BookUser className="w-4 h-4" /> },
    { key: 'bookings',  label: '問事管理',   icon: <BookOpen className="w-4 h-4" /> },
    { key: 'lamps',     label: '點燈管理',   icon: <Flame className="w-4 h-4" /> },
    { key: 'blessings', label: '祈福管理',   icon: <Sparkles className="w-4 h-4" /> },
    { key: 'repairs',   label: '修復專案',   icon: <Wrench className="w-4 h-4" /> },
    { key: 'donations',    label: '捐獻管理',   icon: <HeartHandshake className="w-4 h-4" /> },
    { key: 'receivables', label: '應收管理',   icon: <Banknote className="w-4 h-4" /> },
    { key: 'photos',      label: '照片管理',   icon: <ImageIcon className="w-4 h-4" /> },
    { key: 'scripture', label: '天上聖母經', icon: <BookOpenCheck className="w-4 h-4" /> },
  ];
  const allowed = ROLE_ALLOWED_TABS[role];
  const navItems = allNavItems.filter(n => allowed.includes(n.key));

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-56 bg-temple-dark text-white flex flex-col shrink-0">
        <div className="px-5 py-6 border-b border-white/10">
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
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ key, label, icon }) => {
            const badgeCount =
              key === 'lamps'     ? lampRegistrations.filter(r => r.status === LampRegistrationStatus.PENDING).length
              : key === 'blessings' ? blessingRegistrations.filter(r => r.status === BlessingStatus.PENDING).length
              : key === 'bookings'  ? bookings.filter(b => b.status === BookingStatus.PENDING).length
              : key === 'donations' ? donations.filter(d => d.createdAt && (Date.now() - new Date(d.createdAt).getTime()) < 86400000).length
              : 0;
            return (
              <button key={key} onClick={() => setTab(key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
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
          <button onClick={() => fetchAll(false)} disabled={refreshing}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> 重新整理
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
              {tab === 'overview'  && <OverviewTab bookings={bookings} donations={donations} lampRegistrations={lampRegistrations} blessingRegistrations={blessingRegistrations} lampConfigs={lampConfigs} blessingEvents={blessingEvents} />}
              {tab === 'bookings'  && <BookingsTab bookings={bookings} onStatusChange={handleStatusChange} updatingId={updatingId} memberProfiles={memberProfiles} />}
              {tab === 'donations' && <DonationsTab donations={donations} memberProfiles={memberProfiles} />}
              {tab === 'members'   && <MembersTab bookings={bookings} donations={donations} lampRegistrations={lampRegistrations} registrations={allRegistrations} blessingRegistrations={blessingRegistrations} blessingEvents={blessingEvents} lampConfigs={lampConfigs} memberProfiles={memberProfiles} usersLastLogin={usersLastLogin} />}
              {tab === 'devotees'  && <DevoteesTab memberProfiles={memberProfiles} allContacts={allContacts} bookings={bookings} donations={donations} lampRegistrations={lampRegistrations} registrations={allRegistrations} />}
              {tab === 'bulletins' && <BulletinsTab bulletins={bulletins} onRefresh={fetchAll} />}
              {tab === 'deities'  && <DeitiesTab deities={deitiesList} halls={deityHalls} onRefresh={fetchAll} />}
              {tab === 'photos'   && <PhotosTab siteImages={siteImages} heroSlides={heroSlidesList} onRefresh={fetchAll} />}
              {tab === 'scripture' && <ScriptureTab verses={scriptureVerses} onRefresh={fetchAll} />}
              {tab === 'lamps'     && <LampsTab configs={lampConfigs} registrations={lampRegistrations} onRefresh={fetchAll} memberProfiles={memberProfiles} />}
              {tab === 'blessings' && <BlessingsTab events={blessingEvents} registrations={blessingRegistrations} onRefresh={fetchAll} memberProfiles={memberProfiles} />}
              {tab === 'repairs'      && <RepairProjectsTab onRefresh={fetchAll} />}
              {tab === 'receivables' && <ReceivablesTab lampRegistrations={lampRegistrations} lampConfigs={lampConfigs} blessingRegistrations={blessingRegistrations} blessingEvents={blessingEvents} donations={donations} memberProfiles={memberProfiles} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
