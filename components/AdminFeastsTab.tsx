/**
 * 後台「歲時節令」——神明聖誕與每年重複的節日（deity_feasts）
 *
 * 單次活動不在這裡，在「祈福管理」的 blessing_events：那邊存確定的國曆起訖日，
 * 這裡存「每年都會到的規則」。分工見 supabase/migrations/deity_feasts.sql 檔頭。
 *
 * ── 為什麼每一列都要把換算後的日期算給廟方看 ──
 * 廟方填的是「農曆三月廿三」，但真正要對的是「今年到底是哪一天」。
 * 不當場換算給他看，填錯月份或日子沒有任何地方會發現。所以每列直接顯示
 * 今年與明年的國曆日期，等於填完立刻自我驗證。
 *
 * ── 卡片而不是表格 ──
 * 後台已經支援手機（見 index.css 的 .admin-table）。這一頁欄位多且每列都要
 * 顯示兩年的換算結果，硬塞表格在手機上會很擠，直接用卡片列比較實在。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, RefreshCw, CalendarDays } from 'lucide-react';
import {
  getDeityFeasts, createDeityFeast, updateDeityFeast, deleteDeityFeast,
} from '../services/supabase';
import { DeityFeast, DeityFeastData, FeastCalendarType } from '../types';
import {
  LUNAR_MONTH_LABELS_BASE, LUNAR_DAYS, JIEQI_NAMES, resolveFeastDate, feastRuleLabel, weekdayLabel,
  ResolvedFeastDate,
} from '../services/lunarCalendar';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-temple-red';

const blank = (sortOrder: number): DeityFeastData => ({
  title: '', calendarType: 'lunar',
  lunarMonth: 1, lunarDay: 1, isLeapMonth: false,
  solarMonth: null, solarDay: null, jieqi: null,
  note: '', isVisible: false, sortOrder,
});

/**
 * 換算結果的寫法。農曆三十遇小月時已自動改列廿九（鬼門關那類月底的日子年年都有，
 * 只是小月提前一天），這裡一定要標出來——換算過的日期若跟原日期長得一樣，
 * 廟方會以為自己填的三十在那年真的存在。
 */
const fmt = (r: ResolvedFeastDate | null, when: string): React.ReactNode => {
  if (!r) return <span className="text-amber-700">{when}無此日</span>;
  return (
    <>
      {r.date}（週{weekdayLabel(r.date)}）
      {r.adjusted && <span className="text-amber-700">・小月改列廿九</span>}
    </>
  );
};

const TYPE_LABEL: Record<FeastCalendarType, string> = {
  lunar: '農曆固定日',
  solar: '國曆固定日',
  jieqi: '節氣',
};

