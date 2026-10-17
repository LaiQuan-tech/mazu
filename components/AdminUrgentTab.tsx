/**
 * 後台「緊急祈願」——/urgent 送進來的登記
 *
 * ── 這一頁與其他報名分頁最大的不同：時間 ──
 * 別的分頁晚一天看沒關係，這裡每一筆都是「有人正在開刀／明天要考試／家裡剛走了人」。
 * 所以：**預設只顯示待處理**、待處理那幾筆排在最前面、而且**由舊到新**排——
 * 最久沒處理的最可能被漏掉，要讓它自己浮上來，不要被今天剛進來的壓在底下。
 *
 * 送出當下就會寄一封信到廟方信箱（api/notify-registration.ts），這一頁是備援
 * 與事後查核用的，不是唯一的入口。
 *
 * ── 不收費，所以沒有金額也沒有「已收款」 ──
 * 狀態只有待處理／已祈福／已取消（同問事那一套處理進度）。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Check, Undo2, X, Phone, Mail, Flame, Hospital, GraduationCap } from 'lucide-react';
import { getUrgentPrayers, updateUrgentPrayerStatus } from '../services/supabase';
import { queueConfirmEmail } from '../services/notifyConfirm';
import { UrgentPrayerKind, UrgentPrayerRecord, UrgentPrayerStatus } from '../types';
import { TAG_GOLD, TAG_STATE_DONE, TAG_STATE_OPEN, TAG_STATE_OVER } from './tagStyles';

const KIND_META: Record<UrgentPrayerKind, { label: string; Icon: React.FC<{ className?: string }> }> = {
  hospital: { label: '手術或住院', Icon: Hospital },
  exam:     { label: '升學考試',   Icon: GraduationCap },
  memorial: { label: '冥福接引',   Icon: Flame },
};

const statusClass = (s: UrgentPrayerStatus) =>
  s === UrgentPrayerStatus.DONE ? TAG_STATE_DONE
  : s === UrgentPrayerStatus.CANCELLED ? TAG_STATE_OVER
  : TAG_STATE_OPEN;

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** 一筆裡面有值的欄位才列出來——三種情況各有各的空欄位，一律印出來會是一片「—」 */
const detailsOf = (r: UrgentPrayerRecord): [string, string][] => {
  const rows: [string, string][] = [];
  const push = (k: string, v?: string) => { if (v && v.trim()) rows.push([k, v]); };
  push('農曆生日', r.birthDate);
  if (r.kind === 'memorial') {
    push('農曆卒日', r.deathDate);
    push('安奉位置', r.tabletPlace);
    rows.push(['三等親內', r.kinConfirmed ? '已確認' : '未勾選']);
  } else {
    push('地址', r.address);
    push(r.kind === 'hospital' ? '醫院名稱' : '學校／考場', r.placeName);
    push(r.kind === 'hospital' ? '醫院地址' : '考場地址', r.placeAddress);
    push('病房號', r.roomNo);
    push('考試日期', r.eventDate);
    push('准考證號', r.examNo);
    push('詳細現況', r.condition);
  }
  return rows;
};

