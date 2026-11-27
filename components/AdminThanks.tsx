/**
 * 後台的感謝狀：編號欄＋預覽／列印／發送（2026-11-27 廟方）。
 *
 * 法會、點燈、祈福、捐獻四份名單、以及應收管理都插同一個 `<ThanksCell>`，
 * 規則只寫一次：
 * - **編號是財務自填**（不自動配號：廟方紙本感謝狀本來就有自己的流水號）。
 * - **編號沒填不能標記已收款**——擋在 `PaymentActions` 的 `needThanksNo`，
 *   各處的 handler 也再檢查一次（應收管理那顆按鈕不經過 PaymentActions）。
 * - **沒收款不能發送**：感謝狀是謝「已經護持」，錢還沒到就寄，等於先開了收據。
 * - 預覽、列印、發送都在同一個視窗，看到的就是會印出／寄出的那一張。
 *
 * 列印與發送前都會先存一份快照到 thanks_certificates（同一個編號永遠同一個 id，
 * 信眾手上的連結不會因為重存而失效）。為什麼不存在報名表上，見那支 SQL 的檔頭。
 *
 * ── 合開：同一個編號＝同一張（廟方 2026-11-27）──
 * 會員幫很多親友報名，廟方通常只開一張感謝狀。親友自動併進報名人那張（見下），
 * 報名人自己的幾筆（例如點燈＋捐獻）則由財務填**同一個號碼**合開。合開的那一張：
 * - 受謝人寫「報名人　闔家」（廟方選的）。報名人＝標「本人」的那一筆，沒有就是最早那筆。
 * - 項目逐一列出，金額加總；跨服務也可以（點燈＋捐獻同一號）。
 * - 發送只發一次，發給報名人；整組每一筆都收款了才能發。
 * - **親友列（稱謂不是「本人」）完全不顯示感謝狀**，也不必填編號就能標記已收款：
 *   自動併進同一次送出的報名人那一張（同一張表、同一支電話、建立時間十分鐘內）。
 *   同一次送出裡沒有「本人」的話，親友就沒有感謝狀——前台第一張卡預設就是本人，實務上少見。
 * - 合開的那張只有一個「感謝狀」按鈕、標「合開 N 筆」，在報名人那一列。
 * 組員從 `setThanksPool` 來：AdminDashboard 把四種報名攤平後（buildIncomeRows）整包交過來，
 * 單一服務的名單本身看不到別的服務。
 */
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Award, Printer, Send, X, Link2, Check } from 'lucide-react';
import {
  supabase, getThanksCertificates, saveThanksCertificate, updateThanksLetter,
  type ThanksCertificateRecord, type ThanksSourceTable,
} from '../services/supabase';
import { getReceiptSettings } from '../services/receipts';
import { ThanksCertificateView, ThanksCertificatePrint, type ThanksCertData, type ThanksCertTemple } from './ThanksCertificate';

export const TEMPLE_NAME = '和聖壇';
export const THANKS_ORIGIN = 'https://heshengtan.tw';
export const thanksUrl = (id: string) => `${THANKS_ORIGIN}/thanks/${id}`;

/** 「先填感謝狀編號」：四處 handler 共用同一句 */
export const NEED_THANKS_NO = '請先填寫感謝狀編號，才能標記已收款。';

// ── 已存的感謝狀：整個後台共用一份，任何一處存了，其他名單也立刻看得到 ──
let certs = new Map<string, ThanksCertificateRecord>();
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(f => f());
const load = () => {
  loading ??= getThanksCertificates().then(m => { certs = m; emit(); });
  return loading;
};
const putCert = (c: ThanksCertificateRecord) => {
  certs = new Map(certs).set(c.no, c);
  emit();
};
const useCerts = () => {
  useEffect(() => { void load(); }, []);
  return useSyncExternalStore(f => { listeners.add(f); return () => listeners.delete(f); }, () => certs);
};

// ── 所有報名（已取消的不算），用來找同一個編號的其他筆 ──
let pool: ThanksSource[] = [];
const poolListeners = new Set<() => void>();
export const setThanksPool = (list: ThanksSource[]) => { pool = list; poolListeners.forEach(f => f()); };
const usePool = () => useSyncExternalStore(f => { poolListeners.add(f); return () => poolListeners.delete(f); }, () => pool);

const trimNo = (n?: string) => (n ?? '').trim();
const sameRow = (a: ThanksSource, b: ThanksSource) => a.table === b.table && a.id === b.id;

