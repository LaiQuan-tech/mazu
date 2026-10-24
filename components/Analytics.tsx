import React, { useEffect, useRef } from 'react';
import { AnalyticsSettings } from '../types';
import { getAnalyticsSettings } from '../services/supabase';
import { getEntryUtmQuery } from '../services/attribution';

/**
 * 追蹤碼掛載（GA4／Meta 像素／GTM）
 *
 * 設定放在後台（site_settings 表），這裡只依「編號」用官方標準寫法組出腳本。
 * 刻意不讓後台貼整段 <script>：那等於後台一被盜就能對所有訪客植入任意腳本。
 *
 * 因為要讀資料庫，腳本會比寫死在 index.html 晚幾百毫秒才載入。
 * 對宮廟網站的流量分析而言可以接受，換得的是廟方自己就能換編號、不必找工程師。
 */

// 編號格式檢查：擋掉貼錯欄位或整段程式碼的情況
const RE_GA4 = /^G-[A-Z0-9]{6,}$/i;
const RE_GTM = /^GTM-[A-Z0-9]{5,}$/i;
const RE_PIXEL = /^\d{10,20}$/;

export const isValidGa4 = (v: string): boolean => RE_GA4.test(v.trim());
export const isValidGtm = (v: string): boolean => RE_GTM.test(v.trim());
export const isValidPixel = (v: string): boolean => RE_PIXEL.test(v.trim());

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; push?: unknown; loaded?: boolean; version?: string };
    _fbq?: unknown;
  }
}

const appendScript = (src: string, async = true): void => {
  const s = document.createElement('script');
  s.async = async;
  s.src = src;
  document.head.appendChild(s);
};

const loadGa4 = (id: string): void => {
  window.dataLayer = window.dataLayer || [];
  /**
   * **一定要推 `arguments` 物件，不可以推展開成的真陣列。**
   *
   * Google 的 gtag/js 是用 `Object.prototype.toString` 認出 Arguments 才把那一筆
   * 當成「命令」處理；真陣列會被當成 GTM 式的資料推送而**靜靜地被忽略**。
   * 症狀極隱蔽：腳本照樣載入、`window.gtag` 照樣是個函式、dataLayer 照樣長大、
   * console 一個錯都沒有——但 GA4 從頭到尾沒有初始化，**沒有 `_ga` cookie、
   * 一個 `/g/collect` 都不送**，報表上永遠是零。
   *
   * 2026-10-24 查出來的：這一行原本的註解就寫著「不可改成展開陣列」，
   * 程式卻正是那樣寫的。驗的方法是在線上把同一組命令改用 arguments 推一次——
   * `_ga` 與 `_ga_LHGFX80NXY` 立刻出現、collect 立刻送出。
   * **不要只驗「有沒有載入 gtag/js」**，那一關這個 bug 是過的。
   */
  const gtag = function () { window.dataLayer!.push(arguments); } as (...args: unknown[]) => void;
  window.gtag = gtag;
  gtag('js', new Date());
  // SPA 自行送 page_view：預設的自動送出只會在首次載入觸發，換分頁不會再送
  gtag('config', id, { send_page_view: false });
  appendScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
};

