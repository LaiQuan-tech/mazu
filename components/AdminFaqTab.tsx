import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical, Plus, Trash2, Eye, EyeOff, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import {
  getFaqItems, createFaqItem, updateFaqItem, deleteFaqItem, reorderFaqItems, requestRepublish,
} from '../services/supabase';
import { FaqItem } from '../types';

/**
 * 後台「常見問題」內容管理
 *
 * 一張卡片 = 首頁「常見問題」的一題。順序用拖拉調整，放開才寫回資料庫。
 * 文字欄位一律「離開焦點才存」——每打一個字就送出會把資料庫打爆，
 * 也會讓游標在儲存重繪時亂跳。顯示開關則是立即存，因為那是一次性的動作。
 * 這一套與 AdminAboutTab 相同，維護時兩邊可以互相參照。
 *
 * ── 改完會影響哪裡 ──
 * 首頁的問答區塊即時更新；送給 Google 的 FAQPage 結構化資料也是執行期依這份資料
 * 重新產生，所以標記與畫面永遠一致。唯一有時間差的是給不執行 JS 的 AI 爬蟲看的
 * <noscript> 純文字，那是建置時的快照，要等下次部署才會換。
 */

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-temple-red';

interface FaqCardProps {
  item: FaqItem;
  index: number;
  total: number;
  busy: boolean;
  onPatch: (patch: Partial<FaqItem>) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  /** 手機用的搬移。觸控裝置不會觸發 HTML5 拖拉事件，只有拖曳把手等於不能排序。 */
  onMove: (dir: -1 | 1) => void;
  dragging: boolean;
}

