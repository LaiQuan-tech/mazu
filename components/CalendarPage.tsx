/**
 * 歲時祭曆 /calendar
 *
 * 把兩種來源合成一份依日期排序的年度清單：
 *   deity_feasts     每年重複的日子（神明聖誕、節日），存農曆／國曆／節氣規則
 *   blessing_events  今年實際要辦的活動，存確定的國曆起訖日
 * 兩張表刻意分開，理由見 supabase/migrations/deity_feasts.sql 的檔頭。
 *
 * ── 為什麼是條列不是月曆格 ──
 * 信眾以長者居多。375px 手機上月曆格每格只剩約 50px，寫不下「天上聖母聖誕」，
 * 一定要點進去才看得到內容；條列則是一眼讀完，而且對不執行 JS 的 AI 爬蟲
 * 也是有意義的文字。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import PatternMedallion from './PatternMedallion';
import { getDeityFeasts, getBlessingEvents } from '../services/supabase';
import { DeityFeast, BlessingEventRecord } from '../types';
import { resolveFeastDate, feastRuleLabel, solarToLunarLabel, weekdayLabel } from '../services/lunarCalendar';

interface CalendarEntry {
  key: string;
  date: string;                 // YYYY-MM-DD
  endDate?: string;
  title: string;
  kind: 'feast' | 'event';
  ruleLabel: string;            // 「農曆三月廿三」「節氣・冬至」
  adjusted?: boolean;           // 農曆三十遇小月，已改列廿九
  note?: string;
}

const todayYmd = (): string => {
  // 一律本地時區組字串，不用 toISOString（台灣早上 8 點前會差一天，見 CLAUDE.md）
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const CalendarPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [feasts, setFeasts] = useState<DeityFeast[]>([]);
  const [events, setEvents] = useState<BlessingEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  /**
   * 今年已經過去的日子預設收起來。
   *
   * 這一頁列的是整年。九月打開時，三月到八月的二十二筆全排在上面，第一個還沒到的
   * 日子落在頁面 62% 的位置（實測手機 390px：3456px / 全頁 5595px）——信眾要滑過
   * 二十二筆灰掉的舊資料才看得到普渡法會，等於沒顯示。所以預設只給「今天以後」，
   * 想看整年再展開。切到明年時整年都還沒到，這個開關自然不出現。
   */
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      // 兩者各自獨立：其中一個掛掉不該讓整頁空白，所以用 allSettled 各自處理
      const [f, e] = await Promise.allSettled([getDeityFeasts(), getBlessingEvents()]);
      if (!alive) return;
      setFeasts(f.status === 'fulfilled' ? f.value : []);
      // **刻意不濾 isActive**：那個旗標管的是「在祈福活動頁上架、還能報名」，
      // 行事曆記的是「今年有這件事」。報名截止不代表活動沒發生——普渡法會
      // 9/06 截止、9/13 舉行，濾掉的話 9/13 那天就只剩神明聖誕。
      // 反過來說，後台建的每一筆祈福活動都會出現在這裡，包含為了下架而關閉的。
      setEvents(e.status === 'fulfilled' ? e.value : []);
      // 只有「聖誕」讀失敗才算整頁失敗——那是這一頁的主體，
      // migration 還沒跑時會落在這裡，要讓廟方看得出來而不是以為沒資料
      setFailed(f.status === 'rejected');
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  /** 今年算不出日期的（指定了閏月但該年沒閏）。據實另列，不拿別的月份頂替 */
  const [entries, unresolved] = useMemo(() => {
    const list: CalendarEntry[] = [];
    const skipped: DeityFeast[] = [];

    feasts.forEach(f => {
      const resolved = resolveFeastDate(f, year);
      if (!resolved) { skipped.push(f); return; }
      list.push({
        key: `f-${f.id}`, date: resolved.date, title: f.title, kind: 'feast',
        ruleLabel: feastRuleLabel(f), adjusted: resolved.adjusted, note: f.note || undefined,
      });
    });

    events.forEach(ev => {
      if (!ev.startDate?.startsWith(String(year))) return;
      list.push({
        key: `e-${ev.id}`, date: ev.startDate,
        endDate: ev.endDate && ev.endDate !== ev.startDate ? ev.endDate : undefined,
        title: ev.title, kind: 'event',
        ruleLabel: solarToLunarLabel(ev.startDate),
        note: ev.description || undefined,
      });
    });

    list.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
    return [list, skipped];
  }, [feasts, events, year]);

  const today = todayYmd();
  /** 今年才需要區分過去與未來；明年整年都還沒到 */
  const pastCount = year === thisYear ? entries.filter(x => x.date < today).length : 0;
  // 全部都過去了（例如年底）就照常列出來，否則會變成一片空白
  const hidePast = pastCount > 0 && pastCount < entries.length && !showPast;
  const shown = hidePast ? entries.filter(x => x.date >= today) : entries;

  const byMonth = useMemo(() => {
    const m = new Map<number, CalendarEntry[]>();
    shown.forEach(x => {
      const mo = Number(x.date.slice(5, 7));
      if (!m.has(mo)) m.set(mo, []);
      m.get(mo)!.push(x);
    });
    return m;
  }, [shown]);


  return (
    <div className="relative pt-20 bg-temple-bg min-h-screen overflow-hidden">
      {/* 右邊界空 8/10、左邊 6/10，放右側 */}
      <PatternMedallion motif="dragon" side="r" />
      <section className="page-content py-16 sm:py-20 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* 標題：小標 h2 → 大標 h1 → 分隔飾 → 說明（全站統一寫法，見 CLAUDE.md） */}
          <header className="text-center mb-12">
            <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center justify-center gap-3">
              <span className="w-8 h-1 bg-temple-gold" />歲時祭曆<span className="w-8 h-1 bg-temple-gold" />
            </h2>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-temple-dark">神明聖誕與壇務活動</h1>
            <div className="flex items-center justify-center gap-3 mt-3">
              <span className="w-12 h-px bg-temple-gold/70" />
              <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
              <span className="w-12 h-px bg-temple-gold/70" />
            </div>
            <p className="mt-5 text-gray-600 leading-relaxed">
              聖誕依農曆，換算成國曆每年不同；本表已為您換算。
            </p>
          </header>

          {/* 年份切換。只提供今年與明年——再往後廟方也還沒排定活動 */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {[thisYear, thisYear + 1].map(y => (
              <button key={y} type="button" onClick={() => setYear(y)}
                className={`px-5 py-2.5 rounded-full text-base font-medium border transition-colors ${
                  year === y
                    ? 'bg-temple-red text-white border-temple-red'
                    : 'bg-white text-temple-dark border-temple-gold/40 hover:border-temple-gold'
                }`}>
                {y} 年
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" aria-hidden="true" />載入中…
            </div>
          ) : failed ? (
            <p role="alert" className="text-center text-gray-500 py-16">
              歲時祭曆暫時無法載入，請稍後再試。
            </p>
          ) : entries.length === 0 ? (
            <p className="text-center text-gray-500 py-16">
              {year} 年的歲時祭曆尚未建立，請洽本壇。
            </p>
          ) : (
            <>
              {/* 過去的日子預設收起。用文字按鈕而不是小圖示——信眾以長者居多，
                  講明白「已過去的 N 項」比一個箭頭清楚 */}
              {pastCount > 0 && pastCount < entries.length && (
                <button type="button" onClick={() => setShowPast(v => !v)}
                  className="w-full mb-8 py-3 px-4 rounded-xl border border-dashed border-temple-gold/50 text-sm text-gray-600 hover:border-temple-gold hover:text-temple-dark transition-colors">
                  {showPast
                    ? `收起今年已過去的 ${pastCount} 項`
                    : `本頁只列今天以後的日子・展開今年已過去的 ${pastCount} 項`}
                </button>
              )}

              <div className="space-y-10">
                {[...byMonth.keys()].sort((a, b) => a - b).map(mo => (
                  <section key={mo}>
                    <h3 className="font-serif text-xl font-bold text-temple-red mb-4 flex items-center gap-3">
                      <span className="w-6 h-1 bg-temple-gold" aria-hidden="true" />{mo} 月
                    </h3>
                    <ul className="space-y-3">
                      {byMonth.get(mo)!.map(x => {
                        const past = x.date < today && year === thisYear;
                        return (
                          <li key={x.key}
                            className={`rounded-xl border bg-white px-4 py-4 sm:px-5 flex gap-4 ${
                              past ? 'border-gray-100 opacity-60' : 'border-temple-gold/25'
                            }`}>
                            {/* 日期欄固定寬，讓各列的名稱對齊 */}
                            <div className="shrink-0 w-14 text-center">
                              <p className="font-serif text-2xl leading-none text-temple-dark">{Number(x.date.slice(8, 10))}</p>
                              <p className="text-xs text-gray-500 mt-1">週{weekdayLabel(x.date)}</p>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <p className="font-serif text-lg text-temple-dark">{x.title}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  x.kind === 'event'
                                    ? 'bg-temple-red/10 text-temple-red'
                                    : 'bg-temple-gold/20 text-[#5C4310]'
                                }`}>
                                  {x.kind === 'event' ? '壇務活動' : '聖誕節日'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 mt-1">
                                {x.ruleLabel}
                                {x.adjusted && <span className="text-amber-700">（今年小月，改列廿九）</span>}
                                {x.endDate && `　至 ${x.endDate.slice(5).replace('-', ' / ')}`}
                              </p>
                              {x.note && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{x.note}</p>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>

              {unresolved.length > 0 && (
                <div className="mt-12 rounded-xl border border-gray-200 bg-white/70 px-5 py-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">{year} 年沒有這幾個日子</p>
                  <ul className="text-sm text-gray-500 space-y-1">
                    {unresolved.map(f => (
                      <li key={f.id}>{f.title}（{feastRuleLabel(f)}）</li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                    農曆閏月每十九年才輪七次，這幾筆今年沒有對應的日子，並非漏列。
                  </p>
                </div>
              )}
            </>
          )}

          <div className="mt-14 text-center">
            <button type="button" onClick={onBack}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-temple-gold/50 text-temple-dark hover:bg-temple-gold/10 transition-colors">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />回首頁
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CalendarPage;
