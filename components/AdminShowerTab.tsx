/**
 * 後台「洗澡車」——管理進香洗澡車與志工的打卡連結
 *
 * 打卡本身不在這裡，在 /shower/checkin（志工用專屬連結，不必登入）。
 * 這一頁只做三件事：開一台車、把連結發出去、需要時把鑰匙換掉。
 * 權限與資料設計見 supabase/migrations/shower_trucks.sql 的檔頭。
 *
 * ── 這一頁最重要的互動是「複製連結」 ──
 * 廟方要把連結用 LINE 傳給現場志工。要他照著螢幕把 32 個十六進位字元抄進訊息裡，
 * 一定會抄錯，而抄錯的後果是志工到了現場才發現打不了卡。所以連結整串可複製，
 * 而且複製的是完整網址（含網域），貼到 LINE 就是可以點的。
 *
 * ── 鑰匙要看得到也要能換 ──
 * 看得到是因為廟方得把它發出去；能換是因為它會外流（志工換人、連結被轉傳）。
 * 重發之後舊連結立刻失效，這點要在確認視窗裡講明白。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, RefreshCw, Copy, Check, KeyRound, ShowerHead, ExternalLink } from 'lucide-react';
import {
  getShowerTrucks, createShowerTruck, updateShowerTruck, regenerateShowerKey, deleteShowerTruck,
} from '../services/supabase';
import { ShowerTruckAdmin } from '../types';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-temple-red';

/** 完整網址。複製出去要能直接點，所以帶上網域而不是只有路徑 */
const checkinUrl = (key: string): string =>
  `${typeof window === 'undefined' ? 'https://heshengtan.tw' : window.location.origin}/shower/checkin?k=${key}`;