const FaqCard: React.FC<FaqCardProps> = ({
  item, index, total, busy, onPatch, onDelete, onDragStart, onDragEnter, onDragEnd, onMove, dragging,
}) => {
  const [question, setQuestion] = useState(item.question);
  const [answer, setAnswer] = useState(item.answer);

  // 外部資料變動（例如重新整理、排序後重載）時同步回輸入框
  useEffect(() => { setQuestion(item.question); }, [item.question]);
  useEffect(() => { setAnswer(item.answer); }, [item.answer]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={e => e.preventDefault()}
      className={`bg-white border rounded-xl p-4 transition-shadow ${
        dragging ? 'border-temple-red shadow-lg opacity-60' : 'border-gray-200'
      } ${item.isVisible ? '' : 'bg-gray-50'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-400">
          <GripVertical className="w-4 h-4 cursor-grab hidden lg:block" />
          {/* 手機改用上下鍵：HTML5 的 drag 事件在觸控裝置不會觸發 */}
          <div className="flex items-center gap-1 lg:hidden -ml-1">
            <button type="button" onClick={() => onMove(-1)} disabled={busy || index === 0}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30" aria-label="上移一題">
              <ChevronUp className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => onMove(1)} disabled={busy || index === total - 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30" aria-label="下移一題">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <span className="text-xs font-medium">第 {index + 1} 題</span>
          {!item.isVisible && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">未顯示</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title={item.isVisible ? '點一下隱藏（前台看不到，資料還在）' : '點一下顯示'}
            onClick={() => onPatch({ isVisible: !item.isVisible })}
            disabled={busy}
            className="p-1.5 rounded-lg text-gray-400 hover:text-temple-red hover:bg-gray-100 disabled:opacity-50"
          >
            {item.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            type="button"
            title="刪除這一題"
            onClick={onDelete}
            disabled={busy}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <label className="block text-xs font-medium text-gray-500 mb-1">問題</label>
      <input
        value={question}
        onChange={e => setQuestion(e.target.value)}
        onBlur={() => { if (question !== item.question) onPatch({ question }); }}
        placeholder="例：問事需要先預約嗎？"
        className={`${inputClass} mb-3 font-medium`}
      />

      <label className="block text-xs font-medium text-gray-500 mb-1">答案</label>
      <textarea
        value={answer}
        onChange={e => setAnswer(e.target.value)}
        onBlur={() => { if (answer !== item.answer) onPatch({ answer }); }}
        rows={3}
        placeholder="用信眾看得懂的話直接回答，不要放連結或標記。"
        className={`${inputClass} resize-y leading-relaxed`}
      />
    </div>
  );
};

const AdminFaqTab: React.FC = () => {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dragFrom = useRef<number | null>(null);
  const [republish, setRepublish] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [republishMsg, setRepublishMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getFaqItems(true));
      setError('');
    } catch (e) {
      console.error(e);
      setError('讀取失敗。若尚未執行 faq_items.sql，請先到 Supabase 的 SQL Editor 執行該檔。');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, p: Partial<FaqItem>) => {
    setItems(prev => prev.map(x => (x.id === id ? { ...x, ...p } : x)));   // 先動畫面，操作才跟手
    setBusy(true);
    try { await updateFaqItem(id, p); }
    catch { alert('儲存失敗，請重新整理後再試'); await load(); }
    finally { setBusy(false); }
  };

  const addItem = async () => {
    setBusy(true);
    try {
      const sortOrder = items.length;
      const draft = { sortOrder, question: '', answer: '', isVisible: false };
      const id = await createFaqItem(draft);
      setItems(prev => [...prev, { id, ...draft }]);
    } catch { alert('新增失敗'); }
    finally { setBusy(false); }
  };

  const removeItem = async (id: string) => {
    if (!window.confirm('確定刪除這一題？刪除後無法復原。')) return;
    setBusy(true);
    try { await deleteFaqItem(id); setItems(prev => prev.filter(x => x.id !== id)); }
    catch { alert('刪除失敗'); }
    finally { setBusy(false); }
  };

  // 拖曳中只重排畫面，放開才寫資料庫——每經過一張卡就送一次請求太浪費
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

  const saveOrder = async (list: FaqItem[]) => {
    setBusy(true);
    try { await reorderFaqItems(list.map(x => x.id)); }
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

  const doRepublish = async () => {
    if (!window.confirm('要重新發布網站嗎？約 1–2 分鐘完成，期間網站照常運作。')) return;
    setRepublish('sending');
    setRepublishMsg('');
    try {
      await requestRepublish();
      setRepublish('sent');
    } catch (e) {
      setRepublish('error');
      setRepublishMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const visibleCount = items.filter(x => x.isVisible).length;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">常見問題</h2>
        <p className="text-sm text-gray-500">
          顯示在首頁最下方的問答區塊（收合式，點一下展開）。
          <strong>答案請寫廟方確認過的事實</strong>，這些內容同時會提供給 Google 與 AI 助理引用。
        </p>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-gray-400 text-sm">載入中…</p>}

      {!loading && !error && (
        <>
          <p className="text-xs text-gray-400 mb-3">
            共 {items.length} 題，其中 {visibleCount} 題顯示中。新增的題目預設為「未顯示」，寫好再按眼睛圖示公開。
          </p>

          <div className="space-y-4">
            {items.map((item, i) => (
              <FaqCard
                key={item.id}
                item={item}
                index={i}
                total={items.length}
                busy={busy}
                dragging={dragFrom.current === i}
                onPatch={p => patch(item.id, p)}
                onDelete={() => removeItem(item.id)}
                onDragStart={() => { dragFrom.current = i; }}
                onDragEnter={() => onDragEnter(i)}
                onDragEnd={onDragEnd}
                onMove={dir => moveItem(i, dir)}
              />
            ))}
            {items.length === 0 && (
              <p className="text-gray-400 text-sm py-8 text-center border border-dashed border-gray-300 rounded-lg">
                還沒有任何題目，按下方「新增問題」開始。
              </p>
            )}
          </div>

          <button type="button" onClick={addItem} disabled={busy}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-temple-red text-white text-sm font-medium hover:bg-[#5C4310] disabled:opacity-50">
            <Plus className="w-4 h-4" /> 新增問題
          </button>

          {/*
            重新發布：上面的修改對「使用者」與「Google」是即時的，
            只有不執行 JS 的 AI 助理（ChatGPT、Claude、Perplexity 的檢索器）讀的是
            上次部署時的靜態快照。要讓它們也讀到最新，就得重跑一次建置。
            不是必按的按鈕，所以文案要把「不按會怎樣」講清楚，避免廟方以為沒存檔。
          */}
          <div className="mt-10 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-1">讓 AI 助理讀到最新內容</h3>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              上面的修改，<strong>信眾與 Google 立刻就看得到，不必按這顆按鈕</strong>。<br />
              只有 ChatGPT、Claude 這類 AI 助理讀的是上次發布時的存檔版本。
              想讓它們也讀到最新的問答，按一下重新發布，約 1–2 分鐘完成，期間網站照常運作。
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={doRepublish} disabled={republish === 'sending'}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-temple-red/40 text-temple-red text-sm font-medium hover:bg-temple-red/5 disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${republish === 'sending' ? 'animate-spin' : ''}`} />
                {republish === 'sending' ? '發布中…' : '重新發布'}
              </button>
              {republish === 'sent' && (
                <span className="text-sm text-green-600">已送出，約 1–2 分鐘後生效。</span>
              )}
              {republish === 'error' && (
                <span className="text-sm text-red-600">發布失敗：{republishMsg}</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminFaqTab;
