/**
 * 財務憑證的編輯視窗（單頭＋明細＋附件）。
 *
 * ── 合計是算出來的，畫面上不給填 ──
 * 廟方的紙本傳票單頭有一個「合計金額」要手寫。這裡刻意不做那個欄位：
 * 單頭填一個、明細又是一串，兩邊對不起來時沒有任何方法知道該信哪個。
 * 合計即時由明細加總顯示在明細下方，填完馬上看得到，等於自我驗證。
 *
 * ── 金額是一個輸入框，不是七個格子 ──
 * 紙本把金額拆成「佰萬／拾萬／萬／仟／佰／拾／元」是防竄改用的（每格一個數字，
 * 事後加不上去）。做成七個輸入框只會變成七個可以各自寫錯的地方。
 * 要印成那個版面是列印時的事，見 VoucherPrint。
 *
 * ── 附件要等憑證存在才能傳 ──
 * 附件的外鍵指向 vouchers.id，所以「新增」是先建一張草稿再打開這個視窗編輯，
 * 而不是全部填完才一次送出。這也順便讓半途離開的單留得下來。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Trash2, Upload, FileText, Loader2, Ban, Printer } from 'lucide-react';
import {
  updateVoucher, replaceVoucherItems, voidVoucher,
  uploadVoucherAttachment, getAttachmentUrl, deleteVoucherAttachment, MAX_ATTACHMENT_BYTES,
} from '../services/vouchers';
import {
  AccountingAccount, AttachmentKind, VoucherRecord, VoucherItemData, VoucherStatus,
  voucherTotal, VOUCHER_SOURCE_LABEL,
} from '../types';

/**
 * 注意：**寬度不要寫進 inputBase**。
 * 這裡刻意把 `w-full` 拆出來，因為 Tailwind 的優先序看的是產生出來的 CSS 順序，
 * 不是 class 字串裡的先後——base 裡若含 `w-full`，後面再接 `w-32` 是沒有用的，
 * 欄位會全部變成整行寬（2026-09-27 實測：明細每個欄位都吃滿 838px）。
 * 要固定寬度就用 `${inputBase} w-32`，要整行才用 `inputClass`。
 */
const inputBase =
  'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-temple-red';
const inputClass = `${inputBase} w-full`;

const ATTACHMENT_KINDS: AttachmentKind[] = ['支出傳票', '發票', '收據', '其他'];

const STATUS_LABEL: Record<VoucherStatus, string> = {
  draft: '草稿', confirmed: '已確認', void: '已作廢',
};

const money = (n: number) => `NT$${n.toLocaleString()}`;

interface Props {
  voucher: VoucherRecord;
  accounts: AccountingAccount[];
  onClose: () => void;
  onSaved: () => void;
  onPrint: (v: VoucherRecord) => void;
}

