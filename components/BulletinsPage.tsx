/**
 * 公佈欄完整清單 /bulletins
 *
 * 首頁的 #bulletin 只放置頂＋最新 5 則（廟方 2026-10-11：公告變多之後首頁會太長），
 * 這一頁放全部。卡片與首頁共用 `BulletinCard`——**同一則公告在兩邊必須長得一樣**，
 * 兩份樣式遲早會分岔。
 *
 * ── 分類篩選放這裡不放首頁 ──
 * 首頁只有幾則，篩下去常常是空的，那排篩選鈕在首頁只是多一排要讀的東西。
 * 到了完整清單才真的有東西可篩。
 *
 * ── 單則公告有自己的網址 ──
 * 展開某一則時把網址換成 `/bulletins/<id>`（用 replaceState，不堆上一頁的歷史），
 * 廟方要把某一則分享到 LINE 時，直接複製網址列就好。
 * 反過來，別人點那條連結進來時那一則會自動展開並捲到定位。
 * **分享卡片仍是整個網站的那一張**：單則的 og 標籤需要為每一則產一份靜態 HTML，
 * 而公告是資料庫來的、發佈當下不會重新建置。連結點進來會落在正確的公告上，
 * 但預覽圖文是通用的——這是已知的取捨，不是漏做。
 *
 * ── 衍生卡沒有自己的網址 ──
 * 「近期辦事日」這類是由服務資料即時算出來的（見 services/derivedBulletins.ts），
 * id 不是真的主鍵、內容每天都在變，給它一條固定網址只會指到一個會漂移的東西。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Megaphone } from 'lucide-react';
import PatternMedallion from './PatternMedallion';
import { BulletinCard, scrollCardToTop } from './BulletinBody';
import { BulletinCategory, BulletinRecord } from '../types';
import { isDerivedBulletin } from '../services/derivedBulletins';
import Pagination, { PAGE_SIZE, pageSlice, pageCountOf } from './Pagination';

interface Props {
  bulletins: BulletinRecord[];
  /** 進站時網址指定的那一則（/bulletins/<id>），沒有就是空字串 */
  initialId?: string;
  onBack: () => void;
  onService: (service: NonNullable<BulletinRecord['linkedService']>, eventId?: string) => void;
}

