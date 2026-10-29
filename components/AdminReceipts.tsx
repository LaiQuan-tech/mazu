/**
 * 收據的開立、補印與作廢。資料層見 services/receipts.ts，版面見 ReceiptPrint.tsx。
 *
 * ── 為什麼開立對話框要能改抬頭／電話／地址 ──
 * 預設帶報名人的資料，但**收據抬頭不一定等於報名人**：女兒幫父親點燈，收據要開給
 * 父親；也常見開給「○○家族」或公司行號。所以三個欄位都可以改，改的是這張收據，
 * 不會回頭動到報名紀錄。
 *
 * ── 已經開過收據的要擋在眼前，但不能擋死 ──
 * 同一筆報名開兩張收據是重大的帳務錯誤，但「作廢後重開」是正常流程，
 * 所以是**警告不是禁止**（同 voucher_items_source_idx 刻意不做 UNIQUE 的理由）。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { X, Printer, Search, Ban } from 'lucide-react';
import {
  ReceiptItem, ReceiptRecord, receiptTotal, amountToChinese,
  createReceipt, getReceipts, voidReceipt, getReceiptSettings, saveReceiptSettings,
  ReceiptSettings, DEFAULT_RECEIPT_SETTINGS,
} from '../services/receipts';
import { getSiteInfo, DEFAULT_SITE_INFO } from '../services/supabase';
import ReceiptPrint, { ReceiptTempleInfo, printReceipt } from './ReceiptPrint';

const money = (n: number) => `NT$ ${n.toLocaleString()}`;

/** 把廟方基本資料與收據設定併成列印要的那一包 */
export const useTempleInfo = (): ReceiptTempleInfo => {
  const [info, setInfo] = useState(DEFAULT_SITE_INFO);
  const [rs, setRs] = useState(DEFAULT_RECEIPT_SETTINGS);
  useEffect(() => {
    getSiteInfo().then(setInfo).catch(() => {});
    getReceiptSettings().then(setRs).catch(() => {});
  }, []);
  return {
    name: '台北和聖壇',
    thanksText: rs.thanksText,
    certNo: rs.certNo,
    address: info.address,
    phone: info.phone,
    taxId: rs.taxId,
    signTitles: [rs.signTitle1, rs.signTitle2],
  };
};

const field = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red';

// ── 開立 ──────────────────────────────────────────────────────────────────

/** 一個人要開的那一張收據。**分組是在呼叫端做的**（財務頁知道每一列屬於誰）。 */
export interface ReceiptGroup {
  key: string;
  title: string;
  phone?: string;
  address?: string;
  items: ReceiptItem[];
}