export interface ThanksGroup {
  no: string;
  /** 報名人：發送對象，也是快照的 source */
  primary: ThanksSource;
  members: ThanksSource[];
  name: string; item: string; amount: number;
  /** 還沒收款的筆數（整組收齊才能發送） */
  unpaid: number;
}

/**
 * 親友那一列：報名表上稱謂不是「本人」（兒女、配偶…）。**親友列完全不顯示感謝狀**，
 * 也不必填編號就能標記已收款——他們併在報名人那一張裡（廟方 2026-11-27：
 * 「親友在報名清單上根本不要顯示感謝狀」）。沒有稱謂的舊資料當作報名人。
 */
export const isThanksRelative = (label?: string): boolean => !!label && label.trim() !== '本人';

/** 同一次送出：前台表單一次送出的每一筆都存報名人的電話，建立時間相差幾秒 */
const SAME_SUBMIT_MS = 10 * 60_000;
const timeOf = (iso?: string) => (iso ? new Date(iso).getTime() : NaN);

/** 親友這一列屬於哪一位報名人：同一張表、同一支電話、時間最接近的「本人」那筆（十分鐘內） */
export const thanksOwnerOf = (row: ThanksSource, all: ThanksSource[]): ThanksSource | null => {
  if (!isThanksRelative(row.label) || !row.phone) return null;
  const t = timeOf(row.createdAt);
  let best: ThanksSource | null = null; let gap = Infinity;
  for (const r of all) {
    if (r.table !== row.table || isThanksRelative(r.label) || r.phone !== row.phone) continue;
    const d = Math.abs(timeOf(r.createdAt) - t);
    if (d <= SAME_SUBMIT_MS && d < gap) { best = r; gap = d; }
  }
  return best;
};

/**
 * 一張感謝狀的成員：填了這個編號的報名人（可以跨服務，例如點燈＋捐獻同一號），
 * 加上掛在他們底下的親友。名單還沒傳進來時至少有自己這一筆。
 */