const loadGtm = (id: string): void => {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  appendScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`);
};

const loadMetaPixel = (id: string): void => {
  if (window.fbq) return;
  const n: any = function (...args: unknown[]) {
    n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
  };
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];
  window.fbq = n;
  window._fbq = n;
  appendScript('https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('init', id);
};

interface AnalyticsProps {
  /** 目前頁面路徑；變動時補送一次 page_view（SPA 換頁不會自動送） */
  path: string;
}

/**
 * 以下四個狀態刻意放在模組層級，不是元件的 useRef。
 *
 * `<Analytics>` 在 App 的四個 return 分支各掛一次（首頁／法會／聖母經／志工），
 * 而那四個分支的根節點型別不同，React 在切換時會把元件卸載、再掛一個全新的實例。
 * 狀態若跟著實例走，每切一次分支就會重新注入一次 GTM／GA4 腳本，
 * 並且把那一次當成「進站第一次瀏覽」、UTM 再送一遍。
 * 追蹤碼本來就是整個分頁只該有一份的東西，狀態就該跟著分頁而不是跟著元件。
 */
let loaded = false;
let settings: AnalyticsSettings | null = null;
/** 最後送出的頁面代稱；同一頁不重送，順手擋掉 StrictMode 的雙重掛載 */
let lastSentPath: string | null = null;
/** 進站那一次的瀏覽送出去了沒——只有那一次要帶 UTM */
let entryViewSent = false;

/**
 * 送一次瀏覽。
 *
 * **只有進站第一次帶 UTM**：GA4 的來源歸因是解析 page_location 得來的，
 * 而這裡送的是硬編的路徑代稱、本來就不含 query string，UTM 因此完全到不了 GA4。
 * 換頁時再帶就變成同一個來源被重複宣告，報表多出無意義的雜訊。
 *
 * 用 getEntryUtmQuery() 而不是當下的 window.location.search，有兩個理由：
 * 一是設定要等資料庫回來才送得出去，那時使用者可能已經換過頁、網址上的 UTM
 * 早就被 withKeptParams 拿掉了；二是網址上的其他參數（?share=<uuid>、?admin=1）
 * 不該進流量報表——share 是一組識別碼，送進去只會製造高基數的雜訊。
 */
const sendPageView = (p: string): void => {
  if (!settings) return;
  if (p === lastSentPath) return;
  lastSentPath = p;
  const query = entryViewSent ? '' : getEntryUtmQuery();
  entryViewSent = true;
  const location = window.location.origin + p + query;

  if (isValidGa4(settings.ga4Id) && window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: p,
      page_location: location,
      page_title: document.title,
    });
  }
  if (isValidPixel(settings.metaPixelId) && window.fbq) window.fbq('track', 'PageView');
  if (isValidGtm(settings.gtmId) && window.dataLayer) {
    // 一併給 page_location，容器裡的 GA4 標記才拿得到 UTM
    window.dataLayer.push({ event: 'spa_page_view', page_path: p, page_location: location });
  }
};

const Analytics: React.FC<AnalyticsProps> = ({ path }) => {
  // 設定是非同步讀回來的，屆時要送的是「當下的頁面代稱」而不是掛載當時的。
  // 用 ref 而非 window.location.pathname——法會報名表與聖母經雖然各有網址，
  // 但代稱由 App 統一算好傳進來，直接讀網址會在切換瞬間拿到還沒更新的值。
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    // 換分支重新掛載時 loaded 已經是 true：不要再載一次腳本，
    // 但要補送這一頁的瀏覽（sendPageView 內部會擋掉重複的同一頁）。
    if (loaded) { sendPageView(pathRef.current); return; }
    loaded = true;
    // 刻意不做 cancel：loaded 已經保證整個分頁只跑一次。
    // 早先這裡有一個 cancelled 旗標，配上 StrictMode 的「掛載→卸載→再掛載」
    // 會讓開發模式永遠掛不上追蹤碼——第一次掛載啟動 fetch、cleanup 把 cancelled
    // 設成 true，第二次掛載被 loaded 擋掉直接 return，fetch 回來時已經沒有人採用它。
    // 正式站沒有 StrictMode 所以看不出來，但本機也就永遠驗不了追蹤碼。
    getAnalyticsSettings().then((s) => {
      settings = s;
      if (isValidGtm(s.gtmId)) loadGtm(s.gtmId);
      if (isValidGa4(s.ga4Id)) loadGa4(s.ga4Id);
      if (isValidPixel(s.metaPixelId)) loadMetaPixel(s.metaPixelId);
      sendPageView(pathRef.current);
    });
  }, []);

  // 換頁補送。首次載入時 settings 還沒回來，sendPageView 會直接跳過。
  useEffect(() => {
    sendPageView(path);
  }, [path]);

  return null;
};

export default Analytics;