const BulletinsPage: React.FC<Props> = ({ bulletins, initialId = '', onBack, onService }) => {
  const [filter, setFilter] = useState<string>('all');
  const [openId, setOpenId] = useState<string>(initialId);
  const [page, setPage] = useState(0);
  /** 已經捲過一次就不要再捲——使用者自己往下滑之後被拉回去會很煩 */
  const scrolledRef = useRef(false);
  /** 翻頁後要把清單頂端捲回畫面上方，不然會落在上一頁的位置、看起來像沒反應 */
  const listRef = useRef<HTMLDivElement>(null);

  const shown = useMemo(
    () => (filter === 'all' ? bulletins : bulletins.filter(b => b.category === filter)),
    [bulletins, filter],
  );
  const pageCount = pageCountOf(shown.length);
  /**
   * **頁碼要夾住。** 公告是即時資料：廟方在後台下架一則、或是衍生卡（近期辦事日那種）
   * 當天沒有場次了，總頁數就會變少，停在第 3 頁的人會看到一片空白而不是錯誤。
   * 夾在這裡而不是用 effect 去 setPage，是因為算出來馬上就要用，
   * 等下一輪 render 中間會先閃一次空清單。
   */
  const safePage = Math.min(page, pageCount - 1);
  const shownPage = pageSlice(shown, safePage);

  /** 換頁、換分類都從頭看起 */
  const goPage = (p: number) => {
    setPage(p);
    // 翻頁等於換一批內容，原本展開的那一則已經不在畫面上了，連網址一起收掉
    setOpenId('');
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/bulletins' + window.location.search);
    }
    if (listRef.current) scrollCardToTop(listRef.current);
  };

  /**
   * 從 /bulletins/<id> 進來：那一則展開並捲到定位。
   * 等資料載進來才找得到元素，所以依賴 bulletins。
   *
   * **要捲不只一次**：瀏覽器在 load 完成之後會把捲動位置還原（預設
   * `history.scrollRestoration = 'auto'`），而我們是在資料回來時就捲的——
   * 比 load 早，所以第一次捲的結果會被還原成 0 蓋掉。實測直接開
   * `/bulletins/<id>` 會停在最上面，分享連結點進來還是要自己找那一則。
   * 不改全域的 scrollRestoration（那會動到其他頁按上一頁的行為），
   * 改成在 load 前後各補一次。
   *
   * **用 instant 不用 smooth**：smooth 的動畫要跑幾百毫秒，正好落在還原的時間窗裡。
   * 而且已經在畫面上就不再捲——使用者這 0.7 秒內可能自己滑走了。
   */
  /**
   * **深連結要先翻到那一則所在的頁**，不然卡片根本沒被渲染，下面那支捲動的
   * effect 找不到元素，`/bulletins/<id>` 會停在第 1 頁最上面。
   * 分頁是對**未篩選**的清單算的——進站時 filter 一定是 all。
   */
  const pagedRef = useRef(false);
  useEffect(() => {
    if (!initialId || pagedRef.current || bulletins.length === 0) return;
    const i = bulletins.findIndex(b => b.id === initialId);
    if (i < 0) return;
    pagedRef.current = true;
    setPage(Math.floor(i / PAGE_SIZE));
  }, [initialId, bulletins]);

  useEffect(() => {
    if (!initialId || scrolledRef.current || bulletins.length === 0) return;
    if (!document.getElementById(`bulletin-card-${initialId}`)) return;
    scrolledRef.current = true;

    const jump = () => {
      const el = document.getElementById(`bulletin-card-${initialId}`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      // 已經貼齊上方就別動（門檻跟著 block:'start' 收窄，不是「看得到就算數」）
      if (r.top >= 0 && r.top < 160) return;
      // **對齊卡片頂端，不要置中**（2026-10-13 廟方：「應該要從海報開始閱讀」）：
      // 置中是把整張卡的中點對齊畫面中央，而海報最高 36rem、比手機一個螢幕還高，
      // 置中之後標題與海報都被推到畫面上方，第一眼直接落在內文上。
      // 與展開時共用 scrollCardToTop（`scrollIntoView` 的 smooth 在本專案無效，見該函式）。
      scrollCardToTop(el);
    };
    jump();
    const timers = [200, 700].map(ms => window.setTimeout(jump, ms));
    return () => timers.forEach(window.clearTimeout);
    // safePage 也要進相依：上面那支把頁翻過去之後，卡片才存在、這支才找得到它
  }, [initialId, bulletins, safePage]);

  /** 展開／收合時同步網址。衍生卡沒有穩定的 id，不給網址 */
  const toggle = (b: BulletinRecord) => {
    const next = openId === b.id ? '' : b.id;
    setOpenId(next);
    if (typeof window === 'undefined') return;
    const path = next && !isDerivedBulletin(next) ? `/bulletins/${encodeURIComponent(next)}` : '/bulletins';
    // 保留原本的 query：?preview=1 這類功能性參數掉了，重新整理就會換一種行為
    window.history.replaceState({}, '', path + window.location.search);
  };

  return (
    /* 底色要**白的**，不是 bg-temple-bg（廟方 2026-10-12：「公布欄的顏色被背景吃掉了」）。
       卡片自己就是 `bg-temple-bg` 的米色，整頁也用同一個色等於卡片直接消失在背景裡。
       首頁的 #bulletin 區塊本來就是 bg-white，這一頁跟著白才會長得一樣——
       同一則公告在兩邊必須一致，這正是當初把卡片抽成 BulletinCard 的理由。 */
    <div className="relative pt-20 bg-white min-h-screen overflow-hidden">
      <PatternMedallion motif="phoenix" side="r" />
      <section className="page-content py-16 sm:py-20 relative z-10">
        {/*
          **桌機的欄寬要配海報，不是配文字**（2026-10-30 廟方：桌機「怪怪的」）。
          原本 `max-w-4xl`＝卡片 832px，而海報收合時被 `max-h-72` 夾住只有 427px 寬，
          兩側各留 200px 空白——海報變成一張飄在大白板中間的小圖。
          收到 `max-w-2xl`＝卡片 608px，3:2 的海報剛好 608×411 **填滿整欄**，
          也正好是中文內文舒服的行長（約 38 字）。手機不受影響（本來就滿版）。
        */}
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* 標題：小標 h2 → 大標 h1 → 分隔飾 → 說明（全站統一寫法，見 CLAUDE.md） */}
          <header className="text-center mb-10">
            <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center justify-center gap-3">
              <span className="w-8 h-1 bg-temple-gold" aria-hidden="true" />壇務公告
              <span className="w-8 h-1 bg-temple-gold" aria-hidden="true" />
            </h2>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-temple-dark">最新活動</h1>
            <div className="flex items-center justify-center gap-3 mt-3 mb-4" aria-hidden="true">
              <span className="w-12 h-px bg-temple-gold/70" />
              <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
              <span className="w-12 h-px bg-temple-gold/70" />
            </div>
            <p className="text-gray-500">
              共 {bulletins.length} 則。點標題展開內容。
            </p>
          </header>

          {/* 分類篩選。只有一種分類時不顯示——那排鈕等於沒有作用 */}
          {new Set(bulletins.map(b => b.category)).size > 1 && (
            <div className="flex flex-wrap justify-center gap-3 mb-10">
              {['all', ...Object.values(BulletinCategory)].map(cat => {
                const n = cat === 'all' ? bulletins.length : bulletins.filter(b => b.category === cat).length;
                // 沒有任何一則的分類不顯示，免得點了得到空清單
                if (n === 0) return null;
                return (
                  <button
                    key={cat}
                    onClick={() => { setFilter(cat); goPage(0); }}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                      filter === cat
                        ? 'bg-temple-red text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat === 'all' ? '全部' : cat}
                    <span className="ml-1.5 text-xs opacity-70">{n}</span>
                  </button>
                );
              })}
            </div>
          )}

          {shown.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
              <p className="text-lg">這個分類目前沒有公告</p>
            </div>
          ) : (
            <div ref={listRef} className="space-y-4 scroll-mt-24">
              {shownPage.map(b => (
                <div key={b.id} id={`bulletin-card-${b.id}`}>
                  <BulletinCard
                    bulletin={b}
                    open={openId === b.id}
                    onToggle={() => toggle(b)}
                    onService={onService}
                  />
                </div>
              ))}
            </div>
          )}

          <Pagination page={safePage} count={pageCount} onChange={goPage} label="公告" />

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

export default BulletinsPage;
