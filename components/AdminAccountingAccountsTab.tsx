/**
 * 後台「會計科目」——財務憑證的科目清單，三層：項目 → 子目 → 明細。
 *
 * 嵌在「財務憑證」分頁上方的可收合區塊，作法與 AdminDonationTypesTab 嵌在
 * 捐獻管理裡一樣：科目是憑證的設定，不值得自己佔一個分頁，但又必須改得到。
 *
 * ── 為什麼科目不能是自由文字 ──
 * 讓人在憑證上直接打科目名稱，三個月後就會同時存在「水電」「水電費」
 * 「水電瓦斯」三個科目，報表永遠加不起來。所以科目是一張表、憑證存 id。
 *
 * ── 三層（廟方 2026-10-30：「科目要有項目、子目、明細」）──
 * 一張表加 `parent_id` 自我參照，不是三張表——三張表的話 `voucher_items`
 * 就得知道「指向哪一張」，變成多型外鍵。科目三層是同一種東西的三個層級。
 *
 * **有子目的科目不能記帳。** 金額一律落在最末端的那一層，否則同一筆錢
 * 可能同時出現在「項目」與「明細」的合計裡，兩個數字都對、加起來卻是錯的。
 * 這一頁會把那種科目標成「不可記帳」，憑證的下拉也不會列出來。
 *
 * ── 為什麼用過的科目只能停用不能刪 ──
 * 資料庫的外鍵是 ON DELETE RESTRICT。舊憑證指向不存在的科目，報表就會出現
 * 一塊沒有名字的金額。有子目的項目同理——父層一消失，子目就變成孤兒。
 * 刪除失敗時要明確告訴廟方出路，而不是只說「刪除失敗」。
 *
 * ── 層級不給改 ──
 * 建好之後不能搬動 `parentId`／`level`：搬動會讓既有憑證的彙總在報表上
 * 無聲地換一個分類。要搬就新增一個再停用舊的，留下痕跡。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, ChevronDown, ChevronUp, CornerDownRight } from 'lucide-react';
import {
  getAccountingAccounts, createAccountingAccount, updateAccountingAccount, deleteAccountingAccount,
  sortAccountTree, hasChildren,
} from '../services/vouchers';
import {
  AccountingAccount, AccountingAccountData, VoucherDirection,
  AccountLevel, ACCOUNT_LEVEL_LABEL,
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

const DIRECTION_LABEL: Record<VoucherDirection | 'both', string> = {
  expense: '支出', income: '收入', both: '通用',
};

/**
 * 新增時自動配一個還沒被用過的代號。
 *
 * **不能留空字串。** `accounting_accounts.code` 是 `NOT NULL UNIQUE`，
 * 空字串也算一個值——第一個空代號建得起來，第二個就撞上唯一索引
 * （廟方 2026-10-30：「沒辦法加子目」，錯誤訊息是「科目代號不可重複」）。
 *
 * 順便做對一件事：會計的代號本來就是階層式的（父層代號 ＋ 兩碼），
 * 自動帶出來比讓人每次自己想一個好，而且改得掉。
 *
 * 父層代號還沒填時 base 是空的，產出 `01`／`02`——仍然唯一，
 * 等父層填了代號再手動調整即可。
 */
const suggestCode = (items: AccountingAccount[], parent: AccountingAccount | null): string => {
  const used = new Set(items.map(x => x.code.trim()));
  if (!parent) {
    // 第一層：找沒用過的最小正整數
    for (let n = 1; n < 1000; n++) if (!used.has(String(n))) return String(n);
    return `A${Date.now()}`;   // 千個項目還撞得到的話，先給一個一定不重複的
  }
  const base = parent.code.trim();
  for (let n = 1; n < 100; n++) {
    const c = `${base}${String(n).padStart(2, '0')}`;
    if (!used.has(c)) return c;
  }
  return `${base}-${Date.now()}`;
};

