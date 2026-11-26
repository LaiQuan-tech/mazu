import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical, Plus, Trash2, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getDonationTypes, createDonationType, updateDonationType, deleteDonationType,
  reorderDonationTypes, renameDonationsType,
} from '../services/supabase';
import { DonationRecord, DonationTypeRecord } from '../types';

/**
 * 後台「捐款類別」管理（放在捐獻管理分頁上方，可收合）
 *
 * 一列 = 隨喜捐獻表單裡的一個選項。順序拖拉調整，放開才寫回資料庫；
 * 名稱離開輸入框才存，顯示開關立即存——與其他內容管理分頁一致。
 *
 * ── 這裡最需要小心的事 ──
 * `donations.type` 存的是類別的**文字**，不是這張表的 id。所以：
 *   改名   → 預設只影響之後的捐款，歷史紀錄維持原樣（那是財務資料，不擅自重寫）。
 *            若有既有紀錄，會問廟方要不要一併更新——打錯字通常要，換用途通常不要。
 *   刪除   → 有既有紀錄時直接擋下來，請改用「隱藏」。
 *            真的刪掉，報表上那些紀錄就會指向一個不存在的類別。
 */

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-temple-red';

interface RowProps {
  item: DonationTypeRecord;
  index: number;
  total: number;
  usedCount: number;
  busy: boolean;
  onRename: (next: string) => void;
  onToggle: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  /** 手機用的搬移。觸控裝置不會觸發 HTML5 拖拉事件。 */
  onMove: (dir: -1 | 1) => void;
  dragging: boolean;
}

