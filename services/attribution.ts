/**
 * 來源歸因（UTM）與換頁時的網址參數規則
 *
 * **為什麼要另外存一份 UTM**：站內換頁一律推「純路徑」（goToPage／openFahui／
 * openScripture 都是），query string 會整串從網址上消失。所以等到送出報名時
 * 再去讀 `location.search` 幾乎一定是空的——UTM 必須在進站那一刻就收下來。
 *
 * **為什麼用 sessionStorage 不用 localStorage**：UTM 描述的是「這一次來訪」。
 * 放進 localStorage 會讓三個月前那檔活動的來源黏在同一台裝置上，之後每一筆
 * 報名都算給那一檔，統計會失真。分頁關掉就該忘記，這正是 sessionStorage 的語意。
 *
 * **刻意不動網址列**：進站那一頁的網址保持原樣（含 UTM），因為 GA4／GTM 在
 * 初始化時會讀真實的 `document.location`。若一載入就把 UTM 清掉，改天廟方把
 * GA4 掛進 GTM 容器（而不是後台那個欄位），歸因就會整個失效。UTM 是在
 * 「第一次站內換頁」時才從網址上拿掉的（見 withKeptParams）。
 */

/** 標準的五個 UTM 參數。目前只用前三個，另外兩個一併收下以免日後改欄位 */
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

/**
 * 換頁時要從網址上拿掉的參數。
 *
 * utm_* 只服務「進站那一次」，留在網址上會被信眾連同 UTM 一起轉分享出去，
 * 別人的來源就被記成第一個人的。fbclid／gclid 是平台自己黏上來的，同理。
 *
 * 功能性參數（share／preview／admin／volunteer）**不在此列，要保留**——
 * 它們原本會跟著被洗掉，那是既有的 bug：揪團連結進站後點一下導覽，
 * `?share=` 就沒了，重新整理便找不回那場共享報名。
 */
const DROP_ON_NAV: readonly string[] = [...UTM_KEYS, 'fbclid', 'gclid'];

const STORAGE_KEY = 'heshengtan_utm_v1';

/**
 * 讀出這次來訪的 UTM。網址上有就用網址上的（後來的活動蓋掉先前的，
 * 與 GA4 的 last-click 一致），沒有才回頭拿這個分頁先前存下的。
 */
const readEntryUtm = (): string => {
  if (typeof window === 'undefined') return '';
  const search = new URLSearchParams(window.location.search);
  const picked = new URLSearchParams();
  // 依 UTM_KEYS 的順序組，字串才穩定（之後要拿來比對或存進資料庫）
  for (const key of UTM_KEYS) {
    const value = search.get(key);
    if (value) picked.set(key, value);
  }
  const fromUrl = picked.toString();
  if (fromUrl) {
    // 無痕模式／關閉儲存空間時 setItem 會丟例外，不能讓它擋住頁面
    try { sessionStorage.setItem(STORAGE_KEY, fromUrl); } catch { /* 存不了就只用這一頁 */ }
    return fromUrl;
  }
  try { return sessionStorage.getItem(STORAGE_KEY) ?? ''; } catch { return ''; }
};

/** 進站當下的 UTM，形如 `utm_source=line&utm_medium=broadcast`；沒有就是空字串 */
const entryUtm = readEntryUtm();

/**
 * 進站那一刻的完整網址。
 *
 * 放在這個模組是因為它在 App 啟動時就載入，這一行跑得夠早——而「夠早」正是重點。
 * **誰需要它**：OAuth 轉回來時 Supabase 把失敗原因放在 `error_description`，
 * 而 supabase-js 的 `detectSessionInUrl` 初始化後會自己把那些參數從網址上清掉。
 * 懶載入的元件（會員中心）掛載時再去讀 `window.location` 一定是空的
 * ——2026-10-13 實測：函式單獨呼叫完全正常，放進真實流程卻永遠讀不到，
 * 錯誤訊息整個不見。同一個理由，UTM 也是在這裡就收下來的（見檔頭）。
 */
export const ENTRY_URL = typeof window === 'undefined' ? '' : window.location.href;

/**
 * 給 GA4 的 `page_location` 用：進站那一次要帶 UTM，GA4 才有東西可以歸因。
 * 回傳含「?」的片段或空字串，直接串在路徑後面即可。
 */
export const getEntryUtmQuery = (): string => (entryUtm ? `?${entryUtm}` : '');

/** 這次來訪有沒有帶 UTM（之後把來源存進報名紀錄時會用到） */
export const hasEntryUtm = (): boolean => entryUtm !== '';

/**
 * 換頁推網址時用：把目前網址上「該保留的」參數接回新路徑後面。
 *
 * @param path      要推的路徑，例如 `/lamps`
 * @param alsoDrop  除了 DROP_ON_NAV 之外還要拿掉的參數。
 *                  closeVolunteer 必須拿掉 `volunteer`——`isVolunteerUrl()`
 *                  認得 `?volunteer`，留著等於沒關掉。
 */
