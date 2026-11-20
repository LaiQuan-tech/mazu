import { useEffect } from 'react';

/**
 * 全站共用的捲動動態引擎：進場（.sr）＋ 視差（.sr-figure／.sr-counter）
 *
 * 原本這套只長在「關於我們／遷址募款」兩頁裡（StoryPage 內的私有 hook），
 * 首頁與其他頁完全沒有。抽出來放全站有兩個好處：
 *   1. 首頁也能直接掛 class 就有效果，不必每頁再寫一次相同的計算。
 *   2. 全站只有一個 window 捲動監聽。十幾個區塊各自監聽等於每次捲動跑十幾組相同的數學。
 *
 * 兩個讓它「順」的關鍵（沿用天上聖母經那頁的做法）：
 *   1. 進場觸發點抓在畫面外（桌機 1.5 倍視窗高、手機 1.15 倍）。元素還沒進畫面就開始動，
 *      捲到眼前時已經在半途，不會「啪」地跳出來。
 *   2. 圖片與文字欄用相反方向、不同速度持續位移。速度差才是視差的來源；
 *      只有單層在動，看起來只是「圖片有點飄」。
 *
 * 不用 IntersectionObserver：lazy 圖片高度為 0 時它偵測不到，而且一旦沒回報，
 * 元素會永遠停在 opacity:0——整片內容看不到是最糟的失敗方式。
 */

/**
 * 視差幅度（px）：元素從畫面下緣走到上緣的單邊位移。
 * 照片正、文字負，兩層朝相反方向跑，總相對位移是兩者相加。
 * 幅度是實測出來的：小於 60 在一般筆電上根本看不出來，大於 110 則會撞到相鄰區塊的留白。
 */
const FIGURE_SHIFT = 96;
const COUNTER_SHIFT = -56;

/** 手機螢幕矮，同樣的 px 佔畫面比例大得多，收斂一點才不會晃 */
const MOBILE_SCALE = 0.72;

/** 超出畫面上下各 300px 就不必再算——這是每次捲動都會跑的迴圈，能省則省 */
const CULL_MARGIN = 300;

const applyMotion = (): void => {
  const vh = window.innerHeight;
  const isMobile = window.innerWidth < 768;

  // ── 進場 ──
  const threshold = isMobile ? 1.15 : 1.5;
  document.querySelectorAll<HTMLElement>('.sr:not(.in)').forEach(el => {
    if (el.getBoundingClientRect().top < vh * threshold) el.classList.add('in');
  });

  // ── 視差 ──
  const center = vh / 2;
  const scale = isMobile ? MOBILE_SCALE : 1;

  // 進度：元素中心在視窗下緣為 +1、正中央為 0、上緣為 -1
  const progressOf = (rect: DOMRect): number => Math.max(-1, Math.min(1,
    (rect.top + rect.height / 2 - center) / (vh / 2 + rect.height / 2)));

  // data-par 可覆寫個別元素的幅度（例如卡片列想比大照片輕一點）
  const shiftAll = (selector: string, fallback: number): void => {
    document.querySelectorAll<HTMLElement>(selector).forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.bottom < -CULL_MARGIN || rect.top > vh + CULL_MARGIN) return;
      const raw = el.dataset.par;
      const amount = raw !== undefined && raw !== '' ? Number(raw) : fallback;
      if (!Number.isFinite(amount)) return;
      el.style.transform = `translateY(${(progressOf(rect) * amount * scale).toFixed(1)}px)`;
    });
  };

  shiftAll('.sr-figure', FIGURE_SHIFT);
  shiftAll('.sr-counter', COUNTER_SHIFT);
};

/** 資料非同步進來、版面長高之後可以手動補算一次 */
export const refreshScrollMotion = (): void => {
  if (typeof window !== 'undefined') applyMotion();
};

/**
 * 掛一次就好，放在 App 最外層。
 * 補掃機制（缺一不可，少了任何一個都會出現「內容停在 opacity:0」）：
 *   - 捲動／改變視窗大小：主要驅動。
 *   - MutationObserver：Supabase 資料回來、換頁掛上新區塊時補掃。
 *     只看 childList，不看屬性——否則自己加的 .in 與 transform 會反過來觸發自己。
 *   - 三秒安全網：萬一上面全部失靈，至少把「快要看到」的內容顯示出來，
 *     寧可沒有動畫也不能讓使用者看到空白頁。
 */
export const useScrollMotion = (): void => {
  useEffect(() => {
    applyMotion();

    const onScroll = () => applyMotion();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    let pending: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = setTimeout(() => { pending = null; applyMotion(); }, 120);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const safety = setTimeout(() => {
      const vh = window.innerHeight;
      document.querySelectorAll<HTMLElement>('.sr:not(.in)').forEach(el => {
        if (el.getBoundingClientRect().top < vh * 2.5) el.classList.add('in');
      });
    }, 3000);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      observer.disconnect();
      if (pending) clearTimeout(pending);
      clearTimeout(safety);
    };
  }, []);
};

export default useScrollMotion;