export const ReceiptIssueDialog: React.FC<{
  /**
   * 要開的收據，**一組一張**。
   *
   * 勾選跨到不同人時必須分成好幾張——原本是全部塞進同一張、抬頭掛第一個人的
   * 名字（廟方 2026-10-30 發現多選時的問題時一併查出來）。那是錯的：收據是
   * 給特定一個人的憑證，把別人的錢算在他頭上，金額與抬頭就對不起來了。
   */
  groups: ReceiptGroup[];
  /** 這幾筆裡已經開過收據的，key 是 `table:id` */
  already: Map<string, ReceiptRecord>;
  temple: ReceiptTempleInfo;
  onClose: () => void;
  onIssued: () => void;
}> = ({ groups, already, temple, onClose, onIssued }) => {
  /**
   * 經手人要印在收據上，而 `admin_profiles` 沒有姓名欄位（只有 user_id 與 role），
   * auth 的信箱又不是人名。所以讓財務自己填，**記在這台電腦上**下次自動帶入——
   * 每天要開幾十張，每張都重打姓名不合理。
   * 用 localStorage 不是資料庫：這是「這台電腦前面坐的是誰」，不是廟方的設定。
   */
  const [operator, setOperator] = useState(() => {
    try { return localStorage.getItem('receipt_operator') ?? ''; } catch { return ''; }
  });
  useEffect(() => {
    try { localStorage.setItem('receipt_operator', operator); } catch { /* 無痕視窗會丟錯，不影響開立 */ }
  }, [operator]);

  const single = groups.length === 1;
  /** 只有一張時才給改抬頭／電話／地址；多張時各自帶各自的，見下面的說明 */
  const [title, setTitle] = useState(groups[0]?.title ?? '');
  const [phone, setPhone] = useState(groups[0]?.phone ?? '');
  const [address, setAddress] = useState(groups[0]?.address ?? '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  /** 開完之後要印的那幾張。印完才關對話框，不然元件被卸載就印不出來了 */
  const [printing, setPrinting] = useState<ReceiptRecord[] | null>(null);

  const allItems = groups.flatMap(g => g.items);
  const grandTotal = receiptTotal(allItems);
  const hasReceipt = (i: ReceiptItem) =>
    !!(i.sourceTable && i.sourceId && already.has(`${i.sourceTable}:${i.sourceId}`));

  /**
   * **一張一張判斷，不要整批擋掉。**
   *
   * 「同一筆不能開兩張」是對的（廟方 2026-10-30：「可以一直開，流水號還不同，
   * 這應該是 bug」——同一筆錢有兩張有效的連號收據，帳面上就是收了兩次）。
   * 但我第一版把**整批**都擋下來：選了三個人、其中一個先前開過，另外兩個也
   * 跟著不能開（廟方 2026-10-30：「要怎麼一次印三張收據」）。
   * 那是把「這一筆不能重開」錯誤地放大成「這一次什麼都不能做」。
   *
   * 現在：沒開過的照常開，已開過的改成補印同一張，最後**一起印**——
   * 使用者要的三張還是三張，而且每一張的流水號都正確。
   *
   * 一組只要有任何一筆開過就整組算「已開過」：收據是綁著一組明細開出去的，
   * 沒辦法只補其中一筆。
   */
  const blocked = groups.filter(g => g.items.some(hasReceipt));
  const issuable = groups.filter(g => !g.items.some(hasReceipt));
  const dupes = allItems.filter(hasReceipt);
  /** 已開過的那幾組對應的收據（去重），補印用 */
  const existing: ReceiptRecord[] = [...new Map<string, ReceiptRecord>(
    dupes.map(i => {
      const rec = already.get(`${i.sourceTable}:${i.sourceId}`)!;
      return [rec.id, rec];
    }),
  ).values()];
  /** 按下去總共會印幾張 */
  const willPrint = issuable.length + existing.length;

  const submit = async () => {
    if (single && !title.trim()) { setErr('收據抬頭不能空白'); return; }
    const blank = groups.find(g => !g.title.trim());
    if (!single && blank) { setErr('有一組的抬頭是空白的，請先取消那一筆的勾選'); return; }
    setErr(''); setSaving(true);
    try {
      /**
       * **一張一張依序開，不要 Promise.all。** 流水號是在資料庫端用一列
       * 計數器配的，併發送出去雖然不會重號（ON CONFLICT 會鎖住那一列），
       * 但回來的順序不保證，列印出來的號碼就會亂跳。依序開，印出來的順序
       * 與號碼順序一致。
       */
      const made: ReceiptRecord[] = [];
      for (const g of issuable) {
        const r = await createReceipt({
          title: (single ? title : g.title).trim(),
          items: g.items,
          phone: (single ? phone : (g.phone ?? '')).trim() || undefined,
          address: (single ? address : (g.address ?? '')).trim() || undefined,
          note: note.trim() || undefined,
          byName: operator || undefined,
        });
        if (r) made.push(r);
      }
      // 新開的與補印的一起印，依流水號排序——印出來的順序與號碼一致
      const all = [...made, ...existing].sort((a, b) => a.receiptNo.localeCompare(b.receiptNo));
      if (all.length > 0) { setPrinting(all); if (made.length > 0) onIssued(); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '開立失敗');
    } finally {
      setSaving(false);
    }
  };

  if (printing) {
    const label = printing.length === 1
      ? printing[0].receiptNo
      : `${printing[0].receiptNo}～${printing[printing.length - 1].receiptNo}`;
    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-3">
            <p className="font-semibold text-gray-800">
              已開立 {printing.length > 1 ? `${printing.length} 張（${label}）` : label}
            </p>
            <p className="text-xs text-gray-500">
              {printing.length > 1 ? '一張收據一頁，共 ' + printing.length + ' 頁。' : ''}
              列印對話框沒出現的話，請按下面重印。
            </p>
            <div className="flex gap-2">
              <button onClick={() => printReceipt(label)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600">再印一次</button>
              <button onClick={onClose}
                className="flex-1 py-2.5 bg-temple-red text-white rounded-lg text-sm font-medium">完成</button>
            </div>
          </div>
        </div>
        <ReceiptPrint receipt={printing} temple={temple} />
      </>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">
            開立收據{!single && <span className="ml-2 text-sm font-normal text-gray-500">{groups.length} 張</span>}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {existing.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-300 p-3.5 text-sm text-amber-900 space-y-2">
              <p>
                其中 <strong>{existing.length} 張已經開過了</strong>（{existing.map(r => r.receiptNo).join('、')}）。
                <span className="block text-xs mt-1 text-amber-800">
                  那幾張會<strong>補印原來那一張、流水號不變</strong>，不會重新配號——
                  同一筆錢有兩張有效的連號收據，帳面上就是收了兩次。
                  真的要換新的，請先到「收據」畫面把舊的作廢再回來。
                </span>
              </p>
            </div>
          )}

          {/* 要開哪幾張、每張有什麼。多人時這一段就是主畫面 */}
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
            {groups.map(g => {
              const old = g.items.map(i => i.sourceTable && i.sourceId
                ? already.get(`${i.sourceTable}:${i.sourceId}`) : undefined).find(Boolean);
              return (
              <div key={g.key} className="p-3">
                {!single && (
                  <p className="text-sm font-semibold text-gray-800 mb-1.5 flex items-center gap-2 flex-wrap">
                    {g.title}
                    <span className="text-xs font-normal text-gray-400">{g.phone || '沒有電話'}</span>
                    {old && (
                      <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">
                        補印 {old.receiptNo}
                      </span>
                    )}
                  </p>
                )}
                <table className="w-full text-sm">
                  <tbody>
                    {g.items.map((i, n) => (
                      <tr key={n}>
                        <td className="py-1 text-gray-600">{i.label}</td>
                        <td className="py-1 text-right text-gray-800 font-medium whitespace-nowrap">NT$ {i.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    {g.items.length > 1 && (
                      <tr className="border-t border-gray-100">
                        {/* 合計由明細加總，不另存一個數字（同財務憑證那條原則） */}
                        <td className="pt-1 text-xs text-gray-400">小計</td>
                        <td className="pt-1 text-right font-bold text-gray-900 whitespace-nowrap">NT$ {receiptTotal(g.items).toLocaleString()}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              );
            })}
            {!single && (
              <div className="p-3 bg-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-500">{groups.length} 張合計</span>
                <span className="font-bold text-gray-900">NT$ {grandTotal.toLocaleString()}</span>
              </div>
            )}
            {single && (
              <div className="p-3 bg-gray-50 text-right">
                <span className="text-xs text-gray-500 mr-2">{amountToChinese(grandTotal)}</span>
                <span className="font-bold text-gray-900">NT$ {grandTotal.toLocaleString()}</span>
              </div>
            )}
          </div>

          {single ? (
            <>
              <label className="block">
                <span className="block text-xs font-medium text-gray-600 mb-1">收據抬頭 *</span>
                <input value={title} onChange={e => setTitle(e.target.value)} className={field} />
                <span className="block text-[11px] text-gray-400 mt-1">
                  可以跟報名人不同（例如開給長輩或「○○家族」）。改這裡不會動到報名紀錄。
                </span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium text-gray-600 mb-1">電話</span>
                  <input value={phone} onChange={e => setPhone(e.target.value)} className={field} />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-gray-600 mb-1">經手人</span>
                  <input value={operator} onChange={e => setOperator(e.target.value)} className={field}
                    placeholder="你的名字" />
                </label>
              </div>
              <label className="block">
                <span className="block text-xs font-medium text-gray-600 mb-1">地址</span>
                <input value={address} onChange={e => setAddress(e.target.value)} className={field}
                  placeholder="這幾筆報名與會員資料都沒有留地址，請手動填" />
                {!groups[0]?.address && (
                  <span className="block text-[11px] text-amber-700 mt-1">
                    系統查不到地址——報名表的地址是選填，這幾筆都沒填，會員資料裡也沒有。
                  </span>
                )}
              </label>
            </>
          ) : (
            <>
              <label className="block">
                <span className="block text-xs font-medium text-gray-600 mb-1">經手人</span>
                <input value={operator} onChange={e => setOperator(e.target.value)} className={field}
                  placeholder="你的名字" />
              </label>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                多張一起開時，每一張的抬頭／電話／地址各自取該信眾的報名資料（沒有就退回會員資料）。
                <strong className="text-gray-500">要改某一張的抬頭</strong>（例如開給長輩或「○○家族」），
                請只勾那一個人、單獨開一張。
              </p>
            </>
          )}

          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">
              備註（印在收據右欄{!single && '，每一張都會印上'}）
            </span>
            <input value={note} onChange={e => setNote(e.target.value)} className={field}
              placeholder="例如：現金、代繳" />
          </label>

          {err && <p className="text-sm text-temple-red">{err}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm">取消</button>
            <button onClick={submit} disabled={saving || willPrint === 0}
              className="flex-1 py-2.5 bg-temple-red text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? '開立中…'
                : issuable.length === 0 ? `補印 ${existing.length} 張`
                : single ? '開立並列印'
                : `開立並列印 ${willPrint} 張`}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            {existing.length > 0 && issuable.length > 0 && (
              <span className="block text-gray-500 mb-0.5">
                其中 {issuable.length} 張新開、{existing.length} 張補印（流水號不變）。
              </span>
            )}
            每一張收據佔一張 A4，印出來是三聯（收執聯／財務憑證聯／存根聯），沿裁切線剪開即可。
          </p>
        </div>
      </div>
    </div>
  );
};

// ── 列表：補印與作廢 ──────────────────────────────────────────────────────

export const ReceiptListPanel: React.FC<{ temple: ReceiptTempleInfo; refreshKey: number }> = ({ temple, refreshKey }) => {
  const [list, setList] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [printing, setPrinting] = useState<ReceiptRecord | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getReceipts().then(setList).finally(() => setLoading(false));
  };
  useEffect(load, [refreshKey]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(r =>
      r.receiptNo.toLowerCase().includes(s) ||
      r.title.toLowerCase().includes(s) ||
      (r.phone ?? '').includes(s));
  }, [list, q]);

  const doVoid = async (r: ReceiptRecord) => {
    const reason = window.prompt(`作廢 ${r.receiptNo}。請寫原因（會留在紀錄上）：`);
    if (reason === null) return;
    setBusy(r.id);
    try { await voidReceipt(r.id, reason.trim()); load(); }
    catch { alert('作廢失敗'); }
    finally { setBusy(null); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center gap-3">
        <h3 className="font-semibold text-gray-700 text-sm">已開立的收據</h3>
        <span className="text-xs text-gray-400">{list.length} 張</span>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋收據編號 / 抬頭 / 電話"
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-temple-red/20 w-64" />
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-12 text-sm">載入中…</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-12 text-sm">{list.length === 0 ? '還沒有開過收據' : '沒有符合的收據'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="admin-table w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-left">
                {['收據編號', '日期', '抬頭', '項目', '金額', '經手人', '狀態', '操作'].map(h => (
                  <th key={h} className={`px-5 py-3 font-medium text-gray-500 ${h === '金額' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const voided = r.status === 'void';
                return (
                  <tr key={r.id} className={`border-b border-gray-50 ${voided ? 'opacity-55' : 'hover:bg-gray-50/50'}`}>
                    <td data-label="收據編號" className="px-5 py-3 font-mono font-semibold text-gray-800 whitespace-nowrap">{r.receiptNo}</td>
                    <td data-label="日期" className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(r.issuedAt).toLocaleDateString('zh-TW')}
                    </td>
                    <td data-label="抬頭" className="px-5 py-3 text-gray-800">{r.title}</td>
                    <td data-label="項目" className="px-5 py-3 text-gray-600 max-w-[220px] truncate"
                      title={r.items.map(i => `${i.label} $${i.amount}`).join('、')}>
                      {r.items.map(i => i.label).join('、')}
                    </td>
                    <td data-label="金額" className="px-5 py-3 text-right font-semibold whitespace-nowrap">{money(receiptTotal(r.items))}</td>
                    <td data-label="經手人" className="px-5 py-3 text-gray-500 text-xs">{r.createdByName || '—'}</td>
                    <td data-label="狀態" className="px-5 py-3">
                      {voided
                        ? <span className="px-2.5 py-0.5 rounded-full text-xs bg-red-100 text-red-700" title={r.voidReason}>已作廢</span>
                        : <span className="px-2.5 py-0.5 rounded-full text-xs bg-green-100 text-green-700">有效</span>}
                    </td>
                    <td data-label="操作" className="px-5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {/* 作廢的也要印得出來：財務查帳時會需要調閱那一張 */}
                        <button onClick={() => setPrinting(r)}
                          className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 inline-flex items-center gap-1">
                          <Printer className="w-3 h-3" />{voided ? '調閱' : '補印'}
                        </button>
                        {!voided && (
                          <button onClick={() => doVoid(r)} disabled={busy === r.id}
                            title="作廢（不刪除，號碼留著）"
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-40">
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="px-5 py-3 text-[11px] text-gray-400 border-t border-gray-100">
        作廢不會刪除，號碼留在列表上——<strong>連號一旦缺號，外觀上與「有人抽走一張」分不出來</strong>。
      </p>

      {printing && <ReceiptPrint receipt={printing} temple={temple} onDone={() => setPrinting(null)} />}
    </div>
  );
};

// ── 收據上的廟方資料 ──────────────────────────────────────────────────────

/**
 * 登記證字號、統一編號、感謝詞與簽章頭銜。
 *
 * **放在收據這一頁、不放「基本資料」**：那一頁是給前台用的（頁尾、地圖、schema.org），
 * 這四個只有收據會印。混在一起的話，改網站地址的人會看到四個不知道是什麼的欄位。
 *
 * **沒填就留白，不要給假的預設值**：收據上印一個不存在的登記證號比留白糟得多。
 */
export const ReceiptSettingsPanel: React.FC<{ onSaved: () => void }> = ({ onSaved }) => {
  const [v, setV] = useState<ReceiptSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { getReceiptSettings().then(setV).catch(() => setV(DEFAULT_RECEIPT_SETTINGS)); }, []);
  if (!v) return null;

  const set = (k: keyof ReceiptSettings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV({ ...v, [k]: e.target.value }); setDone(false);
  };

  const save = async () => {
    setSaving(true);
    try { await saveReceiptSettings(v); setDone(true); onSaved(); }
    catch { alert('儲存失敗'); }
    finally { setSaving(false); }
  };

  const rows: Array<[keyof ReceiptSettings, string, string]> = [
    ['thanksText', '感謝詞', '印在附註的第一行'],
    ['certNo',     '寺廟登記證字號', '沒有就留白'],
    ['taxId',      '統一編號', '沒有就留白'],
    ['signTitle1', '簽章欄一', '例如：壇　主'],
    ['signTitle2', '簽章欄二', '例如：主任委員'],
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      <h3 className="font-semibold text-gray-700 text-sm">收據上的廟方資料</h3>
      <p className="text-xs text-gray-400">改完會套用到**之後開立**的收據；已經開出去的不會變（收據是不可變的紙本紀錄）。</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {rows.map(([k, label, hint]) => (
          <label key={k} className={`block ${k === 'thanksText' ? 'sm:col-span-2' : ''}`}>
            <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
            <input value={v[k]} onChange={set(k)} className={field} placeholder={hint} />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="px-4 py-2 rounded-lg bg-temple-red text-white text-sm font-medium disabled:opacity-40">
          {saving ? '儲存中…' : '儲存'}
        </button>
        {done && <span className="text-xs text-green-600">已儲存</span>}
      </div>
    </div>
  );
};
