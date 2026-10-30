import React, { useEffect, useRef, useState } from 'react';
import { BulletinRecord } from '../types';
import { TAG_PINNED } from './BulletinBody';

/**
 * 公佈欄的海報輪播（2026-10-30 廟方：「我想把公布欄改成 banner 手機輪播，
 * 或 banner 桌機併排，因為目前都會有圖片，而且還蠻好看的，要讓他凸顯，
 * 而不是點縮小圖才看到大圖」）。
 *
 * ── 為什麼可以做 ──
 * 廟方的海報**已經統一成 3:2 橫式了**（實測現有五張裡四張是 1525×1031＝1.48，
 * 新的問事形象圖 1200×810 也是 1.48）。所以放進 3:2 的框**不必裁切**——
 * 而「不要裁海報」是廟方否決過兩次的事（2026-09-26「只看得到中間 36%，
 * 標題與 QR code 全被切掉」、2026-10-11「圖在上、文字在下」）。
 *
 * **比例不是 3:2 的照樣不裁**：`fitOf()` 載入後量一次，直式的改用 contain
 * 加底色，寧可上下留白也不要把字切掉。舊的「天赦日」海報（853×1280）就是這種。
 *
 * ── 為什麼輪播而不是把縮圖放大 ──
 * 首頁 2026-10-23 才砍掉三分之一（廟方：「首頁，我想再短一點」）。
 * 四張卡攤開放大海報實測會從約 420px 變成約 1,300px，**多出快一個螢幕**；
 * 輪播是全部公告共用一個位置，**比現在還短**。
 *
 * ── 下一張一定要露出一角 ──
 * 滿版的輪播在長輩手上常常被當成一張靜態圖、從來沒被滑過。
 * 所以手機版一張佔 86%，右邊留 14% 讓下一張露臉——那是「可以滑」唯一的提示。
 *
 * ── 自動輪播 ──
 * 廟方要（「整個網站沒有動，banner 剛好可以動」）但要「很慢」，所以 8 秒。
 * 三種情況一律停：**開了「減少動態效果」**（本站信眾以長者居多，那個設定開著的
 * 比例不低，而且這是唯一會自己動的東西）、**使用者自己滑過之後**（他在看，
 * 不要把畫面從他手上搶走）、**捲出畫面**（看不見還在跑只是白耗電，
 * 同 IncenseSmoke 與墨流那兩支的作法）。
 */

/** 幾秒換一張。廟方要「很慢」——快到會打斷閱讀就失去意義了 */
const AUTO_MS = 8000;

/**
 * 欄數**跟著則數走**，不要寫死（2026-10-30 廟方：「直立平板時，應該要顯示四個活動」）。
 *
 * 原本固定 `sm:grid-cols-2 lg:grid-cols-3`，平板直立（768–1023）是兩欄，
 * 而首頁只取 3 則——第二列永遠空一格，而且那一格就落在畫面正中間。
 *
 * 現在首頁取 4 則（`HOME_BULLETIN_TOTAL`），對照表讓**每一種則數的最後一列都排得滿**：
 *   4 則 → 平板 2×2、桌機一列四張（四欄比三欄窄，但整列是滿的，而且首頁更短）
 *   3 則 → 一律三欄（平板會窄一點，但不留缺口）
 *   2／1 則 → 就那麼多欄
 * 3 則以下只在廟方某一則沒放海報時才會發生（沒海報的那則走下面的 BulletinCard）。
 */
const COLS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

interface Props {
  items: BulletinRecord[];
  /** 點下去開那一則公告（維持原本的展開行為，海報已經看得到了） */
  onOpen: (b: BulletinRecord) => void;
}