const LEVEL_STYLE: Record<AccountLevel, string> = {
  1: 'bg-gray-800 text-white',
  2: 'bg-gray-200 text-gray-700',
  3: 'bg-gray-100 text-gray-500',
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
      setError('讀取會計科目失敗。若尚未執行 finance_vouchers.sql 或 accounting_account_levels.sql，請先到 Supabase 的 SQL Editor 執行。');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** 父層後面緊跟著它的子孫，並帶上縮排深度 */
  const tree = useMemo(() => sortAccountTree(items), [items]);

  const save = async (id: string, next: AccountingAccountData) => {
    setItems(prev => prev.map(x => (x.id === id ? { ...x, ...next } : x)));  // 先動畫面，操作才跟手
    setBusy(true);
    try { await updateAccountingAccount(id, next); onChanged?.(); }
    catch (e) {
      console.error('更新會計科目失敗:', e);
      alert('儲存失敗。科目代號不能與其他科目重複（含已停用的）；請換一個再試。');
      await load();
    }
    finally { setBusy(false); }
  };

  /** 新增一層。`parent` 為 null 就是最上層的「項目」。 */
  const add = async (parent: AccountingAccount | null) => {
    const level = (parent ? parent.level + 1 : 1) as AccountLevel;
    if (level > 3) return;
    setBusy(true);
    try {
      const siblings = items.filter(x => (x.parentId ?? null) === (parent?.id ?? null));
      const draft: AccountingAccountData = {
        code: suggestCode(items, parent), name: '',
        // 子層預設跟著父層的方向——同一個項目底下的明細幾乎不會分屬收支兩邊
        direction: parent ? parent.direction : 'expense',
        sortOrder: (siblings.length + 1) * 10,
        isActive: true, note: '',
        parentId: parent?.id ?? null,
        level,
      };
      const id = await createAccountingAccount(draft);
      setItems(prev => [...prev, { id, ...draft }]);
      onChanged?.();
    } catch (e) {
      // 代號是自動配的，撞號通常代表停用中的科目佔走了那個號（它們也在清單裡，
      // 所以 suggestCode 會避開）——真的撞到多半是 migration 沒跑、level 欄位不存在
      console.error('新增會計科目失敗:', e);
      alert('新增失敗。若尚未執行 accounting_account_levels.sql，請先到 Supabase 的 SQL Editor 跑那一支；'
        + '否則請重新整理後再試（代號是自動配的，不需要手動避開重複）。');
    } finally { setBusy(false); }
  };

  const removeItem = async (a: AccountingAccount) => {
    if (hasChildren(items, a.id)) {
      alert(`「${a.code} ${a.name || '未命名'}」底下還有子目，不能刪除。\n請先刪掉或停用底下的子目——父層一消失，子目就變成指向不存在的東西的孤兒。`);
      return;
    }
    if (!window.confirm(`確定刪除${ACCOUNT_LEVEL_LABEL[a.level]}「${a.code} ${a.name || '未命名'}」？`)) return;
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
  const levelCount = (lv: AccountLevel) => items.filter(x => x.level === lv).length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-baseline gap-3 flex-wrap">
          <span className="font-semibold text-gray-800">會計科目</span>
          <span className="text-xs text-gray-400">
            {loading ? '讀取中…'
              : `項目 ${levelCount(1)}・子目 ${levelCount(2)}・明細 ${levelCount(3)}　（啟用 ${activeCount}）`}
          </span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
          {error && <p role="alert" className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>}

          <p className="text-xs text-gray-500 leading-relaxed mb-4">
            分三層：<strong className="text-gray-700">項目 → 子目 → 明細</strong>。
            憑證的科目從這裡選，不開放自由輸入——自由輸入三個月後就會有「水電」「水電費」
            「水電瓦斯」三個科目，報表加不起來。
            <br />
            <strong className="text-gray-700">有子目的科目不能記帳</strong>，金額一律落在最末端那一層，
            否則同一筆錢會同時出現在項目與明細的合計裡。
            <strong className="text-gray-700">已經被憑證用過的科目不能刪除，只能停用</strong>。
            層級建好之後不能搬動——搬動會讓舊憑證在報表上無聲地換一個分類，要搬請新增一個再停用舊的。
          </p>

          <div className="space-y-2">
            {tree.map(({ account: a, depth }) => {
              const parentOf = hasChildren(items, a.id);
              return (
                <div key={a.id}
                  style={{ marginLeft: depth * 24 }}
                  className={`flex flex-wrap items-center gap-2 p-2 rounded-lg border ${
                    a.isActive ? 'border-gray-200' : 'border-gray-100 bg-gray-50 opacity-60'
                  }`}>
                  {depth > 0 && <CornerDownRight className="w-4 h-4 text-gray-300 shrink-0" aria-hidden="true" />}
                  <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${LEVEL_STYLE[a.level]}`}>
                    {ACCOUNT_LEVEL_LABEL[a.level]}
                  </span>
                  <input
                    aria-label="科目代號" placeholder="代號"
                    className={`${inputBase} w-24 shrink-0`} value={a.code}
                    onChange={e => setItems(prev => prev.map(x => x.id === a.id ? { ...x, code: e.target.value } : x))}
                    onBlur={() => save(a.id, a)}
                  />
                  <input
                    aria-label="科目名稱" placeholder={`${ACCOUNT_LEVEL_LABEL[a.level]}名稱`}
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

                  {/* 有子目就記不了帳，講出來——不講的話廟方會在憑證的下拉找不到它 */}
                  {parentOf && (
                    <span className="text-[11px] text-gray-400 whitespace-nowrap" title="金額要記在最末端那一層">
                      不可記帳
                    </span>
                  )}

                  {a.level < 3 && (
                    <button
                      onClick={() => add(a)} disabled={busy}
                      title={`在底下新增${ACCOUNT_LEVEL_LABEL[(a.level + 1) as AccountLevel]}`}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs hover:bg-gray-50 whitespace-nowrap disabled:opacity-50"
                    >
                      ＋{ACCOUNT_LEVEL_LABEL[(a.level + 1) as AccountLevel]}
                    </button>
                  )}
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
              );
            })}
            {!loading && !items.length && (
              <p className="text-center text-gray-400 py-8 text-sm">尚無科目，請先新增項目。</p>
            )}
          </div>

          <button
            onClick={() => add(null)} disabled={busy}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-temple-gold/60 text-[#7C5C1E] text-sm font-medium hover:bg-temple-gold/10 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> 新增項目
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminAccountingAccountsTab;