export const withKeptParams = (path: string, alsoDrop: readonly string[] = []): string => {
  if (typeof window === 'undefined') return path;
  const params = new URLSearchParams(window.location.search);
  for (const key of DROP_ON_NAV) params.delete(key);
  for (const key of alsoDrop) params.delete(key);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

// ─── 報名來源（存進資料庫的那一欄）────────────────────────────────────────

const SOURCE_KEY = 'heshengtan_src_v1';

/**
 * referrer 網域前面這些子網域要去掉，否則同一個平台會散成好幾個來源。
 * IG 的外連是 `l.instagram.com`、臉書手機版是 `m.facebook.com`，
 * 不正規化的話報表上會出現 instagram.com 與 l.instagram.com 兩列。
 */
const STRIP_SUBDOMAIN = new Set(['www', 'm', 'l', 'lm', 'out', 'web']);

/**
 * 只留安全字元並截斷。
 *
 * 這個值最後會進資料庫、後台列表與 Excel 匯出，而 UTM 的內容來自網址——
 * 任何人都能編。兩件事要擋：(1) 亂七八糟的字元讓報表分不了組；
 * (2) 以 `=`／`+`／`@` 開頭的字串在 Excel 裡會被當成公式執行。
 * 這裡把不允許的字元換成 `-` 再把開頭的 `-` 去掉，兩者一起解決。
 */
const cleanSource = (raw: string): string =>
  raw.toLowerCase().replace(/[^a-z0-9._/-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);

/** 從 referrer 推來源；站內連結與無 referrer 都回空字串 */
const sourceFromReferrer = (): string => {
  const ref = typeof document === 'undefined' ? '' : document.referrer;
  if (!ref) return '';
  try {
    const host = new URL(ref).hostname.toLowerCase();
    if (!host || host === window.location.hostname) return '';
    const parts = host.split('.');
    if (parts.length > 2 && STRIP_SUBDOMAIN.has(parts[0])) parts.shift();
    return parts.join('.');
  } catch {
    return '';
  }
};

const readEntrySource = (): string => {
  if (typeof window === 'undefined') return 'direct';

  // 有 UTM 就以 UTM 為準。entryUtm 本身已經含「這次網址帶的」與「這個分頁先前存的」，
  // 所以這條路徑不必再讀一次 sessionStorage。
  if (entryUtm) {
    const p = new URLSearchParams(entryUtm);
    const parts = [p.get('utm_source') ?? '', p.get('utm_medium') ?? '', p.get('utm_campaign') ?? ''];
    // 尾端沒填的不要留下空段（`line` 而不是 `line//`）；中間缺的用 `-` 佔位，
    // 否則 `line/pudu2026` 會看起來像 source/medium，欄位就對錯位了。
    while (parts.length && !parts[parts.length - 1]) parts.pop();
    const built = cleanSource(parts.map(x => x || '-').join('/'));
    if (built) {
      // 一併覆寫存檔，讓 sessionStorage 裡的值永遠等於 getSource() 回傳的值。
      // 不寫的話，先直接進站（存下 direct）再點 UTM 連結的人，存檔會停在 direct——
      // 邏輯上不影響（UTM 這條路徑優先、也不讀存檔），但之後有人去看那個 key 會被誤導。
      try { sessionStorage.setItem(SOURCE_KEY, built); } catch { /* 無痕模式存不了，不影響回傳值 */ }
      return built;
    }
  }

  // 沒有 UTM：referrer 只有「第一次載入這份文件」時才可靠，使用者一重新整理就沒了。
  // 存起來，同一次來訪的每一筆報名才會記到同一個來源。
  try {
    const kept = sessionStorage.getItem(SOURCE_KEY);
    if (kept) return kept;
  } catch { /* 無痕模式讀不到就當沒存過 */ }

  const derived = cleanSource(sourceFromReferrer()) || 'direct';
  try { sessionStorage.setItem(SOURCE_KEY, derived); } catch { /* 存不了就每頁各自推算 */ }
  return derived;
};

const entrySource = readEntrySource();

/**
 * 這一次來訪的來源，格式「來源/形式/檔期」。送出報名時寫進各表的 `source` 欄。
 *
 *   line/broadcast/pudu2026   從 LINE 群發進來報的
 *   tiktok/bio                抖音簡介欄（沒有指定檔期）
 *   google.com                沒有 UTM，退回 referrer 的網域
 *   direct                    沒有 UTM 也沒有 referrer
 *
 * **一定有值**，不會回空字串——資料庫那欄的 NULL 專門用來表示「這筆早於追蹤上線」，
 * 兩者混在一起就再也分不出「沒追蹤到」與「還沒有追蹤功能」。
 */
export const getSource = (): string => entrySource;