const BulletinBanners: React.FC<Props> = ({ items, onOpen }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  /** 使用者碰過就不再自動換 */
  const touchedRef = useRef(false);
  const [visible, setVisible] = useState(true);
  /** 每張圖的裁切方式：3:2 的用 cover 填滿，直式的用 contain 不切字 */
  const [fit, setFit] = useState<Record<string, 'cover' | 'contain'>>({});

  /**
   * 每一張該捲到哪。**從實際的子元素量，不要用「容器寬 × 86%」去估**——
   * 那個估算沒有算 gap、也沒有算內距，張數一多誤差會累積到整張錯位。
   */
  const offsets = (): number[] => {
    const el = trackRef.current;
    if (!el) return [];
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    return [...el.children].map((c) => (c as HTMLElement).offsetLeft - pad);
  };

  // 捲到哪一張了。用捲動位置回推，不自己記狀態——使用者可能用手滑、也可能按點
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
      const o = offsets();
      if (o.length === 0) return;
      let best = 0;
      o.forEach((x, i) => { if (Math.abs(x - el.scrollLeft) < Math.abs(o[best] - el.scrollLeft)) best = i; });
      setIdx(best);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [items.length]);

  // 捲出畫面就不要再自動換
  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 自動輪播
  useEffect(() => {
    if (items.length < 2 || !visible) return;
    // **開了「減少動態效果」就完全不自動換**，不是放慢
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => {
      if (touchedRef.current) return;
      const el = trackRef.current;
      if (!el) return;
      const o = offsets();
      if (o.length === 0) return;
      let cur = 0;
      o.forEach((x, i) => { if (Math.abs(x - el.scrollLeft) < Math.abs(o[cur] - el.scrollLeft)) cur = i; });
      el.scrollTo({ left: o[(cur + 1) % o.length], behavior: 'smooth' });
    }, AUTO_MS);
    return () => window.clearInterval(t);
  }, [items.length, visible]);

  /**
   * **開了「減少動態效果」就要用 `instant`，不能用 `smooth`。**
   * 那種裝置上瀏覽器**不是把平滑捲動變快，是整個取消**——實測按第 2、第 3 顆點
   * 完全沒反應，scrollLeft 文風不動。本專案已經為同一件事踩過兩次
   * （回到頁首那顆鈕、公佈欄的深連結），這是第三次。
   * 本站信眾以長者居多，那個設定開著的比例不低，等於這排點對他們是壞的。
   */
  const goTo = (i: number) => {
    touchedRef.current = true;
    const el = trackRef.current;
    const o = offsets();
    if (!el || o[i] === undefined) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: o[i], behavior: (reduced ? 'instant' : 'smooth') as ScrollBehavior });
    // **指示器直接設，不要等 scroll 事件**：instant 捲動不保證會派發 scroll
    // （實測按第 2 顆點時位置對了、亮的卻還是第 1 顆）。手滑那條路照樣由事件更新。
    setIdx(i);
  };

  if (items.length === 0) return null;

  return (
    <div>
      {/*
        手機：橫向 snap 捲動，一張 86% 寬讓下一張露臉。
        桌機（sm 以上）：併排的格狀排版，不捲動——螢幕夠寬就該一次看完，
        還要滑才看得到第二張是把資訊藏起來。
        `lg` 再加到三欄：首頁最多五則，兩欄要排三列、三欄只要兩列。
      */}
      <div
        ref={trackRef}
        onPointerDown={() => { touchedRef.current = true; }}
        /**
         * **`scroll-pl-4` 不能省。** `-mx-4 px-4` 是為了讓輪播滿版出血、但第一張仍與
         * 頁面的 16px 邊距對齊；可是 `snap-mandatory` 吸附的是**外框**不是內距邊，
         * 沒有 scroll-padding 的話瀏覽器會自己把 scrollLeft 捲到 16 去抵銷那段內距，
         * 第一張就貼到螢幕最左邊、跟上面的標題對不齊（實測就是這樣）。
         */
        className={`flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 scroll-pl-4
          sm:mx-0 sm:px-0 sm:scroll-pl-0 sm:grid sm:gap-5 sm:overflow-visible
          ${COLS[items.length] || 'sm:grid-cols-2 lg:grid-cols-4'}`}
        style={{ scrollbarWidth: 'none' }}
      >
        {items.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onOpen(b)}
            aria-label={`查看公告：${b.title}`}
            className="tap group relative shrink-0 w-[86%] sm:w-auto snap-start overflow-hidden
              rounded-2xl bg-temple-bg shadow-md hover:shadow-xl transition-shadow
              border border-temple-gold/25 text-left"
          >
            {/* 3:2 的框。廟方的海報就是這個比例，所以不裁；比例不同的改用 contain（見檔頭） */}
            <div className="aspect-[3/2] w-full bg-temple-gold/10">
              {b.imageUrl && (
                <img
                  src={b.imageUrl}
                  alt={b.title}
                  loading="lazy"
                  onLoad={(e) => {
                    const i = e.currentTarget;
                    const r = i.naturalWidth / i.naturalHeight;
                    // 比 4:3 還瘦的（直式海報）一律不裁，寧可留白
                    setFit((f) => (f[b.id] ? f : { ...f, [b.id]: r < 1.25 ? 'contain' : 'cover' }));
                  }}
                  className={`w-full h-full ${fit[b.id] === 'contain' ? 'object-contain' : 'object-cover'}`}
                />
              )}
            </div>

            {/* 標題壓在海報下緣。**深色漸層是必要的不是裝飾**——海報的底色由廟方決定，
                白字直接壓上去隨時可能變成白底白字（本檔記過「金底白字只有 3.17:1」）。 */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/45 to-transparent px-4 pt-10 pb-3">
              {b.isPinned && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold mb-1.5 ${TAG_PINNED}`}>
                  置頂
                </span>
              )}
              <p className="font-serif font-bold text-white text-base leading-snug line-clamp-2 drop-shadow">
                {b.title}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* 進度點。手機才有——桌機是併排的，沒有「第幾張」這回事。
          做成可以按的：有些人不滑，直接點。 */}
      {items.length > 1 && (
        <div className="flex justify-center gap-2 mt-3 sm:hidden">
          {items.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`第 ${i + 1} 張，共 ${items.length} 張`}
              aria-current={i === idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === idx ? 'w-5 bg-temple-red' : 'w-2 bg-temple-gold/50'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BulletinBanners;