const AdminFeastsTab: React.FC = () => {
  const [items, setItems] = useState<DeityFeast[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const thisYear = new Date().getFullYear();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getDeityFeasts(true));
      setError('');
    } catch (e) {
      console.error(e);
      setError('讀取失敗。若尚未執行 deity_feasts.sql，請先到 Supabase 的 SQL Editor 執行該檔。');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** 存檔一律整筆送：只改型態卻留著舊型態的欄位會撞上資料表的 CHECK */
  const save = async (id: string, next: DeityFeastData) => {
    setItems(prev => prev.map(x => (x.id === id ? { ...x, ...next } : x)));  // 先動畫面，操作才跟手
    setBusy(true);
    try { await updateDeityFeast(id, next); }
    catch { alert('儲存失敗，請重新整理後再試'); await load(); }
    finally { setBusy(false); }
  };

  const addItem = async () => {
    setBusy(true);
    try {
      const draft = blank(items.length);
      const id = await createDeityFeast(draft);
      setItems(prev => [...prev, { id, ...draft }]);
    } catch { alert('新增失敗'); }
    finally { setBusy(false); }
  };

  const removeItem = async (id: string, title: string) => {
    if (!window.confirm(`確定刪除「${title || '未命名'}」？刪除後無法復原。`)) return;
    setBusy(true);
    try { await deleteDeityFeast(id); setItems(prev => prev.filter(x => x.id !== id)); }
    catch { alert('刪除失敗'); }
    finally { setBusy(false); }
  };

  const visibleCount = items.filter(x => x.isVisible).length;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">歲時節令</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          神明聖誕與每年重複的節日，顯示在前台的
          <span className="font-medium text-gray-700"> /calendar </span>
          分頁。<strong>單次活動請到「祈福管理」建立</strong>，那邊才有報名與費用。
          新增的項目預設為「未顯示」，確認日期無誤再打開。
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" aria-hidden="true" />載入中…
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-3">
            共 {items.length} 筆，其中 {visibleCount} 筆顯示於前台
          </p>

          <div className="space-y-3">
            {items.map(item => {
              const d1 = resolveFeastDate(item, thisYear);
              const d2 = resolveFeastDate(item, thisYear + 1);
              const patch = (p: Partial<DeityFeastData>) => save(item.id, { ...item, ...p });
              return (
                <div key={item.id}
                  className={`rounded-xl border p-4 ${item.isVisible ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50'}`}>

                  <div className="flex items-start gap-2 mb-3">
                    <input
                      value={item.title}
                      onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, title: e.target.value } : x))}
                      onBlur={e => patch({ title: e.target.value })}
                      placeholder="名稱，例如：天上聖母聖誕"
                      aria-label="名稱"
                      className={`${inputClass} font-medium`}
                    />
                    <button type="button" disabled={busy}
                      title={item.isVisible ? '點一下隱藏（前台看不到，資料還在）' : '點一下顯示'}
                      onClick={() => patch({ isVisible: !item.isVisible })}
                      className="p-2 rounded-lg text-gray-400 hover:text-temple-red hover:bg-gray-100 disabled:opacity-50 shrink-0">
                      {item.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button type="button" disabled={busy}
                      onClick={() => removeItem(item.id, item.title)}
                      aria-label="刪除"
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block">
                      <span className="text-xs text-gray-500">日期型態</span>
                      <select value={item.calendarType} className={inputClass}
                        onChange={e => {
                          const t = e.target.value as FeastCalendarType;
                          // 換型態時把另兩種的欄位補成合法初值，否則存檔會撞 CHECK
                          patch({
                            calendarType: t,
                            lunarMonth: t === 'lunar' ? (item.lunarMonth ?? 1) : null,
                            lunarDay:   t === 'lunar' ? (item.lunarDay ?? 1) : null,
                            isLeapMonth: t === 'lunar' ? item.isLeapMonth : false,
                            solarMonth: t === 'solar' ? (item.solarMonth ?? 1) : null,
                            solarDay:   t === 'solar' ? (item.solarDay ?? 1) : null,
                            jieqi:      t === 'jieqi' ? (item.jieqi ?? JIEQI_NAMES[0]) : null,
                          });
                        }}>
                        {(Object.keys(TYPE_LABEL) as FeastCalendarType[]).map(t => (
                          <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                        ))}
                      </select>
                    </label>

                    {item.calendarType === 'lunar' && (
                      <>
                        <label className="block">
                          <span className="text-xs text-gray-500">農曆月</span>
                          <select value={item.isLeapMonth ? `L${item.lunarMonth}` : String(item.lunarMonth ?? 1)}
                            className={inputClass}
                            onChange={e => {
                              const v = e.target.value;
                              const leap = v.startsWith('L');
                              patch({ lunarMonth: Number(leap ? v.slice(1) : v), isLeapMonth: leap });
                            }}>
                            {LUNAR_MONTH_LABELS_BASE.map((label, i) => (
                              <React.Fragment key={label}>
                                <option value={String(i + 1)}>{label}</option>
                                <option value={`L${i + 1}`}>閏{label}</option>
                              </React.Fragment>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-xs text-gray-500">農曆日</span>
                          <select value={String(item.lunarDay ?? 1)} className={inputClass}
                            onChange={e => patch({ lunarDay: Number(e.target.value) })}>
                            {LUNAR_DAYS.map((label, i) => (
                              <option key={label} value={String(i + 1)}>{label}</option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}

                    {item.calendarType === 'solar' && (
                      <>
                        <label className="block">
                          <span className="text-xs text-gray-500">國曆月</span>
                          <select value={String(item.solarMonth ?? 1)} className={inputClass}
                            onChange={e => patch({ solarMonth: Number(e.target.value) })}>
                            {Array.from({ length: 12 }, (_, i) => (
                              <option key={i} value={String(i + 1)}>{i + 1} 月</option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-xs text-gray-500">國曆日</span>
                          <select value={String(item.solarDay ?? 1)} className={inputClass}
                            onChange={e => patch({ solarDay: Number(e.target.value) })}>
                            {Array.from({ length: 31 }, (_, i) => (
                              <option key={i} value={String(i + 1)}>{i + 1} 日</option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}

                    {item.calendarType === 'jieqi' && (
                      <label className="block sm:col-span-2">
                        <span className="text-xs text-gray-500">節氣</span>
                        <select value={item.jieqi ?? JIEQI_NAMES[0]} className={inputClass}
                          onChange={e => patch({ jieqi: e.target.value })}>
                          {JIEQI_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </label>
                    )}
                  </div>

                  <label className="block mt-3">
                    <span className="text-xs text-gray-500">說明（選填，會顯示在前台）</span>
                    <input
                      value={item.note}
                      onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, note: e.target.value } : x))}
                      onBlur={e => patch({ note: e.target.value })}
                      className={inputClass}
                    />
                  </label>

                  {/* 換算結果。填完立刻看得到「今年是哪一天」，錯了當場就會發現 */}
                  <div className="mt-3 flex items-start gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    <CalendarDays className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="leading-relaxed">
                      <span className="text-gray-400">{feastRuleLabel(item)} → </span>
                      {thisYear}：{fmt(d1, '今年')}
                      　{thisYear + 1}：{fmt(d2, '明年')}
                    </p>
                  </div>
                </div>
              );
            })}

            {items.length === 0 && (
              <p className="text-gray-400 text-sm py-10 text-center border border-dashed border-gray-300 rounded-lg">
                還沒有任何項目，按下方「新增」開始建立聖誕與節日。
              </p>
            )}
          </div>

          <button type="button" onClick={addItem} disabled={busy}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-temple-red text-white text-sm font-medium hover:bg-[#5C1A04] disabled:opacity-50">
            <Plus className="w-4 h-4" aria-hidden="true" />新增
          </button>
        </>
      )}
    </div>
  );
};

export default AdminFeastsTab;