const TypeRow: React.FC<RowProps> = ({
  item, index, total, usedCount, busy, onRename, onToggle, onDelete,
  onDragStart, onDragEnter, onDragEnd, onMove, dragging,
}) => {
  const [name, setName] = useState(item.name);
  useEffect(() => { setName(item.name); }, [item.name]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={e => e.preventDefault()}
      className={`bg-white border rounded-xl p-3 flex items-center gap-3 transition-shadow ${
        dragging ? 'border-temple-red shadow-lg opacity-60' : 'border-gray-200'
      } ${item.isVisible ? '' : 'bg-gray-50'}`}
    >
      <GripVertical className="w-4 h-4 text-gray-300 cursor-grab shrink-0 hidden lg:block" />
      {/* 手機改用上下鍵：HTML5 的 drag 事件在觸控裝置不會觸發 */}
      <div className="flex items-center gap-1 lg:hidden shrink-0 -ml-1 text-gray-400">
        <button type="button" onClick={() => onMove(-1)} disabled={busy || index === 0}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30" aria-label="上移">
          <ChevronUp className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={busy || index === total - 1}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30" aria-label="下移">
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
      <span className="text-xs text-gray-400 w-6 shrink-0">{index + 1}</span>

      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={() => { if (name.trim() && name !== item.name) onRename(name.trim()); else setName(item.name); }}
        placeholder="類別名稱，例如：慈善救助"
        className={`${inputClass} flex-1`}
      />

      <span className="text-xs text-gray-400 w-24 text-right shrink-0">
        {usedCount > 0 ? `已有 ${usedCount} 筆` : '尚無紀錄'}
      </span>

      {!item.isVisible && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 shrink-0">未顯示</span>
      )}

      <button
        type="button"
        title={item.isVisible ? '點一下隱藏（前台不再出現，已收的紀錄不受影響）' : '點一下顯示'}
        onClick={onToggle}
        disabled={busy}
        className="p-1.5 rounded-lg text-gray-400 hover:text-temple-red hover:bg-gray-100 disabled:opacity-50 shrink-0"
      >
        {item.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
      <button
        type="button"
        title={usedCount > 0 ? '已有捐款紀錄使用這個類別，請改用隱藏' : '刪除這個類別'}
        onClick={onDelete}
        disabled={busy}
        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

const AdminDonationTypesTab: React.FC<{ donations: DonationRecord[]; onRefresh: () => void }> = ({
  donations, onRefresh,
}) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DonationTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dragFrom = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await getDonationTypes(true)); setError(''); }
    catch (e) {
      console.error(e);
      setError('讀取失敗。若尚未執行 donation_types.sql，請先到 Supabase 的 SQL Editor 執行該檔。');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const countOf = (name: string) => donations.filter(d => d.type === name).length;

  const rename = async (item: DonationTypeRecord, next: string) => {
    const used = countOf(item.name);
    if (!window.confirm(`要把類別名稱從「${item.name}」改成「${next}」嗎？`)) { await load(); return; }

    // 有歷史紀錄時，讓廟方自己決定要不要一起改。預設（按取消）是保留歷史原樣。
    let alsoHistory = false;
    if (used > 0) {
      alsoHistory = window.confirm(
        `有 ${used} 筆既有捐款紀錄使用「${item.name}」。\n\n` +
        `要一併改成「${next}」嗎？\n` +
        `　確定＝連同過去的紀錄一起改（適合修正錯字）\n` +
        `　取消＝只改之後的捐款，歷史保留原名稱`
      );
    }

    setBusy(true);
    try {
      await updateDonationType(item.id, { name: next });
      if (alsoHistory) { await renameDonationsType(item.name, next); onRefresh(); }
      setItems(prev => prev.map(x => (x.id === item.id ? { ...x, name: next } : x)));
    } catch { alert('儲存失敗，名稱可能與其他類別重複'); await load(); }
    finally { setBusy(false); }
  };

  const toggle = async (item: DonationTypeRecord) => {
    setItems(prev => prev.map(x => (x.id === item.id ? { ...x, isVisible: !x.isVisible } : x)));
    setBusy(true);
    try { await updateDonationType(item.id, { isVisible: !item.isVisible }); }
    catch { alert('儲存失敗'); await load(); }
    finally { setBusy(false); }
  };

  const remove = async (item: DonationTypeRecord) => {
    const used = countOf(item.name);
    if (used > 0) {
      alert(
        `「${item.name}」已經有 ${used} 筆捐款紀錄，不能刪除。\n\n` +
        `刪掉之後那些紀錄會指向一個不存在的類別，報表會出問題。\n` +
        `如果只是不想再讓信眾選到，請按眼睛圖示「隱藏」。`
      );
      return;
    }
    if (!window.confirm(`確定刪除「${item.name}」？`)) return;
    setBusy(true);
    try { await deleteDonationType(item.id); setItems(prev => prev.filter(x => x.id !== item.id)); }
    catch { alert('刪除失敗'); }
    finally { setBusy(false); }
  };

  const add = async () => {
    const name = window.prompt('新類別的名稱：')?.trim();
    if (!name) return;
    if (items.some(x => x.name === name)) { alert('已經有同名的類別了'); return; }
    setBusy(true);
    try {
      const draft = { sortOrder: items.length, name, isVisible: true };
      const id = await createDonationType(draft);
      setItems(prev => [...prev, { id, ...draft }]);
    } catch { alert('新增失敗'); }
    finally { setBusy(false); }
  };

  const onDragEnter = (to: number) => {
    const from = dragFrom.current;
    if (from === null || from === to) return;
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    dragFrom.current = to;
  };

  const saveOrder = async (list: DonationTypeRecord[]) => {
    setBusy(true);
    try { await reorderDonationTypes(list.map(x => x.id)); }
    catch { alert('順序儲存失敗'); await load(); }
    finally { setBusy(false); }
  };

  const onDragEnd = async () => {
    dragFrom.current = null;
    await saveOrder(items);
  };

  // 手機的上下鍵：搬一格就直接寫回（不像拖曳有「放開」這個時機點）
  const moveItem = async (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    await saveOrder(next);
  };

  const visibleCount = items.filter(x => x.isVisible).length;

  return (
    <div className="mb-6 border border-gray-200 rounded-xl bg-gray-50/60">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-bold text-gray-700">
          捐款類別設定
          <span className="ml-2 font-normal text-gray-400">
            {loading ? '載入中…' : `共 ${items.length} 項，${visibleCount} 項顯示中`}
          </span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            這裡改的是「隨喜捐獻」表單裡讓信眾選的類別。
            <strong>改名字只影響之後的捐款</strong>，已經收的紀錄維持原樣——若要一併更新，改名時系統會問你。
            停辦某個類別請用<strong>隱藏</strong>，不要刪除。
            <br />
            「神尊修復」不在這裡：那一項走神尊修復專頁、金額綁定專案。
          </p>

          {error && <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}

          {!loading && !error && (
            <>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <TypeRow
                    key={item.id}
                    item={item}
                    index={i}
                    total={items.length}
                    usedCount={countOf(item.name)}
                    busy={busy}
                    dragging={dragFrom.current === i}
                    onRename={next => rename(item, next)}
                    onToggle={() => toggle(item)}
                    onDelete={() => remove(item)}
                    onDragStart={() => { dragFrom.current = i; }}
                    onDragEnter={() => onDragEnter(i)}
                    onDragEnd={onDragEnd}
                    onMove={dir => moveItem(i, dir)}
                  />
                ))}
              </div>

              <button type="button" onClick={add} disabled={busy}
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-temple-red text-white text-xs font-medium hover:bg-[#5C4310] disabled:opacity-50">
                <Plus className="w-3.5 h-3.5" /> 新增類別
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDonationTypesTab;