const VoucherEditor: React.FC<Props> = ({ voucher, accounts, onClose, onSaved, onPrint }) => {
  const [head, setHead] = useState({
    voucherNo: voucher.voucherNo,
    voucherDate: voucher.voucherDate,
    summary: voucher.summary,
    status: voucher.status,
    note: voucher.note,
  });
  const [items, setItems] = useState<VoucherItemData[]>(
    voucher.items.length
      ? voucher.items.map(it => ({ ...it }))
      : [{ seq: 1, accountId: null, summary: '', amount: 0, applicant: '', sourceTable: null, sourceId: null }],
  );
  const [attachments, setAttachments] = useState(voucher.attachments);
  const [kind, setKind] = useState<AttachmentKind>(voucher.direction === 'expense' ? '發票' : '收據');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // 該方向可用的科目（通用的兩邊都給）
  const usableAccounts = useMemo(
    () => accounts.filter(a => a.isActive && (a.direction === 'both' || a.direction === voucher.direction)),
    [accounts, voucher.direction],
  );

  const total = voucherTotal(items);
  const readOnly = head.status === 'void';

  // Esc 關閉：視窗夠大，右上角的 X 在手機上要捲才按得到
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setItem = (i: number, patch: Partial<VoucherItemData>) =>
    setItems(prev => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const addRow = () =>
    setItems(prev => [...prev, {
      seq: prev.length + 1, accountId: null, summary: '', amount: 0,
      applicant: '', sourceTable: null, sourceId: null,
    }]);

  const removeRow = (i: number) =>
    setItems(prev => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const save = async () => {
    if (!head.voucherNo.trim()) { setError('單號不可空白'); return; }
    setBusy(true); setError('');
    try {
      await updateVoucher(voucher.id, { ...head, direction: voucher.direction });
      await replaceVoucherItems(voucher.id, items);
      onSaved();
      onClose();
    } catch (e: any) {
      // UNIQUE 撞號是最常見的失敗，講清楚是哪裡撞到
      setError(String(e?.code) === '23505' ? '這個單號已經有人用了，請換一個。' : '儲存失敗，請稍後再試。');
      console.error(e);
    } finally { setBusy(false); }
  };

  const doVoid = async () => {
    if (!window.confirm('確定作廢這張憑證？\n\n作廢後不會從列表消失（財務資料不刪除），但不會計入任何統計。')) return;
    setBusy(true);
    try { await voidVoucher(voucher.id); onSaved(); onClose(); }
    catch { setError('作廢失敗'); }
    finally { setBusy(false); }
  };

  const pickFile = async (file?: File) => {
    if (!file) return;
    setUploading(true); setError('');
    try {
      const att = await uploadVoucherAttachment(voucher.id, null, kind, file);
      setAttachments(prev => [...prev, att]);
      onSaved();
    } catch (e: any) {
      setError(e?.message || '上傳失敗');
    } finally { setUploading(false); }
  };

  /** 附件在私有 bucket，要換一個短效簽名網址才打得開 */
  const openAttachment = async (storagePath: string) => {
    try { window.open(await getAttachmentUrl(storagePath), '_blank', 'noopener,noreferrer'); }
    catch { setError('無法開啟附件'); }
  };

  const removeAttachment = async (id: string, storagePath: string, name: string) => {
    if (!window.confirm(`確定刪除附件「${name}」？`)) return;
    try {
      await deleteVoucherAttachment(id, storagePath);
      setAttachments(prev => prev.filter(a => a.id !== id));
      onSaved();
    } catch { setError('刪除附件失敗'); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-0 sm:p-6">
      <div className="w-full sm:max-w-4xl bg-white sm:rounded-2xl shadow-xl min-h-full sm:min-h-0 sm:my-4">
        {/* 標題列 */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-white sm:rounded-t-2xl">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-800">
              {voucher.direction === 'expense' ? '支出憑證' : '收入憑證'}
              <span className="ml-2 text-sm font-normal text-gray-400">{STATUS_LABEL[head.status]}</span>
            </h3>
            <p className="text-xs text-gray-400 truncate">{head.voucherNo}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onPrint({ ...voucher, ...head, items: items as any, attachments })}
              title="列印傳票" aria-label="列印傳票"
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <Printer className="w-5 h-5" />
            </button>
            <button onClick={onClose} aria-label="關閉"
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {error && <p role="alert" className="px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>}

          {/* ── 單頭 ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="block">
              <span className="block text-xs text-gray-500 mb-1">單號</span>
              <input className={inputClass} value={head.voucherNo} disabled={readOnly}
                onChange={e => setHead(h => ({ ...h, voucherNo: e.target.value }))} />
            </label>
            <label className="block">
              <span className="block text-xs text-gray-500 mb-1">日期</span>
              <input type="date" className={inputClass} value={head.voucherDate} disabled={readOnly}
                onChange={e => setHead(h => ({ ...h, voucherDate: e.target.value }))} />
            </label>
            <label className="block col-span-2">
              <span className="block text-xs text-gray-500 mb-1">摘要（整張）</span>
              <input className={inputClass} value={head.summary} disabled={readOnly}
                placeholder="例：9 月水電與香品採購"
                onChange={e => setHead(h => ({ ...h, summary: e.target.value }))} />
            </label>
          </div>

          {/* ── 明細 ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-700 text-sm">明細</h4>
              <span className="text-xs text-gray-400">共 {items.length} 筆</span>
            </div>

            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex flex-wrap items-start gap-2 p-2 rounded-lg border border-gray-200">
                  <span className="w-6 shrink-0 pt-2 text-xs text-gray-400 text-right">{i + 1}</span>
                  <select aria-label="會計科目" className={`${inputBase} w-32 shrink-0`} disabled={readOnly}
                    value={it.accountId ?? ''}
                    onChange={e => setItem(i, { accountId: e.target.value || null })}>
                    <option value="">選科目</option>
                    {usableAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                    ))}
                  </select>
                  <input aria-label="摘要" placeholder="摘要" disabled={readOnly}
                    className={`${inputClass} flex-1 min-w-[8rem]`} value={it.summary}
                    onChange={e => setItem(i, { summary: e.target.value })} />
                  <input aria-label="金額" type="number" min={0} step={1} placeholder="金額" disabled={readOnly}
                    className={`${inputBase} w-28 shrink-0 text-right`} value={it.amount || ''}
                    onChange={e => setItem(i, { amount: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
                  <input aria-label="申請人" placeholder="申請人" disabled={readOnly}
                    className={`${inputBase} w-24 shrink-0`} value={it.applicant}
                    onChange={e => setItem(i, { applicant: e.target.value })} />
                  {it.sourceTable && (
                    <span className="px-2 py-1 rounded-md bg-temple-gold/15 text-[#7C5C1E] text-xs shrink-0 self-center">
                      來自{VOUCHER_SOURCE_LABEL[it.sourceTable]}
                    </span>
                  )}
                  <button onClick={() => removeRow(i)} disabled={readOnly || items.length <= 1}
                    aria-label="刪除這一筆明細"
                    className="p-2 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-3">
              <button onClick={addRow} disabled={readOnly}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-temple-gold/60 text-[#7C5C1E] text-sm hover:bg-temple-gold/10 transition-colors disabled:opacity-40">
                <Plus className="w-4 h-4" /> 新增一筆
              </button>
              {/* 合計由明細加總，不給填——單頭與明細對不起來時無解 */}
              <p className="text-sm text-gray-500">
                合計 <span className="text-xl font-bold text-temple-red ml-1">{money(total)}</span>
              </p>
            </div>
          </div>

          {/* ── 附件 ── */}
          <div>
            <h4 className="font-semibold text-gray-700 text-sm mb-2">附件</h4>
            <p className="text-xs text-gray-400 mb-3">
              發票、收據、傳票影本。檔案存在私有空間，只有管理組與財務組看得到，
              且不會壓縮——發票上的統編與金額壓過就糊了。單檔上限
              {Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB。
            </p>

            <div className="space-y-2 mb-3">
              {attachments.map(a => (
                <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-200">
                  <FileText className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
                  <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-xs shrink-0">{a.kind}</span>
                  <button onClick={() => openAttachment(a.storagePath)}
                    className="flex-1 min-w-0 text-left text-sm text-temple-red underline underline-offset-4 decoration-temple-gold/70 truncate">
                    {a.fileName}
                  </button>
                  <span className="text-xs text-gray-400 shrink-0">
                    {a.sizeBytes ? `${Math.round(a.sizeBytes / 1024)}KB` : ''}
                  </span>
                  <button onClick={() => removeAttachment(a.id, a.storagePath, a.fileName)}
                    aria-label="刪除附件"
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {!attachments.length && <p className="text-sm text-gray-400 py-3 text-center">尚無附件</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="附件類型" className={`${inputBase} w-28 shrink-0`}
                value={kind} onChange={e => setKind(e.target.value as AttachmentKind)}>
                {ATTACHMENT_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <button onClick={() => fileRef.current?.click()} disabled={uploading || readOnly}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Upload className="w-4 h-4" aria-hidden="true" />}
                {uploading ? '上傳中…' : '選擇檔案'}
              </button>
              <input ref={fileRef} type="file" className="hidden"
                accept="image/*,application/pdf"
                onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </div>

          {/* ── 備註與狀態 ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block sm:col-span-2">
              <span className="block text-xs text-gray-500 mb-1">備註</span>
              <input className={inputClass} value={head.note} disabled={readOnly}
                onChange={e => setHead(h => ({ ...h, note: e.target.value }))} />
            </label>
            <label className="block">
              <span className="block text-xs text-gray-500 mb-1">狀態</span>
              <select className={inputClass} value={head.status} disabled={readOnly}
                onChange={e => setHead(h => ({ ...h, status: e.target.value as VoucherStatus }))}>
                <option value="draft">草稿</option>
                <option value="confirmed">已確認</option>
              </select>
            </label>
          </div>
        </div>

        {/* 底部操作列 */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-white sm:rounded-b-2xl">
          {/* 作廢做小做淡、離主要動作遠一點：破壞性動作不該挨著「儲存」 */}
          {head.status !== 'void' ? (
            <button onClick={doVoid} disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-600 transition-colors">
              <Ban className="w-3.5 h-3.5" aria-hidden="true" /> 作廢這張憑證
            </button>
          ) : <span className="text-xs text-gray-400">這張憑證已作廢</span>}

          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              取消
            </button>
            <button onClick={save} disabled={busy || readOnly}
              className="px-6 py-2 rounded-lg bg-temple-red text-white text-sm font-medium hover:bg-[#5C1A04] transition-colors disabled:opacity-50">
              {busy ? '儲存中…' : '儲存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoucherEditor;