export const buildThanksGroup = (src: ThanksSource, all: ThanksSource[]): ThanksGroup => {
  const no = trimNo(src.no);
  const heads = all.filter(r => trimNo(r.no) === no && !isThanksRelative(r.label));
  if (!heads.some(r => sameRow(r, src))) heads.push(src);
  const kin = all.filter(r => { const o = thanksOwnerOf(r, all); return !!o && heads.some(h => sameRow(h, o)); });
  const found = [...heads, ...kin.filter(k => !heads.some(h => sameRow(h, k)))];
  const members = found
    .slice().sort((a, b) =>
      Number(b.label === '本人') - Number(a.label === '本人')
      || (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
  const primary = members[0];
  const names = [...new Set(members.map(m => m.name))];
  let item: string;
  if (names.length === 1) item = [...new Set(members.map(m => m.item))].join('、');
  else {
    // 「光明燈（王美玲、王大明）、太歲燈（王小華）」：同一個項目的人收在一起
    const byItem = new Map<string, string[]>();
    members.forEach(m => {
      const ns = byItem.get(m.item) ?? [];
      if (!ns.includes(m.name)) ns.push(m.name);
      byItem.set(m.item, ns);
    });
    item = [...byItem].map(([it, ns]) => `${it}（${ns.join('、')}）`).join('、');
  }
  return {
    no, primary, members, item,
    name: names.length > 1 ? `${primary.name}　闔家` : primary.name,
    amount: members.reduce((t, m) => t + (m.amount || 0), 0),
    unpaid: members.filter(m => !m.paid).length,
  };
};

let templeCache: Promise<ThanksCertTemple> | null = null;
const getTemple = () => templeCache ??= getReceiptSettings()
  .then(s => ({ name: TEMPLE_NAME, thanksText: s.thanksText }))
  .catch(() => ({ name: TEMPLE_NAME, thanksText: '' }));

const todayIso = () => {
  // 台灣日期：toISOString 是 UTC，半夜八點前會差一天
  const d = new Date(Date.now() + 8 * 3600_000);
  return d.toISOString().slice(0, 10);
};

const fmtSent = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export interface ThanksSource {
  table: ThanksSourceTable;
  id: string;
  /** 目前存在報名紀錄上的編號 */
  no?: string;
  name: string;
  /** 護持項目（燈名、活動名、捐款類別） */
  item: string;
  amount: number;
  paid: boolean;
  /** 報名表上的稱謂（「本人」那筆是報名人，合開時寫在感謝狀上） */
  label?: string;
  /** 電話：親友列靠它（加上建立時間）找到同一次送出的報名人 */
  phone?: string;
  createdAt?: string;
}

/**
 * 名單上那一格：編號輸入框＋（有編號才出現的）「感謝狀」按鈕。
 * `onSaved` 讓呼叫端重抓資料——標記已收款的按鈕要看到新編號才會解鎖。
 */
/** `bare`：放在自己那一欄（表頭已寫「感謝狀」）時不再印一次「感謝狀」字樣 */
export const ThanksCell: React.FC<{ src: ThanksSource; onSaved?: () => void; compact?: boolean; bare?: boolean }> = (props) =>
  // 親友列什麼都不畫（hook 在 ThanksCellInner 裡，這裡提早 return 不違反 hook 規則）
  isThanksRelative(props.src.label) ? null : <ThanksCellInner {...props} />;

const ThanksCellInner: React.FC<{ src: ThanksSource; onSaved?: () => void; compact?: boolean; bare?: boolean }> = ({ src, onSaved, compact, bare }) => {
  const all = useCerts();
  const rows = usePool();
  const cert = all.get(trimNo(src.no));
  const group = trimNo(src.no) ? buildThanksGroup(src, rows) : null;
  const [val, setVal] = useState(src.no ?? '');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { setVal(src.no ?? ''); }, [src.no]);

  const save = async () => {
    const next = val.trim();
    if (next === (src.no ?? '')) return;
    setSaving(true);
    try { await updateThanksLetter(src.table, src.id, next); onSaved?.(); }
    catch (e) { alert(e instanceof Error && e.message ? e.message : '感謝狀編號儲存失敗'); setVal(src.no ?? ''); }
    finally { setSaving(false); }
  };

  const no = (src.no ?? '').trim();
  const missing = !no && !src.paid;
  /** 同一號有好幾筆「本人」（例如同一人點燈＋捐獻）時，按鈕只放在第一筆；其他筆只留編號格 */
  const merged = !!group && group.members.length > 1;
  const isPrimary = !group || sameRow(group.primary, src);
  return (
    <div className={`flex items-center gap-1 ${compact ? '' : 'flex-wrap'}`} onClick={e => e.stopPropagation()}>
      <label className="inline-flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
        <span className={bare ? 'sr-only' : 'sr-only sm:not-sr-only'}>感謝狀</span>
        <input
          value={val} onChange={e => setVal(e.target.value)} onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          disabled={saving} maxLength={20} placeholder="編號" aria-label="感謝狀編號"
          title={missing ? '先填感謝狀編號才能標記已收款'
            : merged && !isPrimary ? `併入 ${group!.primary.name} 那一列的感謝狀` : '感謝狀編號'}
          className={`w-16 px-1.5 py-1 rounded border text-xs text-gray-800 bg-white focus:outline-none focus:ring-1 focus:ring-temple-gold disabled:opacity-50 ${
            missing ? 'border-amber-400' : 'border-gray-200'}`} />
      </label>
      {no && isPrimary && (
        <button type="button" onClick={() => setOpen(true)}
          title={cert?.sentAt ? `已發送 ${fmtSent(cert.sentAt)}` : '預覽、列印、發送感謝狀'}
          className="inline-flex items-center gap-0.5 px-2 py-1 rounded border border-temple-red/40 text-temple-red text-xs font-medium hover:bg-temple-red/5 whitespace-nowrap">
          <Award className="w-3.5 h-3.5" aria-hidden="true" />
          {cert?.sentAt ? <>已發送<Check className="w-3 h-3" aria-hidden="true" /></> : '感謝狀'}
        </button>
      )}
      {merged && isPrimary && (
        <span className="text-[11px] text-temple-dark/70 whitespace-nowrap" title={group.members.map(m => m.name).join('、')}>
          合開 {group.members.length} 筆
        </span>
      )}
      {open && group && <ThanksModal group={group} cert={cert} onClose={() => setOpen(false)} />}
    </div>
  );
};

const ThanksModal: React.FC<{ group: ThanksGroup; cert?: ThanksCertificateRecord; onClose: () => void }> = ({ group, cert, onClose }) => {
  const src = { ...group, table: group.primary.table, id: group.primary.id, paid: group.unpaid === 0 };
  const [temple, setTemple] = useState<ThanksCertTemple>({ name: TEMPLE_NAME, thanksText: '' });
  const [busy, setBusy] = useState<'' | 'print' | 'send' | 'link'>('');
  const [printing, setPrinting] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { void getTemple().then(setTemple); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  // 已發送過、而且內容沒變：沿用當時的日期，重印出來跟信眾手上那張一樣
  const same = cert && cert.no === src.no && cert.name === src.name && cert.item === src.item && cert.amount === src.amount;
  const data: ThanksCertData = { no: src.no, name: src.name, item: src.item, amount: src.amount, date: same ? cert!.date : todayIso() };

  const snapshot = async () => {
    const saved = await saveThanksCertificate(src.table, src.id, {
      no: data.no, name: data.name, item: data.item, amount: data.amount, date: data.date,
      templeName: temple.name, thanksText: temple.thanksText,
    });
    putCert(saved);
    return saved;
  };

  const doPrint = async () => {
    setBusy('print');
    try { await snapshot(); setPrinting(true); }
    catch (e) { alert(e instanceof Error && e.message ? e.message : '感謝狀儲存失敗'); }
    finally { setBusy(''); }
  };

  const doCopy = async () => {
    setBusy('link');
    try {
      const saved = await snapshot();
      await navigator.clipboard.writeText(thanksUrl(saved.id));
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch (e) { alert(e instanceof Error && e.message ? e.message : '複製連結失敗'); }
    finally { setBusy(''); }
  };

  const doSend = async () => {
    if (!src.paid) return;
    const again = cert?.sentAt ? `\n\n這張在 ${fmtSent(cert.sentAt)} 已經發過一次，確定要再發？` : '';
    if (!confirm(`把感謝狀第 ${src.no} 號發給 ${group.primary.name}？\n（有綁 LINE 就用 LINE，沒有就寄 email）${again}`)) return;
    setBusy('send');
    try {
      await snapshot();
      const { data: s } = await supabase.auth.getSession();
      const r = await fetch('/api/notify-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
        body: JSON.stringify({ table: src.table, id: [src.id], kind: 'thanks' }),
      });
      const j = await r.json().catch(() => ({} as Record<string, unknown>));
      if (!r.ok || !j.ok) {
        alert(typeof j.error === 'string' && j.error ? j.error : `發送失敗（${r.status}）`);
        return;
      }
      putCert({ ...(certs.get(src.no) as ThanksCertificateRecord), sentAt: String(j.sentAt || new Date().toISOString()), sentVia: String(j.via || '') });
      alert(j.via === 'line' ? '已用 LINE 發送。' : '已寄出 email。');
    } catch (e) {
      alert(e instanceof Error && e.message ? e.message : '發送失敗');
    } finally { setBusy(''); }
  };

  return createPortal(
    <div className="thx-modal fixed inset-0 z-[80] overflow-y-auto bg-black/50" onClick={onClose}>
      <div className="min-h-full flex items-start sm:items-center justify-center p-3 sm:p-6">
        <div role="dialog" aria-modal="true" aria-label={`感謝狀第 ${src.no} 號`}
          className="w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-bold text-temple-dark">感謝狀　第 {src.no} 號</h3>
            <button type="button" onClick={onClose} aria-label="關閉" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-3 sm:p-4 bg-gray-50"><ThanksCertificateView data={data} temple={temple} /></div>
          <div className="px-4 py-3 border-t border-gray-100 space-y-2">
            {cert?.sentAt && (
              <p className="text-xs text-gray-500">
                已於 {fmtSent(cert.sentAt)} 用{cert.sentVia === 'line' ? ' LINE ' : ' email '}發送
                {!same && <span className="text-amber-700">；內容已改過，信眾打開連結會看到新的版本</span>}
              </p>
            )}
            {group.members.length > 1 && (
              <p className="text-xs text-gray-500">
                合開 {group.members.length} 筆：{group.members.map(m => `${m.name}（${m.item}）`).join('、')}。發送對象是 {group.primary.name}。
              </p>
            )}
            {!src.paid && <p className="text-xs text-amber-700">
              {group.members.length > 1 ? `其中 ${group.unpaid} 筆還沒標記已收款，整組收齊後才能發送。` : '還沒標記已收款，收到款項後才能發送。'}
            </p>}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={doCopy} disabled={!!busy}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}{copied ? '已複製' : '複製連結'}
              </button>
              <button type="button" onClick={doPrint} disabled={!!busy}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-temple-red text-sm text-temple-red hover:bg-temple-red/5 disabled:opacity-50">
                <Printer className="w-4 h-4" />{busy === 'print' ? '準備中…' : '列印'}
              </button>
              <button type="button" onClick={doSend} disabled={!!busy || !src.paid}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-temple-red text-white text-sm font-medium hover:bg-[#5C4310] disabled:opacity-50">
                <Send className="w-4 h-4" />{busy === 'send' ? '發送中…' : cert?.sentAt ? '再發一次' : '發送給信眾'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {printing && <ThanksCertificatePrint data={data} temple={temple} onDone={() => setPrinting(false)} />}
    </div>,
    document.body,
  );
};
