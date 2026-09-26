/**
 * 後台「會計科目」——財務憑證的科目清單。
 *
 * 嵌在「財務憑證」分頁上方的可收合區塊，作法與 AdminDonationTypesTab 嵌在
 * 捐獻管理裡一樣：科目是憑證的設定，不值得自己佔一個分頁，但又必須改得到。
 *
 * ── 為什麼科目不能是自由文字 ──
 * 讓人在憑證上直接打科目名稱，三個月後就會同時存在「水電」「水電費」
 * 「水電瓦斯」三個科目，報表永遠加不起來。所以科目是一張表、憑證存 id。
 *
 * ── 為什麼用過的科目只能停用不能刪 ──
 * 資料庫的外鍵是 ON DELETE RESTRICT。舊憑證指向不存在的科目，報表就會出現
 * 一塊沒有名字的金額。這與「有紀錄的捐款類別禁止刪除」是同一個原則。
 * 刪除失敗時要明確告訴廟方「請改用停用」，而不是只說「刪除失敗」。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getAccountingAccounts, createAccountingAccount, updateAccountingAccount, deleteAccountingAccount,
} from '../services/vouchers';
import { AccountingAccount, AccountingAccountData, VoucherDirection } from '../types';

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

const DIRECTION_LABEL: Record<VoucherDirection | 'both', string> = {
  expense: '支出', income: '收入', both: '通用',
};

const AdminAccountingAccountsTab: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AccountingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getAccountingAccounts(true));   // 含停用的，後台要看得到全部
      setError('');
    } catch (e) {
      console.error(e);
      setError('讀取會計科目失敗。若尚未執行 finance_vouchers.sql，請先到 Supabase 的 SQL Editor 執行該檔。');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (id: string, next: AccountingAccountData) => {
    setItems(prev => prev.map(x => (x.id === id ? { ...x, ...next } : x)));  // 先動畫面，操作才跟手
    setBusy(true);
    try { await updateAccountingAccount(id, next); onChanged?.(); }
    catch { alert('儲存失敗，請重新整理後再試'); await load(); }
    finally { setBusy(false); }
  };

  const addItem = async () => {
    setBusy(true);
    try {
      const draft: AccountingAccountData = {
        code: '', name: '', direction: 'expense',
        sortOrder: (items.length + 1) * 10, isActive: true, note: '',
      };
      const id = await createAccountingAccount(draft);
      setItems(prev => [...prev, { id, ...draft }]);
      onChanged?.();
    } catch { alert('新增失敗。科目代號不可重複。'); }
    finally { setBusy(false); }
  };

  const removeItem = async (a: AccountingAccount) => {
    if (!window.confirm(`確定刪除科目「${a.code} ${a.name || '未命名'}」？`)) return;
    setBusy(true);
    try {
      await deleteAccountingAccount(a.id);
      setItems(prev => prev.filter(x => x.id !== a.id));
      onChanged?.();
    } catch {
      // 外鍵擋下來就是「已經被憑證用過」。講清楚出路，不要只說失敗
      alert('這個科目已經被憑證用過，不能刪除。請改用「停用」——舊憑證才不會指向不存在的科目。');
    } finally { setBusy(false); }
  };

  const activeCount = items.filter(x => x.isActive).length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-baseline gap-3">
          <span className="font-semibold text-gray-800">會計科目</span>
          <span className="text-xs text-gray-400">
            {loading ? '讀取中…' : `啟用 ${activeCount} 個・共 ${items.length} 個`}
          </span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
          {error && <p role="alert" className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>}

          <p className="text-xs text-gray-500 leading-relaxed mb-4">
            憑證的科目從這裡選，不開放自由輸入——自由輸入三個月後就會有「水電」「水電費」
            「水電瓦斯」三個科目，報表加不起來。
            <strong className="text-gray-700">已經被憑證用過的科目不能刪除，只能停用</strong>，
            否則舊憑證會指向不存在的科目。
          </p>

          <div className="space-y-2">
            {items.map(a => (
              <div key={a.id} className={`flex flex-wrap items-center gap-2 p-2 rounded-lg border ${
                a.isActive ? 'border-gray-200' : 'border-gray-100 bg-gray-50 opacity-60'
              }`}>
                <input
                  aria-label="科目代號" placeholder="代號"
                  className={`${inputBase} w-24 shrink-0`} value={a.code}
                  onChange={e => setItems(prev => prev.map(x => x.id === a.id ? { ...x, code: e.target.value } : x))}
                  onBlur={() => save(a.id, a)}
                />
                <input
                  aria-label="科目名稱" placeholder="科目名稱"
                  className={`${inputClass} flex-1 min-w-[8rem]`} value={a.name}
                  onChange={e => setItems(prev => prev.map(x => x.id === a.id ? { ...x, name: e.target.value } : x))}
                  onBlur={() => save(a.id, a)}
                />
                <select
                  aria-label="適用方向"
                  className={`${inputBase} w-24 shrink-0`} value={a.direction}
                  onChange={e => {
                    const next = { ...a, direction: e.target.value as VoucherDirection | 'both' };
                    setItems(prev => prev.map(x => x.id === a.id ? next : x));
                    save(a.id, next);
                  }}
                >
                  {(['expense', 'income', 'both'] as const).map(d => (
                    <option key={d} value={d}>{DIRECTION_LABEL[d]}</option>
                  ))}
                </select>
                <button
                  onClick={() => save(a.id, { ...a, isActive: !a.isActive })}
                  disabled={busy}
                  title={a.isActive ? '停用' : '啟用'}
                  aria-label={a.isActive ? '停用此科目' : '啟用此科目'}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  {a.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => removeItem(a)} disabled={busy}
                  aria-label="刪除此科目"
                  className="p-2 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {!loading && !items.length && (
              <p className="text-center text-gray-400 py-8 text-sm">尚無科目，請先新增。</p>
            )}
          </div>

          <button
            onClick={addItem} disabled={busy}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-temple-gold/60 text-[#7C5C1E] text-sm font-medium hover:bg-temple-gold/10 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> 新增科目
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminAccountingAccountsTab;