const AdminShowerTab: React.FC = () => {
  const [trucks, setTrucks] = useState<ShowerTruckAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTrucks(await getShowerTrucks()); setError(''); }
    catch {
      setError('讀取失敗。若尚未執行 shower_trucks.sql，請先到 Supabase 的 SQL Editor 執行該檔。');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, d: Partial<{ name: string; isActive: boolean }>) => {
    setTrucks(prev => prev.map(t => (t.id === id ? { ...t, ...d } : t)));   // 先動畫面，操作才跟手
    setBusy(true);
    try { await updateShowerTruck(id, d); }
    catch { alert('儲存失敗，請重新整理後再試'); await load(); }
    finally { setBusy(false); }
  };

  const add = async () => {
    setBusy(true);
    try {
      const created = await createShowerTruck(`洗澡車 ${trucks.length + 1}`, trucks.length + 1);
      setTrucks(prev => [...prev, created]);
    } catch {
      alert('新增失敗。若尚未執行 shower_trucks.sql，請先到 Supabase 的 SQL Editor 執行該檔。');
    } finally { setBusy(false); }
  };

  const copy = async (t: ShowerTruckAdmin) => {
    try {
      await navigator.clipboard.writeText(checkinUrl(t.checkinKey));
      setCopiedId(t.id);
      window.setTimeout(() => setCopiedId(c => (c === t.id ? null : c)), 2000);
    } catch { alert('複製失敗，請手動選取網址複製。'); }
  };

  const regen = async (t: ShowerTruckAdmin) => {
    if (!window.confirm(
      `確定要重發「${t.name}」的打卡連結嗎？\n\n` +
      '舊連結會立刻失效，已經拿到舊連結的志工將無法打卡，要重新把新連結發給他們。',
    )) return;
    setBusy(true);
    try {
      const key = await regenerateShowerKey(t.id);
      setTrucks(prev => prev.map(x => (x.id === t.id ? { ...x, checkinKey: key } : x)));
    } catch { alert('重發失敗，請稍後再試'); }
    finally { setBusy(false); }
  };

  const remove = async (t: ShowerTruckAdmin) => {
    if (!window.confirm(
      `確定要刪除「${t.name}」嗎？\n\n它的所有打卡紀錄也會一起刪除，無法復原。\n` +
      '若只是這次進香結束，建議改用「隱藏」——資料留著，明年可以直接重發連結。',
    )) return;
    setBusy(true);
    try { await deleteShowerTruck(t.id); setTrucks(prev => prev.filter(x => x.id !== t.id)); }
    catch { alert('刪除失敗'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1 flex items-center gap-2">
          <ShowerHead className="w-5 h-5 text-temple-red" aria-hidden="true" />
          進香洗澡車
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          白沙屯媽祖進香期間，免費提供香客盥洗的移動式洗澡車。
          香客在前台的
          <a href="/shower" target="_blank" rel="noopener noreferrer"
            className="font-medium text-temple-red hover:underline mx-1 inline-flex items-center gap-0.5">
            /shower<ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
          查目前位置並導航。
        </p>
        <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 leading-relaxed">
          <p className="font-medium text-gray-700 mb-1">打卡連結怎麼用</p>
          <p>
            每台車一條專屬連結，用 LINE 傳給該車的志工。志工點開按一下「我在這裡」就會回報位置，
            <strong>不必註冊也不必登入</strong>。
          </p>
          <p className="mt-1">
            連結等同鑰匙，<strong>請不要公開張貼</strong>；若外流或志工換人，按「重發連結」即可讓舊的失效。
          </p>
        </div>
      </div>

      {error && <p role="alert" className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" aria-hidden="true" />載入中…
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {trucks.map(t => (
              <div key={t.id}
                className={`rounded-xl border p-4 ${t.isActive ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-start gap-2 mb-3">
                  <input
                    value={t.name}
                    onChange={e => setTrucks(prev => prev.map(x => x.id === t.id ? { ...x, name: e.target.value } : x))}
                    onBlur={e => patch(t.id, { name: e.target.value })}
                    placeholder="車輛名稱，例：洗澡車 1"
                    aria-label="車輛名稱"
                    className={`${inputClass} font-medium`}
                  />
                  <button type="button" disabled={busy}
                    title={t.isActive ? '點一下隱藏（香客頁看不到、打卡連結也會失效）' : '點一下啟用'}
                    onClick={() => patch(t.id, { isActive: !t.isActive })}
                    className="p-2 rounded-lg text-gray-400 hover:text-temple-red hover:bg-gray-100 disabled:opacity-50 shrink-0">
                    {t.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button type="button" disabled={busy} onClick={() => remove(t)} aria-label="刪除"
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <label className="block">
                  <span className="text-xs text-gray-500">志工打卡連結</span>
                  {/* 唯讀＋等寬：這串是給人複製的不是給人改的，改了也不會生效 */}
                  <input
                    readOnly
                    value={checkinUrl(t.checkinKey)}
                    onFocus={e => e.currentTarget.select()}
                    aria-label="志工打卡連結"
                    className={`${inputClass} font-mono text-xs bg-gray-50 mt-1`}
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <button type="button" onClick={() => copy(t)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-temple-red text-white rounded-lg hover:bg-[#5C4310] transition-colors">
                    {copiedId === t.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === t.id ? '已複製' : '複製連結'}
                  </button>
                  <button type="button" disabled={busy} onClick={() => regen(t)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 rounded-lg transition-colors disabled:opacity-50">
                    <KeyRound className="w-3.5 h-3.5" />重發連結
                  </button>
                  {!t.isActive && <span className="text-xs text-gray-400">已隱藏，連結目前無法打卡</span>}
                </div>
              </div>
            ))}

            {trucks.length === 0 && (
              <p className="text-gray-400 text-sm py-10 text-center border border-dashed border-gray-300 rounded-lg">
                還沒有任何洗澡車，按下方「新增洗澡車」建立第一台。
              </p>
            )}
          </div>

          <button type="button" onClick={add} disabled={busy}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-temple-red text-white text-sm font-medium hover:bg-[#5C1A04] disabled:opacity-50">
            <Plus className="w-4 h-4" aria-hidden="true" />新增洗澡車
          </button>
        </>
      )}
    </div>
  );
};

export default AdminShowerTab;