const AdminUrgentTab: React.FC = () => {
  const [rows, setRows] = useState<UrgentPrayerRecord[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [onlyPending, setOnlyPending] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setRows(await getUrgentPrayers());
      setError('');
    } catch (err) {
      console.error(err);
      // 講出「資料表還沒建立」這個最可能的原因，不要只說失敗——
      // migration 是人在 Supabase 後台手動跑的，一定會有還沒跑的那段時間
      setError('讀取失敗。若尚未執行 supabase/migrations/urgent_prayers.sql，請先在 Supabase SQL Editor 跑一次。');
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mark = async (id: string, status: UrgentPrayerStatus) => {
    setBusy(true);
    try {
      await updateUrgentPrayerStatus(id, status);
      setRows(prev => prev && prev.map(r => (r.id === id ? { ...r, status } : r)));
      /*
        **只有「已祈福」這個方向要寄信。** 改回待處理不寄——沒有「取消確認信」
        這種東西，寄一封說「其實還沒點」只會讓信眾更混亂（同確認信那條原則）。
        攢 6 秒再送、依收件人分組，所以廟方連按五列只會寄出一封。
        後端靠 confirm_sent_at 蓋章擋重寄，改來改去不會變成一疊一樣的信。
      */
      if (status === UrgentPrayerStatus.DONE) queueConfirmEmail('urgent_prayers', id);
    } catch (err) {
      console.error(err);
      setError('更新失敗，請再試一次。');
    } finally {
      setBusy(false);
    }
  };

  const list = useMemo(() => {
    if (!rows) return [];
    const shown = onlyPending ? rows.filter(r => r.status === UrgentPrayerStatus.PENDING) : rows;
    // 待處理優先，組內由舊到新：最久沒處理的最可能被漏掉，讓它浮上來
    return [...shown].sort((a, b) => {
      const ap = a.status === UrgentPrayerStatus.PENDING ? 0 : 1;
      const bp = b.status === UrgentPrayerStatus.PENDING ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return ap === 0
        ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt);
    });
  }, [rows, onlyPending]);

  const pendingCount = rows ? rows.filter(r => r.status === UrgentPrayerStatus.PENDING).length : 0;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1 flex items-center gap-2">
          <Flame className="w-5 h-5 text-temple-red" aria-hidden="true" />
          緊急祈願
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          信眾從前台
          <a href="/urgent" target="_blank" rel="noopener noreferrer" className="font-medium text-temple-red hover:underline mx-1">/urgent</a>
          登記的急難祈願。每一筆送出時都會立刻寄一封信到廟方信箱，這一頁是備援與事後查核用的。
          <strong className="text-temple-dark">本服務不收費</strong>，所以沒有金額也沒有收款狀態。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className={`px-3 py-1 rounded-full text-sm ${pendingCount > 0 ? TAG_STATE_OPEN : TAG_GOLD}`}>
          待處理 {pendingCount} 筆
        </span>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={onlyPending} onChange={e => setOnlyPending(e.target.checked)}
            className="w-4 h-4 accent-[#7C5C1E]" />
          只看待處理
        </label>
        <button type="button" onClick={load} disabled={busy}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />重新整理
        </button>
      </div>

      {error && <p role="alert" className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</p>}

      {rows === null ? (
        <p className="py-12 text-center text-gray-400">載入中…</p>
      ) : list.length === 0 ? (
        <p className="py-12 text-center text-gray-400 border border-dashed border-gray-300 rounded-lg">
          {onlyPending ? '沒有待處理的祈願登記。' : '目前沒有祈願登記。'}
        </p>
      ) : (
        <div className="space-y-3">
          {list.map(r => {
            const { label, Icon } = KIND_META[r.kind] ?? KIND_META.hospital;
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-temple-red shrink-0" aria-hidden="true" />
                  <span className="font-bold text-gray-800">{r.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${TAG_GOLD}`}>{label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusClass(r.status)}`}>{r.status}</span>
                  <span className="text-xs text-gray-400 ml-auto">{fmt(r.createdAt)}</span>
                </div>

                <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm mb-3">
                  {detailsOf(r).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="text-gray-400 shrink-0">{k}</dt>
                      <dd className="text-gray-700 break-words">{v}</dd>
                    </div>
                  ))}
                </dl>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1.5 text-temple-red hover:underline">
                    <Phone className="w-4 h-4" aria-hidden="true" />{r.phone}
                  </a>
                  {/* 三種狀態分開講。少了這一行，「沒留信箱所以沒寄」與「寄了」
                      在畫面上一模一樣，工作人員會以為信眾都知道了——而這封信
                      存在的理由就是讓信眾知道（同 MemberInfoModal 那條） */}
                  <span className="inline-flex items-center gap-1.5 text-gray-500">
                    <Mail className="w-4 h-4" aria-hidden="true" />
                    {r.confirmSentAt
                      ? `已寄出通知　${r.email ?? ''}`
                      : r.email
                        ? `標記已祈福後會寄到 ${r.email}`
                        : '未留信箱，不會寄通知'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                  {r.status === UrgentPrayerStatus.PENDING ? (
                    <>
                      <button type="button" disabled={busy}
                        onClick={() => mark(r.id, UrgentPrayerStatus.DONE)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-temple-red text-white text-sm font-medium hover:bg-[#5C4310] disabled:opacity-50">
                        <Check className="w-4 h-4" aria-hidden="true" />標記已祈福
                      </button>
                      {/* 取消做成小圖示、跟主按鈕拉開：破壞性語意不能挨著每天按的那顆
                          （同點燈祈福的 PaymentActions） */}
                      <button type="button" disabled={busy} title="取消這筆登記"
                        onClick={() => mark(r.id, UrgentPrayerStatus.CANCELLED)}
                        className="ml-auto p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50">
                        <span className="sr-only">取消這筆登記</span>
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <button type="button" disabled={busy}
                      onClick={() => mark(r.id, UrgentPrayerStatus.PENDING)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-50">
                      <Undo2 className="w-4 h-4" aria-hidden="true" />還原為待處理
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminUrgentTab;
