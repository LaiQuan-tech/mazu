import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { isValidGa4, isValidGtm, isValidPixel } from './Analytics';
import { queueConfirmEmail } from '../services/notifyConfirm';
import { lampAmount, blessingAmount } from '../services/serviceAmount';
import { getBookings, updateBookingStatus, updateBookingDivineMessage, getDonations, getBulletins, createBulletin, updateBulletin, deleteBulletin, getRegistrations, deleteRegistration, uploadBulletinImage, getAnalyticsSettings, saveAnalyticsSettings, getSocialSettings, saveSocialSettings, getDevoteeOverrides, saveDevoteeOverride, deleteDevoteeOverride, getSiteImages, uploadSiteImage, getSiteImagePublicUrl, getDeities, createDeity, updateDeity, deleteDeity, uploadDeityImage, getDeityHalls, createDeityHall, updateDeityHall, deleteDeityHall, getHeroSlides, uploadHeroSlide, deleteHeroSlide, getScriptureVerses, updateScriptureVerse, uploadScriptureImage, deleteScriptureImage, getLampServiceConfigs, createLampServiceConfig, updateLampServiceConfig, deleteLampServiceConfig, getLampRegistrations, updateLampRegistrationStatus, deleteLampRegistration, getAllMemberProfiles, getMemberContactsByUserId, getMemberContacts, getUsersLastLogin, getBlessingEvents, createBlessingEvent, updateBlessingEvent, deleteBlessingEvent, getBlessingRegistrations, updateBlessingRegistrationStatus, deleteBlessingRegistration, uploadBlessingImage, uploadLampImage, getLampChoices, saveLampChoices, getLampChoiceCounts, getRepairProjects, getRepairProjectTotals, createRepairProject, updateRepairProject, deleteRepairProject, uploadRepairProjectImage, getLineClickStats, getBookingSessions, getDeityFeasts, createBookingSession, updateBookingSession, deleteBookingSession, getBookingCountsBySession, getUrgentPrayers, getFahuiRegistrations, updateFahuiStatus, updateFahuiReconcile, updateFahuiEntries, updateFahuiContact, deleteFahuiRegistration, getVolunteerRegistrations, updateVolunteerStatus, deleteVolunteerRegistration, getAllMemberContactsAdmin, createBlessingRegistration, submitBooking, submitLampRegistration, updateDonationStatus, supabase } from '../services/supabase';
import AdminAboutTab from './AdminAboutTab';
import AdminRelocationTab from './AdminRelocationTab';
import AdminFaqTab from './AdminFaqTab';
import AdminHomeVideoSection from './AdminHomeVideoSection';
import AdminScriptureFullText from './AdminScriptureFullText';
import AdminVouchersTab from './AdminVouchersTab';
import { useOpenRows, RowMoreCell } from './AdminRowMore';
import { ReceiptIssueDialog, ReceiptGroup, ReceiptListPanel, ReceiptSettingsPanel, useTempleInfo } from './AdminReceipts';
import ReceiptPrint from './ReceiptPrint';
import { ReceiptRecord, getReceipts, receiptsBySource } from '../services/receipts';
import AdminFeastsTab from './AdminFeastsTab';
import { resolveFeastDate, feastRuleLabel, weekdayLabel, solarToLunarLabel } from '../services/lunarCalendar';
import { TAG_SOLID, TAG_GOLD, TAG_BROWN, TAG_STATE_OVER } from './tagStyles';
import AdminShowerTab from './AdminShowerTab';
import AdminUrgentTab from './AdminUrgentTab';
import AdminDonationTypesTab from './AdminDonationTypesTab';
import AdminSiteInfoTab from './AdminSiteInfoTab';
import { FAHUI_SERVICE_META, fahuiEntryAmount } from '../services/fahuiServices';
import { buildFahuiSheets } from '../services/fahuiWorkbook';
import { buildDevoteeRoster, toNameKey, toBirthKey, DevoteeOverride, DevoteeRecord, DevoteeRow, RosterSources } from '../services/devoteeRoster';
import { readChoiceTag, parseChoiceLines, formatChoiceLines, lampSeasonStart, choiceFor, withChoiceTag, remainingFor, type LampChoices } from '../services/lampChoice';
import { RELATION_OPTIONS, ConsultationType, AdminRole, DeityFeast, ADMIN_ROLE_LABEL, ROLE_ALLOWED_TABS, AnalyticsSettings, SocialSettings, SOCIAL_KEYS, BlessingAddon, BlessingEventData, BlessingEventPackage, BlessingEventRecord, BlessingRegistrationRecord, BlessingStatus, BookingRecord, BookingSessionData, BookingSessionRecord, BookingStatus, BulletinCategory, BulletinData, BulletinRecord, DeityData, DeityRecord, DonationRecord, DonationStatus, FahuiRegistrationRecord, FahuiPaymentMethod, FahuiReconcilePatch, FAHUI_PAYMENT_METHODS, VolunteerRegistrationRecord, HallData, HallRecord, HeroSlideRecord, LampRegistrationRecord, LampRegistrationStatus, LampServiceConfig, LampServiceConfigData, MemberContact, MemberProfileRecord, RegistrationRecord, UrgentPrayerRecord, UrgentPrayerStatus, RepairProject, RepairProjectData, ScriptureVerseRecord, SiteImageRecord, SiteImageSection, ZodiacSign } from '../types';
import {
  ArrowLeft, RefreshCw, Calendar, Clock, User, Phone,
  FileText, CheckCircle, XCircle, Clock3, LayoutDashboard,
  BookOpen, HeartHandshake, Search, Download, ChevronDown,
  TrendingUp, Users, Banknote, AlertCircle, LogOut,
  Megaphone, Plus, Edit2, Trash2, Pin, PinOff, X, Menu, UserPlus, ClipboardList, ArrowRight,
  Image as ImageIcon, Upload, Flame, GripVertical, Save, BookOpenCheck, List, BookUser, Settings, Share2,
  ChevronUp, ChevronsUpDown, CalendarClock, Activity, Sparkles, MapPin, Baby, ShowerHead,
  Eye, EyeOff, ShoppingBag, Wrench, Receipt, Send, Check, Home} from 'lucide-react';

type Tab = 'vouchers' | 'traffic' | 'feasts' | 'analytics' | 'social' | 'siteinfo' | 'about' | 'relocation' | 'faq' | 'overview' | 'fahui' | 'volunteer' | 'roster' | 'bookings' | 'donations' | 'repairs' | 'members' | 'bulletins' | 'photos' | 'deities' | 'scripture' | 'lamps' | 'blessings' | 'receivables' | 'shower' | 'urgent';

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

/**
 * 收款操作鈕：點燈／祈福共用，刻意與法會那顆長得一樣。
 *
 * 廟方 2026-10-13：「點燈／祈福跟法會一樣，要匯款，由後台按標記已收款」。
 * 原本這兩處是四選一的狀態下拉，而廟方真正在做的只有一件事——「錢收到了」。
 * 下拉要點兩下、還要在四個選項裡挑，而三種要匯款的服務各長一個樣子。
 *
 * **取消做成小圖示、跟主按鈕拉開**：那是破壞性的語意（信眾看不到，但統計與
 * 應收都會把它排除），不能挨著每天要按幾十次的那顆。同揪團刪除鈕的理由。
 * 已取消的那一列給「還原」，按錯才回得來。
 */
const PaymentActions = <T extends string>({ status, pending, confirmed, cancelled, busy, onChange }: {
  status: T; pending: T; confirmed: T; cancelled: T;
  busy: boolean; onChange: (next: T) => void;
}) => {
  const isPaid = status === confirmed;
  const isCancelled = status === cancelled;
  return (
    <div className="flex items-center gap-1">
      {isCancelled ? (
        <button onClick={() => onChange(pending)} disabled={busy}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50">
          還原為待匯款
        </button>
      ) : (
        <>
          <button onClick={() => onChange(isPaid ? pending : confirmed)} disabled={busy}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
              isPaid ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-600 text-white hover:bg-green-700'
            }`}>
            {isPaid ? '改回待匯款' : '標記已收款'}
          </button>
          <button onClick={() => onChange(cancelled)} disabled={busy}
            title="標記取消" aria-label="標記取消"
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
            <XCircle className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
};

/**
 * 問事的狀態按鈕（2026-11-18 廟方：「操作按鈕，最好不要用選單，因為選單要點選二次以上」）。
 * 原本是四選一的下拉；廟方實際只做兩件事：待處理 → 確認、確認 → 完成。主按鈕永遠是「下一步」，
 * 取消是小圖示跟主按鈕拉開（同 PaymentActions），已完成／已取消給一顆灰的退回鈕，按錯救得回來。
 */
const BookingActions = ({ status, busy, onChange }: {
  status?: BookingStatus | string; busy: boolean; onChange: (next: BookingStatus) => void;
}) => {
  const s = status || BookingStatus.PENDING;
  const grey = 'px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50';
  if (s === BookingStatus.CANCELLED) return (
    <button onClick={() => onChange(BookingStatus.PENDING)} disabled={busy} className={grey}>還原為待處理</button>
  );
  if (s === BookingStatus.COMPLETED) return (
    <button onClick={() => onChange(BookingStatus.CONFIRMED)} disabled={busy} className={grey}>改回已確認</button>
  );
  const isConfirmed = s === BookingStatus.CONFIRMED;
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(isConfirmed ? BookingStatus.COMPLETED : BookingStatus.CONFIRMED)} disabled={busy}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50 whitespace-nowrap ${
          isConfirmed ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
        {isConfirmed ? '標記已完成' : '確認預約'}
      </button>
      <button onClick={() => onChange(BookingStatus.CANCELLED)} disabled={busy}
        title="標記取消" aria-label="標記取消"
        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
        <XCircle className="w-4 h-4" />
      </button>
    </div>
  );
};

/**
 * 篩選用的一排按鈕，取代下拉選單（2026-11-18 廟方：「操作最好不要用下拉選單，因為選單要點選二次以上」）。
 * 一按就篩、再按同一顆取消；有給 count 就把筆數寫在鈕上——下拉看不到每一類有幾筆。
 * count 為 0 的選項不畫（除非正選著），免得一排都是點了也是空的鈕。
 */
const FilterChips = ({ value, onChange, allLabel, allCount, options }: {
  value: string; onChange: (v: string) => void; allLabel: string; allCount?: number;
  options: { value: string; label?: string; count?: number }[];
}) => {
  const chip = (on: boolean) => `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
    on ? 'bg-temple-red text-white border-temple-red' : 'bg-white text-gray-600 border-gray-300 hover:border-temple-red hover:text-temple-red'}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => onChange('')} className={chip(!value)}>
        {allLabel}{allCount !== undefined ? ` ${allCount}` : ''}
      </button>
      {options.filter(o => o.count === undefined || o.count > 0 || o.value === value).map(o => (
        <button key={o.value} type="button" aria-pressed={value === o.value}
          onClick={() => onChange(value === o.value ? '' : o.value)} className={chip(value === o.value)}>
          {o.label ?? o.value}{o.count !== undefined ? ` ${o.count}` : ''}
        </button>
      ))}
    </div>
  );
};

const statusBadge = (status?: BookingStatus | LampRegistrationStatus | BlessingStatus | string) => {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    // 收款那一組（點燈／祈福／法會）。顏色與 fahuiStatusBadge 一致：黃＝還沒收、綠＝收到了
    '待匯款': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock3 className="w-3 h-3" /> },
    '已收款': { bg: 'bg-green-100',  text: 'text-green-800',  icon: <CheckCircle className="w-3 h-3" /> },
    // 處理進度那一組：問事現場收費、沒有收款環節，維持原本的語彙（見 types.ts）
    '待處理': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock3 className="w-3 h-3" /> },
    '已確認': { bg: 'bg-blue-100',   text: 'text-blue-800',   icon: <CheckCircle className="w-3 h-3" /> },
    '已完成': { bg: 'bg-green-100',  text: 'text-green-800',  icon: <CheckCircle className="w-3 h-3" /> },
    // 舊的祈福待確認。點燈／祈福讀進來就折成新值了，這一筆是為了別處萬一直接印原值
    '待確認': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock3 className="w-3 h-3" /> },
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

// ─── 空值 ────────────────────────────────────────────────────────────────────
/**
 * 表格裡「這一格沒有資料」的唯一寫法（2026-11-17 廟方：「後台的表單，目前有很多都是欄位資訊每行都重複，
 * 這種都是閱讀干擾」）。
 *
 * 原本各表各寫各的：`'—'`、灰色的 —、斜體的「無備註」。桌機上一整欄的 — 已經是雜訊，
 * **手機的卡片版更糟**——每一格都帶自己的欄名（data-label），於是每張卡都印一排
 * 「方案 —／加購 —／備註 —」，真正有內容的兩三格被淹在裡面。
 * 統一成這一支之後，`index.css` 在卡片版把「只有它」的格子整格藏起來（`.admin-empty`）。
 * **新的表格遇到空值一律用它，不要再寫 '—'**，否則手機上又會長回那一排。
 */
const Dash = () => <span className="admin-empty text-gray-300" aria-label="無">—</span>;

