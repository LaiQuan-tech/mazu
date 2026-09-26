/**
 * 後台「財務憑證」——支出與收入的傳票管理。
 *
 * 設計說明見 docs/finance-voucher-plan.md，資料表見 supabase/migrations/finance_vouchers.sql。
 *
 * ── 這一頁與「應收管理」的分工 ──
 * 應收管理是**唯讀的收入彙總**：它直接從報名資料算金額，不知道錢有沒有真的進來。
 * 這一頁才是**財務事實**：這筆錢什麼時候、用什麼方式、由誰經手進出，附件在哪。
 * 兩者刻意不合併——報名紀錄是業務事實，憑證是財務事實，同一筆錢只有一個金額來源。
 *
 * ── 已作廢的憑證不計入任何統計，但不從列表消失 ──
 * 財務資料不刪。作廢的單留在列表裡（淡色、標示已作廢）才查得到當初發生過什麼。
 *
 * ── 為什麼自己寫日期篩選而不共用 AdminDashboard 的 DateRangeFilter ──
 * 那支是 AdminDashboard.tsx 的模組私有元件，而 AdminDashboard 會 import 這一頁，
 * 反過來 import 會變成循環相依。欄位少，自己寫一份比較實在。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, RefreshCw, FileText, Printer } from 'lucide-react';
import {
  getVouchers, createVoucher, getAccountingAccounts, suggestVoucherNo, todayLocal,
} from '../services/vouchers';
import {
  AccountingAccount, VoucherRecord, VoucherDirection, voucherTotal,
} from '../types';
import AdminAccountingAccountsTab from './AdminAccountingAccountsTab';
import VoucherEditor from './VoucherEditor';
import VoucherPrint from './VoucherPrint';

const inputClass =
  'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-temple-red';

const money = (n: number) => `NT$${n.toLocaleString()}`;

/** 日期字串比較用。日期一律本地時區，不用 toISOString（台灣早上 8 點前會差一天） */
const inRange = (date: string, from: string, to: string): boolean => {
  if (!from && !to) return true;
  if (!date) return true;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

const AdminVouchersTab: React.FC = () => {
  const [vouchers, setVouchers] = useState<VoucherRecord[]>([]);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [dir, setDir] = useState<'all' | VoucherDirection>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<VoucherRecord | null>(null);
  const [printing, setPrinting] = useState<VoucherRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vs, as] = await Promise.all([getVouchers(), getAccountingAccounts(true)]);
      setVouchers(vs); setAccounts(as); setError('');
    } catch (e) {
      console.error(e);
      setError('讀取失敗。若尚未執行 finance_vouchers.sql，請先到 Supabase 的 SQL Editor 執行該檔；若已執行，請確認這個帳號的角色是管理組或財務組。');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vouchers.filter(v => {
      if (dir !== 'all' && v.direction !== dir) return false;
      if (!inRange(v.voucherDate, from, to)) return false;
      if (!q) return true;
      return v.voucherNo.toLowerCase().includes(q)
        || v.summary.toLowerCase().includes(q)
        || v.items.some(it => it.summary.toLowerCase().includes(q) || it.applicant.toLowerCase().includes(q));
    });
  }, [vouchers, dir, from, to, search]);

  /** 統計一律排除已作廢——作廢的單不是收入也不是支出 */
  const stats = useMemo(() => {
    const live = filtered.filter(v => v.status !== 'void');
    const sum = (d: VoucherDirection) =>
      live.filter(v => v.direction === d).reduce((s, v) => s + voucherTotal(v.items), 0);
    const expense = sum('expense');
    const income = sum('income');
    return {
      expense, income, balance: income - expense,
      draft: filtered.filter(v => v.status === 'draft').length,
    };
  }, [filtered]);

  /**
   * 新增是「先建一張草稿再打開編輯」，不是填完才送出。
   * 附件的外鍵指向 vouchers.id，沒有先存就沒得傳檔；順便讓半途離開的單留得下來。
   */
  const addVoucher = async (direction: VoucherDirection) => {
    setBusy(true);
    try {
      const date = todayLocal();
      const no = await suggestVoucherNo(direction, date);
      const id = await createVoucher({ direction, voucherNo: no, voucherDate: date, summary: '', status: 'draft', note: '' });
      const fresh: VoucherRecord = {
        id, direction, voucherNo: no, voucherDate: date, summary: '', status: 'draft', note: '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), items: [], attachments: [],
      };
      setVouchers(prev => [fresh, ...prev]);
      setEditing(fresh);
    } catch (e) { console.error(e); alert('新增失敗，請稍後再試'); }
    finally { setBusy(false); }
  };

  const cards = [
    { label: '支出合計', value: money(stats.expense), cls: 'text-gray-800' },
    { label: '收入合計', value: money(stats.income), cls: 'text-temple-red' },
    { label: '結餘', value: money(stats.balance), cls: stats.balance < 0 ? 'text-red-600' : 'text-green-600' },
    { label: '草稿', value: String(stats.draft), cls: 'text-yellow-600' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">財務憑證</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          支出與收入傳票。金額只要填一個數字，
          <strong className="text-gray-700">合計由明細自動加總</strong>；
          要印成紙本傳票時，系統會把數字排回「佰萬／拾萬／萬…」那排格子。
          簽章欄印出來手簽。附件存在只有管理組與財務組看得到的私有空間。
        </p>
      </div>

      {error && <p role="alert" className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>}

      <AdminAccountingAccountsTab onChanged={load} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.cls}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
          {([['all', '全部'], ['expense', '支出'], ['income', '收入']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setDir(k)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                dir === k ? 'bg-temple-red text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-gray-400 text-xs shrink-0">傳票日期</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputClass} aria-label="起始日期" />
          <span className="text-gray-400">～</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputClass} aria-label="結束日期" />
          {(from || to) && (
            <button onClick={() => { setFrom(''); setTo(''); }}
              className="text-xs text-gray-400 hover:text-gray-700 underline shrink-0">清除</button>
          )}
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋單號、摘要或申請人"
            className={`${inputClass} w-full pl-9`} />
        </div>

        <button onClick={load} disabled={loading} aria-label="重新整理"
          className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => addVoucher('expense')} disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-temple-gold/60 text-[#7C5C1E] text-sm font-medium hover:bg-temple-gold/10 transition-colors disabled:opacity-50">
            <Plus className="w-4 h-4" /> 支出
          </button>
          <button onClick={() => addVoucher('income')} disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-temple-red text-white text-sm font-medium hover:bg-[#5C1A04] transition-colors disabled:opacity-50">
            <Plus className="w-4 h-4" /> 收入
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">讀取中…</div>
      ) : !filtered.length ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-16 text-center">
          <p className="text-gray-500 mb-2">{vouchers.length ? '尚無符合條件的憑證' : '還沒有任何憑證'}</p>
          {!vouchers.length && (
            <p className="text-sm text-gray-400">
              按右上角的「支出」或「收入」開一張。單號會自動建議（如 E{todayLocal().replace(/-/g, '')}-01），可以改成廟方自己的編號。
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(v => {
            const total = voucherTotal(v.items);
            const isVoid = v.status === 'void';
            return (
              <div key={v.id}
                className={`bg-white rounded-xl border shadow-sm p-4 flex flex-wrap items-center gap-3 cursor-pointer hover:border-temple-gold/50 transition-colors ${
                  isVoid ? 'border-gray-100 opacity-55' : 'border-gray-100'}`}
                onClick={() => setEditing(v)}>
                <span className={`px-2 py-1 rounded-md text-xs font-medium shrink-0 ${
                  v.direction === 'expense' ? 'bg-gray-100 text-gray-600' : 'bg-temple-gold/15 text-[#7C5C1E]'}`}>
                  {v.direction === 'expense' ? '支出' : '收入'}
                </span>
                <span className="font-mono text-sm text-gray-700 shrink-0">{v.voucherNo}</span>
                <span className="text-xs text-gray-400 shrink-0">{v.voucherDate}</span>
                <span className="flex-1 min-w-[6rem] text-sm text-gray-700 truncate">
                  {v.summary || v.items[0]?.summary || <span className="text-gray-300">未填摘要</span>}
                </span>
                <span className="text-xs text-gray-400 shrink-0">{v.items.length} 筆</span>
                {!!v.attachments.length && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400 shrink-0">
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" />{v.attachments.length}
                  </span>
                )}
                <span className={`text-base font-bold shrink-0 ${isVoid ? 'line-through text-gray-400' : 'text-temple-red'}`}>
                  {money(total)}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-xs shrink-0 ${
                  isVoid ? 'bg-gray-100 text-gray-500'
                    : v.status === 'confirmed' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                  {isVoid ? '已作廢' : v.status === 'confirmed' ? '已確認' : '草稿'}
                </span>
                <button onClick={e => { e.stopPropagation(); setPrinting(v); }}
                  aria-label="列印這張傳票"
                  className="p-2 rounded-lg text-gray-300 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0">
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <VoucherEditor
          voucher={editing} accounts={accounts}
          onClose={() => setEditing(null)}
          onSaved={load}
          onPrint={v => { setEditing(null); setPrinting(v); }}
        />
      )}

      {printing && (
        <VoucherPrint voucher={printing} accounts={accounts} onDone={() => setPrinting(null)} />
      )}
    </div>
  );
};

export default AdminVouchersTab;
