import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import AdminAboutTab from './AdminAboutTab';
import {
  getRelocationPlans, createRelocationPlan, updateRelocationPlan, deleteRelocationPlan,
  getRelocationHome, saveRelocationHome,
} from '../services/supabase';
import { RelocationPlan, RelocationPlanRow, RelocationHome } from '../types';

/**
 * 後台「遷址募款」
 *
 * 圖文段落沿用 AdminAboutTab（page='relocation'），下方接方案矩陣編輯器。
 * 矩陣＝金額當欄、回饋項目當列，格子點一下就在 ✓ ／ — ／ 空白之間切換——
 * 讓廟方自己打「✓」這種符號太為難人，用點的最快。
 */

const inputClass =
  'px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-temple-red';

/** 格子的三種狀態，點一下往後輪一格 */
const CELL_STATES = ['✓', '—', ''];
const nextCell = (v: string): string => {
  const i = CELL_STATES.indexOf(v.trim());
  return CELL_STATES[(i + 1) % CELL_STATES.length];
};

interface PlanEditorProps {
  plan: RelocationPlan;
  onPatch: (patch: Partial<RelocationPlan>) => void;
  onDelete: () => void;
}

const PlanEditor: React.FC<PlanEditorProps> = ({ plan, onPatch, onDelete }) => {
  const [title, setTitle] = useState(plan.title);
  const [amountHeader, setAmountHeader] = useState(plan.amountHeader);
  const [intro, setIntro] = useState(plan.intro);
  const [note, setNote] = useState(plan.note);

  useEffect(() => { setTitle(plan.title); }, [plan.title]);
  useEffect(() => { setAmountHeader(plan.amountHeader); }, [plan.amountHeader]);
  useEffect(() => { setIntro(plan.intro); }, [plan.intro]);
  useEffect(() => { setNote(plan.note); }, [plan.note]);

  const setTier = (i: number, value: string) => {
    const tiers = [...plan.tiers]; tiers[i] = value;
    onPatch({ tiers });
  };
  const addTier = () => {
    // 加一欄的同時每一列都要補一格，否則欄列長度對不上
    onPatch({
      tiers: [...plan.tiers, ''],
      rows: plan.rows.map(r => ({ ...r, cells: [...r.cells, ''] })),
    });
  };
  const removeTier = (i: number) => {
    onPatch({
      tiers: plan.tiers.filter((_, x) => x !== i),
      rows: plan.rows.map(r => ({ ...r, cells: r.cells.filter((_, x) => x !== i) })),
    });
  };

  const setRow = (i: number, row: RelocationPlanRow) => {
    const rows = [...plan.rows]; rows[i] = row;
    onPatch({ rows });
  };
  const addRow = () => onPatch({ rows: [...plan.rows, { label: '', cells: plan.tiers.map(() => '') }] });
  const removeRow = (i: number) => onPatch({ rows: plan.rows.filter((_, x) => x !== i) });

  return (
    <div className={`bg-white rounded-lg border p-4 ${plan.isVisible ? 'border-gray-200' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-1 grid sm:grid-cols-2 gap-3">
          <label className="text-xs text-gray-500">表格標題
            <input value={title} placeholder="例：每月同行｜月供養"
              onChange={e => setTitle(e.target.value)}
              onBlur={() => { if (title !== plan.title) onPatch({ title }); }}
              className={`${inputClass} w-full mt-1 font-bold`} />
          </label>
          <label className="text-xs text-gray-500">左上角欄位名
            <input value={amountHeader} placeholder="例：每月供養"
              onChange={e => setAmountHeader(e.target.value)}
              onBlur={() => { if (amountHeader !== plan.amountHeader) onPatch({ amountHeader }); }}
              className={`${inputClass} w-full mt-1`} />
          </label>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button type="button" onClick={() => onPatch({ isVisible: !plan.isVisible })}
            title={plan.isVisible ? '目前顯示中，點一下隱藏' : '目前隱藏，點一下顯示'}
            className={`p-2 rounded border ${plan.isVisible
              ? 'border-green-300 text-green-600 hover:bg-green-50'
              : 'border-gray-300 text-gray-400 hover:bg-gray-50'}`}>
            {plan.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button type="button" onClick={onDelete} title="刪除這張表"
            className="p-2 rounded border border-gray-300 text-gray-400 hover:border-red-400 hover:text-red-600">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <label className="block text-xs text-gray-500 mb-4">表格上方說明（可留空）
        <textarea value={intro} rows={2} placeholder="例：您的每一份護持，都是新壇落成的一塊磚"
          onChange={e => setIntro(e.target.value)}
          onBlur={() => { if (intro !== plan.intro) onPatch({ intro }); }}
          className={`${inputClass} w-full mt-1 resize-y`} />
      </label>

      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="p-1 text-left text-xs text-gray-400 font-normal w-40">項目＼金額</th>
              {plan.tiers.map((t, i) => (
                <th key={i} className="p-1">
                  <div className="flex items-center gap-1">
                    <input value={t} placeholder="金額"
                      onChange={e => setTier(i, e.target.value)}
                      className={`${inputClass} w-28 text-center font-bold`} />
                    <button type="button" onClick={() => removeTier(i)} title="刪除這一欄"
                      className="text-gray-300 hover:text-red-500 text-xs px-1">✕</button>
                  </div>
                </th>
              ))}
              <th className="p-1">
                <button type="button" onClick={addTier}
                  className="whitespace-nowrap px-3 py-2 rounded-lg border border-dashed border-gray-300 text-gray-500 text-sm hover:border-temple-red hover:text-temple-red">
                  ＋欄
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((row, ri) => (
              <tr key={ri}>
                <td className="p-1">
                  <div className="flex items-center gap-1">
                    <input value={row.label} placeholder="回饋項目"
                      onChange={e => setRow(ri, { ...row, label: e.target.value })}
                      className={`${inputClass} w-36`} />
                    <button type="button" onClick={() => removeRow(ri)} title="刪除這一列"
                      className="text-gray-300 hover:text-red-500 text-xs px-1">✕</button>
                  </div>
                </td>
                {plan.tiers.map((_, ci) => {
                  const v = row.cells[ci] ?? '';
                  return (
                    <td key={ci} className="p-1 text-center">
                      <button type="button"
                        onClick={() => {
                          const cells = [...row.cells];
                          while (cells.length < plan.tiers.length) cells.push('');
                          cells[ci] = nextCell(v);
                          setRow(ri, { ...row, cells });
                        }}
                        title="點一下切換：✓ → — → 空白"
                        className={`w-28 py-2 rounded-lg border text-lg font-bold ${
                          v.trim() === '✓' ? 'border-temple-gold bg-temple-gold/10 text-temple-red'
                          : v.trim() === '—' ? 'border-gray-200 text-gray-400'
                          : 'border-dashed border-gray-200 text-gray-300'}`}>
                        {v.trim() || '　'}
                      </button>
                    </td>
                  );
                })}
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={addRow}
        className="mt-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-gray-500 text-sm hover:border-temple-red hover:text-temple-red">
        ＋列（回饋項目）
      </button>

      <label className="block text-xs text-gray-500 mt-4">表格下方說明（可留空）
        <textarea value={note} rows={2} placeholder="例：功德主芳名將刊載於遷址功德簿"
          onChange={e => setNote(e.target.value)}
          onBlur={() => { if (note !== plan.note) onPatch({ note }); }}
          className={`${inputClass} w-full mt-1 resize-y`} />
      </label>
    </div>
  );
};

const PlansEditor = () => {
  const [plans, setPlans] = useState<RelocationPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setPlans(await getRelocationPlans(true)); setError(''); }
    catch (e) {
      console.error(e);
      setError('讀取捐款方案失敗。若尚未執行 relocation_page.sql，請先到 Supabase 執行該檔。');
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, p: Partial<RelocationPlan>) => {
    setPlans(prev => prev.map(x => (x.id === id ? { ...x, ...p } : x)));
    try { await updateRelocationPlan(id, p); }
    catch { alert('方案儲存失敗，請重新整理後再試'); await load(); }
  };

  const addPlan = async () => {
    try {
      const sortOrder = plans.length;
      const data = { sortOrder, title: '', amountHeader: '金額', intro: '', tiers: [''], rows: [{ label: '', cells: [''] }], note: '', isVisible: true };
      const id = await createRelocationPlan(data);
      setPlans(prev => [...prev, { id, ...data }]);
    } catch { alert('新增失敗'); }
  };

  const removePlan = async (id: string) => {
    if (!window.confirm('確定刪除整張方案表？刪除後無法復原。')) return;
    try { await deleteRelocationPlan(id); setPlans(prev => prev.filter(p => p.id !== id)); }
    catch { alert('刪除失敗'); }
  };

  return (
    <div className="mt-10 pt-6 border-t border-gray-200">
      <h3 className="text-lg font-bold text-gray-800 mb-1">捐款方案</h3>
      <p className="text-sm text-gray-500 mb-4">
        金額是欄、回饋項目是列。格子點一下切換 <strong>✓ → — → 空白</strong>。方案表會顯示在圖文段落之後。
      </p>

      {error && <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-gray-400 text-sm">載入中…</p>}

      {!loading && (
        <>
          <div className="space-y-6">
            {plans.map(p => (
              <PlanEditor key={p.id} plan={p} onPatch={x => patch(p.id, x)} onDelete={() => removePlan(p.id)} />
            ))}
            {plans.length === 0 && (
              <p className="text-gray-400 text-sm py-8 text-center border border-dashed border-gray-300 rounded-lg">
                還沒有方案表，按下方「新增方案表」開始。
              </p>
            )}
          </div>
          <button type="button" onClick={addPlan}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-temple-red text-white text-sm font-medium hover:bg-[#5C4310]">
            <Plus className="w-4 h-4" /> 新增方案表
          </button>
        </>
      )}
    </div>
  );
};

/**
 * 首頁摘要：與 /relocation 的段落分開寫。
 * 首頁那一格空間有限，通常要比內頁更精簡；留空則自動退回內頁的第一段。
 */
const HomeSummaryEditor = () => {
  const [v, setV] = useState<RelocationHome>({ heading: '', body: '' });
  const [saved, setSaved] = useState<RelocationHome>({ heading: '', body: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRelocationHome().then(x => { setV(x); setSaved(x); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async (next: RelocationHome) => {
    setSaved(next);
    try { await saveRelocationHome(next); }
    catch { alert('首頁摘要儲存失敗'); }
  };

  if (loading) return null;
  return (
    <div className="mt-10 pt-6 border-t border-gray-200">
      <h3 className="text-lg font-bold text-gray-800 mb-1">首頁摘要</h3>
      <p className="text-sm text-gray-500 mb-4">
        顯示在首頁「祀奉神尊」下方的遷址募款區塊。<strong>留空</strong>就自動使用下方第一個段落的內容。
        照片同樣取自第一個段落。
      </p>
      <div className="space-y-3 max-w-3xl">
        <label className="block text-xs text-gray-500">標題
          <input value={v.heading} placeholder="留空則沿用第一個段落的標題"
            onChange={e => setV({ ...v, heading: e.target.value })}
            onBlur={() => { if (v.heading !== saved.heading) save(v); }}
            className={`${inputClass} w-full mt-1 font-bold`} />
        </label>
        <label className="block text-xs text-gray-500">
          <span className="flex items-baseline justify-between">
            <span>短文</span>
            <span className="text-gray-400">{v.body.length} 字</span>
          </span>
          <textarea value={v.body} rows={5} placeholder="留空則沿用第一個段落的第一段"
            onChange={e => setV({ ...v, body: e.target.value })}
            onBlur={() => { if (v.body !== saved.body) save(v); }}
            className={`${inputClass} w-full mt-1 leading-relaxed resize-y`} />
        </label>
      </div>
    </div>
  );
};

const AdminRelocationTab = () => (
  <AdminAboutTab
    page="relocation"
    title="遷址募款"
    description={<>這裡的段落會顯示在「遷址募款」頁；方案表格排在段落之後。</>}
  >
    <HomeSummaryEditor />
    <PlansEditor />
  </AdminAboutTab>
);

export default AdminRelocationTab;