/** 一整欄都沒有資料就整欄不畫（表頭與每一格一起）。有任何一列有值就會自己回來 */
function anyFilled<T>(rows: T[], get: (r: T) => unknown): boolean {
  return rows.some(r => { const v = get(r); return Array.isArray(v) ? v.length > 0 : v != null && v !== '' && v !== 0; });
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

/**
 * 總覽頂端的數字卡。手機 2×2 一格只有 160px 寬，所以圖示在上、數字在下，
 * 寬螢幕（xl）才改回圖示在左。給了 `onClick` 才是按鈕（點了跳那一頁）。
 */
const StatCard = ({ icon, label, value, sub, color, onClick }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: React.ReactNode; color: string; onClick?: () => void;
}) => {
  const cls = 'bg-white rounded-xl shadow-sm border border-gray-100 p-3.5 sm:p-5 flex flex-col xl:flex-row xl:items-center gap-2 xl:gap-4 min-w-0 text-left';
  // button 裡只能放 phrasing content，所以全部用 span
  const inner = (
    <>
      <span className={`p-2 sm:p-3 rounded-xl w-fit shrink-0 ${color}`}>{icon}</span>
      <span className="block min-w-0">
        <span className="flex items-center gap-1 text-sm text-gray-500">
          <span className="truncate">{label}</span>
          {onClick && <ArrowRight className="w-3.5 h-3.5 shrink-0 text-gray-400" aria-hidden="true" />}
        </span>
        <span className="block text-lg sm:text-2xl font-bold text-gray-900 break-words">{value}</span>
        {sub && <span className="block text-xs text-gray-400 mt-0.5 break-words">{sub}</span>}
      </span>
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} hover:border-temple-gold transition-colors`}>{inner}</button>
    : <div className={cls}>{inner}</div>;
};

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
  /** 報名時自填的信箱（選填）。捐獻沒有這一欄 */
  email?: string;
  /** 寄給信眾那封信的寄出時間。工作人員要看得出「這個人到底收到通知了沒」 */
  confirmSentAt?: string;
  /**
   * 寄給信眾的是哪一種信。三種的觸發時機不同，所以後台要講不一樣的話：
   *   `confirm` 問事——現場收費，廟方改成「已確認」時寄（預設）
   *   `paid`    點燈／祈福／法會——要先匯款，廟方按「標記已收款」時寄
   *   `thanks`  捐獻——不等確認，送出當下就寄
   */
  mailKind?: 'confirm' | 'paid' | 'thanks';
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
              {/* 確認信：工作人員按下「已確認」之後要看得出這個人到底收到通知了沒。
                  沒有這一行的話，「沒留信箱所以沒寄」與「寄了」在畫面上一模一樣，
                  工作人員會以為信眾都知道了（這封信存在的理由就是讓信眾知道）。
                  **捐獻不會走到這裡**：它沒有「已確認」這個狀態，也沒有收信箱。 */}
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-400 w-14 shrink-0 pt-0.5">
                  {reg.mailKind === 'thanks' ? '感謝信' : '確認信'}
                </span>
                {reg.confirmSentAt ? (
                  <span className="text-xs text-green-700">
                    已寄出　{fmtDate(reg.confirmSentAt)}
                    {reg.email ? <span className="block text-gray-400">{reg.email}</span> : null}
                  </span>
                ) : reg.email ? (
                  <span className="text-xs text-gray-500">
                    {/* 捐獻是送出當下寄的，所以「有信箱卻還沒寄出」代表那一封沒寄成功，
                        不是「還在等廟方確認」；而點燈／祈福等的是收款不是確認。
                        三種講一樣的話，工作人員就不知道自己該按哪一顆 */}
                    {reg.mailKind === 'thanks' ? '尚未寄出（可能寄送失敗）'
                      : reg.mailKind === 'paid' ? '按「標記已收款」時寄至'
                      : '改為「已確認」時寄至'}
                    <span className="block text-gray-700">{reg.email}</span>
                  </span>
                ) : (
                  /* 會員帳號那條備援在後端用電話比對，前端這裡拿不到帳號的信箱，
                     所以寫「若⋯」而不是斷定——寫死會變成騙工作人員 */
                  <span className="text-xs text-gray-500">
                    未留信箱。若此電話對得上用信箱註冊的會員，會寄到那個帳號，否則不寄。
                  </span>
                )}
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

/**
 * 一筆紀錄與會員帳號的關係。**三種的可信度完全不同，畫面上一定要分得出來**：
 *
 * | 來源 | 可信度 | 樣子 |
 * |---|---|---|
 * | 這一筆就是帳號自己的資料（`會員` 管道） | 事實 | 實心 |
 * | 這個人在某個帳號的通訊錄裡（綁 `user_id`） | 事實，但他不是帳號本人 | 實線框＋「的通訊錄」 |
 * | 只用電話對到的 | **推測** | 虛線框＋「同電話」 |
 *
 * 最後那一種是真正危險的：一家人常共用一支號碼，兒子的報名會對到母親的帳號。
 * **所以「對到的正是這一列自己的帳號」要另外講**（標「本人」）——不分開的話，
 * 「他自己的點燈」與「兒子借媽媽電話報名」在畫面上長得一模一樣，
 * 虛線想警告的那一種就被稀釋掉了。
 */
const AccountCell = ({ rec, own }: { rec: DevoteeRecord; own: string[] }) => {
  const dim = <Dash />;

  // 事實一：這一筆就是那個帳號自己的資料。**沒編號也還是會員**，所以不能靠編號判斷
  if (rec.isMemberSelf) return (
    <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium"
      title="這一筆就是這個會員帳號自己的資料">
      {rec.memberNumber || '會員（未編號）'}
    </span>
  );

  // 事實二：通訊錄綁 user_id，知道是誰的通訊錄（這個人是那位會員的家人，不是本人）
  if (rec.contactOf) return (
    <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200"
      title="他出現在這個會員的通訊錄裡（通訊錄綁帳號，這是查得到的事實）；他本人不一定有帳號">
      {rec.contactOf} 的通訊錄
    </span>
  );

  if (rec.linkedMembers.length > 0) {
    const mine = rec.linkedMembers.filter(n => own.includes(n));
    const others = rec.linkedMembers.filter(n => !own.includes(n));
    return (
      <span className="inline-flex flex-wrap gap-1">
        {mine.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200"
            title="這支電話對到的正是這一列自己的會員帳號，所以這筆報名幾乎確定是他本人送的">
            {mine.join('、')}<span className="ml-1 text-[10px] text-blue-400">本人</span>
          </span>
        )}
        {others.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-dashed border-blue-200"
            title="只靠電話對到的，報名本身沒有記帳號；一家人共用一支號碼時會對到親屬的帳號，僅供參考">
            {others.join('、')}<span className="ml-1 text-[10px] text-blue-400">同電話</span>
          </span>
        )}
      </span>
    );
  }
  return dim;
};

/**
 * 稱謂／關係。**跟 `AccountCell` 一樣，兩種可信度不可以畫成一樣**：
 *
 * | 來源 | 知道「對誰」嗎 | 樣子 |
 * |---|---|---|
 * | 通訊錄（`member_contacts` 綁 `user_id`） | 知道 → 事實 | 實線框「#007 的兒女」 |
 * | 報名表的 `contact_label` | **不知道** | 虛線框「報名填兒女」 |
 *
 * 後面那一種為什麼沒有主詞：全站報名都不需要登入，資料庫裡沒有欄位記著「這筆是誰送的」
 * （同 `devoteeRoster.linkMembersByPhone` 的理由）。所以「兒女」只能解讀成
 * 「某次報名時有人把他填成兒女」，**不可以寫成「某某人的兒女」**——那是在編造主詞。
 *
 * 「本人」不是人與人的關係，是「這筆報名就是填表人自己」，所以不進關係的框，
 * 只在完全沒有其他關係時用灰字交代一句，否則整欄會被「本人」洗掉。
 */
const RelationCell = ({ row }: { row: DevoteeRow }) => {
  const others = row.relations.filter(r => r && r !== '本人');
  // 通訊錄來的那幾個已經在 relationOf 裡有主詞了，不要再用無主詞的樣子重複講一次
  const sourced = new Set(row.relationOf.map(x => x.relation));
  const unsourced = others.filter(r => !sourced.has(r));

  if (row.relationOf.length === 0 && others.length === 0) {
    return row.relations.includes('本人')
      ? <span className="text-gray-400 text-xs" title="歷次報名都是填「本人」，沒有填過與其他人的關係">都是本人</span>
      : <Dash />;
  }

  return (
    <span className="inline-flex flex-wrap gap-1">
      {row.relationOf.map(({ tag, relation }) => (
        <span key={`${tag}-${relation}`}
          className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs whitespace-nowrap"
          title={`${tag} 的通訊錄把他記成「${relation}」。通訊錄綁帳號，所以「是誰的${relation}」是查得到的事實`}>
          {tag} 的{relation}
        </span>
      ))}
      {unsourced.map(r => (
        <span key={r}
          className="px-1.5 py-0.5 rounded-full bg-emerald-50/60 text-emerald-600 border border-dashed border-emerald-200 text-xs whitespace-nowrap"
          title="報名表上填的關係。報名不需登入，資料庫沒有記「這筆是誰送的」，所以只知道關係、不知道是對誰——要確認請看下方該筆紀錄的電話">
          報名填{r}
        </span>
      ))}
    </span>
  );
};

/**
 * 並列比對用的紀錄表：把一個人底下的每一筆原始紀錄攤開。
 *
 * ── 只印「不一樣的地方」（2026-10-30 大改）──
 * 廟方看著一個 9 筆的人問：「對我來說都是重複的資訊，這樣顯示有什麼意義。」
 * 他是對的——那 9 筆的電話、地址、性別、生日、生肖完全相同，表格卻把同一組
 * 身分資料重印了 9 次，真正在變的只有日期與管道。
 *
 * 所以**整欄只有一種值的，提到表格上面講一次就好**，表格只留會變的欄位。
 * 這張表的用途是「判斷是不是同一個人」，而判斷靠的正是差異；
 * 把相同的東西印滿整個畫面，反而會把唯一的那個差異淹掉。
 *
 * **完全一樣的列併成一列加 `×N`**：法會一張報名單上報了 3 個牌位，就是 3 筆
 * 同日期同管道同資料的「法會陽上」。分開列沒有任何資訊，只有長度。
 *
 * `own` 是這一列自己那幾個帳號的代稱，用來分辨「對到自己的帳號」與「對到別人的帳號」。
 */
const RecordTable = ({ records, own }: { records: DevoteeRecord[]; own: string[] }) => {
  const distinct = (pick: (r: DevoteeRecord) => string): string[] => {
    const s = new Set<string>();
    records.forEach(r => { const v = pick(r); if (v) s.add(v); });
    return [...s];
  };

  // 可以被提上去講一次的欄位。日期／管道／帳號／金額不在內：
  // 前兩個是這張表的軸，後兩個就算只有一種值也要逐筆對得起來。
  const HOISTABLE: Array<{ label: string; pick: (r: DevoteeRecord) => string }> = [
    { label: '生日', pick: r => r.birthDate },
    { label: '生肖', pick: r => r.zodiac },
    { label: '性別', pick: r => r.gender },
    { label: '電話', pick: r => r.phone },
    { label: '地址', pick: r => r.address },
    { label: '關係', pick: r => r.relation },
  ];
  const common: Array<{ label: string; value: string; missing: number }> = [];
  const varying = new Set<string>();
  HOISTABLE.forEach(({ label, pick }) => {
    const vs = distinct(pick);
    if (vs.length === 1) {
      // **沒填不等於有填成一樣的值。** 6 筆裡只有 1 筆填了「本人」時，
      // 寫成「共同的資料：關係 本人」就是在說那 6 筆都是本人——那是假的。
      // 所以把沒填的筆數一起講出來，才對得起「共同」兩個字。
      const missing = records.filter(r => !pick(r)).length;
      common.push({ label, value: vs[0], missing });
    } else if (vs.length > 1) varying.add(label);   // 0 種＝整欄都空，不必顯示也不必提
  });

  const hasAmount = records.some(r => r.amount > 0);
  // 帳號欄：值一樣也要留著——它是「這筆是誰送的」，逐筆對得起來才有意義
  const accountKey = (r: DevoteeRecord) =>
    `${r.isMemberSelf}|${r.memberNumber}|${r.contactOf}|${r.linkedMembers.join(',')}`;
  const hasAccount = distinct(r => accountKey(r) === 'false|||' ? '' : accountKey(r)).length > 0;

  // 完全一樣的列併起來
  const rowKey = (r: DevoteeRecord) => [
    r.at, r.source, accountKey(r), r.relation, r.gender, r.birthDate, r.zodiac, r.phone, r.address, r.amount,
  ].join('\u0001');
  const merged: Array<{ rec: DevoteeRecord; n: number }> = [];
  records.forEach(rec => {
    const k = rowKey(rec);
    const hit = merged.find(m => rowKey(m.rec) === k);
    if (hit) hit.n += 1; else merged.push({ rec, n: 1 });
  });

  const cols: string[] = ['日期', '管道'];
  if (hasAccount) cols.push('帳號');
  HOISTABLE.forEach(({ label }) => { if (varying.has(label)) cols.push(label); });
  if (hasAmount) cols.push('金額');

  return (
    <div className="space-y-2">
      {common.length > 0 && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
          <p className="text-[11px] text-gray-400 mb-1">這 {records.length} 筆共同的資料（沒有任何一筆填得不一樣，所以不逐筆重複）</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {common.map(c => (
              <span key={c.label} className="text-gray-600">
                <span className="text-gray-400">{c.label}</span>　{c.value}
                {c.missing > 0 && (
                  <span className="text-gray-400 ml-1"
                    title={`另外 ${c.missing} 筆這一欄是空的——沒填，不是填了不一樣的值`}>
                    （{c.missing} 筆未填）
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="admin-table w-full text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              {cols.map(h => (
                <th key={h} className="px-2.5 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {merged.map(({ rec, n }, i) => (
              <tr key={i} className="hover:bg-gray-50/60">
                <td data-label="日期" className="px-2.5 py-2 text-gray-400 whitespace-nowrap">{rec.at || <Dash />}</td>
                <td data-label="管道" className="px-2.5 py-2 whitespace-nowrap">
                  <span className="px-1.5 py-0.5 rounded-full bg-[#C49820]/10 text-[#7C5C1E]">{rec.source}</span>
                  {n > 1 && (
                    <span className="ml-1.5 text-gray-400"
                      title={rec.source === '法會陽上'
                        ? '同一張報名單上的多個牌位，每個牌位都要填陽上姓名，資料完全相同'
                        : '這幾筆的每一個欄位都相同'}>
                      ×{n}
                    </span>
                  )}
                </td>
                {hasAccount && (
                  <td data-label="帳號" className="px-2.5 py-2 whitespace-nowrap">
                    <AccountCell rec={rec} own={own} />
                  </td>
                )}
                {varying.has('生日') && <td data-label="生日" className="px-2.5 py-2 text-gray-700 whitespace-nowrap">{rec.birthDate || <Dash />}</td>}
                {varying.has('生肖') && <td data-label="生肖" className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{rec.zodiac || <Dash />}</td>}
                {varying.has('性別') && <td data-label="性別" className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{rec.gender || <Dash />}</td>}
                {varying.has('電話') && <td data-label="電話" className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{rec.phone || <Dash />}</td>}
                {varying.has('地址') && <td data-label="地址" className="px-2.5 py-2 text-gray-500 max-w-[200px] truncate" title={rec.address}>{rec.address || <Dash />}</td>}
                {varying.has('關係') && (
                  <td data-label="關係" className="px-2.5 py-2 whitespace-nowrap">
                    {rec.relation
                      ? <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px]"
                          title={rec.source === '通訊錄'
                            ? `${rec.contactOf} 的通訊錄把他記成「${rec.relation}」`
                            : '這一筆報名表上填的關係；主詞是送出這筆報名的人，資料庫沒有記那是誰'}>
                          {rec.relation}
                        </span>
                      : <Dash />}
                  </td>
                )}
                {hasAmount && <td data-label="金額" className="px-2.5 py-2 text-right text-gray-700 whitespace-nowrap">{rec.amount > 0 ? `$${rec.amount.toLocaleString()}` : <Dash />}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

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

const ROSTER_SOURCES = ['法會報名', '法會陽上', '志工', '會員', '通訊錄', '問事', '捐款', '點燈', '祈福', '活動報名'];

/**
 * 管道徽章上的數字代表什麼。**每一種數的東西不一樣，滑過去要講得出來**
 * （廟方 2026-10-30 問「法會陽上 5 是因為有會員幫她報名嗎」——不是，
 * 最常見的是同一張報名單上報了 5 個牌位，陽上姓名都填他自己）。
 */
const ROSTER_SOURCE_HINT: Record<string, string> = {
  法會報名: '他自己當聯絡人送出的報名單數。金額算在這裡。',
  法會陽上: '他的名字出現在幾個牌位／戶的「陽上姓名」欄。'
    + '一張報名單可以有很多個牌位，所以 5 通常是「同一張單報了 5 個牌位」，'
    + '不是「5 個人幫他報名」——點「檢視」看日期就分得出來：同一天＝同一張單。'
    + '陽上不計金額，錢算在聯絡人身上。',
  志工:     '志工報名的次數。',
  會員:     '他名下的會員帳號數（通常 1 個；有人同時有信箱帳號與 LINE 帳號）。',
  通訊錄:   '他被幾個會員加進親友通訊錄。',
  問事:     '問事預約的次數。',
  捐款:     '捐款的筆數。金額算在這裡。',
  點燈:     '點燈報名的次數。',
  祈福:     '祈福報名的次數。',
  活動報名: '舊的活動報名紀錄（這條路前台已經沒有在用了）。',
};

/**
 * **表格裡的管道徽章要合併顯示**（廟方 2026-10-30：「表格中就是看一個大概，
 * 參與管道中法會報名、法會陽上資料都太詳細了」）。
 *
 * 法會的兩種（自己當聯絡人送單／名字出現在別人的牌位上）在名冊的資料層是
 * **兩個不同的管道、必須分開存**——金額只算在報名單上，合在一起存就再也分不出
 * 誰該收錢。但那是對帳時才需要的精度，一張「看個大概」的表上並排兩顆徽章只是雜訊。
 *
 * 所以**只有顯示合併**：`DevoteeSource`、篩選下拉、匯出、「檢視」的逐筆紀錄
 * 全都維持原本的兩種。要看拆解點「檢視」。
 */
const ROSTER_BADGE_GROUPS: Array<{ label: string; keys: string[] }> = [
  { label: '法會', keys: ['法會報名', '法會陽上'] },
  ...['祈福', '點燈', '問事', '捐款', '志工', '通訊錄', '活動報名']
    .map(k => ({ label: k, keys: [k] })),
];

/**
 * **`會員` 刻意不在上面那張表裡。** 姓名那一格已經有一顆「會員 #007」的徽章
 * （`memberAccounts > 0` 時顯示），管道裡再放一顆講的是同一件事——同一列把同一個
 * 事實講兩次，而這張表的用途是「看一個大概」。
 *
 * **只是不顯示，資料沒有少**：`會員` 仍然是 `DevoteeSource` 的一員，篩選下拉、
 * 匯出、「檢視」的逐筆紀錄都還在，`stats.members` 也照樣算得到。
 */

/** 一列要顯示的徽章：合併後的標籤、總次數，以及滑過去的說明 */
const rosterBadges = (counts: Record<string, number>) =>
  ROSTER_BADGE_GROUPS
    .map(g => {
      const parts = g.keys
        .map(k => ({ k, n: counts[k] ?? 0 }))
        .filter(x => x.n > 0);
      const total = parts.reduce((s, x) => s + x.n, 0);
      if (total === 0) return null;
      // 合併的那顆要講得出 total 是哪幾種加起來的，否則數字會像憑空出現
      const hint = parts.length > 1
        ? parts.map(x => `${x.k} ${x.n}`).join('、') + '。'
          + ROSTER_SOURCE_HINT['法會陽上']
        : `${ROSTER_SOURCE_HINT[parts[0].k] ?? ''}${total > 1 ? `（目前 ${total}）` : ''}`;
      return { label: g.label, total, hint };
    })
    .filter((x): x is { label: string; total: number; hint: string } => x !== null);

/** 後台代為報名時寫進 `source` 欄的值（廟方 2026-10-30 指定）。
 *  **不要讓它退回 `getSource()`**：那會變成 `direct`，然後「流量來源」那一頁會
 *  告訴廟方「很多人自己直接找上門」，而實際上是工作人員一筆一筆手動加的。 */
const PROXY_SOURCE = 'admin/line';

/** yyyy-mm-dd（本地時區）。不可用 toISOString，台灣早上 8 點前會差一天 */
const todayYmd = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 代為報名：廟方在後台直接幫信眾報名祈福活動、問事或太歲點燈。
 *
 * ── 為什麼需要這個 ──
 * 廟方 2026-10-30：「目前還是有大量的信眾從 LINE 官方帳號手動通知報名。」
 * 那些人不會自己去官網填表，工作人員只好代填——代填的管道如果是官網前台，
 * 就得重打一次姓名生日地址，而名冊上本來就有。
 *
 * ── 刻意的四個決定（廟方 2026-10-30）──
 * 1. `source` 標成 `admin/line`，與信眾自己報名的分得開（理由見 PROXY_SOURCE）。
 * 2. **不寄「報名成功」信**（`notify: false`）：對方剛在 LINE 跟廟方講完話，
 *    再收一封信只會困惑，而且多數 LINE 來的人沒留信箱。
 *    「已收款」那封不受影響，還是廟方在後台按下去才寄。
 * 3. 涵蓋祈福活動、問事、**太歲點燈**。點燈原本刻意不做（「不是檔期性的報名」），
 *    **2026-11-18 廟方改口要加**：「信眾管理可以協助報名，目前有祈福活動跟問事，也加上點燈」。
 *    專屬神明燈一樣要選指定神明、一樣扣名額（同前台，見 services/lampChoice.ts）。
 * 4. 重複報名**只提醒不擋**：真的有人要報兩個名額。
 *
 * ── 已截止的場次照樣列出來 ──
 * 看起來很怪，但代為報名存在的理由正是「這個人錯過了前台的截止」。
 * 只給開放中的場次，等於在最需要它的時候把它關掉。所以分成兩組、
 * 已截止那組標紅字，由工作人員自己判斷要不要收。
 *
 * ── 絕對不碰 external_form 的活動 ──
 * `externalForm === 'fahui'` 那種的報名在 `fahui_registrations`，不在這裡。
 * 從這裡報下去會產生一筆對不到場次的孤兒訂單——那正是前台不給「我要報名」
 * 的原因（見 CLAUDE.md 的 blessing_events_external_form）。
 */
const ProxyRegisterModal = ({ row, sources, onClose, onDone }: {
  row: DevoteeRow;
  sources: RosterSources;
  onClose: () => void;
  onDone: () => void;
}) => {
  const [kind, setKind] = useState<'blessing' | 'booking' | 'lamp'>('blessing');
  const [lampConfigs, setLampConfigs] = useState<LampServiceConfig[]>([]);
  const [lampChoiceMap, setLampChoiceMap] = useState<LampChoices>({});
  const [lampCounts, setLampCounts] = useState<Record<string, number> | null>(null);
  const [lampId, setLampId] = useState('');
  const [lampChoice, setLampChoice] = useState('');
  const [events, setEvents] = useState<BlessingEventRecord[]>([]);
  const [sessions, setSessions] = useState<BookingSessionRecord[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [eventId, setEventId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [consultType, setConsultType] = useState<ConsultationType>(ConsultationType.CAREER);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ev, ss, ct, lc, ch] = await Promise.all([
        getBlessingEvents().catch(() => [] as BlessingEventRecord[]),
        getBookingSessions(false).catch(() => [] as BookingSessionRecord[]),
        getBookingCountsBySession().catch(() => ({} as Record<string, number>)),
        getLampServiceConfigs(true).catch(() => [] as LampServiceConfig[]),
        getLampChoices(),
      ]);
      if (!alive) return;
      setEvents(ev); setSessions(ss); setCounts(ct); setLampConfigs(lc); setLampChoiceMap(ch); setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  /**
   * 這個人的基本資料。**取最後一次留下的值，不是陣列的第一個**——
   * `phones[0]` 是最早出現的那一支，搬過家換過號碼的話會填到舊的。
   * `records` 已經依日期由舊到新排好，所以從後面找第一個非空的。
   */
  const latest = (pick: (r: DevoteeRecord) => string): string => {
    for (let i = row.records.length - 1; i >= 0; i--) {
      const v = pick(row.records[i]);
      if (v) return v;
    }
    return '';
  };
  // 拆分出來的列，顯示名稱後面帶了生日（「王小明（民國80年…）」），報名要用原本的姓名
  const person = {
    name: row.splitFrom ?? row.name,
    phone: latest(r => r.phone),
    birthDate: latest(r => r.birthDate),
    zodiac: latest(r => r.zodiac),
    gender: latest(r => r.gender),
    address: latest(r => r.address),
  };

  const today = todayYmd();
  const now = Date.now();
  const isOpen = (e: BlessingEventRecord): boolean => {
    if (!e.isActive) return false;
    if (e.endDate && e.endDate < today) return false;
    if (e.registrationDeadline && new Date(e.registrationDeadline).getTime() < now) return false;
    return true;
  };
  // fahui 那種一律不列：報名在另一套表，從這裡報會變成孤兒訂單
  const usable = events.filter(e => e.externalForm !== 'fahui');
  const openEvents = usable.filter(isOpen);
  const closedEvents = usable.filter(e => !isOpen(e));
  const openSessions = sessions.filter(s => s.isActive && s.sessionDate >= today);
  const closedSessions = sessions.filter(s => !(s.isActive && s.sessionDate >= today));

  const evt = events.find(e => e.id === eventId);
  const pkg = evt?.packages?.find(p => p.id === packageId);
  const sess = sessions.find(s => s.id === sessionId);
  const lampCfg = lampConfigs.find(c => c.id === lampId);
  const lampCh = choiceFor(lampChoiceMap, lampId);
  // 選了有名額的燈種就抓這一季的計數（同前台；讀不到回 null＝不擋人）
  useEffect(() => {
    setLampCounts(null);
    if (lampId && lampChoiceMap[lampId]?.quotas) getLampChoiceCounts(lampId, lampSeasonStart()).then(setLampCounts);
  }, [lampId, lampChoiceMap]);
  const amount = kind === 'blessing' ? (pkg ? pkg.fee : (evt?.fee ?? 0)) : kind === 'lamp' ? (lampCfg?.fee ?? 0) : 0;

  /** 重複報名偵測：同姓名＋同電話、同一場。**只提醒不擋**（廟方 2026-10-30）。 */
  const nameK = toNameKey(person.name);
  const dupes = kind === 'blessing'
    ? (sources.blessings ?? []).filter(b =>
        b.eventId === eventId && toNameKey(b.name) === nameK && (b.phone ?? '') === person.phone)
    : kind === 'lamp'
    // 點燈一年一期：這一季已經點過同一盞才算重複
    ? (sources.lamps ?? []).filter(l =>
        l.serviceId === lampId && toNameKey(l.name) === nameK && (l.phone ?? '') === person.phone
        && l.status !== '已取消' && (l.createdAt ?? '') >= lampSeasonStart())
    : (sources.bookings ?? []).filter(b =>
        b.sessionId === sessionId && toNameKey(b.name) === nameK && (b.phone ?? '') === person.phone);

  const chosenClosed = kind === 'blessing'
    ? (evt ? !isOpen(evt) : false)
    : kind === 'lamp' ? false
    : (sess ? !(sess.isActive && sess.sessionDate >= today) : false);
  const lampLeft = lampCh && lampChoice ? remainingFor(lampCh, lampChoice, lampCounts) : null;

  const canSubmit = !saving && !!person.name
    && (kind === 'blessing' ? !!eventId
      : kind === 'lamp' ? (!!lampId && !!person.birthDate && (!lampCh || !!lampChoice) && (lampLeft == null || lampLeft > 0))
      : (!!sessionId && !!person.birthDate));

  const submit = async () => {
    setErr(''); setSaving(true);
    try {
      if (kind === 'blessing') {
        await createBlessingRegistration({
          eventId,
          name: person.name,
          phone: person.phone,
          birthDate: person.birthDate || undefined,
          zodiac: (person.zodiac || undefined) as ZodiacSign | undefined,
          gender: person.gender || undefined,
          address: person.address || undefined,
          contactLabel: '本人',   // 代報的對象就是這一列本人，不是他的家人
          notes: notes || undefined,
          packageName: pkg?.name,
          packageFee: pkg?.fee,
        }, { notify: false, source: PROXY_SOURCE });
      } else if (kind === 'lamp') {
        await submitLampRegistration({
          serviceId: lampId,
          name: person.name,
          phone: person.phone,
          gender: person.gender || undefined,
          birthDate: person.birthDate,
          zodiac: (person.zodiac || undefined) as ZodiacSign | undefined,
          address: person.address || undefined,
          contactLabel: '本人',
          // 指定神明寫進備註開頭，與前台同一個格式（後台列表與匯出才讀得到）
          notes: (lampCh ? withChoiceTag(notes || undefined, lampCh.label, lampChoice) : notes) || undefined,
        }, { notify: false, source: PROXY_SOURCE });
      } else {
        await submitBooking({
          name: person.name,
          phone: person.phone,
          gender: person.gender || undefined,
          birthDate: person.birthDate,
          zodiac: (person.zodiac || undefined) as ZodiacSign | undefined,
          address: person.address || undefined,
          contactLabel: '本人',
          bookingDate: sess!.sessionDate,
          bookingTime: sess!.sessionTime,
          sessionId: sess!.id,
          type: consultType,
          notes: notes || undefined,
        }, { notify: false, source: PROXY_SOURCE });
      }
      setDone(kind === 'blessing' ? `已幫 ${person.name} 報名「${evt?.title}」`
        : kind === 'lamp' ? `已幫 ${person.name} 登記「${lampCfg?.name}${lampChoice ? `・${lampChoice}` : ''}」`
        : `已幫 ${person.name} 預約 ${sess?.sessionDate} 的問事`);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '送出失敗，請再試一次');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none bg-white';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">代為報名</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
        </div>

        {done ? (
          <div className="p-5 space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">{done}</div>
            <p className="text-xs text-gray-500">
              狀態是「待匯款」，等款項收到後到該服務的分頁按「標記已收款」——
              <strong>確認信在那一刻才會寄</strong>，這筆代報沒有寄出任何信。
            </p>
            <button onClick={onClose} className="w-full py-2.5 bg-temple-red text-white rounded-lg text-sm font-medium">關閉</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* 這個人是誰 */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm">
              <p className="font-medium text-gray-800">{person.name}</p>
              <p className="text-xs text-gray-500 mt-1">
                {[person.phone, person.gender, person.birthDate, person.zodiac, person.address].filter(Boolean).join('｜') || '名冊上沒有其他資料'}
              </p>
              <p className="text-[11px] text-gray-400 mt-1.5">取自名冊最後一次留下的資料。要改請到該筆報名紀錄上改。</p>
            </div>

            {/* 服務 */}
            <div className="flex gap-2">
              {([['blessing', '祈福活動'], ['booking', '問事'], ['lamp', '太歲點燈']] as const).map(([k, label]) => (
                <button key={k} onClick={() => { setKind(k); setErr(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border ${kind === k
                    ? 'bg-temple-red text-white border-temple-red'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
                  {label}
                </button>
              ))}
            </div>

            {loading ? <p className="text-sm text-gray-400 py-6 text-center">載入場次…</p> : kind === 'lamp' ? (
              <>
                <label className="block">
                  <span className="block text-xs font-medium text-gray-600 mb-1">燈種 *</span>
                  <select value={lampId} onChange={e => { setLampId(e.target.value); setLampChoice(''); }} className={field}>
                    <option value="">請選擇</option>
                    {lampConfigs.map(c => <option key={c.id} value={c.id}>{c.name}　NT$ {c.fee.toLocaleString()} / 年</option>)}
                  </select>
                </label>
                {lampCh && (
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-600 mb-1">{lampCh.label} *</span>
                    <select value={lampChoice} onChange={e => setLampChoice(e.target.value)} className={field}>
                      <option value="">請選擇{lampCh.label}</option>
                      {lampCh.options.map(o => {
                        const left = remainingFor(lampCh, o, lampCounts);
                        return <option key={o} value={o} disabled={left != null && left <= 0}>
                          {o}{left == null ? '' : left <= 0 ? '（已額滿）' : `（剩 ${left} 盞）`}
                        </option>;
                      })}
                    </select>
                  </label>
                )}
                {!person.birthDate && (
                  <p className="text-xs text-temple-red">
                    點燈必須有生日，但名冊上這個人沒有。請先從他既有的報名紀錄補上，或改用前台表單。
                  </p>
                )}
              </>
            ) : kind === 'blessing' ? (
              <>
                <label className="block">
                  <span className="block text-xs font-medium text-gray-600 mb-1">活動場次 *</span>
                  <select value={eventId} onChange={e => { setEventId(e.target.value); setPackageId(''); }} className={field}>
                    <option value="">請選擇</option>
                    {openEvents.length > 0 && (
                      <optgroup label="開放報名中">
                        {openEvents.map(e => <option key={e.id} value={e.id}>{e.startDate} {e.title}</option>)}
                      </optgroup>
                    )}
                    {closedEvents.length > 0 && (
                      <optgroup label="已截止／已結束（代報仍可選）">
                        {closedEvents.map(e => <option key={e.id} value={e.id}>{e.startDate} {e.title}</option>)}
                      </optgroup>
                    )}
                  </select>
                </label>
                {evt && evt.packages && evt.packages.length > 0 && (
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-600 mb-1">護持方案</span>
                    <select value={packageId} onChange={e => setPackageId(e.target.value)} className={field}>
                      <option value="">不指定方案（費用 ${evt.fee.toLocaleString()}）</option>
                      {evt.packages.map(p => <option key={p.id} value={p.id}>{p.name}　${p.fee.toLocaleString()}</option>)}
                    </select>
                  </label>
                )}
              </>
            ) : (
              <>
                <label className="block">
                  <span className="block text-xs font-medium text-gray-600 mb-1">問事場次 *</span>
                  <select value={sessionId} onChange={e => setSessionId(e.target.value)} className={field}>
                    <option value="">請選擇</option>
                    {openSessions.length > 0 && (
                      <optgroup label="開放中">
                        {openSessions.map(s => {
                          const used = counts[s.id] ?? 0;
                          const left = s.maxSlots - used;
                          return <option key={s.id} value={s.id}>{s.sessionDate} {s.sessionTime}（剩 {left < 0 ? 0 : left} 位）</option>;
                        })}
                      </optgroup>
                    )}
                    {closedSessions.length > 0 && (
                      <optgroup label="已過期／已停用（代報仍可選）">
                        {closedSessions.map(s => <option key={s.id} value={s.id}>{s.sessionDate} {s.sessionTime}</option>)}
                      </optgroup>
                    )}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-gray-600 mb-1">問事類型 *</span>
                  <select value={consultType} onChange={e => setConsultType(e.target.value as ConsultationType)} className={field}>
                    {Object.values(ConsultationType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                {!person.birthDate && (
                  <p className="text-xs text-temple-red">
                    問事必須有生日，但名冊上這個人沒有。請先從他既有的報名紀錄補上，或改用前台表單。
                  </p>
                )}
              </>
            )}

            {/* 名額 / 截止 / 重複 的提醒。只提醒，不擋 */}
            {chosenClosed && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                這一場<strong>已經截止或已結束</strong>。代報還是送得出去，但請先確認廟方真的要收這一筆。
              </div>
            )}
            {sess && (counts[sess.id] ?? 0) >= sess.maxSlots && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                這一場<strong>名額已滿</strong>（{counts[sess.id]}／{sess.maxSlots}）。
              </div>
            )}
            {dupes.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                這個人<strong>已經報過這一場了</strong>（{dupes.length} 筆）。要報第二個名額才繼續，否則請關掉。
              </div>
            )}

            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">備註（選填）</span>
              <input value={notes} onChange={e => setNotes(e.target.value)} className={field}
                placeholder="例如：LINE 告知、代付現金" />
            </label>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
              <p>送出後狀態是<strong>待匯款</strong>，<strong>不會寄任何信給信眾</strong>。</p>
              <p>報名來源會標成 <code className="font-mono">admin/line</code>，在「流量來源」那一頁跟信眾自己報的分得開。</p>
              {amount > 0 && <p>應收金額 <strong>${amount.toLocaleString()}</strong>。</p>}
            </div>

            {err && <p className="text-sm text-temple-red">{err}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm">取消</button>
              <button onClick={submit} disabled={!canSubmit}
                className="flex-1 py-2.5 bg-temple-red text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                {saving ? '送出中…' : '確認代為報名'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const RosterTab = ({ sources, onDone }: { sources: RosterSources; onDone: () => void }) => {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [proxyRow, setProxyRow] = useState<DevoteeRow | null>(null);
  /** 次要欄位（關係／性別／地址／累計金額／可能親屬）預設收起來。
   *  廟方 2026-10-30：「這張表很長，後台操作不易。」收起來不是刪掉，
   *  點「檢視」一樣看得到全部。 */
  const [showMore, setShowMore] = useState(false);
  const rosterRows = useOpenRows();
  /** 電話、地址是個資，桌機也不常駐一欄：姓名格裡按「電話・地址」才就地展開（同問事管理；電話 2026-11-18 收進來） */
  const rosterInfo = useOpenRows();
  const [onlyConflicts, setOnlyConflicts] = useState(false);

  // ── 人工校正 ──
  const [overrides, setOverrides] = useState<DevoteeOverride[]>([]);
  const [busy, setBusy] = useState(false);
  /** 合併模式：先選來源列，再點另一列作為併入目標 */
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  /** 檢視／拆分視窗：把該姓名底下的紀錄依生日並列 */
  const [inspect, setInspect] = useState<DevoteeRow | null>(null);
  /** 已判定是同一人時，使用者仍可手動要求「依生日拆開比對」。
   *  每次開新的檢視視窗都要歸零，否則上一個人的選擇會帶到下一個人身上。 */
  const [forceSplit, setForceSplit] = useState(false);
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
    // 信箱不分大小寫（信眾自己填的大小寫不一致，廟方從信件複製貼上更不會一致）
    const q = search.trim();
    const ql = q.toLowerCase();
    const matchSearch = !q
      || r.name.includes(q)
      || r.phones.some(p => p.includes(q))
      || r.addresses.some(a => a.includes(q))
      || r.emails.some(e => e.toLowerCase().includes(ql))
      || r.lineIds.some(l => l.toLowerCase().includes(ql))
      || r.memberNumbers.some(n => n.includes(q))
      || r.relations.some(x => x.includes(q));
    const matchSource = !sourceFilter || (r.counts[sourceFilter] ?? 0) > 0;
    return matchSearch && matchSource && (!onlyConflicts || r.nameConflict);
  }), [rows, search, sourceFilter, onlyConflicts]);

  /**
   * **這幾個數字的用途是「現在要找誰」**（廟方 2026-10-30 把「曾參與法會」換掉：
   * 法會是檔期性的，辦完就不動，天天看沒有意義）。大量信眾是從 LINE 官方帳號
   * 私訊報名的，所以真正要回答的是「最近還在往來的有誰」「這個月多了誰」
   * 「誰太久沒來了」。
   *
   * **日期一律用 `lastSeen`／`firstSeen` 那組 yyyy-mm-dd 字串直接比大小**，
   * 不要 `new Date()` 再比——那組字串是 `localDate()` 用本地時區產的，
   * 轉回 Date 會在台灣早上 8 點前差一天（同 devoteeRoster 那條註解的理由）。
   *
   * **沒有日期的那些人不算進「久未參與」**：`lastSeen` 是空字串代表那幾筆紀錄
   * 本來就沒有時間（舊資料），不是「很久沒來」。把它們算進去會憑空生出一份
   * 不該回訪的名單。
   */
  const stats = useMemo(() => {
    const d = new Date();
    const ymd = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const days = (n: number) => { const t = new Date(d); t.setDate(t.getDate() - n); return ymd(t); };
    const d90 = days(90);
    const d365 = days(365);
    return {
      total: rows.length,
      active90: rows.filter(r => r.lastSeen && r.lastSeen >= d90).length,
      newThisMonth: rows.filter(r => r.firstSeen && r.firstSeen >= monthStart).length,
      dormant: rows.filter(r => r.lastSeen && r.lastSeen < d365).length,
      repeat: rows.filter(r => rosterTotalCount(r.counts) > 1).length,
      conflicts: rows.filter(r => r.nameConflict).length,
      // 會員一定是信眾，所以這個數字一定 <= total；拿它跟「會員資訊」那一頁的人數對照，
      // 對不起來就表示有會員的姓名與他報名時填的不一樣（去那一頁用「比對併入」處理）
      members: rows.filter(r => r.memberAccounts > 0).length,
    };
  }, [rows]);

  const handleExport = () => {
    exportExcel('和聖壇信眾名冊.xlsx', filtered.map(r => [
      r.name,
      // 空白＝不是會員；未編號的會員要講出來，否則廟方照這一欄篩就會漏掉他們
      r.memberAccounts > 0 ? (r.memberNumbers.join('、') || '（未編號）') : '',
      r.genders.join('／'),
      r.phones.join('、'),
      r.addresses.join('；'),
      r.birthDates.join('；'),
      r.zodiacs.join('／'),
      r.lineIds.join('、'),
      r.emails.join('、'),
      r.relationOf.map(x => `${x.tag} 的${x.relation}`).join('、'),
      r.relations.filter(x => x && x !== '本人' && !r.relationOf.some(y => y.relation === x)).join('、'),
      ROSTER_SOURCES.filter(s => r.counts[s]).map(s => `${s}${r.counts[s]}`).join('、'),
      rosterTotalCount(r.counts),
      r.totalAmount,
      r.firstSeen,
      r.lastSeen,
      r.relatives.join('、'),
      r.nameConflict ? '是' : '',
      r.conflictHint,
    ]), ['姓名', '會員編號', '性別', '電話', '地址', '生日', '生肖', 'LINE', '信箱', '關係（通訊錄，確定）', '關係（報名填，未知對誰）', '參與管道', '參與次數', '累計金額', '首次參與', '最近參與', '可能親屬（同電話）', '疑似同名不同人', '判斷依據']);
  };

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">信眾人數</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">其中 {stats.members} 位有會員帳號</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">近 90 天有參與</p>
          <p className="text-2xl font-bold text-green-600">{stats.active90}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">還在往來的人</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">本月新增</p>
          <p className="text-2xl font-bold text-[#C49820]">{stats.newThisMonth}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">這個月第一次出現</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">久未參與</p>
          <p className="text-2xl font-bold text-gray-500">{stats.dormant}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">超過一年沒有紀錄</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 mb-1">參與 2 次以上</p>
          <p className="text-2xl font-bold text-gray-800">{stats.repeat}</p>
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

      {/**
        * 合併模式的提示。三件事以前都講錯或沒講（廟方 2026-10-13 回報「沒有『併入此人』的按鈕」）：
        *  (1) **按鈕叫「比對併入」不叫「併入此人」**——提示叫人去找一顆不存在的鈕，
        *      他只會以為功能壞了。這種字串改了按鈕卻忘了改提示，畫面上看不出來。
        *  (2) **不在「下方」**：那顆鈕在每一列的「校正」欄（桌機在右邊、手機在卡片裡）。
        *  (3) **沒講哪個姓名會留下來**——合併是把來源併進目標、**保留目標的姓名**，
        *      選錯邊就是另一個名字消失。這是這段提示裡最該講的一句。
        * 也補一句「確認後才真的合併」：按下去只是開比對視窗，不是立刻動資料。
        */}
      {mergeFrom && (
        <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-center gap-3 flex-wrap">
          <span>
            正在合併：<strong>{mergeFrom}</strong> → 請在<strong>要保留的那個姓名</strong>那一列按「比對併入」
            <span className="text-blue-600">（會先讓你比對，確認後才真的合併）</span>
          </span>
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋姓名 / 電話 / 關係 / 信箱 / LINE / 地址 / 會員編號"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
        </div>
        <div className="w-full space-y-2">
          <FilterChips value={sourceFilter} onChange={setSourceFilter} allLabel="全部管道"
            options={ROSTER_SOURCES.map(s => ({ value: s, count: rows.filter(r => (r.counts[s] ?? 0) > 0).length }))} />
          {/* 「關係」篩選 2026-11-18 拿掉（廟方：「關係好像不再重要」）；關係欄仍在「更多欄位」、檢視與匯出裡 */}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap px-1">
          <input type="checkbox" checked={onlyConflicts} onChange={e => setOnlyConflicts(e.target.checked)}
            className="rounded border-gray-300 text-temple-red focus:ring-temple-red/30" />
          只看疑似同名
        </label>
        <label className="hidden lg:flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap px-1"
          title="性別、累計金額、可能親屬">
          <input type="checkbox" checked={showMore} onChange={e => setShowMore(e.target.checked)}
            className="rounded border-gray-300 text-temple-red focus:ring-temple-red/30" />
          更多欄位
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-20">尚無符合條件的信眾</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="admin-table w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                {/* 常用的排前面（廟方 2026-10-30）：找人 → 看他最近有沒有來 → 直接代報名。
                    關係常駐；其餘三欄（性別／累計金額／可能親屬）收在「更多欄位」後面，順序與表身必須一致。 */}
                <th className="px-4 py-3 text-left font-medium">姓名</th>
                {/* 電話 2026-11-18 收進姓名格的「電話・地址」（廟方：「信眾資訊 表單的電話可以收折」）；搜尋照樣吃電話 */}
                <th className="px-4 py-3 text-left font-medium">最近參與</th>
                <th className="px-4 py-3 text-left font-medium">參與管道</th>
                {/* 這四欄一律輸出（地址改由姓名格的「地址」鈕就地展開，2026-11-18 隱私考量）：桌機由「更多欄位」決定顯示（lg:hidden），手機卡片由每張卡的「更多資料」展開 */}
                {/* 關係常駐（2026-11-18 廟方：「關係要顯示，也要能搜尋，但不要一整排關係按鈕」） */}
                <th className="px-4 py-3 text-left font-medium">關係</th>
                <th className={`px-4 py-3 text-left font-medium${showMore ? '' : ' lg:hidden'}`}>性別</th>
                <th className={`px-4 py-3 text-right font-medium${showMore ? '' : ' lg:hidden'}`}>累計金額</th>
                <th className={`px-4 py-3 text-left font-medium${showMore ? '' : ' lg:hidden'}`}>可能親屬</th>
                <th className="px-4 py-3 text-center font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr key={r.name} className={`hover:bg-gray-50/60${rosterRows.isOpen(r.name) ? ' admin-open' : ''}`}>
                  <td data-label="姓名" className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                    {r.name}
                    {/* 此人同時是註冊會員，可回「會員資訊」看登入紀錄。
                        **判斷用 memberAccounts 不是 memberNumbers**：編號是廟方給的，
                        沒編號的帳號照樣是會員，用編號判斷會讓他顯示成非會員。 */}
                    {r.memberAccounts > 0 && (
                      <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200"
                        title="此信眾同時是註冊會員">
                        {r.memberNumbers.length > 0 ? `會員 ${r.memberNumbers.join('、')}` : '會員（未編號）'}
                      </span>
                    )}
                    {r.nameConflict && (
                      <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200"
                        title={`可能是不同人：${r.conflictHint}`}>
                        疑似同名
                      </span>
                    )}
                    {(r.addresses.length > 0 || r.phones.length > 0) && (
                      <div>
                    <button type="button" aria-expanded={rosterInfo.isOpen(r.name)}
                      onClick={e => { e.stopPropagation(); rosterInfo.toggle(r.name); }}
                      className="mt-1 text-xs text-gray-500 hover:text-temple-red inline-flex items-center gap-0.5">
                      {rosterInfo.isOpen(r.name) ? '收合資料' : [r.phones.length ? '電話' : '', r.addresses.length ? '地址' : ''].filter(Boolean).join('・')}
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${rosterInfo.isOpen(r.name) ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                        {rosterInfo.isOpen(r.name) && (
                          <div className="mt-1 text-xs font-normal text-gray-500 whitespace-normal space-y-0.5">
                            {r.phones.length > 0 && <p>{r.phones.join('、')}</p>}
                            {r.addresses.length > 0 && <p>{r.addresses.join('；')}</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td data-label="最近參與" className="px-4 py-3 text-gray-400 whitespace-nowrap">{r.lastSeen || <Dash />}</td>
                  <td data-label="參與管道" className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {rosterBadges(r.counts).map(b => (
                        <span key={b.label} className="text-[11px] px-2 py-0.5 rounded-full bg-[#C49820]/10 text-[#7C5C1E] whitespace-nowrap"
                          title={`${b.label}：${b.hint}`}>
                          {b.label}{b.total > 1 ? ` ${b.total}` : ''}
                        </span>
                      ))}
                      {/* 註冊了帳號但還沒報過任何名的會員，管道會是空的——
                          「會員」那顆刻意不在這裡（姓名旁邊已經有了）。留白看起來像壞掉，
                          所以照其他欄位的慣例給一個破折號。 */}
                      {rosterBadges(r.counts).length === 0 && <Dash />}
                    </div>
                  </td>
                  <td data-label="關係" className="px-4 py-3 max-w-[200px]"><RelationCell row={r} /></td>
                  <td data-label="性別" data-more className={`px-4 py-3 text-gray-500 whitespace-nowrap${showMore ? '' : ' lg:hidden'}`}>{r.genders.join('／')}</td>
                  <td data-label="累計金額" data-more className={`px-4 py-3 text-right text-gray-700 whitespace-nowrap${showMore ? '' : ' lg:hidden'}`}>
                    {r.totalAmount > 0 ? `$${r.totalAmount.toLocaleString()}` : <Dash />}
                  </td>
                  <td data-label="可能親屬" data-more className={`px-4 py-3 text-gray-500 max-w-[160px] truncate${showMore ? '' : ' lg:hidden'}`} title={r.relatives.join('、')}>
                    {r.relatives.join('、') || <Dash />}
                  </td>
                  <td data-label="操作" className="px-4 py-3 whitespace-nowrap">
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
                          {/* 日常最常按的放最前面；校正（檢視／合併／拆分）是偶爾才做的事 */}
                          <button onClick={() => setProxyRow(r)} disabled={busy} title="直接幫這個人報名祈福活動、問事或太歲點燈"
                            className="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-lg bg-temple-red text-white shadow-sm hover:bg-[#5C4310] disabled:opacity-40">
                            {/* 實心深底（2026-11-18 廟方：「代為報名，這是重要的按鈕，請凸顯」）；旁邊的檢視／合併維持細框小字 */}
                            <UserPlus className="w-4 h-4" aria-hidden="true" />代為報名
                          </button>
                          {/* 一律提供「檢視」：不看原始紀錄無從判斷該拆還是該併 */}
                          <button onClick={() => { setInspect(r); setForceSplit(false); }} disabled={busy} title="查看這個人的每一筆原始紀錄"
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
                  <RowMoreCell open={rosterRows.isOpen(r.name)} onToggle={() => rosterRows.toggle(r.name)} hint="性別、金額" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 檢視／拆分：把紀錄依生日並列，看完再決定是同一人還是要拆開 */}
      {proxyRow && (
        <ProxyRegisterModal
          row={proxyRow}
          sources={sources}
          onClose={() => setProxyRow(null)}
          onDone={onDone}
        />
      )}

      {inspect && (() => {
        const groups = groupByBirth(inspect.records);
        const splittable = groups.filter(g => g.key).length >= 2;
        /**
         * **判定是同一個人，就不要再把他切成好幾組並列**（2026-10-30 廟方：
         * 「我看來是很複雜」）。並列是一種「請你比對」的版面，而這裡已經不必比對了——
         * 一邊說「判定為同一個人」一邊擺出比對版面，是畫面自己打自己的臉。
         * 併成一張表之後，共同欄位還能一次提得更乾淨（整個人的資料只講一次）。
         *
         * 真的不同意的人還是拆得開：綠色方塊裡有「依生日拆開比對」。
         */
        const grouped = splittable && (forceSplit || !inspect.sameEvidence);
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
                  {/* **只有真的拆得開才要求比對**（2026-10-30 修）。
                      原本的條件是 `groups.length > 1`，而「未填生日」也算一組——
                      於是一個只有單一生日、外加幾筆沒填生日的人，會看到
                      「依生日分成 2 組…判斷這是同一個人還是不同人」，
                      然後同一個視窗的頁尾又說「只有一組有生日，無法依生日拆分」。
                      要人做一個它自己也知道做不到的判斷。 */}
                  {splittable && inspect.sameEvidence ? (
                    /* 生日對不起來，但別的欄位一致到足以判定是同一個人。
                       **理由一定要講出來**：只是悄悄不顯示警示的話，廟方看到兩個生日
                       並列又沒有任何說明，會以為系統漏判了。 */
                    <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2.5 text-sm text-green-800">
                      <p><strong>判定為同一個人</strong>——{inspect.sameEvidence}。</p>
                      <p className="text-xs text-green-700/80 mt-1">
                        生日有兩種寫法（{groups.filter(g => g.key).map(g => g.label).join('　／　')}），
                        多半是同一天的國曆與農曆，不是兩個人。
                      </p>
                      {!forceSplit && (
                        <button onClick={() => setForceSplit(true)}
                          className="mt-1.5 text-xs underline text-green-700 hover:text-green-900">
                          其實是兩個不同的人？依生日拆開比對
                        </button>
                      )}
                    </div>
                  ) : grouped ? (
                    <p className="text-sm text-gray-500">
                      以下依生日分成 {groups.filter(g => g.key).length} 組並列。請比對電話、地址、性別，判斷這是同一個人（生日可能填錯），還是不同人。
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">
                      這 {inspect.records.length} 筆的生日沒有互相矛盾，看起來是同一個人。
                      {groups.some(g => !g.key) && '（有幾筆沒填生日，那是沒填，不是另一個人。）'}
                    </p>
                  )}
                  {/* **拆不開就不要分組並列。** 把「有生日」與「未填生日」切成兩個方框
                      並排，本身就在暗示「這裡有兩個候選人」——而拆不開的時候並沒有。
                      併成一張表之後，共同欄位還能一次提得更乾淨（整個人的資料只講一次）。 */}
                  {!grouped ? (
                    <RecordTable records={inspect.records} own={inspect.memberTags} />
                  ) : groups.map((g, gi) => (
                    <div key={g.key || `none-${gi}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${g.key ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                          {g.key ? `生日：${g.label}` : '未填生日'}
                        </span>
                        <span className="text-xs text-gray-400">{g.records.length} 筆</span>
                        {g.key && (
                          <button onClick={() => doSplit(inspect, g.key)} disabled={busy}
                            className="ml-auto text-xs px-2.5 py-1 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-40">
                            拆分，未填生日者歸這位
                          </button>
                        )}
                      </div>
                      <RecordTable records={g.records} own={inspect.memberTags} />
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
                    <RecordTable records={p.records} own={p.memberTags} />
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
      const next = r.status === 'paid' ? 'pending' : 'paid';
      await updateFahuiStatus(r.id, next);
      // 只有「確認」那個方向要寄；改回待匯款不寄（沒有「取消確認信」這種東西，
      // 寄一封說「其實還沒收到」只會讓信眾更混亂，廟方該直接打電話）
      if (next === 'paid') queueConfirmEmail('fahui_registrations', r.id);
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
        <FilterChips value={filterStatus} onChange={setFilterStatus} allLabel="全部" allCount={registrations.length}
          options={[
            { value: 'pending', label: '待匯款', count: registrations.filter(r => r.status !== 'paid').length },
            { value: 'paid', label: '已收款', count: registrations.filter(r => r.status === 'paid').length },
          ]} />
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
                      {/* 電話、LINE、信箱、報名時間 2026-11-18 收進展開區；後五碼留著——對帳收款就是看它 */}
                      <span className="text-xs text-gray-400">{countEntries(r)} 個項目</span>
                      {r.accountLast5 && <span className="text-xs bg-[#C49820]/10 text-[#7C5C1E] px-2 py-0.5 rounded-full">後五碼: {r.accountLast5}</span>}
                    </div>
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
                        {r.phone}
                        {r.lineId && <span className="ml-2 text-[#06C755]">LINE: {r.lineId}</span>}
                        {r.email && <span className="ml-2">{r.email}</span>}
                        <span className="ml-2 text-gray-400">報名 {fmtDate(r.createdAt)}</span>
                        <br />
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
                    {/* 確認信：按下「標記已收款」之後，信眾收到通知了沒。
                        法會是五種報名裡唯一本來就收信箱的，所以這裡不必講會員帳號那條備援 */}
                    <div className="text-sm">
                      <span className="text-gray-400">確認信：</span>
                      {r.confirmSentAt
                        ? <span className="text-green-700">已寄出　{fmtDate(r.confirmSentAt)}{r.email ? `（${r.email}）` : ''}</span>
                        : r.email
                          ? <span className="text-gray-500">標記已收款時寄至 {r.email}</span>
                          : <span className="text-gray-500">未留信箱，不會寄確認信</span>}
                    </div>
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

  /**
   * 清單頁只留：姓名、出勤（最重要，同一行常駐）、LINE、狀態；電話 2026-11-18 收進「更多資料」（2026-11-18 廟方：「志工報名表單太多資訊了，
   * 像地址都可以隱藏⋯⋯非必要資訊，不用出現在表單清單頁，需要再點開」）。
   * 地址、生日、飲食、其他說明、報名時間與來源收進「更多資料」，就地展開（同問事的「生日・地址」）。
   */
  const volInfo = useOpenRows();
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
        <FilterChips value={filterStatus} onChange={setFilterStatus} allLabel="全部" allCount={registrations.length}
          options={[
            { value: 'pending', label: '待聯絡', count: registrations.filter(r => r.status !== 'contacted').length },
            { value: 'contacted', label: '已聯絡', count: registrations.filter(r => r.status === 'contacted').length },
          ]} />
        <DateRangeFilter from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-20">尚無符合條件的志工報名</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800">{r.name}</span>
                  {/* 出勤是志工清單最重要的資料，跟名字同一行常駐；電話收進「更多資料」（2026-11-18 廟方更正） */}
                  {fmtAvailability(r.availability) && <span className="text-sm text-[#7C5C1E]">出勤：{fmtAvailability(r.availability)}</span>}
                  {r.lineId && <span className="text-xs bg-[#06C755]/10 text-[#06C755] px-2 py-0.5 rounded-full">LINE: {r.lineId}</span>}
                  {/* 「更多資料」跟名字同一行（2026-11-18 廟方：「不用在名字下面，這樣可以更多行」）：一張卡一行，一屏看得到更多人 */}
                  <button type="button" aria-expanded={volInfo.isOpen(r.id)}
                    onClick={e => { e.stopPropagation(); volInfo.toggle(r.id); }}
                    className="text-xs text-gray-500 hover:text-temple-red inline-flex items-center gap-0.5">
                    {volInfo.isOpen(r.id) ? '收合資料' : '更多資料'}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${volInfo.isOpen(r.id) ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                </div>
                {volInfo.isOpen(r.id) && (
                  <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                    {r.phone && <p>{r.phone}</p>}
                    {r.address && <p>{r.address}</p>}
                    {(r.birthDate || r.zodiac) && <p>{r.birthDate}{r.zodiac ? `（${r.zodiac}）` : ''}</p>}
                    {r.diet && <p>飲食：{r.diet}</p>}
                    {r.availabilityNote && <p>其他：{r.availabilityNote}</p>}
                    <p className="text-gray-400">報名 {fmtDate(r.createdAt)}{r.source ? `・${r.source}` : ''}</p>
                  </div>
                )}
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

/** 提醒作業的四個項目。順序就是畫面上的順序 */
const REMIND_KEYS = [
  { key: '未匯款提醒_點燈', label: '點燈未匯款' },
  { key: '未匯款提醒_祈福', label: '祈福未匯款' },
  { key: '問事提醒',        label: '明日問事' },
  { key: '點燈到期提醒',    label: '點燈即將到期' },
] as const;

/**
 * 總覽（2026-11-18 依廟方決定重做，同日再調一次）。
 *
 * 廟方：「最早當初我們是為了法會報名，但現在已升級成整個和聖壇的管理，需求不同，
 * dashboard 重點也就不同」。同一天看過三塊版之後又說：
 * 「頂端四張累計數字卡、LINE 導流和最新報名，改回來，但四張數字的內容，我要改成符合現在有意義的。」
 * 「近期行程太長了，改一週內」。所以現在由上而下是：
 *   0. 四張數字卡——遷址累積金額／本月報名筆數／本月新信眾／會員人數（算法見 `overviewStats`）
 *   1. 今天要做的事——還要廟方動手的事（紅點那幾項）＋可提醒的信眾
 *   2. 近期行程——未來一週的問事場次、祈福活動、神明聖誕
 *   3. 本月款項——只給看得到「應收管理」的角色（admin／finance），staff 看不到
 *   4. 最新報名——問事／點燈／祈福／捐獻各最新 5 筆
 *   5. LINE 官方帳號導流
 *
 * **待辦數字不在這裡算**：由父層用 `navItems` ＋ `badgeFor` 組好傳進來（`todos`），
 * 與側邊欄紅點是同一份規則。最新報名分頁上的紅色數字也是父層用 `badgeFor` 算好傳進來的
 * （`serviceBadges`）。舊版在這裡自己重抄了四條狀態判斷，紅點改規則時就對不上。
 */
type OverviewTodo = { tab: Tab; label: string; count: number };

/** yyyy-mm-dd（本地時區）。不可用 toISOString，台灣早上 8 點前會差一天 */
const ymdOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** '2026-11-18' → '11/18' */
const mdOf = (ymd: string): string => {
  const [, m, d] = ymd.split('-');
  return `${Number(m)}/${Number(d)}`;
};
/** 報名截止存的是 UTC ISO，要轉成台灣本地那一天；壞值回空字串 */
const localYmdOfIso = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : ymdOf(d);
};

type AgendaKind = '聖誕' | '祈福' | '問事';
type AgendaItem = { key: string; date: string; kind: AgendaKind; title: string; sub: string; tab: Tab; muted?: boolean };
const AGENDA_ORDER: Record<AgendaKind, number> = { 聖誕: 0, 祈福: 1, 問事: 2 };
const AGENDA_TAG: Record<AgendaKind, string> = { 聖誕: TAG_SOLID, 祈福: TAG_GOLD, 問事: TAG_BROWN };
const AGENDA_DAYS = 7;

/** 本地時區的「年×12＋月」；壞值回 -1。報名的 createdAt 是 UTC ISO，要換成台灣那一天再歸月 */
function monthKeyOf(v: unknown): number {
  const d = new Date(String(v ?? ''));
  return Number.isNaN(d.getTime()) ? -1 : d.getFullYear() * 12 + d.getMonth();
}
/** 最新 5 筆（createdAt 由新到舊）。泛型箭頭函式在這個專案推導會失敗，所以用 function */
function newestFive<T extends { createdAt?: unknown }>(xs: T[]): T[] {
  return [...xs].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))).slice(0, 5);
}
/** 比對用的電話：只拿掉空白與連字號（同 toPersonKey），空的就是空字串＝不參與比對 */
function phoneKeyOf(p?: string | null): string {
  return (p ?? '').replace(/[\s-]/g, '');
}

const OverviewTab = ({
  todos, onNavigate, canOpen, showMoney,
  blessingEvents, blessingRegistrations, fahuiCount,
  lampRegistrations, lampConfigs, fahuiRegistrations, donations,
  bookings, volunteerRegistrations, memberProfiles, serviceBadges, lineStats,
}: {
  /** 父層由 navItems ＋ badgeFor 組好、只含 count > 0 且這個角色看得到的 */
  todos:                 OverviewTodo[];
  /** 等同點側邊欄那一項 */
  onNavigate:            (tab: Tab) => void;
  /** 這個角色進得去那一頁嗎（近期行程的項目進不去就不給點） */
  canOpen:               (tab: Tab) => boolean;
  /** 本月款項：只有看得到應收管理的角色才顯示 */
  showMoney:             boolean;
  blessingEvents:        BlessingEventRecord[];
  blessingRegistrations: BlessingRegistrationRecord[];
  /** 法會報名筆數（external_form = 'fahui' 的活動，報名不在 blessing_registrations） */
  fahuiCount:            number;
  lampRegistrations:     LampRegistrationRecord[];
  lampConfigs:           LampServiceConfig[];
  fahuiRegistrations:    FahuiRegistrationRecord[];
  donations:             DonationRecord[];
  bookings:              BookingRecord[];
  /** 只用在「本月新信眾」的首次出現判斷；志工不算報名，不進本月報名筆數 */
  volunteerRegistrations: VolunteerRegistrationRecord[];
  memberProfiles:        MemberProfileRecord[];
  /** 最新報名四個分頁的紅點，父層用 badgeFor 算好的（與側邊欄同一份規則） */
  serviceBadges:         { bookings: number; lamps: number; blessings: number; donations: number };
  lineStats:             { today: number; total: number };
}) => {
  const [activeService, setActiveService] = useState<'lamps' | 'blessing' | 'donation' | 'booking'>('lamps');

  /**
   * 提醒信眾（未匯款／問事前一天／點燈到期）。2026-11-18 起住在「今天要做的事」裡，
   * **這是全後台唯一寄這幾種提醒的地方**，不要在搬版面時弄丟。
   *
   * **進來就讀，不必按**（廟方 2026-10-16：「直接顯示出來，不要查詢，還要按才會執行」）：
   * 預覽是唯讀的 dry 查詢。只有「寄送提醒通知」——真的會寄出去、收不回來的——才要按。
   * 有人可提醒時才多一格「可提醒信眾 N 位」，點開就地展開明細與寄送鈕。
   */
  const [remind, setRemind] = useState<Record<string, any> | null>(null);
  const [remindErr, setRemindErr] = useState('');
  const [remindBusy, setRemindBusy] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);

  /** 現在總共有幾位要提醒。按鈕要把這個數字講出來，而不是叫「立即執行」 */
  const remindTotal = REMIND_KEYS.reduce((n, k) => n + (remind?.[k.key]?.對象 ?? 0), 0);
  const remindPartialErr = REMIND_KEYS.some(k => !!remind?.[k.key]?.查詢錯誤);

  const loadRemind = async () => {
    setRemindBusy(true); setRemindErr('');
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch('/api/cron-reminders?dry=1', {
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { setRemindErr(j.error ?? `讀取失敗（${r.status}）`); return; }
      setRemind(j);
    } catch { setRemindErr('讀取失敗，請檢查網路'); }
    finally { setRemindBusy(false); }
  };
  // 進入總覽就抓一次。這支是唯讀的 dry 查詢，不會寄出任何東西
  useEffect(() => { void loadRemind(); }, []);

  const runReminders = async () => {
    if (!confirm(
      `確定要寄給上面那 ${remindTotal} 位嗎？\n\n`
      + '他們會立刻收到 LINE 訊息或 email，送出後無法收回。\n'
      + '同一個人不會被重複提醒（寄過會記錄下來）。',
    )) return;
    setRemindBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch('/api/cron-reminders', {
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { alert(`執行失敗：${j.error ?? r.status}`); return; }
      const 送出 = REMIND_KEYS.reduce((n, k) => n + (j[k.key]?.已送 ?? 0), 0);
      alert(`已執行，共通知 ${送出} 位。`);
      await loadRemind();
    } catch { alert('執行失敗，請檢查網路後再試'); }
    finally { setRemindBusy(false); }
  };

  // ── 近期行程：問事場次與神明聖誕自己抓，**失敗一律當空的**，不可以讓整個總覽空白 ──
  const [sessions, setSessions] = useState<BookingSessionRecord[]>([]);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [feasts, setFeasts] = useState<DeityFeast[]>([]);
  const [agendaLoaded, setAgendaLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      // 與問事管理（BookingsTab）同一組讀法：含已關閉的場次＋各場次報名數
      const [ss, ct, fs] = await Promise.all([
        getBookingSessions(false).catch(() => [] as BookingSessionRecord[]),
        getBookingCountsBySession().catch(() => ({} as Record<string, number>)),
        getDeityFeasts().catch(() => [] as DeityFeast[]),
      ]);
      if (!alive) return;
      setSessions(ss); setSessionCounts(ct); setFeasts(fs); setAgendaLoaded(true);
    })();
    return () => { alive = false; };
  }, []);

  const agenda = useMemo(() => {
    const now = new Date();
    const from = ymdOf(now);
    const to = ymdOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + AGENDA_DAYS - 1));
    const inWin = (d: string) => !!d && d >= from && d <= to;
    const items: AgendaItem[] = [];

    for (const s of sessions) {
      if (!inWin(s.sessionDate)) continue;
      const n = sessionCounts[s.id] || 0;
      // session_time 是自由文字（「晚上 19:00–21:00」），整串照印，不可以 slice
      items.push({
        key: `s:${s.id}`, date: s.sessionDate, kind: '問事', tab: 'bookings',
        title: String(s.sessionTime ?? ''),
        sub: `已報名 ${n}／${s.maxSlots}${s.isActive ? '' : '・已關閉'}`,
        muted: !s.isActive,
      });
    }

    for (const ev of blessingEvents) {
      const count = ev.externalForm === 'fahui'
        ? `報名 ${fahuiCount} 筆（法會報名）`
        : `報名 ${blessingRegistrations.filter(r => r.eventId === ev.id && String(r.status ?? '') !== BlessingStatus.CANCELLED).length} 人`;
      const deadline = localYmdOfIso(ev.registrationDeadline);
      if (inWin(ev.startDate)) {
        items.push({ key: `e:${ev.id}`, date: ev.startDate, kind: '祈福', tab: 'blessings', title: ev.title, sub: count });
      }
      // 截止日另列一行（同一天就不重複）
      if (inWin(deadline) && deadline !== ev.startDate) {
        items.push({ key: `d:${ev.id}`, date: deadline, kind: '祈福', tab: 'blessings', title: ev.title, sub: `報名截止 ${mdOf(deadline)}・${count}` });
      }
    }

    // 聖誕：用歲時節慶同一支 resolveFeastDate 換算（含「三十遇小月改列廿九」）。
    // 視窗可能跨年，今年與明年都算
    for (const f of feasts) {
      for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
        const r = resolveFeastDate(f, y);
        if (!r || !inWin(r.date)) continue;
        items.push({
          key: `f:${f.id}:${y}`, date: r.date, kind: '聖誕', tab: 'feasts', title: f.title,
          sub: `${feastRuleLabel(f)}${r.adjusted ? '（今年小月，改列廿九）' : ''}`,
        });
      }
    }

    items.sort((a, b) => a.date.localeCompare(b.date) || AGENDA_ORDER[a.kind] - AGENDA_ORDER[b.kind]);
    const days: { date: string; items: AgendaItem[] }[] = [];
    for (const it of items) {
      const last = days[days.length - 1];
      if (last && last.date === it.date) last.items.push(it); else days.push({ date: it.date, items: [it] });
    }
    return { days, today: from };
  }, [sessions, sessionCounts, feasts, blessingEvents, blessingRegistrations, fahuiCount]);

  // ── 本月款項：與應收管理同一支 buildIncomeRows，不另算 ──
  const money = useMemo(() => {
    if (!showMoney) return null;
    const rows = buildIncomeRows({ lampRegistrations, lampConfigs, blessingRegistrations, blessingEvents, fahuiRegistrations, donations });
    const now = new Date();
    const thisKey = now.getFullYear() * 12 + now.getMonth();
    const keyOf = (s: string) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? -1 : d.getFullYear() * 12 + d.getMonth(); };
    const cur = rows.filter(r => keyOf(r.date) === thisKey && r.pay !== 'cancelled');
    const prev = rows.filter(r => keyOf(r.date) === thisKey - 1 && r.pay !== 'cancelled');
    const total = (xs: IncomeRow[]) => xs.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const byType = (['點燈', '祈福', '法會', '捐獻'] as const).map(t => ({ t, amount: total(cur.filter(r => r.type === t)) }));
    return {
      month: now.getMonth() + 1,
      prevMonth: ((now.getMonth() + 11) % 12) + 1,
      registered: total(cur),
      paid: total(cur.filter(r => r.pay === 'paid')),
      pending: total(cur.filter(r => r.pay === 'pending')),
      prevRegistered: total(prev),
      byType,
    };
  }, [showMoney, lampRegistrations, lampConfigs, blessingRegistrations, blessingEvents, fahuiRegistrations, donations]);

  /**
   * ── 頂端四張數字卡（廟方 2026-11-18：「四張數字的內容，我要改成符合現在有意義的」）──
   * 舊的四張是「總報名數／待處理／累計捐款／不重複信眾」，全部是開站以來的累計，
   * 數字只會變大、看不出現在的狀況；待處理又跟「今天要做的事」重複。
   */
  const overviewStats = useMemo(() => {
    const now = new Date();
    const thisKey = now.getFullYear() * 12 + now.getMonth();

    // 1. 遷址累積金額：type = '遷址護持' 的捐獻（與 RelocationPage 寫入的值同一個字串）。
    //    已收款才進主數字；待匯款另列；status 為空的是 donation_payment_status 之前的舊資料，
    //    **從未核對過、不等於沒收到**（同 buildIncomeRows 的 unchecked），所以既不算已收也不算待匯，單獨講出來。
    //    已取消一律不算（金額與人數都不算）。
    const reloc = donations.filter(d => String(d.type ?? '') === '遷址護持' && d.status !== DonationStatus.CANCELLED);
    const sumOf = (xs: DonationRecord[]) => xs.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const relocPaid      = sumOf(reloc.filter(d => d.status === DonationStatus.CONFIRMED));
    const relocPending   = sumOf(reloc.filter(d => d.status === DonationStatus.PENDING));
    const relocUnchecked = sumOf(reloc.filter(d => d.status === undefined));
    // 人數依電話；沒留電話的一筆算一人（寧可多算一位，也不要把所有沒電話的併成同一人）
    const relocPeople = new Set(reloc.map(d => phoneKeyOf(d.phone) || `id:${d.id}`)).size;

    // 2. 本月報名筆數：問事／點燈／祈福／法會／捐獻，不含已取消。法會一張報名單＝1 筆（不是牌位數）。
    //    志工不算——那不是報名一項服務。
    const regDates: unknown[] = [
      ...bookings.filter(b => String(b.status ?? '') !== BookingStatus.CANCELLED).map(b => b.createdAt),
      ...lampRegistrations.filter(r => String(r.status ?? '') !== LampRegistrationStatus.CANCELLED).map(r => r.createdAt),
      ...blessingRegistrations.filter(r => String(r.status ?? '') !== BlessingStatus.CANCELLED).map(r => r.createdAt),
      ...fahuiRegistrations.filter(r => String(r.status ?? '') !== 'cancelled').map(r => r.createdAt),
      ...donations.filter(d => d.status !== DonationStatus.CANCELLED).map(d => d.createdAt),
    ];
    const regKeys = regDates.map(monthKeyOf);
    const regThis = regKeys.filter(k => k === thisKey).length;
    const regPrev = regKeys.filter(k => k === thisKey - 1).length;

    // 3. 本月新信眾：依電話，第一次出現在任何一張表（含志工、含已取消——來過就是來過）的月份。
    //    空電話不參與（空電話一律不對，同 samePhone）。
    const firstSeen = new Map<string, number>();
    const see = (phone: string | null | undefined, at: unknown) => {
      const k = phoneKeyOf(phone);
      const t = new Date(String(at ?? '')).getTime();
      if (!k || Number.isNaN(t)) return;
      const prev = firstSeen.get(k);
      if (prev === undefined || t < prev) firstSeen.set(k, t);
    };
    bookings.forEach(r => see(r.phone, r.createdAt));
    lampRegistrations.forEach(r => see(r.phone, r.createdAt));
    blessingRegistrations.forEach(r => see(r.phone, r.createdAt));
    donations.forEach(r => see(r.phone, r.createdAt));
    fahuiRegistrations.forEach(r => see(r.phone, r.createdAt));
    volunteerRegistrations.forEach(r => see(r.phone, r.createdAt));
    const firstKeys = [...firstSeen.values()].map(t => { const d = new Date(t); return d.getFullYear() * 12 + d.getMonth(); });
    const newThis = firstKeys.filter(k => k === thisKey).length;
    const newPrev = firstKeys.filter(k => k === thisKey - 1).length;

    // 4. 會員人數：一個人有好幾個帳號只算一次（toPersonKey，同會員資訊）；
    //    「加入」取那個人最早的帳號（同會員資訊的加入欄）。
    const earliest = new Map<string, string>();
    memberProfiles.forEach(p => {
      const k = toPersonKey(p);
      const c = String(p.createdAt ?? '');
      const prev = earliest.get(k);
      if (prev === undefined || (c && c < prev)) earliest.set(k, c);
    });
    const membersNew = [...earliest.values()].filter(c => monthKeyOf(c) === thisKey).length;

    return {
      relocPaid, relocPending, relocUnchecked, relocPeople, relocCount: reloc.length,
      regThis, regPrev, newThis, newPrev,
      members: earliest.size, membersNew,
    };
  }, [donations, bookings, lampRegistrations, blessingRegistrations, fahuiRegistrations, volunteerRegistrations, memberProfiles]);

  // ── 最新報名：各服務最新 5 筆（原樣搬回，紅點改用父層的 badgeFor） ──
  const lampConfigMap    = Object.fromEntries(lampConfigs.map(c => [c.id, c.name]));
  const blessingEventMap = Object.fromEntries(blessingEvents.map(e => [e.id, e.title]));
  const latestLamps     = newestFive(lampRegistrations);
  const latestBlessings = newestFive(blessingRegistrations);
  const latestDonations = newestFive(donations);
  const latestBookings  = newestFive(bookings);
  const serviceTabs = [
    { key: 'booking'  as const, label: '問事', badge: serviceBadges.bookings  },
    { key: 'lamps'    as const, label: '點燈', badge: serviceBadges.lamps     },
    { key: 'blessing' as const, label: '祈福', badge: serviceBadges.blessings },
    { key: 'donation' as const, label: '捐獻', badge: serviceBadges.donations },
  ];
  /** 報名時間顯示成台灣那一天（createdAt 是 UTC ISO，slice(0,10) 早上 8 點前會差一天） */
  const dayOf = (v: unknown) => localYmdOfIso(String(v ?? '')) || '';
  const rowCls = 'flex items-center justify-between gap-2 py-2.5 border-b border-gray-50 last:border-0';
  const nameCls = 'font-medium text-sm text-gray-800';
  const subCls  = 'text-xs text-gray-400 ml-2';
  const dateCls = 'text-xs text-gray-400';

  const nt = (n: number) => `NT$ ${n.toLocaleString()}`;
  const remindLoaded = remind !== null || !!remindErr;
  const showRemindTile = !remindErr && remindTotal > 0;
  const sectionCls = 'bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mb-4';
  const headCls = 'font-semibold text-gray-800 text-base mb-3 flex items-center gap-2';
  const tileCls = 'text-left rounded-xl border px-3.5 py-3 transition-colors min-w-0';

  const st = overviewStats;
  /** 那一頁這個角色進得去才給點 */
  const goIf = (tab: Tab) => (canOpen(tab) ? () => onNavigate(tab) : undefined);

  return (
    <div>
      {/* ── 0. 四張數字卡（手機 2×2、桌機一排四張）── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard icon={<HeartHandshake className="w-5 h-5 text-temple-red" />} color="bg-temple-gold/15"
          label="遷址累積金額" value={nt(st.relocPaid)} onClick={goIf('donations')}
          sub={<>
            {st.relocPending > 0 && <span className="block">另有待匯款 {nt(st.relocPending)}</span>}
            {st.relocUnchecked > 0 && <span className="block">另有未核對 {nt(st.relocUnchecked)}</span>}
            <span className="block">護持 {st.relocPeople} 人・{st.relocCount} 筆</span>
          </>} />
        <StatCard icon={<ClipboardList className="w-5 h-5 text-blue-600" />} color="bg-blue-50"
          label="本月報名筆數" value={st.regThis} sub={`上月 ${st.regPrev} 筆`} />
        <StatCard icon={<UserPlus className="w-5 h-5 text-green-600" />} color="bg-green-50"
          label="本月新信眾" value={st.newThis} sub={`上月 ${st.newPrev} 位`} onClick={goIf('roster')} />
        <StatCard icon={<Users className="w-5 h-5 text-purple-600" />} color="bg-purple-50"
          label="會員人數" value={st.members} sub={`本月新增 ${st.membersNew} 位`} onClick={goIf('members')} />
      </div>

      {/* ── 1. 今天要做的事 ── */}
      <section className={sectionCls}>
        <h3 className={headCls}><AlertCircle className="w-4 h-4 text-temple-red" aria-hidden="true" />今天要做的事</h3>

        {(todos.length > 0 || showRemindTile) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {todos.map(t => (
              <button key={t.tab} type="button" onClick={() => onNavigate(t.tab)}
                className={`${tileCls} border-gray-200 bg-white hover:border-temple-gold hover:bg-temple-gold/5`}>
                <span className="block text-2xl font-bold text-temple-red leading-tight">{t.count}</span>
                <span className="mt-0.5 flex items-center gap-1 text-sm text-gray-700">
                  <span className="truncate">{t.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                </span>
              </button>
            ))}
            {showRemindTile && (
              <button type="button" onClick={() => setRemindOpen(o => !o)} aria-expanded={remindOpen}
                className={`${tileCls} ${remindOpen ? 'border-temple-gold bg-temple-gold/10' : 'border-gray-200 bg-white hover:border-temple-gold hover:bg-temple-gold/5'}`}>
                <span className="block text-2xl font-bold text-temple-red leading-tight">{remindTotal}<span className="text-sm font-medium ml-0.5">位</span></span>
                <span className="mt-0.5 flex items-center gap-1 text-sm text-gray-700">
                  <span className="truncate">可提醒信眾</span>
                  <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-gray-400 transition-transform ${remindOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </span>
              </button>
            )}
          </div>
        )}

        {todos.length === 0 && !showRemindTile && remindLoaded && (
          <p className="text-sm text-gray-500 py-2">目前沒有待辦事項。</p>
        )}
        {todos.length === 0 && !remindLoaded && (
          <p className="text-sm text-gray-400 py-2">讀取中…</p>
        )}

        {/* 讀不到提醒名單時不給那一格，但要留一行小字，失敗才不會悄悄的 */}
        {remindErr && (
          <p className="mt-3 text-xs text-gray-500" role="status">
            可提醒信眾的名單讀不到（{remindErr}）。
            <button type="button" onClick={() => void loadRemind()} disabled={remindBusy}
              className="ml-1 underline text-temple-red disabled:opacity-50">{remindBusy ? '讀取中…' : '再試一次'}</button>
          </p>
        )}
        {!remindErr && remindPartialErr && !remindOpen && (
          <p className="mt-3 text-xs text-gray-500">部分提醒名單查詢失敗，點「可提醒信眾」可看是哪一種。</p>
        )}

        {/* 提醒明細：點「可提醒信眾」就地展開 */}
        {showRemindTile && remindOpen && remind && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              {/* **不要用「提醒作業」「立即執行」這種詞**（廟方 2026-10-16：「立即執行，
                  我其實不知道這什麼動作」）。要寫的是「誰會收到什麼、什麼時候」，
                  不是功能的名字。 */}
              <p className="text-xs text-gray-500 min-w-0 flex-1">
                下面這些人可以用 LINE 或 email 提醒：還沒匯款的、明天要來問事的、點燈快到期的。
                <span className="text-gray-400">　不會自動寄，按「寄送提醒通知」才會送出。</span>
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => void loadRemind()} disabled={remindBusy}
                  className="px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
                  {remindBusy ? '讀取中…' : '重新整理'}
                </button>
                {/* 按鈕的字要說出「會發生什麼事」（廟方 2026-10-16 定名「寄送提醒通知」） */}
                <button type="button" onClick={() => void runReminders()} disabled={remindBusy || remindTotal === 0}
                  title={`寄給下面那 ${remindTotal} 位（寄過的不會再寄一次）`}
                  className="px-3 py-2 bg-temple-red text-white rounded-lg text-sm hover:bg-[#5C1A04] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  寄送提醒通知
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {REMIND_KEYS.map(({ key, label }) => {
                const v = remind[key] ?? {};
                const n = v.對象 ?? 0;
                return (
                  <div key={key} className="border border-gray-100 rounded-xl p-3.5 bg-gray-50 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                      {/* 查詢失敗要自己一種顏色：它既不是「有人要提醒」也不是「沒有人」 */}
                      {v.查詢錯誤
                        ? <span className="text-xs font-medium text-red-600">查詢失敗</span>
                        : <span className={`text-sm font-semibold ${n > 0 ? 'text-temple-red' : 'text-gray-400'}`}>{n} 位</span>}
                    </div>
                    {v.查詢錯誤 && <p className="mt-1.5 text-xs text-red-600 break-all">{v.查詢錯誤}</p>}
                    {/* 母體：讓「0 位」分得出是「沒有人欠款」還是「都落在時間窗外」 */}
                    {!v.查詢錯誤 && v.母體 && <p className="mt-1 text-xs text-gray-400">{v.母體}</p>}
                    {/* 是誰。沒有這個，數字就只能拿來問「你有把握嗎」 */}
                    {!v.查詢錯誤 && n > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {(v.明細 ?? []).slice(0, 8).map((line: string, i: number) => (
                          <li key={i} className="text-xs text-gray-600 break-words">・{line}</li>
                        ))}
                        {(v.明細 ?? []).length > 8 && (
                          <li className="text-xs text-gray-400">…還有 {(v.明細 ?? []).length - 8} 位</li>
                        )}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── 2. 近期行程（未來一週） ── */}
      <section className={sectionCls}>
        <h3 className={headCls}><CalendarClock className="w-4 h-4 text-temple-red" aria-hidden="true" />近期行程<span className="text-xs font-normal text-gray-400">未來一週</span></h3>
        {!agendaLoaded ? (
          <p className="text-sm text-gray-400 py-2">讀取中…</p>
        ) : agenda.days.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">未來一週沒有排定的行程。</p>
        ) : (
          <div className="space-y-4">
            {agenda.days.map(day => (
              <div key={day.date}>
                {/* 廟方是用農曆在想事情的，日期旁邊一定要有農曆 */}
                <p className="text-sm font-semibold text-gray-800 mb-1.5 flex flex-wrap items-baseline gap-x-2">
                  <span>{mdOf(day.date)}（{weekdayLabel(day.date)}）</span>
                  {day.date === agenda.today && <span className="text-xs font-medium text-temple-red">今天</span>}
                  <span className="text-xs font-normal text-gray-500">{solarToLunarLabel(day.date)}</span>
                </p>
                <ul className="space-y-1.5">
                  {day.items.map(it => {
                    const clickable = canOpen(it.tab);
                    const inner = (
                      <>
                        <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${it.muted ? TAG_STATE_OVER : AGENDA_TAG[it.kind]}`}>{it.kind}</span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm break-words ${it.muted ? 'text-gray-500' : 'text-gray-800'}`}>{it.title}</span>
                          <span className="block text-xs text-gray-500 break-words">{it.sub}</span>
                        </span>
                        {clickable && <ArrowRight className="w-3.5 h-3.5 shrink-0 text-gray-400 mt-1" aria-hidden="true" />}
                      </>
                    );
                    return (
                      <li key={it.key}>
                        {clickable ? (
                          <button type="button" onClick={() => onNavigate(it.tab)}
                            className="w-full flex items-start gap-2.5 text-left rounded-lg border border-gray-100 px-3 py-2 hover:border-temple-gold hover:bg-temple-gold/5 transition-colors">
                            {inner}
                          </button>
                        ) : (
                          <div className="flex items-start gap-2.5 rounded-lg border border-gray-100 px-3 py-2">{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 3. 本月款項（admin／finance；staff 看不到應收管理，所以整塊不出現） ── */}
      {money && (
        <section className={sectionCls}>
          <h3 className={headCls}><Banknote className="w-4 h-4 text-temple-red" aria-hidden="true" />{money.month} 月款項</h3>
          {/* 整塊點下去到應收管理。button 裡只能放 phrasing content，所以全部用 span */}
          <button type="button" onClick={() => onNavigate('receivables')} className="w-full text-left group">
            <span className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <span className="block rounded-xl bg-temple-gold/10 px-3.5 py-3 min-w-0">
                <span className="block text-xs text-gray-600">報名金額</span>
                <span className="block text-xl font-bold text-gray-900 break-words">{nt(money.registered)}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{money.prevMonth} 月 {nt(money.prevRegistered)}</span>
              </span>
              <span className="block rounded-xl bg-gray-50 px-3.5 py-3 min-w-0">
                <span className="block text-xs text-gray-600">已收款</span>
                <span className="block text-xl font-bold text-gray-900 break-words">{nt(money.paid)}</span>
              </span>
              <span className="block rounded-xl bg-gray-50 px-3.5 py-3 min-w-0">
                <span className="block text-xs text-gray-600">待匯款</span>
                <span className="block text-xl font-bold text-temple-red break-words">{nt(money.pending)}</span>
              </span>
            </span>
            <span className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
              {money.byType.map(b => <span key={b.t}>{b.t} {nt(b.amount)}</span>)}
            </span>
            {/* 口徑要講清楚（同流量來源那條）：不寫的話會被當成收入看 */}
            <span className="mt-1.5 block text-xs text-gray-400">
              依報名日期歸月、不含已取消；是「報名金額」不是已入帳。已收款／待匯款是這些報名目前的收款狀態，與應收管理同一套算法。
            </span>
            <span className="mt-2 flex items-center gap-1 text-sm text-temple-red group-hover:underline">到應收管理<ArrowRight className="w-3.5 h-3.5" aria-hidden="true" /></span>
          </button>
        </section>
      )}

      {/* ── 4. 最新報名（2026-11-18 依廟方要求改回來）── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
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
                  <div className="min-w-0"><span className={nameCls}>{r.name}</span><span className={subCls}>{lampConfigMap[r.serviceId] ?? r.serviceId}</span></div>
                  <div className="flex items-center gap-2 shrink-0"><span className={dateCls}>{dayOf(r.createdAt)}</span>{statusBadge(r.status)}</div>
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
                  <div className="min-w-0"><span className={nameCls}>{r.name}</span><span className={subCls}>{blessingEventMap[r.eventId] ?? r.eventId}</span></div>
                  <div className="flex items-center gap-2 shrink-0"><span className={dateCls}>{dayOf(r.createdAt)}</span>{statusBadge(r.status)}</div>
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
                  <div className="min-w-0"><span className={nameCls}>{d.name}</span><span className={subCls}>{d.type}</span></div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={dateCls}>{dayOf(d.createdAt)}</span>
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
                  <div className="min-w-0"><span className={nameCls}>{b.name}</span><span className={subCls}>{b.type} · {b.bookingDate}</span></div>
                  <div className="flex items-center gap-2 shrink-0"><span className={dateCls}>{dayOf(b.createdAt)}</span>{statusBadge(b.status)}</div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── 5. LINE 導流統計（2026-11-18 依廟方要求改回來）── */}
      <div className="bg-[#06C755]/5 border border-[#06C755]/30 rounded-xl p-5 flex flex-col sm:flex-row items-center gap-6">
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
  /**
   * 過期場次預設收起來（2026-11-17 廟方：「過期的場次，在後台要藏起來，需要查看時再點選即可」）。
   * 場次一週好幾場、只增不減，半年後列表上全是辦完的，要找下一場得一直往下滑。
   * **判準是日期不是「開放／關閉」**：今天的場次還沒辦完，照樣排在上面；
   * 未來但被關閉的（例如額滿先關）也還是「要管的」，不收起來。
   * 收起來的照樣能點開、能刪，**不刪任何資料**——報名紀錄與統計都還掛在那幾場上。
   */
  const [showPastSessions, setShowPastSessions] = useState(false);

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
  // 清單預設只留「找人、看時間、改狀態」要的東西（2026-11-11 廟方：「需要再簡單清楚一點，
  // 信眾資料跟神明的話可以收折起來」）。兩塊各自一顆鈕、就地展開，不另開一列——
  // 1023px 以下 admin-table 會變卡片，另開一列在手機上就成了一張沒頭沒尾的孤兒卡。
  const [openInfo, setOpenInfo] = useState<Set<string>>(new Set());
  const [openDivine, setOpenDivine] = useState<Set<string>>(new Set());
  const [openNote, setOpenNote] = useState<Set<string>>(new Set());
  const toggleIn = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    set(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

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
      const matchSession = filterSession === '__none__' ? !b.sessionId : b.sessionId === filterSession;
      return matchSearch && matchStatus && matchType && matchSession;
    });
    if (sortBy === 'name') result.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'));
    return result;
  }, [bookings, search, filterStatus, filterType, filterSession, sortBy]);

  useEffect(() => { setPage(0); }, [search, filterStatus, filterType, filterSession, sortBy]);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  /** 「未指定場次」那一列的鍵：場次功能上線前的預約沒有 session_id */
  const NO_SESSION = '__none__';
  /** 每一場還待處理的筆數（紅點）。沒掛場次的歸 NO_SESSION */
  const pendingBySession = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of bookings) if (b.status === BookingStatus.PENDING) {
      const k = b.sessionId || NO_SESSION;
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [bookings]);
  const noSessionCount = bookings.filter(b => !b.sessionId).length;
  const openSessionRec = sessions.find(x => x.id === filterSession) ?? null;
  const sessionTitle = (id: string) => {
    if (id === NO_SESSION) return '未指定場次（場次功能上線前的預約）';
    const x = sessions.find(y => y.id === id);
    if (!x) return '預約名單';
    const d = new Date(x.sessionDate + 'T12:00:00');
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${'日一二三四五六'[d.getDay()]}）${x.sessionTime}`;
  };
  const openSessionList = (id: string) => { setFilterSession(id); setSearch(''); setFilterStatus(''); setFilterType(''); };

  const handleExport = () => {
    exportExcel(`預約資料_${sessionTitle(filterSession).slice(0, 20)}.xlsx`, filtered.map(b => [
      b.name, b.phone, b.gender || '', b.birthDate, b.zodiac || '', b.address || '', b.bookingDate,
      b.bookingTime === 'evening' ? '晚上' : b.bookingTime,
      b.type, b.status || '', b.notes || '', fmtDate(b.createdAt), b.source || ''
    ]), ['姓名', '電話', '性別', '農曆生日', '生肖', '現居地址', '預約日期', '時段', '問事項目', '狀態', '備註', '建立時間', '報名來源']);
  };

  const types = [...new Set(bookings.map(b => b.type))];
  /** 這一場的預約（不吃其他篩選）：篩選鈕上的數字從這裡數，按下去才知道有幾筆 */
  const inSession = bookings.filter(b => filterSession === NO_SESSION ? !b.sessionId : b.sessionId === filterSession);
  const sessionTypes = [...new Set(inSession.map(b => b.type))];
  const chip = (on: boolean) => `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
    on ? 'bg-temple-red text-white border-temple-red' : 'bg-white text-gray-600 border-gray-300 hover:border-temple-red hover:text-temple-red'}`;

  return (
    <div>
      {/* 問事管理照點燈管理的版型（2026-11-18 廟方：「點燈管理表單改得非常好，後台其他表單，依相同設計概念重新調整」）：
          場次一列一列，列上看得到預約數、待處理數與「預約名單」；名單一定是某一場的。
          原本是場次清單底下再接一張所有場次混在一起的大表，要靠「全部場次」下拉自己篩。
          **沒掛場次的預約另成一列「未指定場次」**：場次功能上線前的預約都沒有 session_id（2026-11-18 線上 15 筆裡有 9 筆），
          不給它一列的話那些人就再也找不到。 */}
      {!filterSession && (
        <h2 className="text-xl font-bold text-gray-800 mb-5">問事管理</h2>
      )}

      {sessionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{sessionError}</span>
        </div>
      )}

      {/* 場次管理 */}
      {!filterSession && (
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
          (() => {
            const renderSession = (s: BookingSessionRecord) => {
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
                    {pendingBySession[s.id] > 0 && (
                      <span className="text-[11px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5 leading-none">{pendingBySession[s.id]} 待處理</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openSessionList(s.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                      <List className="w-3.5 h-3.5" /> 預約名單
                    </button>
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
            };
            const today = todayYmd();
            const upcoming = sessions.filter(s => s.sessionDate >= today);
            // 過期的由新到舊：點開時最先看到的是剛辦完的那幾場，那才是會回頭查的
            const past = sessions.filter(s => s.sessionDate < today).reverse();
            return (
              <div className="space-y-2">
                {upcoming.length === 0 && (
                  <div className="text-center text-gray-400 text-sm py-3">目前沒有即將到來的場次，請新增。</div>
                )}
                {upcoming.map(renderSession)}
                {past.length > 0 && (
                  <>
                    <button type="button" onClick={() => setShowPastSessions(v => !v)} aria-expanded={showPastSessions}
                      className="w-full flex items-center justify-center gap-1.5 mt-1 py-2 text-sm text-gray-500 hover:text-temple-red border border-dashed border-gray-200 rounded-lg hover:border-temple-red/40 transition-colors">
                      {showPastSessions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {showPastSessions ? '收起已過期場次' : `已過期場次（${past.length} 場）`}
                    </button>
                    {showPastSessions && past.map(renderSession)}
                  </>
                )}
                {noSessionCount > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-dashed border-gray-200 bg-white">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">未指定場次</span>
                      <span className="text-xs text-gray-400">場次功能上線前的預約・{noSessionCount} 位</span>
                      {pendingBySession[NO_SESSION] > 0 && (
                        <span className="text-[11px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5 leading-none">{pendingBySession[NO_SESSION]} 待處理</span>
                      )}
                    </div>
                    <button onClick={() => openSessionList(NO_SESSION)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                      <List className="w-3.5 h-3.5" /> 預約名單
                    </button>
                  </div>
                )}
              </div>
            );
          })()
        )}
      </div>
      )}

      {/* ── 某一場的預約名單 ── */}
      {filterSession && (
      <>
      <button onClick={() => setFilterSession('')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> 返回場次列表
      </button>
      <div className="bg-white rounded-xl border border-temple-gold/30 shadow-sm p-5 mb-5 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-800">{sessionTitle(filterSession)}</h2>
          {openSessionRec && <p className="text-sm text-gray-500 mt-0.5">{sCountMap[openSessionRec.id] || 0}/{openSessionRec.maxSlots} 位</p>}
        </div>
        <span className="text-sm font-semibold text-temple-red">共 {filtered.length} 筆</span>
        {(pendingBySession[filterSession] ?? 0) > 0 && (
          <span className="text-xs font-bold text-white bg-red-500 rounded-full px-2 py-0.5">{pendingBySession[filterSession]} 待處理</span>
        )}
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
        {/* 篩選與排序改成一排按鈕（2026-11-18 廟方：「操作最好不要用下拉選單」）：下拉要點兩次、而且看不到每一類有幾筆 */}
        <button type="button" onClick={() => setSortBy(sortBy === 'time' ? 'name' : 'time')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:border-temple-red hover:text-temple-red whitespace-nowrap">
          {sortBy === 'time' ? '依時間排序' : '依姓名排序'} ⇅
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-5 -mt-2">
        <button type="button" onClick={() => setFilterStatus('')} className={chip(!filterStatus)}>全部 {inSession.length}</button>
        {Object.values(BookingStatus).map(st => {
          const n = inSession.filter(b => (b.status || BookingStatus.PENDING) === st).length;
          return n > 0 || filterStatus === st
            ? <button key={st} type="button" onClick={() => setFilterStatus(filterStatus === st ? '' : st)} className={chip(filterStatus === st)}>{st} {n}</button>
            : null;
        })}
        {/* 項目只有一種時這排不出現：篩了也是同一份 */}
        {sessionTypes.length > 1 && <span className="w-px bg-gray-200 mx-1" aria-hidden="true" />}
        {sessionTypes.length > 1 && sessionTypes.map(t => (
          <button key={t} type="button" onClick={() => setFilterType(filterType === t ? '' : t)} className={chip(filterType === t)}>
            {t} {inSession.filter(b => b.type === t).length}
          </button>
        ))}
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
                  {['信眾資訊', '問事項目', '備註／神明的話', '狀態'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paged.map(b => (
                  <tr key={b.id}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                    onClick={() => setQuickView({ name: b.name, phone: b.phone, gender: b.gender || undefined, birthDate: b.birthDate, zodiac: b.zodiac || undefined, address: b.address || undefined, notes: b.notes || undefined, status: b.status, serviceLabel: `問事 · ${b.type}`, createdAt: b.createdAt, contactLabel: b.contactLabel, source: b.source, email: b.email, confirmSentAt: b.confirmSentAt, mailKind: 'confirm' })}
                  >
                    <td data-label="信眾資訊" className="px-5 py-4">
                      {/* 原本每一列前面都有同一個人像圓圈，整欄一模一樣，只是把名字往右推（2026-11-17 拿掉） */}
                      <div className="flex items-start gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{b.name}</p>
                          </div>
                          <button type="button" aria-expanded={openInfo.has(b.id)}
                            onClick={e => { e.stopPropagation(); toggleIn(setOpenInfo, b.id); }}
                            className="mt-1 text-xs text-gray-500 hover:text-temple-red inline-flex items-center gap-0.5">
                            {openInfo.has(b.id) ? '收合資料' : '個人資料'}
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openInfo.has(b.id) ? 'rotate-180' : ''}`} aria-hidden="true" />
                          </button>
                          {openInfo.has(b.id) && (
                            <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                              {b.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{b.phone}</p>}
                              {b.contactLabel && <p>稱謂：{b.contactLabel}</p>}
                              {b.gender && <p>性別：{b.gender}</p>}
                              <p className="text-gray-400">登記 {fmtDate(b.createdAt)}</p>
                              <p>生日：{b.birthDate || '—'}{b.zodiac ? `　生肖：${b.zodiac}` : ''}</p>
                              {b.address && <p>地址：{b.address}</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* 名單一定屬於某一場，日期時段整份都一樣，摘要卡已經寫了；只有「未指定場次」那份每列不同才印 */}
                    <td data-label="問事項目" className="px-5 py-4">
                      {filterSession === NO_SESSION && (
                        <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-1.5"><Calendar className="w-3.5 h-3.5 text-gray-400" />{b.bookingDate}
                          　{b.bookingTime === 'evening' ? '晚上 (19:00-21:00)' : b.bookingTime}</p>
                      )}
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">{b.type}</span>
                    </td>
                    {/* 備註與神明的話收成兩個圖示（2026-11-11 廟方：「可以做成 icon，有內容時會變色顯示即可，
                        應該大部分時都沒有」）。有內容＝上色、點了就地展開；沒內容＝淡灰。
                        神明的話沒內容時點下去直接開填寫視窗——那是廟方唯一會在這裡做的事。 */}
                    <td data-label="備註／神明的話" className="px-5 py-4 max-w-[240px]" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button type="button"
                          disabled={!b.notes}
                          aria-expanded={b.notes ? openNote.has(b.id) : undefined}
                          aria-label={b.notes ? (openNote.has(b.id) ? '收合備註' : '查看備註') : '無備註'}
                          title={b.notes ? '備註' : '無備註'}
                          onClick={() => toggleIn(setOpenNote, b.id)}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${b.notes
                            ? (openNote.has(b.id) ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-700 hover:bg-sky-100')
                            : 'text-gray-300 cursor-default'}`}>
                          <FileText className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button type="button"
                          aria-expanded={b.divineMessage ? openDivine.has(b.id) : undefined}
                          aria-label={b.divineMessage ? (openDivine.has(b.id) ? '收合神明的話' : '查看神明的話') : '填寫神明的話'}
                          title={b.divineMessage ? '神明的話' : '填寫神明的話'}
                          onClick={() => b.divineMessage
                            ? toggleIn(setOpenDivine, b.id)
                            : setDivineEdit({ id: b.id, name: b.name, text: '' })}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${b.divineMessage
                            ? (openDivine.has(b.id) ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100')
                            : 'text-gray-300 hover:text-amber-600 hover:bg-amber-50'}`}>
                          <Sparkles className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                      {b.notes && openNote.has(b.id) && (
                        <div className="mt-2">
                          <p className="text-[11px] font-medium text-sky-700">備註</p>
                          <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{b.notes}</p>
                        </div>
                      )}
                      {b.divineMessage && openDivine.has(b.id) && (
                        <div className="mt-2">
                          <p className="text-[11px] font-medium text-amber-700">神明的話</p>
                          <p className="text-xs text-amber-900 whitespace-pre-line leading-relaxed">{b.divineMessage}</p>
                          <button type="button" onClick={() => setDivineEdit({ id: b.id, name: b.name, text: b.divineMessage! })}
                            className="mt-1 text-xs text-gray-500 hover:text-temple-red underline">編輯</button>
                        </div>
                      )}
                    </td>
                    {/* 狀態與按鈕同一格（同捐獻、祈福）：看到狀態的同時就按得到下一步 */}
                    <td data-label="狀態" className="px-5 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-col items-start gap-1.5">
                        {statusBadge(b.status)}
                        <BookingActions status={b.status} busy={updatingId === b.id} onChange={next => onStatusChange(b.id, next)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Paginator total={filtered.length} page={page} onChange={setPage} />
          </div>
        )}
      </div>
      </>
      )}
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
  const donationRows = useOpenRows();
  /** 電話、性別、生日、地址：按「個人資料」才就地展開（同問事管理；電話 2026-11-18 收進來） */
  const donationInfo = useOpenRows();
  const [donBusyId, setDonBusyId] = useState<string | null>(null);
  const handleDonationStatus = async (id: string, next: DonationStatus) => {
    setDonBusyId(id);
    try { await updateDonationStatus(id, next); onRefresh(); }
    catch { alert('更新收款狀態失敗，請再試一次'); }
    finally { setDonBusyId(null); }
  };
  /**
   * 年度捐獻明細：把某一年的捐獻整理成一則寄給每一位捐款人。
   * **先預覽再寄**是刻意的——這是一次寄給幾十個人的動作，按下去才發現年份選錯
   * 就收不回來了。預覽會回報筆數、人數、以及前三則的實際內容。
   */
  const [stmtYear, setStmtYear] = useState(new Date().getFullYear());
  const [stmtBusy, setStmtBusy] = useState(false);
  const sendStatement = async (dry: boolean) => {
    if (!dry && !confirm(`確定要把 ${stmtYear} 年的捐獻明細寄給每一位捐款人嗎？\n\n寄出後無法收回。建議先按「預覽」確認筆數。`)) return;
    setStmtBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch('/api/donation-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify({ year: stmtYear, dry }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { alert(`失敗：${j.error ?? j.說明 ?? r.status}`); return; }
      if (dry) {
        alert(`預覽（不會寄出）\n\n${stmtYear} 年尚未寄送明細的捐獻：${j.筆數} 筆、${j.人數} 位捐款人`
          + `\n這次會寄給 ${j.這次會寄} 位`
          + (j.無法通知 ? `\n有 ${j.無法通知} 筆沒有信箱也沒有 LINE，無法通知` : '')
          + (j.預覽?.[0] ? `\n\n── 內容範例（${j.預覽[0].管道}）──\n${j.預覽[0].內容}` : ''));
      } else {
        alert(`已寄出 ${j.已寄} 位、涵蓋 ${j.涵蓋筆數} 筆。`
          + (j.提醒 ? `\n${j.提醒}` : '') + (j.警告 ? `\n\n注意：${j.警告}` : ''));
        onRefresh();
      }
    } catch { alert('失敗，請檢查網路後再試'); }
    finally { setStmtBusy(false); }
  };
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'name'>('time');
  const [page, setPage] = useState(0);
  const [quickView, setQuickView] = useState<RegViewItem | null>(null);

  const filtered = useMemo(() => {
    const result = donations.filter(d => {
      const q = search.toLowerCase();
      const matchSearch = !q || d.name.toLowerCase().includes(q) || d.phone.includes(q);
      const matchType = d.type === filterType;
      return matchSearch && matchType;
    });
    if (sortBy === 'name') result.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'));
    return result;
  }, [donations, search, filterType, sortBy]);

  useEffect(() => { setPage(0); }, [search, filterType, sortBy]);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const total = filtered.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  /**
   * 捐獻管理照點燈管理的版型（2026-11-18 廟方：「後台其他表單，依相同設計概念重新調整」）：
   * 一種捐獻類型一列，列上看得到筆數、累計金額、待匯款，按「捐款名單」才進那一類的名單。
   * 三類收的錢去處不同（一般捐獻與遷址護持是**不同帳戶**，見 BankInfoBox），混在一張表裡對帳最容易出錯。
   */
  const typeStats = useMemo(() => {
    const m = new Map<string, { count: number; amount: number; pending: number; last: string }>();
    for (const d of donations) {
      const k = m.get(d.type) ?? { count: 0, amount: 0, pending: 0, last: '' };
      k.count++;
      if (d.status !== DonationStatus.CANCELLED) k.amount += Number(d.amount) || 0;
      if (d.status === DonationStatus.PENDING) k.pending++;
      if ((d.createdAt ?? '') > k.last) k.last = d.createdAt ?? '';
      m.set(d.type, k);
    }
    // 最近有人捐的排前面：那一類才是現在要看的
    return [...m.entries()].sort((a, b) => b[1].last.localeCompare(a[1].last));
  }, [donations]);
  const openType = (t: string) => { setFilterType(t); setSearch(''); };

  const showDesignated = anyFilled(filtered, d => d.repairProjectName || d.relocationPlan);
  const showDonNotes = anyFilled(filtered, d => d.notes);
  const handleExport = () => {
    // 生日與遷址方案 2026-10-23 加入：遷址護持的方案含誦經祈福與功德簿，
    // 廟方要拿這份去寫疏文與功德簿，少了生辰就得回頭一個一個問。
    exportExcel(`捐款資料_${filterType}.xlsx`, filtered.map(d => [
      d.name, d.phone, d.gender || '', d.birthDate || '', d.address || '', Number(d.amount), d.type,
      d.repairProjectName || '', d.relocationPlan || '', d.relocationTier || '',
      d.notes || '', fmtDate(d.createdAt), d.source || ''
    ]), ['姓名', '電話', '性別', '出生年月日', '現居地址', '金額', '捐款類型',
      '修復神尊', '遷址方案', '遷址級距', '備註', '建立時間', '報名來源']);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-800">捐款管理</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 年度明細：先預覽再寄。這是一次寄給幾十個人的動作，按下去就收不回來了 */}
          <div className="flex items-center gap-1.5 text-sm">
            {/* 年份用兩顆鈕不用下拉：年度明細實際只會寄今年或去年 */}
            {[new Date().getFullYear(), new Date().getFullYear() - 1].map(y => (
              <button key={y} type="button" aria-pressed={stmtYear === y} onClick={() => setStmtYear(y)}
                className={`px-3 py-2 rounded-lg text-sm border transition-colors ${stmtYear === y
                  ? 'bg-temple-red text-white border-temple-red' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {y} 年
              </button>
            ))}
            <button onClick={() => sendStatement(true)} disabled={stmtBusy}
              title="只看筆數與內容，不會寄出"
              className="px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
              預覽明細
            </button>
            <button onClick={() => sendStatement(false)} disabled={stmtBusy}
              title="把這一年的捐獻明細寄給每一位捐款人（LINE 或 email）"
              className="flex items-center gap-1.5 px-3 py-2 bg-temple-red text-white rounded-lg text-sm hover:bg-[#5C1A04] transition-colors disabled:opacity-50">
              <Send className="w-4 h-4" /> 寄年度明細
            </button>
          </div>
        </div>
      </div>

      {!filterType && (
      <>
      {/* 捐款類別設定：預設收合，不擋住每天要看的捐款列表 */}
      <AdminDonationTypesTab donations={donations} onRefresh={onRefresh} />

      <div className="space-y-2">
        {typeStats.length === 0 && (
          <div className="p-12 text-center text-gray-400 bg-white rounded-xl border border-gray-100">
            <HeartHandshake className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p>尚無捐款紀錄</p>
          </div>
        )}
        {typeStats.map(([t, st]) => (
          <div key={t} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-800">{t}</h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 mt-1">
                <span className="text-temple-red font-medium">{st.count} 筆</span>
                <span>累計 NT$ {st.amount.toLocaleString()}</span>
                {st.last && <span>最近 {fmtDate(st.last)}</span>}
                {st.pending > 0 && <span className="text-[11px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5 leading-none">{st.pending} 待匯款</span>}
              </div>
            </div>
            <button onClick={() => openType(t)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
              <List className="w-3.5 h-3.5" /> 捐款名單
            </button>
          </div>
        ))}
      </div>
      </>
      )}

      {filterType && (
      <>
      <button onClick={() => setFilterType('')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> 返回捐款類型
      </button>
      <div className="bg-white rounded-xl border border-temple-gold/30 shadow-sm p-5 mb-5 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-800">{filterType}</h2>
          <p className="text-sm text-green-600 font-semibold mt-0.5">合計 NT$ {total.toLocaleString()}</p>
        </div>
        <span className="text-sm font-semibold text-temple-red">共 {filtered.length} 筆</span>
        {(typeStats.find(([t]) => t === filterType)?.[1].pending ?? 0) > 0 && (
          <span className="text-xs font-bold text-white bg-red-500 rounded-full px-2 py-0.5">{typeStats.find(([t]) => t === filterType)![1].pending} 待匯款</span>
        )}
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
        <button type="button" onClick={() => setSortBy(sortBy === 'time' ? 'name' : 'time')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:border-temple-red hover:text-temple-red whitespace-nowrap">
          {sortBy === 'time' ? '依時間排序' : '依姓名排序'} ⇅
        </button>
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
                  {/* 「指定項目」一欄兩用：神尊修復的專案、遷址護持的方案。
                      兩者都是「這筆錢指定給哪一件事」，而且互斥，不必各開一欄 */}
                  {/* 一整欄都空的不畫：一般捐獻幾乎沒有「指定項目」，備註也多半沒寫（2026-11-17） */}
                  {/* 「類型」欄拿掉：整份名單都是同一類 */}
                  {['信眾資訊', '捐款金額',
                    ...(showDesignated ? ['指定項目'] : []), ...(showDonNotes ? ['備註'] : []), '時間', '收款'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paged.map(d => (
                  <tr key={d.id}
                    className={`hover:bg-green-50/40 transition-colors cursor-pointer${donationRows.isOpen(d.id) ? ' admin-open' : ''}`}
                    onClick={() => setQuickView({ name: d.name, phone: d.phone, gender: d.gender || undefined, address: d.address || undefined, notes: d.notes || undefined, serviceLabel: `捐獻 · ${d.type}　NT$${Number(d.amount).toLocaleString()}`, createdAt: d.createdAt, contactLabel: d.contactLabel, source: d.source, email: d.email, confirmSentAt: d.confirmSentAt, mailKind: 'thanks' })}
                  >
                    <td data-label="信眾資訊" className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{d.name}</p>
                            {d.contactLabel && <span className="text-xs bg-temple-gold/20 text-temple-dark px-1.5 py-0.5 rounded-full font-medium">#{d.contactLabel}</span>}
                          </div>
                          {(d.phone || d.gender || d.birthDate || d.address) && (
                            <button type="button" aria-expanded={donationInfo.isOpen(d.id)}
                              onClick={e => { e.stopPropagation(); donationInfo.toggle(d.id); }}
                              className="mt-1 text-xs text-gray-500 hover:text-temple-red inline-flex items-center gap-0.5">
                              {donationInfo.isOpen(d.id) ? '收合資料' : '個人資料'}
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${donationInfo.isOpen(d.id) ? 'rotate-180' : ''}`} aria-hidden="true" />
                            </button>
                          )}
                          {/* 生日、地址是隱私，預設收起（2026-11-18）；一看就知道是什麼，不加「生日：」前綴（2026-11-17） */}
                          {donationInfo.isOpen(d.id) && (
                            <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                              {d.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{d.phone}</p>}
                              {d.gender && <p>{d.gender}</p>}
                              {d.birthDate && <p>{d.birthDate}</p>}
                              {d.address && <p>{d.address}</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td data-label="捐款金額" className="px-5 py-4">
                      <p className="text-base font-bold text-green-700">NT$ {Number(d.amount).toLocaleString()}</p>
                    </td>
                    {showDesignated && <td data-label="指定項目" data-more className="px-4 py-3 text-sm text-gray-500">
                      {d.repairProjectName ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                          <Wrench className="w-3 h-3" />{d.repairProjectName}
                        </span>
                      ) : d.relocationPlan ? (
                        // 方案與級距分兩行：方案名最長十個字，跟級距擠一行在手機的卡片版會換行換得很醜
                        <span className="inline-flex flex-col gap-0.5 text-xs px-2 py-1 rounded-lg bg-temple-gold/15 border border-temple-gold/40 text-temple-dark">
                          <span className="inline-flex items-center gap-1"><Home className="w-3 h-3" />{d.relocationPlan}</span>
                          {d.relocationTier && <span className="font-semibold">{d.relocationTier}</span>}
                        </span>
                      ) : <Dash />}
                    </td>}
                    {showDonNotes && <td data-label="備註" data-more className="px-5 py-4 max-w-[180px]">
                      <p className="text-sm text-gray-700 truncate">{d.notes || <Dash />}</p>
                    </td>}
                    <td data-label="時間" className="px-5 py-4">
                      <p className="text-xs text-gray-500">{fmtDate(d.createdAt)}</p>
                    </td>
                    {/* 收款按鈕直接放在名單上（2026-11-18）：原本只有應收管理改得了，捐獻管理的紅點寫「N 待匯款」卻沒有地方按 */}
                    <td data-label="收款" className="px-5 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-col items-start gap-1.5">
                        {statusBadge(d.status || DonationStatus.PENDING)}
                        <PaymentActions
                          status={(d.status || DonationStatus.PENDING) as DonationStatus}
                          pending={DonationStatus.PENDING}
                          confirmed={DonationStatus.CONFIRMED}
                          cancelled={DonationStatus.CANCELLED}
                          busy={donBusyId === d.id}
                          onChange={next => handleDonationStatus(d.id, next)}
                        />
                      </div>
                    </td>
                    <RowMoreCell open={donationRows.isOpen(d.id)} onToggle={() => donationRows.toggle(d.id)} hint="指定項目、備註" />
                  </tr>
                ))}
              </tbody>
            </table>
            <Paginator total={filtered.length} page={page} onChange={setPage} />
          </div>
        )}
      </div>
      </>
      )}
      {quickView && <MemberInfoModal reg={quickView} memberProfiles={memberProfiles} onClose={() => setQuickView(null)} />}
    </div>
  );
};

// ─── Members Tab ─────────────────────────────────────────────────────────────

// ── 統計小標籤 ──────────────────────────────────────────────────────────────────
const StatBadges = ({ lamps, bookingCount, blessings, donation }: { lamps: number; bookingCount: number; blessings: number; donation: number }) => (
  <div className="flex flex-wrap gap-1.5">
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-medium">
      <Flame className="w-3 h-3" />{lamps} 燈
    </span>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">
      <Sparkles className="w-3 h-3" />{blessings} 祈福
    </span>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">
      <HeartHandshake className="w-3 h-3" />{donation > 0 ? `NT$${donation.toLocaleString()}` : '—'}
    </span>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-medium">
      <BookOpen className="w-3 h-3" />{bookingCount} 問事
    </span>
  </div>
);

// ─── 人的比對（會員資訊與總覽共用）────────────────────────────────────────────
// 原本是 MembersTab 裡的區域函式；2026-11-18 總覽的「會員人數」要用同一套規則，搬到模組層級共用。

/**
 * **空電話一律不對**（2026-10-30 補）。這一頁的統計全部是拿電話去比報名紀錄，
 * 而 LINE 登入後還沒補電話的會員電話是空的（見 `toPersonKey` 的註解）。
 * 不擋的話 `'' === ''`（或 `null === null`）會成立，**所有沒留電話的報名
 * 會被算進每一個沒留電話的會員頭上**。信眾名冊那邊的 `linkMembersByPhone()`
 * 早就寫明這條，這一頁漏掉了。
 */
function samePhone(a?: string | null, b?: string | null): boolean {
  const x = (a ?? '').trim();
  return x !== '' && x === (b ?? '').trim();
}

/**
 * ── 同一個人有好幾個帳號時，列表只列一次 ──
 *
 * 2026-10-13 廟方回報：清單上有三筆「鍾介凡」，數字一模一樣。
 * **數字一樣不是程式把金額複製過去**：這一頁的統計全部是拿電話去對報名紀錄的
 * （`l.phone === p.phone`），三個帳號填的是同一支電話，所以看到的是同一筆
 * NT$2,500 被顯示三次——錢沒有被重複計算，是「人」被重複列了三次。
 * 換句話說**統計層早就把他們當成同一個人，只有列表層還當成三個**，這裡就是把
 * 兩邊對齊。
 *
 * 一個人會有好幾個帳號的原因：用信箱註冊過一次、又用 LINE 登入一次（LINE 不給
 * email，Supabase 只能開新帳號），或是 LINE 的 Provider 換過
 * （LINE 的使用者 ID 綁 Provider 不是綁 channel，換了就全部對不上，見 CLAUDE.md）。
 * 正解是請本人在會員中心「綁定 LINE 帳號」，那會把 identity 接到同一個 user id；
 * **但已經各自存在的帳號合併不了**，所以後台至少要看得懂它們是同一個人。
 *
 * ── 合併的條件刻意收得很緊：電話**與**姓名都一樣 ──
 * 只看電話會把共用一支電話的家人併成一個人（長輩常留子女的號碼），
 * 那是把一位真的會員藏起來，比列重複嚴重得多。
 * **電話空白的一律不併**：LINE 登入後還沒補電話的帳號電話都是空的，
 * 只看電話的話會把他們全部併成一團。
 */
function toPersonKey(p: MemberProfileRecord): string {
  const phone = (p.phone ?? '').replace(/[\s-]/g, '');
  const name  = (p.name ?? '').replace(/[\s　]/g, '');   // 與信眾名冊的 nameKey 同一套
  return phone && name ? `${phone}|${name}` : `uid:${p.userId}`;
}

/**
 * **`activities` 改名成 `blessings`**（2026-10-30）。這個鍵對應的欄位標籤一直是
 * 「祈福」，但它數的是 `bulletin_registrations`——一張前台**沒有任何程式會寫入**的
 * 死表（`submitRegistration()` 全專案沒有呼叫端）。真正的祈福報名在
 * `blessing_registrations`，而同一個視窗的「服務歷史紀錄」用的正是後者。
 * 於是同一個人在列表與詳情會看到兩個不同的祈福數字，列表那個基本上恆為 0。
 * 名字留著 `activities` 只會讓下一個人再踩一次。
 */
type MemberSortKey = 'default' | 'lamps' | 'bookings' | 'blessings' | 'donation' | 'lastLogin';
type MemberSortDir = 'asc' | 'desc';

const MembersTab = ({ bookings, donations, lampRegistrations, blessingRegistrations, blessingEvents, lampConfigs, memberProfiles, usersLastLogin, memberEmails }: {
  bookings: BookingRecord[];
  donations: DonationRecord[];
  lampRegistrations: LampRegistrationRecord[];
  blessingRegistrations: BlessingRegistrationRecord[];
  blessingEvents: BlessingEventRecord[];
  lampConfigs: LampServiceConfig[];
  memberProfiles: MemberProfileRecord[];
  usersLastLogin: Record<string, string>;
  memberEmails: Record<string, string>;
}) => {
  // 已註冊會員詳情
  const [selectedProfile, setSelectedProfile] = useState<MemberProfileRecord | null>(null);
  const memberRows = useOpenRows();
  /** 這個人底下的全部帳號（通常只有一個）。通訊錄是綁 user_id 的，所以要逐個抓 */
  const [selectedAccounts, setSelectedAccounts] = useState<MemberProfileRecord[]>([]);
  const [profileContacts, setProfileContacts] = useState<MemberContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  // 親友詳情 modal
  const [selectedContact, setSelectedContact] = useState<MemberContact | null>(null);
  // 歷史紀錄 tab
  const [historyTab, setHistoryTab] = useState<'lamp' | 'booking' | 'blessing' | 'donation'>('lamp');
  // 搜尋
  const [search, setSearch] = useState('');
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
    const lamps = lampRegistrations.filter(l => samePhone(l.phone, phone)).length;
    const bkCount = bookings.filter(b => samePhone(b.phone, phone)).length;
    // **祈福數的是 blessing_registrations，不是 bulletin_registrations**（見 MemberSortKey 的註解）
    const bless = blessingRegistrations.filter(br => samePhone(br.phone, phone)).length;
    const dn = donations.filter(d => samePhone(d.phone, phone));
    return { lamps, bookingCount: bkCount, blessings: bless, donation: dn.reduce((s, d) => s + Number(d.amount), 0) };
  };

  const getContactStats = (memberPhone: string, contactName: string) => {
    const lamps = lampRegistrations.filter(l => samePhone(l.phone, memberPhone) && l.name === contactName).length;
    const bkCount = bookings.filter(b => samePhone(b.phone, memberPhone) && b.name === contactName).length;
    const bless = blessingRegistrations.filter(br => samePhone(br.phone, memberPhone) && br.name === contactName).length;
    const dn = donations.filter(d => samePhone(d.phone, memberPhone) && d.name === contactName);
    return { lamps, bookingCount: bkCount, blessings: bless, donation: dn.reduce((s, d) => s + Number(d.amount), 0) };
  };
  // samePhone()／toPersonKey() 在模組層級（MembersTab 上方），總覽的會員人數也用同一套

  // ── 計算排序後的 rows ──
  const sortedProfiles = useMemo(() => {
    const all = memberProfiles.map(p => {
      const lamps = lampRegistrations.filter(l => samePhone(l.phone, p.phone)).length;
      const bookingCount = bookings.filter(b => samePhone(b.phone, p.phone)).length;
      const blessings = blessingRegistrations.filter(br => samePhone(br.phone, p.phone)).length;
      const donation = donations.filter(d => samePhone(d.phone, p.phone)).reduce((s, d) => s + Number(d.amount), 0);
      const lastLogin = usersLastLogin[p.userId] ?? null;
      return { ...p, stats: { lamps, bookingCount, blessings, donation }, lastLogin };
    });

    /**
     * 同一個人的帳號折成一列。
     * **代表那一筆取最近登入的**（沒登入過就取最新建立的）：那是他現在實際在用的帳號，
     * 顯示的姓名／性別／地址以它為準才是最新的。其餘帳號收進 `accounts`，
     * 編號與最後登入都看得到——廟方要有辦法知道「到底是哪幾個帳號」才處理得掉。
     */
    const groups = new Map<string, typeof all>();
    all.forEach(r => {
      const k = toPersonKey(r);
      groups.set(k, [...(groups.get(k) ?? []), r]);
    });
    const at = (r: typeof all[number]) => new Date(r.lastLogin ?? r.createdAt).getTime();
    const rows = [...groups.values()].map(list => {
      const sortedByUse = [...list].sort((a, b) => at(b) - at(a));
      const main = sortedByUse[0];
      return {
        ...main,
        // 整個人的最後登入＝所有帳號裡最晚的那一次
        lastLogin: sortedByUse.map(r => r.lastLogin).filter(Boolean)[0] ?? null,
        /**
         * 「加入」要取**最早**那個帳號，不是代表帳號的。
         * 代表取的是最近在用的，而那常常是今年才開的 LINE 帳號——照它顯示，
         * 一位 2024 年就入會的信眾會變成「今天加入」，預設排序也會把他推到最前面。
         */
        createdAt: list.map(r => r.createdAt).sort()[0],
        accounts: sortedByUse,
      };
    });

    rows.sort((a, b) => {
      if (sortBy === 'lamps')       { const d = a.stats.lamps - b.stats.lamps; return sortDir === 'asc' ? d : -d; }
      if (sortBy === 'bookings')    { const d = a.stats.bookingCount - b.stats.bookingCount; return sortDir === 'asc' ? d : -d; }
      if (sortBy === 'blessings')   { const d = a.stats.blessings - b.stats.blessings; return sortDir === 'asc' ? d : -d; }
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
  }, [memberProfiles, lampRegistrations, bookings, donations, blessingRegistrations, usersLastLogin, sortBy, sortDir]);

  /**
   * 搜尋：姓名／電話／信箱／會員編號／地址。
   *
   * **一列可能底下有好幾個帳號**（同一個人常有信箱帳號＋LINE 帳號，見 `toPersonKey`），
   * 所以電話與信箱要把那幾個帳號全部比過，不能只看主要那一個——不然用他 LINE 帳號的
   * 信箱搜就會搜不到他。
   *
   * 編號接受「7」「007」「#007」三種寫法：廟方口頭講的是「七號」，紙本上寫的是 #007。
   */
  const visibleProfiles = useMemo(() => {
    const q = search.trim();
    if (!q) return sortedProfiles;
    const ql = q.toLowerCase();
    const digits = q.replace(/\D/g, '');
    return sortedProfiles.filter(p => {
      const accounts = p.accounts ?? [p];
      if (p.name?.includes(q)) return true;
      if (accounts.some(a => (a.phone ?? '').includes(q))) return true;
      if (accounts.some(a => (memberEmails[a.userId] ?? '').toLowerCase().includes(ql))) return true;
      if (accounts.some(a => (a.address ?? '').includes(q))) return true;
      if (digits && accounts.some(a => a.memberNumber != null
        && (String(a.memberNumber) === String(Number(digits))
          || String(a.memberNumber).padStart(3, '0') === digits))) return true;
      return false;
    });
  }, [sortedProfiles, search, memberEmails]);

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
    const stats = selectedProfile.phone ? getStatsByPhone(selectedProfile.phone) : { lamps: 0, bookingCount: 0, blessings: 0, donation: 0 };
    const lastLogin = usersLastLogin[selectedProfile.userId];
    return (
      <div>
        {/* 親友詳情 Modal */}
        {selectedContact && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelectedContact(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${selectedContact.label
                    ? 'bg-temple-red/10 text-temple-red'
                    : 'bg-gray-100 text-gray-400'}`}
                    title={selectedContact.label ? undefined : '報名時沒有選稱謂／關係'}>
                    {selectedContact.label || '未填關係'}
                  </span>
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

        <button onClick={() => { setSelectedProfile(null); setSelectedAccounts([]); setProfileContacts([]); setSelectedContact(null); }}
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
          <StatBadges lamps={stats.lamps} bookingCount={stats.bookingCount} blessings={stats.blessings} donation={stats.donation} />

          {/**
            * 同一個人有好幾個帳號時，把它們列出來。
            * 列表那邊只顯示「3 個帳號」，廟方要處理就得知道**是哪三個**
            * （編號是他們對信眾的稱呼，最後登入則看得出哪一個還在用）。
            * 文案要講清楚兩件事：統計沒有重複算、以及怎麼真的合併。
            */}
          {selectedAccounts.length > 1 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">
                這個人有 {selectedAccounts.length} 個登入帳號
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedAccounts.map(a => (
                  <span key={a.userId} className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-gray-600">
                    <span className="font-mono text-gray-400 mr-1.5">
                      {a.memberNumber ? `#${String(a.memberNumber).padStart(3, '0')}` : '（無編號）'}
                    </span>
                    {usersLastLogin[a.userId]
                      ? new Date(usersLastLogin[a.userId]).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })
                      : '未登入過'}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                上面的點燈／祈福／捐獻／問事是用電話對報名紀錄算出來的，整個人只算一次，沒有重複計算。
                <strong className="text-gray-500">但一家人共用一支電話時，家人的報名也會算進來</strong>——
                報名不需要登入，資料庫沒有欄位記著「這筆是誰送的」，只能靠電話對。
                要讓他以後只剩一個帳號，請本人用原本的信箱密碼登入後，到會員中心按「綁定 LINE 帳號」。
              </p>
            </div>
          )}
        </div>

        {/* ── 歷史紀錄 ── */}
        {(() => {
          const phone = selectedProfile.phone ?? '';
          // 空電話一律不對（見 samePhone）：沒留電話的會員不該看到一堆別人的紀錄
          const myLamps      = lampRegistrations.filter(l => samePhone(l.phone, phone));
          const myBookings   = bookings.filter(b => samePhone(b.phone, phone));
          const myBlessings  = blessingRegistrations.filter(br => samePhone(br.phone, phone));
          const myDonations  = donations.filter(d => samePhone(d.phone, phone));

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
                const cStats = selectedProfile.phone ? getContactStats(selectedProfile.phone, c.name) : { lamps: 0, bookingCount: 0, blessings: 0, donation: 0 };
                return (
                  <button key={c.id} type="button" onClick={() => setSelectedContact(c)}
                    className="w-full px-5 py-3 flex items-center gap-3 hover:bg-temple-bg/60 transition-all text-left">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${c.label
                      ? 'bg-temple-red/10 text-temple-red'
                      : 'bg-gray-100 text-gray-400'}`}
                      title={c.label ? undefined : '報名時沒有選稱謂／關係'}>
                      {c.label || '未填關係'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                        {genderBadge(c.gender)}
                      </div>
                      <div className="mt-1">
                        <StatBadges lamps={cStats.lamps} bookingCount={cStats.bookingCount} blessings={cStats.blessings} donation={cStats.donation} />
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
          {/* **數的是人不是帳號**。一個人有好幾個帳號時（見 toPersonKey 的註解），
              把帳號數當人數會讓廟方以為會員比實際多。兩個數字不一樣時才把帳號數講出來，
              一樣的時候多講一次是雜訊 */}
          <span className="ml-2 text-sm font-normal text-gray-400">
            {sortedProfiles.length} 位
            {memberProfiles.length !== sortedProfiles.length && (
              <span className="ml-1 text-gray-300">（{memberProfiles.length} 個帳號）</span>
            )}
          </span>
        </h2>
      </div>

      {memberProfiles.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-gray-400 text-sm">
          尚無已註冊會員
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-temple-gold/30 overflow-hidden">
          <div className="px-5 py-3 bg-temple-gold/10 border-b border-temple-gold/20 flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="flex items-center gap-2 shrink-0">
              <UserPlus className="w-4 h-4 text-temple-red" />
              <h3 className="font-semibold text-temple-dark text-sm">已註冊會員帳號</h3>
              <span className="text-xs font-normal text-gray-500">
                {search.trim() ? `${visibleProfiles.length} / ${sortedProfiles.length} 人` : `${sortedProfiles.length} 人`}
              </span>
            </div>
            <div className="relative sm:ml-auto sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="搜尋姓名 / 電話 / 信箱 / 編號"
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-temple-gold/30 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="admin-table w-full min-w-[640px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">編號</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">姓名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">性別</th>
                  <SortTh col="lamps"      label="點燈"   align="center" />
                  <SortTh col="blessings"  label="祈福"   align="center" />
                  <SortTh col="donation"   label="捐獻"   align="right" />
                  <SortTh col="bookings"   label="問事"   align="center" />
                  <SortTh col="lastLogin"  label="最後登入" align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visibleProfiles.map(p => (
                  <tr key={p.userId}
                    onClick={async () => {
                      setSelectedProfile(p); setSelectedAccounts(p.accounts); setContactsLoading(true);
                      try {
                        /**
                         * **每個帳號都要抓**：通訊錄是綁 `user_id` 的，一個人有三個帳號時
                         * 家人名單會散在三邊。只抓代表那一個，廟方看到的是殘缺的通訊錄
                         * ——而且看不出有缺。抓失敗的那個當空的，不要讓一個壞掉的帳號
                         * 把整張名單變空白。
                         */
                        const lists = await Promise.all(
                          p.accounts.map(a => getMemberContactsByUserId(a.userId).catch(() => [] as MemberContact[])),
                        );
                        setProfileContacts(lists.flat());
                      }
                      catch { setProfileContacts([]); }
                      finally { setContactsLoading(false); }
                    }}
                    className={`cursor-pointer hover:bg-temple-bg/60 transition-all group${memberRows.isOpen(p.userId) ? ' admin-open' : ''}`}
                  >
                    <td data-label="編號" className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-400">
                        {p.memberNumber ? `#${String(p.memberNumber).padStart(3, '0')}` : <Dash />}
                      </span>
                    </td>
                    <td data-label="姓名" className="px-4 py-3">
                      <span className="text-sm font-semibold text-gray-800 group-hover:text-temple-red transition-colors">
                        {p.name || <span className="text-gray-400 font-normal italic">（未填）</span>}
                      </span>
                      {/* 折起來的那幾個帳號要講出來，不然廟方只會覺得「剛剛那兩筆呢」。
                          用灰色不用警示色：這不是錯誤，是同一個人用了不只一種方式登入 */}
                      {p.accounts.length > 1 && (
                        <span className="ml-2 text-[11px] font-normal text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          {p.accounts.length} 個帳號
                        </span>
                      )}
                    </td>
                    <td data-label="性別" data-more className="px-4 py-3">
                      {p.gender
                        ? <span className="text-xs bg-temple-red/10 text-temple-red px-2 py-0.5 rounded-full">{p.gender}</span>
                        : <Dash />}
                    </td>
                    <td data-label="點燈" data-more className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-amber-700 text-sm font-medium">
                        <Flame className="w-3.5 h-3.5" />{p.stats.lamps}
                      </span>
                    </td>
                    <td data-label="祈福" data-more className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-blue-700 text-sm font-medium">
                        <Sparkles className="w-3.5 h-3.5" />{p.stats.blessings}
                      </span>
                    </td>
                    <td data-label="捐獻" data-more className="px-4 py-3 text-right text-sm">
                      {p.stats.donation > 0
                        ? <span className="text-green-700 font-medium">NT${p.stats.donation.toLocaleString()}</span>
                        : <Dash />}
                    </td>
                    <td data-label="問事" data-more className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-purple-700 text-sm font-medium">
                        <BookOpen className="w-3.5 h-3.5" />{p.stats.bookingCount}
                      </span>
                    </td>
                    <td data-label="最後登入" className="px-4 py-3 text-right text-xs text-gray-400 whitespace-nowrap">
                      {p.lastLogin
                        ? new Date(p.lastLogin).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })
                        : <Dash />}
                    </td>
                    <RowMoreCell open={memberRows.isOpen(p.userId)} onToggle={() => memberRows.toggle(p.userId)} hint="性別、統計" />
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

/**
 * 公告的「分類」由「連結服務」推出來，不再另外選（2026-11-18 廟方：「分類跟連結服務只保留一個就好，不然都是重複資料干擾」）。
 * 兩者本來就一一對應（線上兩則：點燈公告↔點燈、捐獻公告↔遷址）。分類欄照樣存，因為前台 /bulletins 的分類篩選靠它。
 */
const categoryOfService = (svc: BulletinData['linkedService']): BulletinCategory => ({
  lamp: BulletinCategory.LAMP, blessing: BulletinCategory.BLESSING, booking: BulletinCategory.BOOKING,
  donation: BulletinCategory.DONATION, relocation: BulletinCategory.DONATION,
} as Record<string, BulletinCategory>)[svc ?? ''] ?? BulletinCategory.GENERAL;

const BulletinsTab = ({ bulletins, onRefresh }: { bulletins: BulletinRecord[]; onRefresh: () => void }) => {
  const [broadcastingId, setBroadcastingId] = useState<string | null>(null);
  const bulletinRows = useOpenRows();
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
        await updateBulletin(editingId, { ...form, category: categoryOfService(form.linkedService) });
      } else {
        await createBulletin({ ...form, category: categoryOfService(form.linkedService) });
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

  /**
   * 群發到 LINE 官方帳號。
   *
   * **這顆鈕與旁邊的編輯／刪除不是同一個量級**：它送到所有好友、收不回來、
   * 而且每一位都算一則訊息配額。所以：
   *   文字寫明「所有好友」與「無法收回」，不是只寫「確定要群發嗎」
   *   發過的那一則整顆鈕換成灰色的「已群發」，按不下去
   *   真正的防線在後端（broadcast_at 蓋章），前端這層只是別讓人手滑
   */
  const handleBroadcast = async (b: BulletinRecord) => {
    if (b.broadcastAt) return;
    if (!confirm(
      `確定要把「${b.title}」群發到 LINE 官方帳號嗎？\n\n`
      + '・會送給所有好友，送出後無法收回\n'
      + '・每位好友都會計入官方帳號的訊息配額\n'
      + '・一則公告只能群發一次',
    )) return;
    setBroadcastingId(b.id);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch('/api/line-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify({ id: b.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { alert(`群發失敗：${j.error ?? r.status}${j.原因 ? `\n${j.原因}` : ''}`); return; }
      alert(j.警告 ? `已群發，但有一件事要注意：\n${j.警告}` : '已群發到 LINE 官方帳號。');
      onRefresh();
    } catch {
      alert('群發失敗，請檢查網路後再試');
    } finally {
      setBroadcastingId(null);
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
    lamp: '點燈', blessing: '祈福', booking: '問事', donation: '捐獻', relocation: '遷址募資',
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
              <th className="px-5 py-3 text-left">類別</th>
              <th className="px-5 py-3 text-left">發布狀態</th>
              <th className="px-5 py-3 text-center">置頂</th>
              <th className="px-5 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">尚無公告</td></tr>
            ) : paged.map(b => (
              <tr key={b.id} className={`hover:bg-gray-50/50 transition-colors${bulletinRows.isOpen(b.id) ? ' admin-open' : ''}`}>
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
                {/* 分類與連結服務原本兩欄講同一件事，併成一欄（2026-11-18） */}
                <td data-label="類別" data-more className="px-5 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${categoryColor(categoryOfService(b.linkedService))}`}>
                    {b.linkedService ? (serviceLabel[b.linkedService] ?? b.linkedService) : '一般公告'}
                  </span>
                </td>
                <td data-label="發布狀態" className="px-5 py-4 text-gray-500">
                  {publishStatus(b) ?? <span className="text-xs text-green-600">已發布</span>}
                  <div className="text-xs text-gray-400 mt-0.5">{fmtDate(b.createdAt)}</div>
                </td>
                <td data-label="置頂" data-more className="px-5 py-4 text-center">
                  <button onClick={() => handleTogglePin(b)}
                    className={`p-1.5 rounded-lg transition-colors ${b.isPinned ? 'text-temple-gold hover:bg-yellow-50' : 'text-gray-300 hover:bg-gray-100'}`}>
                    {b.isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                  </button>
                </td>
                <td data-label="操作" className="px-5 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => openEdit(b)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {/* 群發：發過的就變成灰色標記、按不下去（真正的防線在後端的蓋章） */}
                    {b.broadcastAt ? (
                      <span title={`已於 ${fmtDate(b.broadcastAt)} 群發`}
                        className="p-1.5 text-xs text-gray-400 whitespace-nowrap">已群發</span>
                    ) : (
                      <button onClick={() => handleBroadcast(b)} disabled={broadcastingId === b.id}
                        title="群發到 LINE 官方帳號（送給所有好友，無法收回）"
                        className="p-1.5 text-[#06C755] hover:bg-[#06C755]/10 rounded-lg transition-colors disabled:opacity-50">
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(b.id)} disabled={deletingId === b.id}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
                <RowMoreCell open={bulletinRows.isOpen(b.id)} onToggle={() => bulletinRows.toggle(b.id)} hint="類別、置頂" />
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
                <label className="block text-sm font-medium text-gray-700 mb-1">類別</label>
                <select value={form.linkedService ?? ''} onChange={e => setForm({...form, linkedService: (e.target.value || null) as BulletinData['linkedService']})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red">
                  <option value="">一般公告（不加按鈕）</option>
                  <option value="lamp">點燈</option>
                  <option value="blessing">祈福</option>
                  <option value="booking">問事</option>
                  <option value="donation">捐獻</option>
                  <option value="relocation">遷址募資</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">選了服務，信眾展開公告時會有一顆按鈕直接前往該服務；前台公佈欄的分類也跟著它</p>
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
  const deityRows = useOpenRows();
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
              {/* 「介紹」欄拿掉（2026-11-18，同點燈管理拿掉說明欄）：一整段只截得到第一句，要看全文按編輯 */}
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
                className={`transition-colors select-none ${!d.isVisible ? 'opacity-50' : ''} ${dDragId === d.id ? 'opacity-30 bg-gray-50' : ''} ${dOverIdx === idx && dDragId !== d.id ? 'border-t-2 border-temple-red' : 'hover:bg-gray-50'}${deityRows.isOpen(d.id) ? ' admin-open' : ''}`}>
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
                <td data-label="殿" data-more className="px-6 py-4 text-gray-500">
                  {d.hallId ? (halls.find(h => h.id === d.hallId)?.name ?? '-') : '-'}
                </td>
                <td data-label="尊稱" data-more className="px-6 py-4 text-gray-500">{d.title || '-'}</td>
                <td data-label="操作" className="px-6 py-4 text-right flex items-center justify-end gap-3">
                  <button onClick={() => handleToggleVisible(d)} disabled={togglingId === d.id}
                    title={d.isVisible ? '點擊隱藏' : '點擊顯示'}
                    className={`transition-colors disabled:opacity-40 ${d.isVisible ? 'text-gray-400 hover:text-orange-500' : 'text-orange-500 hover:text-gray-400'}`}>
                    {d.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit(d)} className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(d.id, d.name)} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                </td>
                <RowMoreCell open={deityRows.isOpen(d.id)} onToggle={() => deityRows.toggle(d.id)} hint="殿、尊稱" />
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

// ─── Photos Tab (多媒體管理；2026-11-09 加了首頁影片之前叫「照片管理」) ──────────────────────────────────────────────────────

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
        <h3 className="text-lg font-bold text-gray-800 mb-1">網站多媒體管理</h3>
        <p className="text-sm text-gray-500">管理網站各區塊的影片與照片，存檔後前台會自動更新。</p>
      </div>

      <AdminHomeVideoSection />

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
  const verseRows = useOpenRows();
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
          <p className="text-sm text-gray-500 mt-1">共 {verses.length} 節・可編輯經文、解說及插圖</p>
        </div>
      </div>

      {/* 全文（誦讀版）另存一份，與下面 136 段分開（見 AdminScriptureFullText 的檔頭） */}
      <AdminScriptureFullText verses={verses} />

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
              <th className="text-left px-4 py-3 text-gray-500 font-medium">解說</th>
              <th className="text-center px-4 py-3 text-gray-500 font-medium w-20">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paged.map(v => (
              <tr key={v.id} className={`hover:bg-gray-50/50 transition-colors${verseRows.isOpen(v.id) ? ' admin-open' : ''}`}>
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
                <td data-label="解說" data-more className="px-4 py-3 text-gray-500 max-w-[300px]">
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
                <RowMoreCell open={verseRows.isOpen(v.id)} onToggle={() => verseRows.toggle(v.id)} hint="解說" />
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
                  <label className="block text-sm font-medium text-gray-700">解說</label>
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
                  placeholder="經文的詳細解說..."
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

// ─── Lamps Tab (太歲點燈管理) ─────────────────────────────────────────────────

const LampsTab = ({
  configs, registrations, onRefresh, memberProfiles,
}: {
  configs: LampServiceConfig[];
  registrations: LampRegistrationRecord[];
  onRefresh: () => void;
  memberProfiles: MemberProfileRecord[];
}) => {
  /**
   * 點燈管理照祈福管理的樣子：**每個燈種一列、列上就看得到報名數與待匯款，按「報名名單」才進那一盞的名單**
   * （2026-11-18 廟方：「為什麼不像祈福管理一樣，可以在各自的行就看到新增報名人數，目前是要點選
   * 『登記紀錄』，而且是全部的燈都混在一起，我是覺得要一致性，這樣好學習與管理」）。
   * 原本頂端一顆「服務設定／登記紀錄」切換，名單是四種燈混在一起、要再用下拉篩；現在名單一定是某一盞的。
   */
  const [selectedConfig, setSelectedConfig] = useState<LampServiceConfig | null>(null);
  const [quickView, setQuickView] = useState<RegViewItem | null>(null);

  /** 電話、生日、地址、備註、登記時間：按「個人資料」才就地展開（2026-11-18，同問事、捐獻、祈福） */
  const lampInfo = useOpenRows();
  // ── Service config state ──
  const [editingConfig, setEditingConfig] = useState<LampServiceConfig | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState<LampServiceConfigData>({ name: '', fee: 0, description: '', imageUrl: '', isActive: true, displayOrder: 0 });
  const [savingConfig, setSavingConfig] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingLampImg, setUploadingLampImg] = useState(false);
  /** 燈種的「請信眾選擇」（專屬神明燈的指定神明等）。存在 site_settings，見 services/lampChoice.ts */
  const [lampChoices, setLampChoices] = useState<LampChoices>({});
  const [choiceLabel, setChoiceLabel] = useState('');
  const [choiceText, setChoiceText] = useState('');
  const [fillingDeities, setFillingDeities] = useState(false);
  /** 這一季每個選項已登記幾盞（null＝計數讀不到，多半是 lamp_choice_counts.sql 還沒跑） */
  const [choiceCounts, setChoiceCounts] = useState<Record<string, number> | null | undefined>(undefined);
  useEffect(() => { getLampChoices().then(setLampChoices); }, []);

  /** 從「祀奉神尊」帶入名單：廟方不必再打一次本壇有哪些神尊，帶進來再刪掉不開放的即可 */
  const fillFromDeities = async () => {
    if (choiceText.trim() && !window.confirm('會取代目前的選項，確定嗎？')) return;
    setFillingDeities(true);
    try {
      const ds = await getDeities();
      const names = [...new Set(ds.map(d => d.name.trim()).filter(Boolean))];
      setChoiceText(names.join('\n'));
      if (!choiceLabel.trim()) setChoiceLabel('指定神明');
    } catch { alert('讀取祀奉神尊失敗，請稍後再試'); }
    finally { setFillingDeities(false); }
  };

  // ── Registration state ──
  const [regSearch, setRegSearch] = useState('');
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
    setChoiceLabel(lampChoices[c.id]?.label ?? '');
    setChoiceText(formatChoiceLines(lampChoices[c.id]));
    setChoiceCounts(undefined);
    if (lampChoices[c.id]) getLampChoiceCounts(c.id, lampSeasonStart()).then(setChoiceCounts);
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
        // 選項：有名稱也有選項才算設定；清空就是拿掉這一格
        const { options, quotas } = parseChoiceLines(choiceText);
        const next = { ...lampChoices };
        if (choiceLabel.trim() && options.length) next[editingConfig.id] = { label: choiceLabel.trim(), options, ...(Object.keys(quotas).length ? { quotas } : {}) };
        else delete next[editingConfig.id];
        if (JSON.stringify(next) !== JSON.stringify(lampChoices)) {
          await saveLampChoices(next);
          setLampChoices(next);
        }
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
      const matchService = !!selectedConfig && r.serviceId === selectedConfig.id;
      const matchStatus = !regStatusFilter || r.status === regStatusFilter;
      return matchSearch && matchService && matchStatus;
    });
  }, [registrations, regSearch, selectedConfig, regStatusFilter]);

  useEffect(() => { setRegPage(0); }, [regSearch, selectedConfig, regStatusFilter]);

  /**
   * 列上的數字：**本季**的報名筆數（九月一日起，與「丁未點燈」換年同一條界線，見 lampSeasonStart），
   * 以及**不分季**的待匯款筆數——還沒收到的錢不會因為換季就不用處理。已取消的不算。
   */
  const seasonStart = lampSeasonStart();
  const regStats = useMemo(() => {
    const m: Record<string, { season: number; pending: number }> = {};
    for (const r of registrations) {
      const k = (m[r.serviceId] ??= { season: 0, pending: 0 });
      if (r.status === LampRegistrationStatus.PENDING) k.pending++;
      if (r.status !== LampRegistrationStatus.CANCELLED && r.createdAt && new Date(r.createdAt) >= new Date(seasonStart)) k.season++;
    }
    return m;
  }, [registrations, seasonStart]);
  const openRegs = (c: LampServiceConfig) => { setSelectedConfig(c); setRegSearch(''); setRegStatusFilter(''); };
  const pagedRegs = filteredRegs.slice(regPage * PAGE_SIZE, (regPage + 1) * PAGE_SIZE);

  const getServiceName = (serviceId: string) =>
    configs.find(c => c.id === serviceId)?.name || serviceId;

  const handleRegStatusChange = async (id: string, status: LampRegistrationStatus) => {
    setUpdatingRegId(id);
    try {
      await updateLampRegistrationStatus(id, status);
      // 收到款就通知信眾一聲（廟方 2026-10-13）。連著標好幾列會併成一封，
      // 寄過的不再寄——兩件事都在 services/notifyConfirm.ts 與那支端點裡處理。
      // **只有「收到了」那個方向要寄**：改回待匯款不寄，沒有「取消確認信」這種東西，
      // 寄一封說「其實還沒收到」只會讓信眾更混亂，廟方該直接打電話。
      if (status === LampRegistrationStatus.CONFIRMED) queueConfirmEmail('lamp_registrations', id);
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
    // 「指定項目」單獨一欄（專屬神明燈點給哪一尊），廟方要照這欄排燈位；備註只留剩下的
    exportExcel(`點燈登記_${selectedConfig?.name ?? ''}.xlsx`, filteredRegs.map(r => {
      const t = readChoiceTag(r.notes);
      return [
        getServiceName(r.serviceId), t ? t.value : '', r.name, r.phone, r.gender || '', r.birthDate, r.zodiac || '', r.address || '',
        r.status, t ? t.rest.trim() : (r.notes || ''), fmtDate(r.createdAt), r.source || '',
      ];
    }), ['服務項目', '指定項目', '姓名', '電話', '性別', '農曆生日', '生肖', '現居地址', '狀態', '備註', '建立時間', '報名來源']);
  };

  return (
    <div className="space-y-6">
      {/* ── 燈種列表（每一列帶自己的報名數與「報名名單」，同祈福管理） ── */}
      {!selectedConfig && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">太歲點燈管理</h3>
              <p className="text-sm text-gray-500 mt-1">共 {configs.length} 種燈・報名數為本季（{seasonStart.slice(0, 4)} 年 9 月起）</p>
            </div>
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
                  {/* 「說明」欄拿掉（廟方：「表格這麼大段在顯示說明，這非常浪費，也無意義」）——
                      一整段只截得到第一句，要看全文本來就得按編輯 */}
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">報名</th>
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
                        ? <div className="h-10 flex items-center"><img src={c.imageUrl} alt={c.name} className="max-h-10 max-w-14 w-auto h-auto rounded border border-gray-100" /></div>
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
                    <td data-label="報名" className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-temple-red font-medium">{regStats[c.id]?.season ?? 0} 筆</span>
                        {(regStats[c.id]?.pending ?? 0) > 0 && (
                          <span className="text-[11px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5 leading-none">
                            {regStats[c.id]!.pending} 待匯款
                          </span>
                        )}
                        <button onClick={() => openRegs(c)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                          <List className="w-3.5 h-3.5" /> 報名名單
                        </button>
                      </div>
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
                    {/* 原本這裡有手機版的「更多資料（說明）」開關，收的就是說明欄；說明欄 2026-11-18 整欄拿掉，開關也跟著拿掉 */}
                  </tr>
                ))}
                {configs.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">尚無服務項目，請點「新增服務」建立</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 某一盞燈的報名名單 ── */}
      {selectedConfig && (
        <div className="space-y-4">
          <button onClick={() => setSelectedConfig(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> 返回燈種列表
          </button>
          <div className="bg-white rounded-xl border border-temple-gold/30 shadow-sm p-5 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-800">{selectedConfig.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5">NT$ {selectedConfig.fee.toLocaleString()} / 年</p>
            </div>
            <span className="text-sm font-semibold text-temple-red">本季 {regStats[selectedConfig.id]?.season ?? 0} 筆</span>
            {(regStats[selectedConfig.id]?.pending ?? 0) > 0 && (
              <span className="text-xs font-bold text-white bg-red-500 rounded-full px-2 py-0.5">{regStats[selectedConfig.id]!.pending} 待匯款</span>
            )}
          </div>
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
            <FilterChips value={regStatusFilter} onChange={setRegStatusFilter} allLabel="全部"
              allCount={registrations.filter(r => r.serviceId === selectedConfig?.id).length}
              options={Object.values(LampRegistrationStatus).map(st => ({
                value: st, count: registrations.filter(r => r.serviceId === selectedConfig?.id && r.status === st).length,
              }))} />
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
                onClick={() => setQuickView({ name: r.name, phone: r.phone, gender: r.gender || undefined, birthDate: r.birthDate || undefined, zodiac: r.zodiac || undefined, address: r.address || undefined, notes: r.notes || undefined, status: r.status, serviceLabel: `點燈 · ${getServiceName(r.serviceId)}`, createdAt: r.createdAt, contactLabel: r.contactLabel, source: r.source, email: r.email, confirmSentAt: r.confirmSentAt, mailKind: 'paid' })}
              >
                {/* 每張卡前面原本都有同一個火焰圖示，拿掉（2026-11-17，理由同問事清單的人像） */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-800">{r.name}</p>
                    {r.contactLabel && <span className="text-xs bg-temple-gold/20 text-temple-dark px-1.5 py-0.5 rounded-full font-medium">#{r.contactLabel}</span>}
                    {/* 整份名單都是同一盞燈，燈名不再每張卡印一次；只留專屬神明燈點給哪一尊（存在備註開頭，見 services/lampChoice.ts） */}
                    {readChoiceTag(r.notes) && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                        {readChoiceTag(r.notes)!.value}
                      </span>
                    )}
                    {statusBadge(r.status)}
                  </div>
                  {(r.phone || r.birthDate || r.address || r.gender || r.notes) && (
                    <button type="button" aria-expanded={lampInfo.isOpen(r.id)}
                  onClick={e => { e.stopPropagation(); lampInfo.toggle(r.id); }}
                  className="mt-1 text-xs text-gray-500 hover:text-temple-red inline-flex items-center gap-0.5">
                  {lampInfo.isOpen(r.id) ? '收合資料' : '個人資料'}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${lampInfo.isOpen(r.id) ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                  )}
                  {/* 性別、生日、生肖收成一行、不帶欄名：「女・民國72年6月20日・豬」一看就懂 */}
                  {lampInfo.isOpen(r.id) && (
                    <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                      {r.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.phone}</p>}
                      <p>{[r.gender, r.birthDate, r.zodiac].filter(Boolean).join('・')}</p>
                      {r.address && <p>{r.address}</p>}
                      {(() => {
                        // 選項已經併進上面的燈種標籤，備註只印剩下的，同一件事不講兩次
                        const t = readChoiceTag(r.notes);
                        const rest = t ? t.rest.trim() : r.notes;
                        return rest ? <p>備註：{rest}</p> : null;
                      })()}
                      <p className="text-gray-400">登記 {fmtDate(r.createdAt)}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                  <PaymentActions
                    status={r.status}
                    pending={LampRegistrationStatus.PENDING}
                    confirmed={LampRegistrationStatus.CONFIRMED}
                    cancelled={LampRegistrationStatus.CANCELLED}
                    busy={updatingRegId === r.id}
                    onChange={next => handleRegStatusChange(r.id, next)}
                  />
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
                <label className="block text-sm font-medium text-gray-700 mb-1">服務圖片</label>
                {/* 前台照原比例攤在卡片最上面、不裁切，所以預覽也不裁（廟方是在這裡確認自己傳了什麼） */}
                <p className="text-xs text-gray-400 mb-2">建議用 3:2 橫式，與最新活動的海報同尺寸。前台會整張顯示在這個燈種的卡片上方。</p>
                {configForm.imageUrl && (
                  <div className="relative mb-2 inline-block">
                    <img src={configForm.imageUrl} alt="預覽" className="block max-h-40 max-w-full w-auto h-auto rounded-lg border border-gray-200" />
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
              {/* 請信眾選擇（2026-11-17 廟方：「專屬神明燈，還需要有神明燈的表單，須在後台可設定」）。
                  新增的燈種還沒有 id，存檔後再編輯一次才設得了，所以新增時只放一行提示 */}
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-700">請信眾選擇（選填）</p>
                <p className="text-xs text-gray-400 mt-0.5 mb-2">
                  例如專屬神明燈要選「指定神明」。有設定時，信眾選了這個燈種就會多一格必選的下拉；不需要就留空。
                  <br />每行後面加數字就是那一項的名額，例如「天上聖母 30」；沒寫數字＝不限量。名額每年九月重新算，已取消的不算。
                </p>
                {editingConfig ? (
                  <div className="space-y-2">
                    <input
                      type="text" value={choiceLabel} onChange={e => setChoiceLabel(e.target.value)}
                      placeholder="欄位名稱，例：指定神明" maxLength={20}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none"
                    />
                    <textarea
                      value={choiceText} onChange={e => setChoiceText(e.target.value)} rows={5}
                      placeholder={'選項，一行一個，後面的數字是名額，例：\n天上聖母 30\n觀世音菩薩 20\n中壇元帥'}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none resize-y"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-400">
                        {(() => { const p = parseChoiceLines(choiceText); const q = Object.keys(p.quotas).length;
                          return `${p.options.length} 個選項${q ? `，其中 ${q} 個有名額` : ''}`; })()}
                      </span>
                      <button type="button" onClick={fillFromDeities} disabled={fillingDeities}
                        className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                        {fillingDeities ? '讀取中…' : '從祀奉神尊帶入'}
                      </button>
                    </div>
                    {/* 這一季登記到哪了：廟方調名額前要先知道已經賣出幾盞 */}
                    {choiceCounts === null && (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
                        讀不到已登記的數量，名額暫時不會生效。請在 Supabase 執行 supabase/migrations/lamp_choice_counts.sql。
                      </p>
                    )}
                    {choiceCounts && Object.keys(choiceCounts).length > 0 && (
                      <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5">
                        本季已登記：{Object.entries(choiceCounts).sort((a, b) => b[1] - a[1]).map(([k, n]) => {
                          const q = parseChoiceLines(choiceText).quotas[k];
                          return `${k} ${n}${q != null ? `／${q}` : ''} 盞`;
                        }).join('、')}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5">請先儲存這個燈種，再點「編輯」設定。</p>
                )}
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

/**
 * 供品的基本款（廟方 2026-10-23：「目前供品品項都要手動打字，但其實內容不外乎⋯⋯
 * 這幾個基本款式可以用勾選的會更方便」）。
 *
 * **這是捷徑不是限制**：不在這張清單上的照樣用「新增供品」手打，
 * 勾選只是省掉最常打的那幾個字——勾完只剩名額與金額要填。
 *
 * 順序照廟方唸出來的排，不要自己重排成筆劃或分類，那是現場備供品的順序。
 * **蛋糕放第一顆**：廟方 2026-10-23 補的時候講的是「還有最重要的蛋糕」，
 * 祝壽場合它是主角，排第一是依這句話不是依他補充的先後。
 */
const OFFERING_PRESETS = ['蛋糕', '鮮花', '水果', '壽桃', '壽麵', '蠟燭', '金紙', '祝壽供香', '壽酒', '茶葉'] as const;

/**
 * 加購品項的基本款（廟方 2026-10-23：「加購品項，通常是元寶、蓮花，也幫我設定
 * 可勾選，方便設定」）。與供品那組是**兩份清單不是一份**——加購是信眾報名時
 * 自己加買的（元寶、蓮花這類紙錢），供品是法會現場要備的，兩邊的品項不重疊。
 * 同樣是捷徑不是限制：其餘用「新增加購品項」手打。
 *
 * **「元寶」2026-10-30 改成「祝壽元寶18顆」**（廟方要求）。不是憑空改的：
 * 查資料庫時發現廟方自己在兩場活動裡**早就手打了這個全名**，預設卻還是舊的短名
 * ——等於那顆按鈕每次都要再改一次字。
 *
 * **這一項就是一個品項，不是一個開關**（廟方 2026-10-30）。
 * 資料庫裡它原本有**三種寫法**——「隨喜」「自由敬獻」還有一筆**名字是空的**
 * （前台靠 `addon.name || '隨喜'` 撐著才沒出事）。有了預設按鈕，以後都是同一個名字。
 * **廟方 2026-10-30 指定用「自由敬獻」**（當天先定「隨喜」，同日改成這個）。
 *
 * **蓮花刻意維持短名**：廟方在活動裡打的是「蓮花9朵」，但朵數會隨場次變，
 * 寫死一個數字反而每次都要改。元寶那個是廟方指名的，所以照辦。
 */
const ADDON_PRESETS = ['祝壽元寶18顆', '蓮花', '自由敬獻'] as const;

/**
 * **金額留空就是自由敬獻。** 廟方 2026-10-30：「不需要用打勾的方式來呈現隨喜，
 * 如果沒有金額就是讓信眾自填，就是隨喜」。
 *
 * 原本每一列有一個「隨喜」勾選框，那是**同一件事用兩個欄位表示**，
 * 而且兩者可以互相矛盾（填了 500 又勾隨喜，誰說了算？）。
 * 現在只剩金額欄：有數字就是固定費用，空的就是信眾自填。
 *
 * **`voluntary` 這個欄位沒有拿掉，改成存檔時推導。** 前台的加購分區、
 * `services/serviceAmount.ts` 的金額、`api/notify-confirm.ts` 的確認信、
 * `api/cron-reminders.ts` 的提醒全都在讀它——把它從資料裡拔掉要同時改四個地方，
 * 而那四個地方算的是錢。少一個欄位的好處遠不及那個風險。
 */
const deriveVoluntary = (addons: BlessingAddon[] | undefined): BlessingAddon[] =>
  (addons || []).map(a => ({ ...a, fee: Number(a.fee) || 0, voluntary: !Number(a.fee) }));

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

const BlessingsTab = ({ events, registrations, onRefresh, memberProfiles, fahuiCount, onGoFahui }: {
  events: BlessingEventRecord[];
  registrations: BlessingRegistrationRecord[];
  onRefresh: () => void;
  memberProfiles: MemberProfileRecord[];
  /** 法會報名表的筆數。給 external_form = 'fahui' 的活動顯示用，見下方 */
  fahuiCount: number;
  onGoFahui: () => void;
}) => {
  const [view, setView] = useState<'list' | 'regs'>('list');
  const blessingRegRows = useOpenRows();
  /** 生日、地址是個資，桌機也不常駐一欄：姓名格裡按「生日・地址」才就地展開（同問事管理） */
  const blessingRegInfo = useOpenRows();
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

  /**
   * 基本款的勾選。**勾＝清單上有同名的那一項**，所以取消勾選就是把它移除。
   *
   * 已經設定過名額／費用／說明的那一列先問一次再刪：廟方可能先勾起來、
   * 調好名額，之後手滑點到同一顆就把填好的東西靜靜刪掉了。
   * 沒動過的（名額 1、免費、沒說明）直接移除，不要為了沒資訊的一列跳提示。
   *
   * 比對用 `trim()` 後的完整名稱：廟方若把「鮮花」改成「鮮花一束」，
   * 那一顆就會顯示成未勾選——這是對的，那已經不是基本款那一項了，
   * 再點一次會另外新增一列，而不是覆蓋掉他改的名字。
   */
  /**
   * 勾選基本款時帶入「上一場用過的金額」（2026-11-17 廟方：「加購品項、供養名額，
   * 除了預設勾選外，我還要預設金額，目前都預設為 0，每次都要重設」）。
   *
   * **從過去的活動學，不寫死一張價目表**：廟方每一場的價錢幾乎一樣
   * （元寶 100、蓮花 600、鮮花 1000、壽桃 300⋯⋯），但總有一天會調價；
   * 寫死的話調價那天要找工程師，學來的話他改一次、下一場就跟著新價錢走。
   * 從來沒設過價錢的品項（蛋糕、壽酒、茶葉）照舊是 0。
   *
   * 找的是**活動日期最近**的那一場有同名品項的，比對 `trim()` 後**相等或開頭相同**：
   * 廟方在活動裡打的是「蓮花9朵」，基本款按鈕是「蓮花」（朵數會變，見 ADDON_PRESETS）。
   * **只帶金額，名額不帶**：名額每場差很多（1、3、5、6 都出現過），帶上一場的反而容易錯。
   */
  const lastFee = (kind: 'addons' | 'offerings', name: string): number => {
    const byDate = [...events].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
    for (const ev of byDate) {
      const items: { name: string; fee?: number }[] = (kind === 'addons' ? ev.addons : ev.offerings) || [];
      const hit = items.find(i => { const n = (i.name || '').trim(); return n === name || n.startsWith(name); });
      if (hit) return Number(hit.fee) || 0;
    }
    return 0;
  };

  const toggleOfferingPreset = (name: string) => {
    const list = form.offerings || [];
    const hit = list.find(o => o.name.trim() === name);
    if (!hit) {
      setForm(f => ({
        ...f,
        offerings: [...(f.offerings || []), { id: Math.random().toString(36).slice(2), name, totalQty: 1, fee: lastFee('offerings', name) }],
      }));
      return;
    }
    // 「動過」要跟帶入的預設金額比，不是跟 0 比——否則剛勾起來的那一列也會被當成改過
    const touched = hit.totalQty !== 1 || (hit.fee ?? 0) !== lastFee('offerings', name) || !!hit.description?.trim();
    // confirm 要在 setState 外面叫：StrictMode 會把 updater 跑兩次，寫在裡面會跳兩次視窗
    if (touched && !window.confirm(`「${name}」已經設定了名額或費用，確定要移除嗎？`)) return;
    setForm(f => ({ ...f, offerings: (f.offerings || []).filter(o => o.id !== hit.id) }));
  };

  /** 加購的勾選。規則與 toggleOfferingPreset 相同，差別只在「動過」的判定：
      加購沒有名額欄，所以看的是費用與說明（自由敬獻已經不是獨立欄位了）。 */
  const toggleAddonPreset = (name: string) => {
    const list = form.addons || [];
    const hit = list.find(a => a.name.trim() === name);
    if (!hit) {
      // fee 0 ＝ 留空 ＝ 自由敬獻（見 deriveVoluntary）。那一顆因此不必特別處理
      setForm(f => ({
        ...f,
        addons: [...(f.addons || []), { id: Math.random().toString(36).slice(2), name, fee: lastFee('addons', name) }],
      }));
      return;
    }
    // 「動過」只看費用與說明——自由敬獻不再是獨立欄位，fee 0 本來就是它的預設樣子
    const touched = (hit.fee ?? 0) !== lastFee('addons', name) || !!hit.description?.trim();
    if (touched && !window.confirm(`「${name}」已經設定了費用，確定要移除嗎？`)) return;
    setForm(f => ({ ...f, addons: (f.addons || []).filter(a => a.id !== hit.id) }));
  };

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
        // 金額留空＝自由敬獻。`voluntary` 在這裡推導一次，資料庫裡仍然存著那個欄位
        // ——前台、金額試算、確認信、排程提醒四處都在讀它（見 deriveVoluntary）
        addons: deriveVoluntary(form.addons),
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
    try {
      await updateBlessingRegistrationStatus(id, status);
      // 同點燈：收到款才寄，改回待匯款不寄（理由見 LampTab 的 handleRegStatusChange）
      if (status === BlessingStatus.CONFIRMED) queueConfirmEmail('blessing_registrations', id);
      onRefresh();
    }
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
    const regCols = {
      pkg: anyFilled(filteredRegs, r => r.packageName),
      addon: anyFilled(filteredRegs, r => [...(r.selectedAddons || []), ...(r.claimedOfferings || [])]),
      notes: anyFilled(filteredRegs, r => r.notes),
    };
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
                    {/* 電話 2026-11-18 收進姓名格的「個人資料」 */}
                    {/* 沒設方案的活動整欄都是空的，加購、備註也常整欄空——空欄不畫（2026-11-17）。
                        生日／生肖與地址不再是欄位，改由姓名格就地展開（2026-11-18 隱私） */}
                    {regCols.pkg && <th className="px-4 py-3 text-left">方案</th>}
                    {regCols.addon && <th className="px-4 py-3 text-left">加購</th>}
                    {regCols.notes && <th className="px-4 py-3 text-left">備註</th>}
                    <th className="px-4 py-3 text-left">狀態</th>
                    <th className="px-4 py-3 text-left">報名時間</th>
                    <th className="px-4 py-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredRegs.map(r => (
                    <tr key={r.id}
                      className={`hover:bg-purple-50/40 transition-colors cursor-pointer${blessingRegRows.isOpen(r.id) ? ' admin-open' : ''}`}
                      onClick={() => setQuickView({ name: r.name, phone: r.phone, birthDate: r.birthDate || undefined, zodiac: r.zodiac || undefined, gender: r.gender || undefined, address: r.address || undefined, notes: r.notes || undefined, status: r.status, serviceLabel: `祈福 · ${selectedEvent?.title ?? ''}`, createdAt: r.createdAt, source: r.source, email: r.email, confirmSentAt: r.confirmSentAt, mailKind: 'paid' })}
                    >
                      <td data-label="姓名" className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                        {(r.phone || r.gender || r.birthDate || r.zodiac || r.address) && <div>
                          <button type="button" aria-expanded={blessingRegInfo.isOpen(r.id)}
                            onClick={e => { e.stopPropagation(); blessingRegInfo.toggle(r.id); }}
                            className="mt-1 text-xs text-gray-500 hover:text-temple-red inline-flex items-center gap-0.5">
                            {blessingRegInfo.isOpen(r.id) ? '收合資料' : '個人資料'}
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${blessingRegInfo.isOpen(r.id) ? 'rotate-180' : ''}`} aria-hidden="true" />
                          </button>
                        </div>}
                        {blessingRegInfo.isOpen(r.id) && (
                          <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                            {r.phone && <p>{r.phone}</p>}
                            {r.gender && <p>{r.gender}</p>}
                            {(r.birthDate || r.zodiac) && <p>{r.birthDate}{r.zodiac ? `　${r.zodiac}年` : ''}</p>}
                            {r.address && <p>{r.address}</p>}
                          </div>
                        )}
                      </td>
                      {regCols.pkg && <td data-label="方案" className="px-4 py-3 text-sm text-gray-500">
                        {r.packageName
                          ? <span className="inline-flex flex-col gap-0.5">
                              <span className="text-xs font-medium text-temple-red">{r.packageName}</span>
                              {r.packageFee !== undefined && <span className="text-xs text-gray-400">NT${r.packageFee.toLocaleString()}</span>}
                            </span>
                          : <Dash />}
                      </td>}
                      {regCols.addon && <td data-label="加購" data-more className="px-4 py-3 text-sm text-gray-500 max-w-[200px]">
                        {r.selectedAddons && r.selectedAddons.length > 0 && (
                          <span className="text-xs leading-relaxed">
                            {r.selectedAddons.map(a => `${a.name}(NT$${a.fee.toLocaleString()})`).join(' / ')}
                          </span>
                        )}
                        {r.claimedOfferings && r.claimedOfferings.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {r.claimedOfferings.map(o => (
                              <span key={o.id} className="inline-flex items-center gap-0.5 bg-orange-100 text-orange-700 text-[11px] font-medium px-1.5 py-0.5 rounded-full">
                                {o.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {(!r.selectedAddons || r.selectedAddons.length === 0) && (!r.claimedOfferings || r.claimedOfferings.length === 0) && (
                          <Dash />
                        )}
                      </td>}
                      {regCols.notes && <td data-label="備註" data-more className="px-4 py-3 text-sm text-gray-500 max-w-[120px] truncate">{r.notes || <Dash />}</td>}
                      <td data-label="狀態" className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-start gap-1.5">
                          {statusBadge(r.status)}
                          <PaymentActions
                            status={r.status}
                            pending={BlessingStatus.PENDING}
                            confirmed={BlessingStatus.CONFIRMED}
                            cancelled={BlessingStatus.CANCELLED}
                            busy={updatingRegId === r.id}
                            onChange={next => handleRegStatus(r.id, next)}
                          />
                        </div>
                      </td>
                      <td data-label="報名時間" data-more className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                      <td data-label="操作" className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleDeleteReg(r.id)} disabled={deletingRegId === r.id}
                          className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-40">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                      <RowMoreCell open={blessingRegRows.isOpen(r.id)} onToggle={() => blessingRegRows.toggle(r.id)} hint="加購、備註、報名時間" />
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
                    onClick={() => setForm(f => ({ ...f, addons: [...(f.addons || []), { id: Math.random().toString(36).slice(2), name: '', fee: 0 }] }))}
                    className="flex items-center gap-1 text-xs text-temple-red hover:text-temple-red/80 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> 新增加購品項
                  </button>
                </div>
                {/* 基本款：勾一下就長出一列，只剩金額要填（同供品那組） */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ADDON_PRESETS.map(name => {
                    const on = (form.addons || []).some(a => a.name.trim() === name);
                    return (
                      <button key={name} type="button"
                        onClick={() => toggleAddonPreset(name)}
                        aria-pressed={on}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs transition-colors ${
                          on ? 'bg-temple-gold/20 border-temple-gold text-temple-red font-medium'
                             : 'bg-white border-gray-300 text-gray-600 hover:border-temple-gold hover:text-temple-red'}`}>
                        {on ? <Check className="w-3 h-3" /> : <span className="w-3 h-3 border border-current rounded-[3px]" />}
                        {name}
                        {/* 勾下去會帶入的金額先寫在鈕上：廟方一眼看得到這一場會不會照舊價 */}
                        {lastFee('addons', name) > 0 && <span className="opacity-70">${lastFee('addons', name)}</span>}
                      </button>
                    );
                  })}
                </div>

                {(!form.addons || form.addons.length === 0) ? (
                  <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                    無加購品項。上面勾選基本款，或點「新增加購品項」自己打。金額留空就是自由敬獻，由信眾自填。
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
                          {/* 金額留空＝自由敬獻。`|| ''` 讓 0 顯示成空的——印一個「0」會被讀成
                              「這項免費」，而它的意思是「由信眾自填」，兩者差很多。 */}
                          <input
                            type="number" min={0}
                            value={addon.fee || ''}
                            onChange={e => setForm(f => ({ ...f, addons: (f.addons || []).map((a, i) => i === idx ? { ...a, fee: Number(e.target.value) } : a) }))}
                            placeholder="金額 NT$"
                            className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-temple-red" />
                          {/* 留空時當場講出它的意思，不要讓廟方自己記這條規則。
                              **藏的時候用 `invisible` 不要用 `text-transparent`**：後者只是把字
                              變透明，螢幕閱讀器照樣會念「自由敬獻．自填」——而那一列明明已經填了金額。
                              `visibility:hidden` 會一起退出無障礙樹，而且同樣佔住位置不讓版面跳。 */}
                          <span className={`text-xs whitespace-nowrap shrink-0 text-temple-red font-medium ${addon.fee ? 'invisible' : ''}`}>
                            自由敬獻．自填
                          </span>
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
                {/* 基本款：勾一下就長出一列，不必打字（理由見 OFFERING_PRESETS）。
                    放在清單上方——要先挑才會有列可以調，順序要跟操作順序一致。 */}
                <div className="flex flex-wrap gap-1.5">
                  {OFFERING_PRESETS.map(name => {
                    const on = (form.offerings || []).some(o => o.name.trim() === name);
                    return (
                      <button key={name} type="button"
                        onClick={() => toggleOfferingPreset(name)}
                        aria-pressed={on}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs transition-colors ${
                          on ? 'bg-orange-100 border-orange-300 text-orange-800 font-medium'
                             : 'bg-white border-gray-300 text-gray-600 hover:border-orange-300 hover:text-orange-700'}`}>
                        {/* 方框／打勾用圖示而不是真的 checkbox：整顆要能點，
                            真的 input 會讓點標籤與點方框變成兩種行為 */}
                        {on ? <Check className="w-3 h-3" /> : <span className="w-3 h-3 border border-current rounded-[3px]" />}
                        {name}
                        {/* 勾下去會帶入的金額先寫在鈕上：廟方一眼看得到這一場會不會照舊價 */}
                        {lastFee('offerings', name) > 0 && <span className="opacity-70">${lastFee('offerings', name)}</span>}
                      </button>
                    );
                  })}
                </div>

                {(!form.offerings || form.offerings.length === 0) ? (
                  <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                    無供品名額。上面勾選基本款，或點「新增供品」自己打（如：五果一份、香爐一個）。
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
            // 紅色待匯款跟點燈、問事同一個樣子（2026-11-18 全後台一致化）
            const pending = registrations.filter(r => r.eventId === e.id && r.status === BlessingStatus.PENDING).length;
            const closed = isDeadlinePassed(e.registrationDeadline);
            // 報名走法會那套獨立表單的活動（目前只有普渡）：這裡數 blessing_registrations
            // 一定是 0，直接寫 0 筆等於告訴廟方「沒有人報名」。改成指去正確的分頁。
            // 見 supabase/migrations/blessing_events_external_form.sql
            const external = e.externalForm === 'fahui';
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
                    {external ? (
                      <button type="button" onClick={onGoFahui}
                        className="text-temple-red font-medium underline underline-offset-2 hover:text-[#5C1A04]">
                        {fahuiCount} 筆報名在「法會報名」分頁 →
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-temple-red font-medium">{count} 筆報名</span>
                        {pending > 0 && <span className="text-[11px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5 leading-none">{pending} 待匯款</span>}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => external ? onGoFahui() : viewRegs(e)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
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

// ─── 應收的列（應收管理與總覽「本月款項」共用）──────────────────────────────
/**
 * 把點燈／祈福／法會／捐獻四張表攤成同一種收款列。**應收管理與總覽共用這一支**，
 * 兩頁的金額與收款狀態才不會各算各的（2026-11-18 從 ReceivablesTab 抽出）。
 * 金額一律走 services/serviceAmount.ts。
 */
type PayState = 'pending' | 'paid' | 'cancelled' | 'unchecked';
type IncomeRow = {
  id: string; date: string; name: string; phone: string;
  /** 報名時留的地址。收據要印，而四張報名表本來就都有存這一欄 */
  address: string;
  type: '點燈' | '祈福' | '法會' | '捐獻';
  typeKey: 'lamp' | 'blessing' | 'fahui' | 'donation';
  detail: string; amount: number;
  pay: PayState;
  /** 法會才有，用來展開既有的對帳區塊（整套搬過來，不另寫一份） */
  fahui?: FahuiRegistrationRecord;
};


function buildIncomeRows(src: {
  lampRegistrations:     LampRegistrationRecord[];
  lampConfigs:           LampServiceConfig[];
  blessingRegistrations: BlessingRegistrationRecord[];
  blessingEvents:        BlessingEventRecord[];
  fahuiRegistrations:    FahuiRegistrationRecord[];
  donations:             DonationRecord[];
}): IncomeRow[] {
  const { lampRegistrations, lampConfigs, blessingRegistrations, blessingEvents, fahuiRegistrations, donations } = src;
  // 金額一律走 services/serviceAmount.ts，不要在這裡自己算（理由見那支的檔頭）
  const lampRows: IncomeRow[] = lampRegistrations.map(r => {
    const cfg = lampConfigs.find(c => c.id === r.serviceId);
    return { id: `lamp:${r.id}`, date: r.createdAt, name: r.name, phone: r.phone,
      address: r.address ?? '',
      type: '點燈', typeKey: 'lamp', detail: cfg?.name || '—',
      amount: lampAmount(r, lampConfigs),
      pay: r.status === LampRegistrationStatus.CANCELLED ? 'cancelled'
         : r.status === LampRegistrationStatus.CONFIRMED ? 'paid' : 'pending' };
  });
  const blessingRows: IncomeRow[] = blessingRegistrations.map(r => {
    const ev = blessingEvents.find(e => e.id === r.eventId);
    return { id: `blessing:${r.id}`, date: r.createdAt, name: r.name, phone: r.phone,
      address: r.address ?? '',
      type: '祈福', typeKey: 'blessing', detail: ev?.title || '—',
      amount: blessingAmount(r, blessingEvents),
      pay: r.status === BlessingStatus.CANCELLED ? 'cancelled'
         : r.status === BlessingStatus.CONFIRMED ? 'paid' : 'pending' };
  });
  // 法會的金額用報名紀錄上的 totalAmount（與法會分頁、信眾名冊同一個來源）
  const fahuiRows: IncomeRow[] = fahuiRegistrations.map(r => ({
    id: `fahui:${r.id}`, date: r.createdAt, name: r.name, phone: r.phone,
    address: r.address ?? '',
    type: '法會', typeKey: 'fahui', detail: '法會報名',
    amount: r.totalAmount,
    pay: r.status === 'paid' ? 'paid' : 'pending',
    fahui: r,
  }));
  const donationRows: IncomeRow[] = donations.map(r => ({
    id: `donation:${r.id}`, date: r.createdAt, name: r.name, phone: r.phone,
    address: r.address ?? '',
    type: '捐獻', typeKey: 'donation', detail: r.type, amount: r.amount,
    // undefined＝欄位存在之前的舊資料，從未核對過，**不是**「還沒收到」
    pay: r.status === undefined ? 'unchecked'
       : r.status === DonationStatus.CANCELLED ? 'cancelled'
       : r.status === DonationStatus.CONFIRMED ? 'paid' : 'pending',
  }));
  return [...lampRows, ...blessingRows, ...fahuiRows, ...donationRows]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ─── ReceivablesTab（應收管理）────────────────────────────────────────────────

/**
 * 後台「應收管理」——**財務的作業頁**（2026-10-30 大改）。
 *
 * ── 這一頁在做什麼 ──
 * 廟方 2026-10-30：「暫時不用線上金流，財務必須要用很多張 excel 表來記錄，
 * 一個報名就一張表，還要一個個確認是否匯款……要做一個專屬財務的，有報名、捐款
 * 都會直接顯示在該頁，由財務去檢查，並點選『已收款』。」
 *
 * **這一頁原本只有一半**：它一直是唯讀的收入彙總，直接從報名資料算金額，
 * 不知道錢有沒有真的進來。現在補上寫入那一半，並把法會納進來。
 *
 * **沒有另開新頁是刻意的。** CLAUDE.md 早就記著「本站收入已經有三套不一致的作法
 * ……再做一套就是第四套也是最糟的一套」。財務角色的 ROLE_ALLOWED_TABS 本來就
 * 含 receivables，這一頁補完就是廟方要的那一頁。
 *
 * ── 「已收款」會寄信給信眾，這不是純粹的內部狀態 ──
 * 點燈／祈福／法會按下去會送出一封「款項已收到」（走 queueConfirmEmail）。
 * **財務一次標記幾十筆，就是一次對外寄出幾十封信。** 所以這顆按鈕一定要走與
 * 各服務分頁同一條路——自己寫一套 update 而漏掉寄信，症狀是「後台一切正常、
 * 信眾永遠收不到通知」，而且不會報錯。
 *
 * **捐獻不寄**：它的感謝信是送出當下就寄的（廟方 2026-10-30 決定維持原樣），
 * 與收款核對無關。
 *
 * ── 預設只顯示「待收款」 ──
 * 這是工作清單不是報表。全部顯示的話，今天要處理的幾筆會被幾百筆已完成的淹掉。
 *
 * ── 捐獻的「未核對」與「待匯款」是兩回事 ──
 * `status === undefined` 代表這筆早於 donation_payment_status.sql，當初根本沒有
 * 核對這件事；把它顯示成「待匯款」等於系統在宣稱那些錢沒收到。畫面上分開，
 * 而且**未核對的不進待辦清單**——那會是一整頁假的待辦。
 */
const ReceivablesTab: React.FC<{
  lampRegistrations:     LampRegistrationRecord[];
  lampConfigs:           LampServiceConfig[];
  blessingRegistrations: BlessingRegistrationRecord[];
  blessingEvents:        BlessingEventRecord[];
  fahuiRegistrations:    FahuiRegistrationRecord[];
  donations:             DonationRecord[];
  memberProfiles:        MemberProfileRecord[];
  onRefresh:             () => void;
}> = ({ lampRegistrations, lampConfigs, blessingRegistrations, blessingEvents, fahuiRegistrations, donations, memberProfiles, onRefresh }) => {
  const [filter, setFilter] = useState<'all' | 'lamp' | 'blessing' | 'fahui' | 'donation'>('all');
  const receivableRows = useOpenRows();
  /** 預設只看待收款——這是工作清單，不是報表 */
  const [payFilter, setPayFilter] = useState<'pending' | 'paid' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  /** 法會展開對帳欄位的那一列 */
  const [openReconcile, setOpenReconcile] = useState<string | null>(null);
  /** 畫面：待辦清單 ↔ 已開立的收據 */
  const [view, setView] = useState<'work' | 'receipts'>('work');
  /**
   * 工具列要黏在後台頂欄的**下方**，而頂欄的高度沒有常數可以引用。
   * **不要寫死一個偏移量**：猜錯就是工具列疊在頂欄上，而那在不同字級與
   * 視窗寬度下還會變。量出來最實在，量不到就退回 0（不黏，但不會壞版）。
   */
  const [stickyTop, setStickyTop] = useState(0);
  useEffect(() => {
    const measure = () => {
      const el = document.querySelector('[data-admin-topbar]');
      setStickyTop(el ? Math.round(el.getBoundingClientRect().height) : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  /** 勾選要開收據的列。key 是 IncomeRow.id（`lamp:uuid` 這種） */
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [issuing, setIssuing] = useState(false);
  /** 清單上按「收據 115-xxxxx」直接補印的那一張 */
  const [reprint, setReprint] = useState<ReceiptRecord | null>(null);
  /**
   * 只印日期、不印時間（廟方 2026-10-30：「有日期就好，不用時間」）。
   * 財務是拿銀行入帳的日期去對，分秒幫不上忙，只是把欄位撐寬。
   * **不改共用的 `fmtDate`**：別的分頁（報名明細、最後登入）要那個時間。
   */
  const fmtDay = (s: string) => {
    if (!s) return '';
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? String(s)
      : `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  /** 開完收據要讓列表重抓 */
  const [receiptKey, setReceiptKey] = useState(0);
  const temple = useTempleInfo();

  useEffect(() => { getReceipts().then(setReceipts).catch(() => {}); }, [receiptKey]);
  const already = useMemo(() => receiptsBySource(receipts), [receipts]);

  /** IncomeRow 的 typeKey → 資料表名。收據明細靠這個指回報名紀錄 */
  const SOURCE_TABLE = {
    lamp: 'lamp_registrations', blessing: 'blessing_registrations',
    fahui: 'fahui_registrations', donation: 'donations',
  } as const;

  const rows = useMemo<IncomeRow[]>(
    () => buildIncomeRows({ lampRegistrations, lampConfigs, blessingRegistrations, blessingEvents, fahuiRegistrations, donations }),
    [lampRegistrations, lampConfigs, blessingRegistrations, blessingEvents, fahuiRegistrations, donations]);

  const filtered = useMemo(() => {
    let r = rows;
    if (filter !== 'all') r = r.filter(row => row.typeKey === filter);
    // 「待收款」刻意不含 unchecked：那些是舊資料，不是今天要做的事
    if (payFilter === 'pending') r = r.filter(row => row.pay === 'pending');
    else if (payFilter === 'paid') r = r.filter(row => row.pay === 'paid');
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(row => row.name.toLowerCase().includes(q) || row.phone.includes(q));
    }
    return r;
  }, [rows, filter, payFilter, search]);

  /** 勾起來的那幾列。**從 rows 取不是從 filtered 取**：換了篩選條件之後，
   *  已經勾好的列不該因為暫時被篩掉就消失，否則勾到一半改個篩選就全沒了。 */
  const pickedRows = useMemo(() => rows.filter(r => picked.has(r.id)), [rows, picked]);
  /** **要定義在 `pickedGroups` 之前。** `const` 有暫時死區，而那個 useMemo 的
   *  工廠是在渲染當下同步執行的——放在後面的話，一勾選就 ReferenceError。
   *  沒勾選時 Map 是空的、這支不會被呼叫，所以畫面看起來正常，
   *  **一勾下去才炸**（廟方 2026-10-30 回報）。 */
  const findMember = (phone: string) => memberProfiles.find(p => p.phone === phone) || null;

  /**
   * 勾選的列依「人」分組——**一個人一張收據**。
   *
   * 原本是不管勾了誰，全部塞進同一張、抬頭掛第一個人的名字。那是錯的：
   * 收據是給特定一個人的憑證，把別人的錢算在他頭上，金額與抬頭就對不起來。
   * 廟方 2026-10-30 說「勾選二個以上要能一次印」時一併查出來的。
   *
   * **分組鍵是姓名＋電話，不是姓名。** 只看姓名的話，兩個同名的人會被併成
   * 一張收據——那正是這次要修掉的毛病，不能在分組這一層又犯一次。
   * 代價是同一個人用兩支電話報名會分成兩張；那比合錯好，而且看得出來。
   */
  const pickedGroups: ReceiptGroup[] = useMemo(() => {
    const m = new Map<string, ReceiptGroup>();
    pickedRows.forEach(r => {
      const key = `${r.name}|${r.phone}`;
      let g = m.get(key);
      if (!g) {
        g = { key, title: r.name, phone: r.phone, address: '', items: [] };
        m.set(key, g);
      }
      g.items.push({
        sourceTable: SOURCE_TABLE[r.typeKey],
        sourceId: r.id.split(':')[1],
        // 項目名稱與金額是**快照**：收據印出去之後，活動改名或改價都不該動到那張紙
        label: r.typeKey === 'donation' ? r.detail : `${r.type}－${r.detail}`,
        amount: r.amount,
      });
    });
    // 電話與地址：這個人自己那幾筆裡第一個有填的，再退回他的會員資料
    const rowsOf = (key: string) => pickedRows.filter(r => `${r.name}|${r.phone}` === key);
    m.forEach((g, key) => {
      const mine = rowsOf(key);
      const mem = findMember(g.phone ?? '');
      g.phone = mine.map(r => r.phone).find(Boolean) ?? mem?.phone ?? '';
      g.address = mine.map(r => r.address).find(Boolean) ?? mem?.address ?? '';
    });
    return [...m.values()];
  }, [pickedRows, memberProfiles]);
  const togglePick = (id: string) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const sum = (pred: (r: IncomeRow) => boolean) =>
    rows.filter(pred).reduce((s, r) => s + r.amount, 0);
  const pendingRows   = useMemo(() => rows.filter(r => r.pay === 'pending'), [rows]);
  const totalPending  = useMemo(() => sum(r => r.pay === 'pending'), [rows]);
  const totalPaid     = useMemo(() => sum(r => r.pay === 'paid'), [rows]);
  const uncheckedRows = useMemo(() => rows.filter(r => r.pay === 'unchecked'), [rows]);


  /**
   * 標記收款。**一定要走各服務原本那條路**，寄信就在那裡面
   * （漏掉的症狀是後台一切正常、信眾永遠收不到「款項已收到」，而且不報錯）。
   */
  const setPayState = async (row: IncomeRow, next: 'pending' | 'paid' | 'cancelled') => {
    const rawId = row.id.split(':')[1];
    const paid = next === 'paid';
    setBusyId(row.id);
    try {
      if (row.typeKey === 'lamp') {
        await updateLampRegistrationStatus(rawId,
          next === 'cancelled' ? LampRegistrationStatus.CANCELLED
          : paid ? LampRegistrationStatus.CONFIRMED : LampRegistrationStatus.PENDING);
        if (paid) queueConfirmEmail('lamp_registrations', rawId);
      } else if (row.typeKey === 'blessing') {
        await updateBlessingRegistrationStatus(rawId,
          next === 'cancelled' ? BlessingStatus.CANCELLED
          : paid ? BlessingStatus.CONFIRMED : BlessingStatus.PENDING);
        if (paid) queueConfirmEmail('blessing_registrations', rawId);
      } else if (row.typeKey === 'fahui') {
        // 法會只有 paid／pending 兩種值，沒有取消——那是它自己那套的既有設計
        await updateFahuiStatus(rawId, paid ? 'paid' : 'pending');
        if (paid) queueConfirmEmail('fahui_registrations', rawId);
      } else {
        // 捐獻不寄信：感謝信是送出當下就寄的，與收款核對無關
        await updateDonationStatus(rawId,
          next === 'cancelled' ? DonationStatus.CANCELLED
          : paid ? DonationStatus.CONFIRMED : DonationStatus.PENDING);
      }
      onRefresh();
    } catch {
      alert('更新收款狀態失敗');
    } finally {
      setBusyId(null);
    }
  };

  const typeBadge = (typeKey: IncomeRow['typeKey'], label: string) => {
    const cls =
      typeKey === 'lamp'     ? 'bg-amber-100 text-amber-700' :
      typeKey === 'blessing' ? 'bg-purple-100 text-purple-700' :
      typeKey === 'fahui'    ? 'bg-rose-100 text-rose-700' :
                               'bg-green-100 text-green-700';
    // **whitespace-nowrap ＋ shrink-0 兩個都要**：前者擋字本身折行，
    // 後者擋 flex 容器把它壓窄（壓窄之後照樣會折）。少一個就會看到「祈／福」。
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${cls}`}>{label}</span>;
  };

  const payBadge = (pay: PayState) => {
    const base = 'px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap inline-block';
    if (pay === 'paid')      return <span className={`${base} bg-green-100 text-green-800`}>已收款</span>;
    if (pay === 'cancelled') return <span className={`${base} bg-red-100 text-red-800`}>已取消</span>;
    if (pay === 'unchecked') return (
      <span className={`${base} bg-gray-100 text-gray-500`}
        title="這筆早於收款狀態這個欄位，當初沒有核對過——不等於沒收到">未核對</span>
    );
    return <span className={`${base} bg-yellow-100 text-yellow-800`}>待匯款</span>;
  };

  return (
    <div className="space-y-6">
      {/* 統計卡片：這是工作清單，所以先講「還沒收的」 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-yellow-200 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">待收款</p>
          <p className="text-2xl font-bold text-yellow-700">NT$ {totalPending.toLocaleString()}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{pendingRows.length} 筆等著核對</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">已收款</p>
          <p className="text-2xl font-bold text-green-600">NT$ {totalPaid.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">未核對</p>
          <p className="text-2xl font-bold text-gray-400">{uncheckedRows.length}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">舊捐獻，當初沒有核對欄位</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">全部收入</p>
          <p className="text-2xl font-bold text-temple-red">NT$ {sum(() => true).toLocaleString()}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">報名金額，不是已入帳</p>
        </div>
      </div>

      <div className="flex gap-1">
        {(['work', 'receipts'] as const).map(k => (
          <button key={k} onClick={() => setView(k)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              view === k ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}>
            {k === 'work' ? '待辦清單' : `收據 ${receipts.length}`}
          </button>
        ))}
      </div>

      {view === 'receipts' ? (
        <div className="space-y-6">
          <ReceiptListPanel temple={temple} refreshKey={receiptKey} />
          {/* 設定放在列表下面：每天開收據的人不需要看到它，但要找得到 */}
          <ReceiptSettingsPanel onSaved={() => setReceiptKey(k => k + 1)} />
        </div>
      ) : (
      <>
      {/* 篩選 + 搜尋 + 表格。
          **卡片不能有 overflow-hidden**：它會讓裡面的工具列 sticky 失效
          （sticky 會改成相對那個不捲動的容器定位，等於不會黏）。
          圓角改由表格容器自己處理。 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div style={{ top: stickyTop }}
          className="sticky z-20 bg-white rounded-t-2xl p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {(['pending', 'paid', 'all'] as const).map(key => (
              <button key={key} onClick={() => setPayFilter(key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  payFilter === key ? 'bg-temple-red text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}>
                {key === 'pending' ? `待收款 ${pendingRows.length}` : key === 'paid' ? '已收款' : '全部'}
              </button>
            ))}
          </div>
          <div className="w-px h-6 bg-gray-200" />
          <div className="flex gap-1">
            {(['all', 'lamp', 'blessing', 'fahui', 'donation'] as const).map(key => {
              const label = key === 'all' ? '全部' : key === 'lamp' ? '點燈' : key === 'blessing' ? '祈福' : key === 'fahui' ? '法會' : '捐獻';
              return (
                <button key={key} onClick={() => setFilter(key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filter === key ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'
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
          {/* **這顆要永遠看得見。** 原本只在勾選之後才浮出底部那一條——
              而沒發現左邊有勾選框的人，永遠不會知道有這個功能。
              藏在一個「你必須先知道」的動作後面，等於沒有。 */}
          {/* **已選與合計也在這裡，不在畫面底部。** 廟方 2026-10-30：
              「操作要在表頭，你藏在最下面，每次都要滑多久。」
              清單有幾百列時，為了按一顆按鈕捲到底再捲回來是不合理的。 */}
          {pickedRows.length > 0 && (
            <span className="text-sm text-gray-600 whitespace-nowrap">
              已選 <strong className="text-gray-900">{pickedRows.length}</strong> 筆
              <span className="text-gray-400 mx-2">·</span>
              NT$ {pickedRows.reduce((s, r) => s + r.amount, 0).toLocaleString()}
              <button onClick={() => setPicked(new Set())}
                className="ml-2 text-xs text-gray-400 hover:text-gray-700 underline">清除</button>
            </span>
          )}
          <button onClick={() => pickedRows.length > 0 && setIssuing(true)}
            disabled={pickedRows.length === 0}
            title={pickedRows.length === 0 ? '先勾選左邊的方框選取要開收據的項目' : ''}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
              pickedRows.length > 0
                ? 'bg-temple-red text-white hover:bg-temple-red/90'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}>
            開立收據{pickedGroups.length > 1 ? ` ${pickedGroups.length} 張`
              : pickedRows.length > 0 ? ` (${pickedRows.length})` : ''}
          </button>
        </div>

        {/* 沒勾選時講一句，不要讓人對著一顆灰掉的按鈕猜 */}
        {pickedRows.length === 0 && filtered.length > 0 && (
          <p className="px-4 py-2 bg-amber-50/60 border-b border-amber-100 text-xs text-amber-800">
            要開收據請先<strong>勾選最左邊的方框</strong>（可以跨類型一起勾，點燈＋捐款會開在同一張收據上）。
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="admin-table w-full text-sm">
            {/* **表頭不做 sticky**：它在 `overflow-x-auto` 容器裡，而
                `overflow-x: auto` 會讓 `overflow-y` 計算成 auto，於是那個容器
                變成捲動容器、表頭只會相對它定位——它不垂直捲動，所以黏不住。
                要讓表頭跟著捲得改整個表格的捲動結構，代價比收益大。 */}
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 w-10">
                  {/* 全選只作用在「目前篩選出來的」那幾列，不是整份資料——
                      按一下就勾了幾百筆是沒有人想要的結果 */}
                  <input type="checkbox"
                    checked={filtered.length > 0 && filtered.every(r => r.pay === 'cancelled' || picked.has(r.id))}
                    onChange={e => setPicked(prev => {
                      const next = new Set(prev);
                      filtered.forEach(r => {
                        if (r.pay === 'cancelled') return;
                        if (e.target.checked) next.add(r.id); else next.delete(r.id);
                      });
                      return next;
                    })}
                    title="全選目前篩選出來的"
                    className="rounded border-gray-300 text-temple-red focus:ring-temple-red/30" />
                </th>
                {/* **類型與項目併成一欄**（徽章＋底下的明細）：同樣的資訊、少一欄。
                    財務的動線是「看銀行入帳 → 找到人 → 按已收款」，欄位每多一個，
                    那顆按鈕就離畫面右緣更近一點。 */}
                {/* **八欄全部直接顯示，沒有「更多欄位」開關**（廟方 2026-10-30）。
                    只剩電話一項要藏的時候，那個勾勾本身就比它省下的空間更礙事。
                    「會員」已整欄移除：財務對帳是拿銀行入帳去比姓名與金額，
                    「這個人有沒有帳號」不影響任何一個決定。 */}
                {['日期', '姓名', '電話', '項目', '金額', '狀態'].map(h => (
                  <th key={h} className={`px-5 py-3 font-medium text-gray-500 ${h === '金額' ? 'text-right' : ''}`}>{h}</th>
                ))}
                <th className="px-5 py-3 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-gray-400 py-16">
                  {payFilter === 'pending' ? '待收款的都處理完了' : '暫無資料'}
                </td></tr>
              ) : filtered.map(row => {
                const busy = busyId === row.id;
                return (
                  <React.Fragment key={row.id}>
                    <tr className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors${receivableRows.isOpen(row.id) ? ' admin-open' : ''}`}>
                      <td data-label="選取" className="px-4 py-3">
                        {/* 已取消的開不了收據 */}
                        {row.pay !== 'cancelled' && (
                          <input type="checkbox" checked={picked.has(row.id)} onChange={() => togglePick(row.id)}
                            className="rounded border-gray-300 text-temple-red focus:ring-temple-red/30" />
                        )}
                      </td>
                      <td data-label="日期" className="px-5 py-3 text-gray-400 whitespace-nowrap text-xs">{fmtDay(row.date)}</td>
                      <td data-label="姓名" className="px-5 py-3 font-medium text-gray-800 whitespace-nowrap">{row.name}</td>
                      <td data-label="電話" data-more className="px-5 py-3 text-gray-500 whitespace-nowrap">{row.phone || <Dash />}</td>
                      <td data-label="項目" className="px-5 py-3 max-w-[220px]">
                        <div className="flex items-center gap-2">
                          {typeBadge(row.typeKey, row.type)}
                          <span className="text-gray-600 truncate" title={row.detail}>{row.detail}</span>
                        </div>
                      </td>
                      <td data-label="金額" className="px-5 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">NT$ {row.amount.toLocaleString()}</td>
                      <td data-label="狀態" className="px-5 py-3 whitespace-nowrap">{payBadge(row.pay)}</td>
                      <td data-label="操作" className="px-5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {/* 三種狀態都能在這裡改，**取消的也回得來**——
                              原本已取消的那一列是死路，按錯就得回各服務分頁救。
                              取消做成小圖示、跟主按鈕拉開：那是破壞性的語意，
                              不能挨著每天要按幾十次的那一顆（同 PaymentActions）。 */}
                          {row.pay === 'cancelled' ? (
                            <button onClick={() => setPayState(row, 'pending')} disabled={busy}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50">
                              還原為待匯款
                            </button>
                          ) : (
                            <>
                              <button onClick={() => setPayState(row, row.pay === 'paid' ? 'pending' : 'paid')} disabled={busy}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                                  row.pay === 'paid'
                                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                }`}>
                                {row.pay === 'paid' ? '改回待匯款' : '標記已收款'}
                              </button>
                              {/* 法會沒有「取消」這個狀態值，不給那顆（它那套只有 paid／pending） */}
                              {row.typeKey !== 'fahui' && (
                                <button onClick={() => setPayState(row, 'cancelled')} disabled={busy}
                                  title="標記取消" aria-label="標記取消"
                                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-50">
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                          {/* **開過的收據直接顯示在列上。** 不顯示的話，財務只能
                              點了「開立收據」才知道這筆開過——而那時已經在對話框裡了。
                              按下去是補印同一張，流水號不變。 */}
                          {(() => {
                            const rec = already.get(`${SOURCE_TABLE[row.typeKey]}:${row.id.split(':')[1]}`);
                            return rec ? (
                              <button onClick={() => setReprint(rec)}
                                title={`補印 ${rec.receiptNo}（同一張，流水號不變）`}
                                className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 font-mono whitespace-nowrap">
                                {rec.receiptNo}
                              </button>
                            ) : null;
                          })()}
                          {/* 法會的細部對帳（付款方式／帳號後五碼／財務會計確認）整套在這裡展開，
                              用的是法會分頁那個元件本體，不另寫一份 */}
                          {row.fahui && (
                            <button onClick={() => setOpenReconcile(openReconcile === row.id ? null : row.id)}
                              className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50">
                              {openReconcile === row.id ? '收合對帳' : '對帳'}
                            </button>
                          )}
                        </div>
                      </td>
                      <RowMoreCell open={receivableRows.isOpen(row.id)} onToggle={() => receivableRows.toggle(row.id)} hint="電話" />
                    </tr>
                    {row.fahui && openReconcile === row.id && (
                      <tr className="bg-gray-50/70">
                        <td colSpan={8} className="px-5 py-4">
                          <FahuiReconcileBlock r={row.fahui} onSaved={onRefresh} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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

      {reprint && (
        <ReceiptPrint receipt={reprint} temple={temple} onDone={() => setReprint(null)} />
      )}

      {issuing && (
        <ReceiptIssueDialog
          groups={pickedGroups}
          already={already}
          temple={temple}
          onClose={() => setIssuing(false)}
          onIssued={() => { setPicked(new Set()); setReceiptKey(k => k + 1); }}
        />
      )}
      </>
      )}

      <p className="text-xs text-gray-400 leading-relaxed">
        按「標記已收款」時，<strong className="text-gray-500">點燈／祈福／法會會自動寄一封「款項已收到」給信眾</strong>
        （寄過的不再寄，連著標好幾列會併成一封）。捐獻不寄——它的感謝信在送出當下就寄了。
        「改回待匯款」不會寄任何信，也沒有「取消確認信」這種東西，標錯請直接打電話。
      </p>

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

const TrafficTab = ({ bookings, donations, lampRegistrations, lampConfigs, blessingRegistrations, blessingEvents, fahuiRegistrations, volunteerRegistrations }: {
  bookings: BookingRecord[];
  donations: DonationRecord[];
  lampRegistrations: LampRegistrationRecord[];
  lampConfigs: LampServiceConfig[];
  blessingRegistrations: BlessingRegistrationRecord[];
  /** 祈福的費用多半存在活動上（沒有方案時），所以算金額一定要有這份 */
  blessingEvents: BlessingEventRecord[];
  fahuiRegistrations: FahuiRegistrationRecord[];
  volunteerRegistrations: VolunteerRegistrationRecord[];
}) => {
  const [view, setView] = useState<'summary' | 'detail'>('summary');
  const trafficRows = useOpenRows();
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
      // 金額與應收管理共用同一支（services/serviceAmount.ts），兩頁對不起來就沒人信
      ...lampRegistrations.filter(r => r.status !== LampRegistrationStatus.CANCELLED).map(r => ({
        service: '點燈', name: r.name,
        amount: lampAmount(r, lampConfigs),
        source: r.source, createdAt: r.createdAt,
      })),
      ...blessingRegistrations.filter(r => r.status !== BlessingStatus.CANCELLED).map(r => ({
        service: '祈福', name: r.name,
        amount: blessingAmount(r, blessingEvents),
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
  }, [bookings, donations, lampRegistrations, lampConfigs, blessingRegistrations, blessingEvents, fahuiRegistrations, volunteerRegistrations]);

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
                  <tr key={g.source} className={`hover:bg-gray-50/60${trafficRows.isOpen(g.source) ? ' admin-open' : ''}`}>
                    <td data-label="來源" className="px-5 py-3">
                      <span className="text-sm font-mono text-gray-800">{g.source}</span>
                    </td>
                    <td data-label="平台" data-more className="px-5 py-3 text-sm text-gray-600">{g.platform}</td>
                    <td data-label="筆數" className="px-5 py-3 text-sm font-semibold text-gray-800">{g.count}</td>
                    <td data-label="佔比" data-more className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                          <div className="h-full bg-temple-gold" style={{ width: `${totalCount ? (g.count / totalCount) * 100 : 0}%` }} />
                        </div>
                        <span className="text-xs text-gray-400">{totalCount ? Math.round((g.count / totalCount) * 100) : 0}%</span>
                      </div>
                    </td>
                    <td data-label="金額" className="px-5 py-3 text-sm text-temple-red">{g.amount ? `NT$${g.amount.toLocaleString()}` : <Dash />}</td>
                    {TRAFFIC_SERVICES.map(s => (
                      <td key={s} data-label={s} data-more className="px-5 py-3 text-sm text-gray-500">{g.byService[s] || <Dash />}</td>
                    ))}
                    <RowMoreCell open={trafficRows.isOpen(g.source)} onToggle={() => trafficRows.toggle(g.source)} hint="平台、佔比、各服務" />
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
                    <td data-label="金額" className="px-5 py-3 text-sm text-temple-red">{r.amount ? `NT$${r.amount.toLocaleString()}` : <Dash />}</td>
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
  /**
   * 重新整理後停在原本那一頁（2026-11-17，與 App 的 ?admin=1 同一件事）。記在 sessionStorage：
   * 只屬於這個分頁、關掉就忘——下次打開後台從總覽開始才是對的。
   * 讀回來的值要確認這個角色看得到，否則財務組會被帶到一頁空白。
   */
  const [tab, setTabState] = useState<Tab>(() => {
    const fallback: Tab = role === 'finance' ? 'receivables' : 'overview';
    try {
      const saved = sessionStorage.getItem('admin_tab') as Tab | null;
      return saved && (ROLE_ALLOWED_TABS[role] as readonly string[]).includes(saved) ? saved : fallback;
    } catch { return fallback; }
  });
  const setTab = (t: Tab) => {
    setTabState(t);
    try { sessionStorage.setItem('admin_tab', t); } catch { /* 私密瀏覽等情況存不了就算了 */ }
  };
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
  /** 會員帳號的信箱（來自 auth.users，走 get_users_last_login 這支 RPC）。
   *  空的原因見 `getUsersLastLogin` 的註解——LINE 登入的會員本來就沒有信箱。 */
  const [memberEmails, setMemberEmails] = useState<Record<string, string>>({});
  const [blessingEvents, setBlessingEvents] = useState<BlessingEventRecord[]>([]);
  const [blessingRegistrations, setBlessingRegistrations] = useState<BlessingRegistrationRecord[]>([]);
  const [fahuiRegistrations, setFahuiRegistrations] = useState<FahuiRegistrationRecord[]>([]);
  const [volunteerRegistrations, setVolunteerRegistrations] = useState<VolunteerRegistrationRecord[]>([]);
  const [lineStats, setLineStats] = useState<{ today: number; total: number }>({ today: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  /**
   * 緊急祈願的待處理筆數（側邊欄紅點用）。2026-11-17 廟方：「緊急祈願⋯⋯在後台的清單沒有顯示小紅點」。
   * 原因是那一頁的資料由 AdminUrgentTab 自己抓，總覽這層從來沒有拿到，`badgeFor` 對它永遠回 0。
   * 現在 fetchAll 一起抓一次，進到那一頁之後由那一頁回報最新的數字（標記已祈福就立刻少一個）。
   */
  const [urgentPending, setUrgentPending] = useState(0);
  const fetchAll = async (initial = false) => {
    if (initial) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const [b, d, bl, si, dt, hl, hs, sv, lc, lr, mp, ac, ll, ar, be, br, ls, fh, vol, up] = await Promise.all([getBookings(), getDonations(), getBulletins(true), getSiteImages(), getDeities(), getDeityHalls().catch(() => [] as HallRecord[]), getHeroSlides(), getScriptureVerses(), getLampServiceConfigs().catch(() => [] as LampServiceConfig[]), getLampRegistrations().catch(() => [] as LampRegistrationRecord[]), getAllMemberProfiles().catch(() => [] as MemberProfileRecord[]), getAllMemberContactsAdmin().catch(() => [] as MemberContact[]), getUsersLastLogin().catch(() => ({ lastLogin: {}, emails: {} })), getRegistrations().catch(() => [] as RegistrationRecord[]), getBlessingEvents().catch(() => [] as BlessingEventRecord[]), getBlessingRegistrations().catch(() => [] as BlessingRegistrationRecord[]), getLineClickStats().catch(() => ({ today: 0, total: 0 })), getFahuiRegistrations().catch(() => [] as FahuiRegistrationRecord[]), getVolunteerRegistrations().catch(() => [] as VolunteerRegistrationRecord[]), getUrgentPrayers().catch(() => [] as UrgentPrayerRecord[])]);
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
      setUsersLastLogin(ll.lastLogin);
      setMemberEmails(ll.emails);
      setAllRegistrations(ar);
      setBlessingEvents(be);
      setBlessingRegistrations(br);
      setLineStats(ls);
      setFahuiRegistrations(fh);
      setVolunteerRegistrations(vol);
      setUrgentPending(up.filter(r => r.status === UrgentPrayerStatus.PENDING).length);
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
      // 確認完成就通知信眾一聲（廟方 2026-10-13）。連著確認好幾列會併成一封，
      // 寄過的不再寄——兩件事都在 services/notifyConfirm.ts 與那支端點裡處理
      if (status === BookingStatus.CONFIRMED) queueConfirmEmail('bookings', id);
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
    { key: 'feasts',      label: '歲時節慶', icon: <CalendarClock className="w-4 h-4" /> },
    { key: 'urgent',      label: '緊急祈願', icon: <Flame className="w-4 h-4" /> },
    { key: 'shower',      label: '沐浴車',   icon: <ShowerHead className="w-4 h-4" /> },
    { key: 'photos',      label: '多媒體管理',   icon: <ImageIcon className="w-4 h-4" /> },
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
    // 捐獻原本是「24 小時內的新捐款」，跟有沒有收到錢無關——放一天紅點就自己消失，
    // 還沒對帳的捐款反而看不到（2026-11-17 線上有 5 筆待匯款、紅點是 0）。改成跟點燈、祈福同一個標準。
    : key === 'donations' ? donations.filter(d => d.status === DonationStatus.PENDING).length
    : key === 'urgent'    ? urgentPending
    : 0;
  const totalPending = navItems.reduce((sum, n) => sum + badgeFor(n.key), 0);

  /**
   * 總覽「今天要做的事」的格子：**直接用 badgeFor**，不在總覽另抄一份狀態規則。
   * 只列這個角色看得到、而且還有待辦的分頁；字要講出是什麼動作。
   * 日後新增有紅點的分頁、這裡沒補字的話，退回「分頁名＋待處理」，不會靜默消失。
   */
  const TODO_LABEL: Partial<Record<Tab, string>> = {
    bookings: '問事待處理', lamps: '點燈待匯款', blessings: '祈福待匯款', fahui: '法會待匯款',
    donations: '捐獻待匯款', volunteer: '志工待聯絡', urgent: '緊急祈願待處理',
  };
  const overviewTodos = navItems
    .map(n => ({ tab: n.key, label: TODO_LABEL[n.key] ?? `${n.label}待處理`, count: badgeFor(n.key) }))
    .filter(t => t.count > 0);
  /** 等同點側邊欄那一項 */
  const goTab = (key: Tab) => { setTab(key); setNavOpen(false); };

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
    /**
     * 「常用」組內也有先後：**每天會用的排前面，檔期性的排後面**。
     * 法會報名與志工報名是跟著一場法會跑的——辦的時候天天開，辦完就閒置
     * （廟方 2026-10-13：「法會與志工暫時都沒有了，可以往後下移動」）。
     * 它們**沒有離開「常用」**：下一場法會一開又是每天要看的，
     * 到時候把這兩個 key 搬回 overview 後面就好，不必動別的地方。
     */
    // 緊急祈願排在捐獻之後、法會之前：它每天都可能有新的一筆，而且晚一天看就失去意義
    { title: '常用',       keys: ['overview', 'bookings', 'lamps', 'blessings', 'donations', 'urgent', 'fahui', 'volunteer'] },
    /**
     * 下面這幾組維持 2026-10-13 之前**畫面上實際的順序**，不是這串 keys 原本寫的順序。
     * 在那之前組內順序是跟著 allNavItems 走、這串 keys 的先後沒有作用，所以兩者本來
     * 就不一致（名單與帳務的 roster/members、網站內容的 shower 都差一位）。
     * 改成以 keys 為準的同時把它們設回原樣——**廟方每天在用的選單，沒有被要求就不要動**。
     */
    { title: '名單與帳務', keys: ['members', 'roster', 'repairs', 'receivables', 'vouchers', 'traffic'] },
    { title: '網站內容',   keys: ['bulletins', 'deities', 'about', 'relocation', 'faq', 'feasts', 'shower', 'photos', 'scripture'] },
    { title: '系統設定',   keys: ['siteinfo', 'analytics', 'social'] },
  ];
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const groupedKeys = NAV_GROUPS.reduce<Tab[]>((all, g) => all.concat(g.keys), []);
  // 日後新增分頁若忘了歸類，讓它落到最後一組，不要從選單裡靜默消失
  const ungrouped = navItems.filter(n => groupedKeys.indexOf(n.key) < 0);
  const navGroups = NAV_GROUPS
    .map((g, i) => ({
      title: g.title,
      /**
       * **組內順序以 `g.keys` 為準，不是 `allNavItems`。**
       * 原本是 `navItems.filter(...)`，順序其實跟著 allNavItems 走——
       * 那表示調整 NAV_GROUPS 裡的 keys 順序**畫面完全不會變**，
       * 而從程式碼看起來明明改對了（2026-10-13 調整順序時踩到）。
       * 一份清單只能有一個順序來源，放在 keys 這裡才是人會去改的地方。
       */
      items: g.keys.map(k => navItems.find(n => n.key === k)).filter((n): n is typeof navItems[number] => !!n)
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
        <div data-admin-topbar className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3 sticky top-0 z-10">
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
              {/* **要包一層箭頭函式**：直接寫 `onClick={fetchAll}` 的話，React 會把
                  滑鼠事件當成第一個參數傳進去，而事件物件是 truthy——於是
                  `initial` 永遠是真，判斷就失效了。這裡從錯誤畫面重載，整頁
                  loading 才是對的，所以明寫 true。
                  （2026-10-30 補上 @types/react 之後才看得見這個錯。） */}
              <button onClick={() => fetchAll(true)} className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg">重試</button>
            </div>
          ) : (
            <>
              {tab === 'overview'  && <OverviewTab todos={overviewTodos} onNavigate={goTab} canOpen={key => allowed.includes(key)}
                showMoney={allowed.includes('receivables')}
                blessingEvents={blessingEvents} blessingRegistrations={blessingRegistrations} fahuiCount={fahuiRegistrations.length}
                lampRegistrations={lampRegistrations} lampConfigs={lampConfigs} fahuiRegistrations={fahuiRegistrations} donations={donations}
                bookings={bookings} volunteerRegistrations={volunteerRegistrations} memberProfiles={memberProfiles} lineStats={lineStats}
                serviceBadges={{ bookings: badgeFor('bookings'), lamps: badgeFor('lamps'), blessings: badgeFor('blessings'), donations: badgeFor('donations') }} />}
              {tab === 'fahui'     && <FahuiTab registrations={fahuiRegistrations} onRefresh={fetchAll} />}
              {tab === 'volunteer' && <VolunteerTab registrations={volunteerRegistrations} onRefresh={fetchAll} />}
              {tab === 'bookings'  && <BookingsTab bookings={bookings} onStatusChange={handleStatusChange} updatingId={updatingId} memberProfiles={memberProfiles} />}
              {tab === 'donations' && <DonationsTab donations={donations} memberProfiles={memberProfiles} onRefresh={fetchAll} />}
              {tab === 'members'   && <MembersTab bookings={bookings} donations={donations} lampRegistrations={lampRegistrations} blessingRegistrations={blessingRegistrations} blessingEvents={blessingEvents} lampConfigs={lampConfigs} memberProfiles={memberProfiles} usersLastLogin={usersLastLogin} memberEmails={memberEmails} />}
              {tab === 'roster'    && <RosterTab sources={{ fahui: fahuiRegistrations, volunteers: volunteerRegistrations, members: memberProfiles, contacts: allContacts, bookings, donations, lamps: lampRegistrations, blessings: blessingRegistrations, registrations: allRegistrations }} onDone={() => fetchAll()} />}
              {tab === 'bulletins' && <BulletinsTab bulletins={bulletins} onRefresh={fetchAll} />}
              {tab === 'deities'  && <DeitiesTab deities={deitiesList} halls={deityHalls} onRefresh={fetchAll} />}
              {tab === 'photos'   && <PhotosTab siteImages={siteImages} heroSlides={heroSlidesList} onRefresh={fetchAll} />}
              {tab === 'scripture' && <ScriptureTab verses={scriptureVerses} onRefresh={fetchAll} />}
              {tab === 'about' && <AdminAboutTab />}
              {tab === 'relocation' && <AdminRelocationTab />}
              {tab === 'faq' && <AdminFaqTab />}
              {tab === 'feasts' && <AdminFeastsTab />}
              {tab === 'urgent' && <AdminUrgentTab onPendingChange={setUrgentPending} />}
              {tab === 'shower' && <AdminShowerTab />}
              {tab === 'siteinfo' && <AdminSiteInfoTab />}
              {tab === 'analytics' && <AnalyticsTab />}
              {tab === 'social' && <SocialTab />}
              {tab === 'lamps'     && <LampsTab configs={lampConfigs} registrations={lampRegistrations} onRefresh={fetchAll} memberProfiles={memberProfiles} />}
              {tab === 'blessings' && <BlessingsTab events={blessingEvents} registrations={blessingRegistrations} onRefresh={fetchAll} memberProfiles={memberProfiles}
                fahuiCount={fahuiRegistrations.length} onGoFahui={() => setTab('fahui')} />}
              {tab === 'repairs'      && <RepairProjectsTab onRefresh={fetchAll} />}
              {tab === 'vouchers'    && <AdminVouchersTab />}
              {tab === 'traffic'     && <TrafficTab bookings={bookings} donations={donations} lampRegistrations={lampRegistrations} lampConfigs={lampConfigs} blessingRegistrations={blessingRegistrations} blessingEvents={blessingEvents} fahuiRegistrations={fahuiRegistrations} volunteerRegistrations={volunteerRegistrations} />}
              {tab === 'receivables' && <ReceivablesTab lampRegistrations={lampRegistrations} lampConfigs={lampConfigs} blessingRegistrations={blessingRegistrations} blessingEvents={blessingEvents} fahuiRegistrations={fahuiRegistrations} donations={donations} memberProfiles={memberProfiles} onRefresh={() => fetchAll()} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
