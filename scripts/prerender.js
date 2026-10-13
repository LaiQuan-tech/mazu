// 預渲染：為每一條路由產出獨立的靜態 HTML
//
// 由 `npm run build` 自動接著跑（見 package.json），不需要另外執行。
//
// ── 為什麼需要 ──
// 本站是純前端渲染的 SPA，原始 HTML 的可見文字是 0 個字。Google 會執行 JavaScript
// 所以看得到，但 GPTBot／ClaudeBot／PerplexityBot 這些 AI 檢索器**不執行 JS**。
// 而且所有路由本來共用同一份 index.html，等於 /about、/booking 全都頂著法會報名的標題。
//
// ── 這支做什麼 ──
// 拿剛建好的 dist/index.html 當模板，為每條路由複製一份並換掉：
//   title、description、og:title/description/url、canonical，
//   再補上該頁自己的 JSON-LD 與一段 <noscript> 內容。
// 資產路徑直接沿用模板，所以 hash 一定對得上（這是它必須跑在 build 之後的原因）。
//
// ── 這支不做什麼 ──
// 它不會把 React 真的跑一遍，所以**後台資料（公告、神尊、關於我們的內文）不會進到靜態 HTML**。
// 那些要靠無頭瀏覽器快照才拿得到。目前的取捨是：這些頁面的「用途說明」是穩定的，
// 手寫一次就長期有效，而且零相依、不會因為瀏覽器版本或 CI 環境壞掉。
// 若之後要連後台內容一起靜態化，再換成 puppeteer 版本（要注意 `/` 在
// 非官網網域會顯示報名表，快照時必須讓瀏覽器以 heshengtan.tw 的身分解析）。

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// ESM 取 npm 套件一定要用 createRequire（NODE_PATH 對 import 沒作用，見 CLAUDE.md）
const require = createRequire(import.meta.url);

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const ORIGIN = 'https://heshengtan.tw';

/**
 * 每條路由的靜態身分。
 * `/` 不在這裡：根路徑用原本的 index.html，那份的標題與分享預覽是法會收件版，
 * 由 index.html 直接維護（收件結束後換回官網版，見該檔開頭的註解）。
 */
const ROUTES = [
  {
    // 天上聖母經有自己的網址（App.tsx 的 SCRIPTURE_PATH），是要分享出去讓人讀的內容。
    // 不預渲染的話，貼到 LINE 的預覽卡片會沿用靜態 index.html 的法會報名標題——
    // 網址等於半殘。內容取自 scripture-data.json（136 段，每段有經文與註解）。
    path: '/scripture',
    priority: '0.8',
    title: '天上聖母經｜經文、註解與故事｜台北古亭和聖壇',
    desc: '天上聖母經全文，逐段附白話註解與典故出處，共 136 段。台北古亭和聖壇提供，可線上閱讀。',
    h1: '天上聖母經',
    // 專屬分享圖。不給的話會沿用全站的 og-hero.jpg（金箔＋神尊），
    // 那張跟經文沒關係。這張是廟方的書籍封面，直式 1414x2000 沒辦法直接當
    // og:image（LINE／FB 會裁掉），所以做成 1200x630、整張封面置中，
    // 底色取自封面自己的外框（rgb(222,198,169)），接縫是連續的。
    // 產生方式見 CLAUDE.md。
    image: '/og-scripture.jpg',
    imageAlt: '天上聖母經的註解與故事｜台北古亭和聖壇 編著',
    body: [
      '天上聖母經全文，逐段附上白話註解與典故出處，共 136 段。',
      '經文記述天上聖母降世的緣由、勸世的教誨，以及歷代忠臣烈士的節義事蹟；註解說明字句的意思與引用的出處，供信眾誦讀時對照理解。',
    ],
  },
  {
    // 歲時節慶。這一頁的內容是資料庫來的（deity_feasts ＋ blessing_events），
    // prerender 不執行 React 所以抓不到那些資料——noscript 只能寫「這頁有什麼」，
    // 不寫死任何日期。寫死等於多一份會過期又沒人會回來改的清單。
    // 與 App.tsx 的 ENABLE_CALENDAR 一起開關。關閉時不預渲染、也不進 sitemap——
    // 留著會讓 Google 收錄一頁還沒建好的行事曆。網址本身仍由 SPA 萬用規則供應。
    enabled: true,
    path: '/calendar',
    priority: '0.7',
    title: '歲時節慶｜神明聖誕、辦事日與誦經祈福｜台北古亭和聖壇',
    desc: '和聖壇年度歲時節慶：神明聖誕、節令、辦事日（問事）、誦經祈福與壇務活動一覽。聖誕依農曆記載，本表已換算為當年國曆日期，並標示星期。',
    h1: '歲時節慶',
    body: [
      '和聖壇的年度歲時節慶，依月份列出神明聖誕、節令、辦事日（問事）、誦經祈福與壇務活動。',
      '聖誕以農曆記載，換算成國曆每年日期不同；本表會依所選年份自動換算，並一併標示農曆與星期。',
      '辦事日即問事，與線上預約的場次同一份資料；誦經祈福每月舉行，日期依當月公告。',
    ],
  },
  {
    // 隱私權政策。**這一頁存在的理由是「要有一個網址可以填給別人」**：
    // LINE Developers 把 Login channel 從 Developing 切成 Published 時要填
    // 隱私權政策的網址，而本站原本只有一個彈出視窗、沒有網址（廟方 2026-10-13）。
    // 內文是靜態的（不像行事曆要讀資料庫），所以 noscript 可以直接寫重點，
    // 不執行 JS 的審核程式與爬蟲也看得到實質內容。
    enabled: true,
    path: '/privacy',
    priority: '0.3',
    title: '隱私權政策｜台北古亭和聖壇',
    desc: '台北古亭和聖壇的隱私權政策：說明點燈登記、祈福報名、捐獻護持、問事預約等服務如何收集、使用與保護您的個人資料。',
    h1: '隱私權政策',
    body: [
      '台北古亭和聖壇重視您的個人資料保護。本政策說明本宮在您使用本網站各項服務（點燈登記、祈福報名、捐獻護持、問事預約等）時，如何收集、使用及保護您的個人資料，適用範圍以本網站為限。',
      '本宮僅在您主動填寫表單時收集資料，用途限於辦理您所申請的服務與必要的聯繫，不會提供給與服務無關的第三方。',
      '您可隨時向本宮查詢、更正或請求刪除您的個人資料；聯絡方式見本頁下方與網站頁尾。',
    ],
  },
  {
    // 進香洗澡車。內容全部是即時的（志工打卡的位置），prerender 只負責靜態殼——
    // **這一頁的靜態殼特別重要**：連結主要靠 LINE 轉傳，沒有預渲染的話分享卡片
    // 會沿用 index.html 的首頁標題，香客看到「問事、點燈與法會服務」不會點進來。
    // 刻意不進導覽列（進香一年九天），但要進 sitemap——搜「白沙屯 洗澡車」找得到
    // 正是這一頁存在的意義。
    // /shower/checkin 不預渲染也不進 sitemap：那是志工的憑證網址，不該被索引。
    enabled: true,
    path: '/shower',
    priority: '0.6',
    title: '進香洗澡車位置查詢｜白沙屯媽祖進香｜台北古亭和聖壇',
    desc: '白沙屯媽祖進香期間免費提供隨香香客盥洗的移動式洗澡車。位置由現場志工即時回報，本頁可查目前地點並一鍵開啟導航。',
    h1: '進香洗澡車',
    body: [
      '白沙屯媽祖進香沒有固定路線，洗澡車隨隊伍移動。本頁顯示每台車目前停放的地點與最後回報時間，可直接開啟 Google 地圖導航前往。',
      '洗澡車免費提供隨香香客盥洗。位置由現場志工回報，出發前請再確認一次。',
    ],
  },
  {
    // 公佈欄完整清單。內容是資料庫來的，prerender 只產靜態殼——
    // 廟方會把單則公告（/bulletins/<id>）貼到 LINE，而那是 SPA 的路徑，
    // 由萬用規則供應；這一份是給 /bulletins 本身與搜尋引擎的入口。
    enabled: true,
    path: '/bulletins',
    priority: '0.6',
    title: '最新活動與壇務公告｜台北古亭和聖壇',
    desc: '台北古亭和聖壇的最新活動與壇務公告：法會、點燈、問事場次、誦經祈福與各項通知，依分類與日期排列。',
    h1: '最新活動',
    body: [
      '和聖壇的壇務公告與活動消息，包含法會、點燈、問事場次與誦經祈福等各項通知。',
      '首頁只顯示最新幾則，本頁列出全部並可依分類篩選。',
    ],
  },
  {
    path: '/about',
    priority: '0.8',
    title: '關於和聖壇｜台北古亭媽祖廟的沿革與壇務',
    desc: '和聖壇創立於民國 73 年，主祀天上聖母，前身為聖鳳壇。位於台北市中正區晉江街，提供問事、點燈、法會等服務。',
    h1: '關於和聖壇',
    body: [
      '和聖壇創立於民國 73 年（1984），主祀天上聖母，前身為「聖鳳壇」，位於台北市中正區晉江街 72 巷 9 號。',
      '秉持天上聖母傳道的精神，信仰不止於燒香祈福，更落實於日常的為人處世。',
    ],
  },
  {
    path: '/booking',
    service: { name: '預約問事', description: '向神明請示事業、感情、家運等疑難，由專人解籤與問事。須先線上選擇場次預約，不接受未預約臨櫃辦理。' },
    priority: '0.8',
    title: '預約問事｜台北古亭和聖壇',
    desc: '事業、感情、家運遇有瓶頸，誠心向神明請示。台北古亭和聖壇提供一對一專人解籤與問事服務，可線上預約場次，亦接受現場報名。',
    h1: '預約問事',
    body: [
      '事業、感情、家運遇有瓶頸時，可誠心向神明請示。本壇提供一對一專人解籤與問事服務。',
      '請盡可能透過官方網站或官方 LINE 帳號預約場次，方便廟方安排時間；也接受現場報名。',
    ],
  },
  {
    path: '/lamps',
    service: { name: '點燈服務', description: '年度點燈，一年一期：太歲祈安燈、光明前程祈福燈、財源廣進財利燈、本命神明祈願燈。可線上登記。' },
    priority: '0.8',
    title: '點燈服務｜太歲祈安燈・光明前程祈福燈・財利燈・本命神明燈',
    desc: '台北古亭和聖壇點燈服務線上登記，一年一期。提供太歲祈安燈、光明前程祈福燈、財源廣進財利燈、本命神明祈願燈，祈求流年順遂、元辰光彩。天赦日等單場次的祈福點燈請見祈福活動。',
    h1: '點燈服務',
    body: [
      '農曆新年期間提供太歲祈安燈（每年 NT$300）、光明前程祈福燈（每年 NT$300）、財源廣進財利燈（每年 NT$500）、本命神明祈願燈（每年 NT$1,200），祈求流年順遂、元辰光彩。',
      '可於線上填寫姓名、生辰與地址完成登記。',
    ],
  },
  {
    path: '/blessing',
    service: { name: '祈福活動', description: '單場次的祈福法會與活動，例如天赦日點燈、神明聖誕祈福，為信眾消災解厄、增福添壽。可線上報名。' },
    priority: '0.7',
    title: '祈福法會報名｜台北古亭和聖壇',
    desc: '台北古亭和聖壇不定期舉辦祈福法會，為信眾消災解厄、增福添壽，提供個人與闔家平安祈福線上報名。',
    h1: '祈福法會',
    body: [
      '本壇不定期舉辦各式祈福法會，為信眾消災解厄、增福添壽。',
      '提供個人與闔家平安祈福登記，可於線上報名。',
    ],
  },
  {
    path: '/deities',
    priority: '0.7',
    title: '祀奉神尊｜台北古亭和聖壇的神尊介紹',
    desc: '台北古亭和聖壇奉祀天上聖母、濟公禪師、中壇元帥、文武財神等神尊。本頁介紹各殿奉祀的神尊與其職掌。',
    h1: '祀奉神尊',
    body: [
      // 這句原本列了「濟公禪師、中壇元帥、文武財神」，但資料庫的名單裡沒有中壇元帥——
      // 手寫的概括與實際內容漂掉了。名單交給下面從資料庫抓的那段，這裡不再點名。
      '和聖壇主祀天上聖母，同壇奉祀諸位神尊，各有其願力與職司。',
      '誠邀諸善信大德一同前來參拜。壇址：100 臺北市中正區晉江街 72 巷 9 號。',
    ],
  },
  {
    path: '/relocation',
    service: { name: '遷址護持', description: '道場遷址的護持專案，分月供養與單次供養兩種方案。' },
    priority: '0.7',
    title: '遷址捐款｜護持和聖壇道場遷址',
    desc: '和聖壇道場遷址護持專案。分「每月同行｜月供養」與「單次供養」兩種方案，誠摯邀請信眾一同護持。',
    h1: '遷址捐款',
    body: [
      '近四十年來，和聖壇陪伴信眾走過人生的重要時刻。隨著道場使用面臨新的挑戰，我們希望為下一個世代留下能共同成長的家。',
      '捐款方案分為「每月同行｜月供養」與「單次供養」兩種。',
    ],
  },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 只換第一個符合的標籤，找不到就丟錯——寧可讓建置失敗，也不要靜靜產出沒換到的頁面 */
const swap = (html, pattern, replacement, label) => {
  if (!pattern.test(html)) throw new Error(`prerender: 在模板裡找不到 ${label}`);
  return html.replace(pattern, replacement);
};

const template = readFileSync(resolve(DIST, 'index.html'), 'utf8');

/**
 * 常見問題：注入首頁的 FAQPage 結構化資料與 <noscript> 純文字。
 *
 * 內容的正式來源是資料庫 `faq_items`（後台可編輯），這裡在建置時抓一份快照。
 * 抓不到（沒設環境變數、Supabase 暫停、表還沒建）就退回 content/faq.json，
 * 讓建置永遠不會因為外部服務而失敗。
 *
 * ── 三份內容的時效性，講清楚 ──
 *   首頁畫面      執行期讀資料庫 → 廟方一存檔就變
 *   FAQPage 標記  執行期由 App.tsx 覆蓋 → Google 會執行 JS，看到的與畫面一致
 *   noscript 文字 就是這裡產的快照 → 不執行 JS 的 AI 爬蟲會讀到「上次部署時」的內容
 * 最後一項有時間差是刻意的取捨：那只影響新鮮度，不影響標記與畫面是否一致。
 */
const FALLBACK_FAQ = JSON.parse(readFileSync(resolve(DIST, '..', 'content', 'faq.json'), 'utf8')).items;

const fetchFaq = async () => {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.log('prerender  FAQ 來源：content/faq.json（沒有 Supabase 環境變數）');
    return FALLBACK_FAQ;
  }
  try {
    const res = await fetch(
      `${url}/rest/v1/faq_items?select=question,answer&is_visible=eq.true&order=sort_order`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('沒有資料');
    console.log(`prerender  FAQ 來源：資料庫（${rows.length} 題）`);
    return rows.map((r) => ({ q: r.question, a: r.answer }));
  } catch (e) {
    console.log(`prerender  FAQ 來源：content/faq.json（讀資料庫失敗：${e.message}）`);
    return FALLBACK_FAQ;
  }
};

const faq = await fetchFaq();

/**
 * 網站基本資料（地址／電話／開放時間）。與 FAQ 同理，建置時抓一份快照。
 *
 * 執行期 App.tsx 會用同一份資料覆寫畫面與 JSON-LD，所以使用者與 Google
 * 看到的永遠是最新的；這裡產的是給「不執行 JS 的爬蟲」看的靜態版本。
 * 抓不到就沿用 index.html 裡原本寫的內容（下面的 replace 找不到就不動）。
 */
/**
 * 祀奉神尊的名單。給不執行 JS 的爬蟲看的。
 *
 * 為什麼要抓：原本 /deities 的 noscript 只有一句「主祀天上聖母，並配祀濟公禪師、
 * 中壇元帥、文武財神等」——那是手寫的概括，**而且與實際名單不符**（名單裡沒有
 * 中壇元帥）。「台北 媽祖廟 供奉哪些神明」正是會被搜尋與被 AI 問到的問題，
 * 資料庫裡有 38 尊的完整名單，沒有理由讓爬蟲只看到一句錯的話。
 * 抓不到就回 null，退回 ROUTES 裡手寫的 body，不會開天窗。
 */
const fetchDeities = async () => {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/deities?select=name,is_visible,display_order&order=display_order`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('沒有資料');
    const names = rows.filter((r) => r.is_visible !== false).map((r) => (r.name || '').trim()).filter(Boolean);
    if (names.length === 0) throw new Error('沒有顯示中的神尊');
    console.log(`prerender  神尊名單來源：資料庫（${names.length} 尊）`);
    return names;
  } catch (e) {
    console.log(`prerender  神尊名單來源：ROUTES 手寫內容（讀資料庫失敗：${e.message}）`);
    return null;
  }
};

const fetchSiteInfo = async () => {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/site_settings?select=key,value&key=like.info_*`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('沒有資料');
    const m = Object.fromEntries(rows.map((r) => [r.key, (r.value ?? '').trim()]));
    const info = {
      address: m.info_address, street: m.info_street, locality: m.info_locality,
      region: m.info_region, postalCode: m.info_postal_code,
      phone: m.info_phone, open: m.info_hours_open, close: m.info_hours_close,
    };
    if (!info.address || !info.phone || !info.open || !info.close) throw new Error('欄位不完整');
    console.log(`prerender  基本資料來源：資料庫（${info.open}–${info.close}）`);
    return info;
  } catch (e) {
    console.log(`prerender  基本資料來源：index.html 原內容（讀資料庫失敗：${e.message}）`);
    return null;
  }
};

/**
 * noscript 裡的站內連結。
 *
 * 為什麼需要：原本每個分頁的 noscript 只有一個「回首頁」，不執行 JS 的爬蟲
 * （GPTBot／ClaudeBot／PerplexityBot 都不執行）落在 /about 之後只能回首頁，
 * 走不到兄弟頁——整個站在它們眼裡幾乎沒有內部連結。sitemap 能補一部分，
 * 但頁與頁之間的關聯是 sitemap 給不了的。
 * 從 ROUTES 自動產生，新增分頁不必回來改這裡。
 */
/**
 * 尚未對外開放的分頁（enabled: false）一律排除：不預渲染、不進 sitemap、
 * 也不出現在各頁 noscript 的站內連結。留著會讓爬蟲收錄一頁還沒建好的內容。
 * 開關要與 App.tsx 的對應旗標一起改。
 */
const ACTIVE_ROUTES = ROUTES.filter((r) => r.enabled !== false);

const NAV_LINKS = [{ path: '/', label: '首頁' }, ...ACTIVE_ROUTES.map((r) => ({ path: r.path, label: r.h1 }))];

/**
 * 這一頁 noscript 的段落。預設是 ROUTES 裡手寫的 body；
 * /deities 額外把資料庫的神尊名單接在後面（手寫那句只是概括，且曾與實際名單不符）。
 */
/**
 * 公佈欄與神明聖誕的快照（2026-10-13 補）。
 *
 * **為什麼要抓**：預渲染不執行 React，所以 /bulletins 與 /calendar 原本的
 * noscript 只寫得出「這一頁有什麼」，寫不出「現在實際有什麼」。
 * 不執行 JS 的 AI 檢索器看到的就是一頁空殼——而「最近有什麼活動」「媽祖生日
 * 是哪一天」正是信眾最常問、最該被答對的兩件事。
 *
 * **刻意不用 puppeteer**：讓無頭瀏覽器跑一次 React 是另一種解法，但要在
 * Vercel 的建置機下載 Chromium（幾百 MB、拖慢建置、多一個會壞的環節），
 * 而這些內容本來就在資料庫——直接抓，同樣的結果、少掉整個瀏覽器。
 *
 * 快照會過期（下次部署才更新），所以**只寫會長期成立的事實**：
 * 公告標題與日期、聖誕的農曆規則與今年換算後的國曆日期。
 */
const fetchBulletins = async () => {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(
      `${url}/rest/v1/bulletins?select=title,category,content,created_at,is_pinned&order=is_pinned.desc,created_at.desc&limit=10`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    console.log(`prerender  公告快照：${Array.isArray(rows) ? rows.length : 0} 則`);
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    console.log(`prerender  公告快照：略過（${e.message}）`);
    return [];
  }
};

/** 今年的神明聖誕（農曆換算成國曆）。lunar-javascript 與前台用同一個函式庫 */
const fetchFeasts = async () => {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(
      `${url}/rest/v1/deity_feasts?select=title,calendar_type,lunar_month,lunar_day,solar_month,solar_day,is_visible&is_visible=eq.true`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    const { Lunar, Solar } = require('lunar-javascript');
    const year = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date()).slice(0, 4));
    const out = [];
    // **日期要補零再排**：不補的話字串比較會把 2026/10/10 排在 2026/2/17 前面
    const ymd = (y, m, d) => `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    for (const f of (Array.isArray(rows) ? rows : [])) {
      try {
        if (f.calendar_type === 'solar' && f.solar_month && f.solar_day) {
          out.push({ title: f.title, date: ymd(year, f.solar_month, f.solar_day), rule: `國曆 ${f.solar_month} 月 ${f.solar_day} 日` });
        } else if (f.calendar_type === 'lunar' && f.lunar_month && f.lunar_day) {
          const sol = Lunar.fromYmd(year, f.lunar_month, f.lunar_day).getSolar();
          // 反查確認：lunar-javascript 對不存在的日期是回鄰近值而不是報錯（見 CLAUDE.md）
          const back = sol.getLunar();
          if (Math.abs(back.getMonth()) !== Math.abs(f.lunar_month) || back.getDay() !== f.lunar_day) continue;
          out.push({ title: f.title, date: ymd(sol.getYear(), sol.getMonth(), sol.getDay()), rule: `農曆 ${f.lunar_month} 月 ${f.lunar_day} 日` });
        }
      } catch { /* 單筆算不出來就跳過，不要讓整個建置掛掉 */ }
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    console.log(`prerender  聖誕快照：${out.length} 筆（${year} 年）`);
    return out;
  } catch (e) {
    console.log(`prerender  聖誕快照：略過（${e.message}）`);
    return [];
  }
};

const bulletinSnapshot = await fetchBulletins();
const feastSnapshot = await fetchFeasts();

const bodyOf = (r) => {
  if (r.path === '/deities' && deityNames && deityNames.length) {
    return [...r.body, `本壇目前奉祀的神尊共 ${deityNames.length} 尊：${deityNames.join('、')}。`];
  }
  if (r.path === '/bulletins' && bulletinSnapshot.length > 0) {
    return [...r.body, ...bulletinSnapshot.map((b) => {
      const d = String(b.created_at || '').slice(0, 10).replace(/-/g, '/');
      const brief = String(b.content || '').replace(/\s+/g, ' ').trim().slice(0, 90);
      return `${d}　【${b.category || '公告'}】${b.title}${brief ? `——${brief}…` : ''}`;
    })];
  }
  if (r.path === '/calendar' && feastSnapshot.length > 0) {
    return [...r.body, `今年的神明聖誕日期（依農曆換算）：`,
      ...feastSnapshot.map((f) => `${f.date}　${f.title}（${f.rule}）`)];
  }
  return r.body;
};

/**
 * 即將舉行的祈福活動，用來產生 Event 結構化資料。
 *
 * **為什麼要改成從資料庫來**（2026-10-13）：原本 index.html 裡寫死一段
 * 「太上慈悲普渡禮懺法會 2026-09-13」的 Event。那場早就辦完了，但標記還掛在
 * 首頁上——Search Console 會回報「過期活動」，而 AI 檢索器讀到的是
 * 「這間廟即將舉辦的活動」是一場一個月前就結束的法會。**比沒有標記更糟**。
 *
 * `blessing_events` 本來就有需要的每一個欄位，而且是後台可編輯的。
 * 改成從這裡產之後：辦完的自動不輸出、新辦的不必工程師改程式。
 *
 * **只輸出「還沒結束」的**（end_date >= 今天）。報名截止但還沒辦的仍然輸出——
 * 那場活動確實即將發生，只是不收報名了（同前台的排序規則）。
 * 走外部報名表的（external_form）也輸出：Event 描述的是「有這場活動」，
 * 跟報名走哪一套無關。
 */
const fetchUpcomingEvents = async () => {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.log('prerender  Event 標記：略過（沒有 Supabase 環境變數）');
    return [];
  }
  // 日期一律釘住台北時區：建置機跑在 UTC，用本地時間會在台灣早上 8 點前少一天
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
  try {
    const res = await fetch(
      `${url}/rest/v1/blessing_events?select=title,description,start_date,end_date,registration_deadline,fee,packages,image_url,is_active&is_active=eq.true&order=start_date`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    const upcoming = (Array.isArray(rows) ? rows : [])
      .filter((r) => (r.end_date || r.start_date || '') >= today);
    console.log(`prerender  Event 標記：${upcoming.length} 場即將舉行（共 ${rows.length} 場）`);
    return upcoming;
  } catch (e) {
    console.log(`prerender  Event 標記：略過（讀資料庫失敗：${e.message}）`);
    return [];
  }
};

/**
 * 點燈的燈種與價格。寫死在這裡的話，廟方在後台調價就會跟結構化資料對不起來——
 * 而「多少錢」正是 AI 最常被問、也最容易答錯的一項。
 */
const fetchLampServices = async () => {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(
      `${url}/rest/v1/lamp_service_configs?select=name,fee,description,is_active&is_active=eq.true&order=display_order`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    console.log(`prerender  點燈價格：${Array.isArray(rows) ? rows.length : 0} 種`);
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    console.log(`prerender  點燈價格：略過（${e.message}）`);
    return [];
  }
};

const lampServices = await fetchLampServices();

const upcomingEvents = await fetchUpcomingEvents();

/**
 * 把一筆 blessing_events 轉成 schema.org 的 Event。
 * 價格要嘛不給、要嘛給完整——`offers` 只給一半（例如有 price 沒有 priceCurrency）
 * Search Console 會直接回報錯誤。
 */
const toEventNode = (ev) => {
  const fees = [Number(ev.fee) || 0, ...(Array.isArray(ev.packages) ? ev.packages.map((p) => Number(p?.fee) || 0) : [])]
    .filter((n) => n > 0);
  const node = {
    '@type': 'Event',
    name: ev.title,
    startDate: ev.start_date,
    endDate: ev.end_date || ev.start_date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: 'https://heshengtan.tw/blessing',
    organizer: { '@id': 'https://heshengtan.tw/#temple' },
    performer: { '@id': 'https://heshengtan.tw/#temple' },
    location: { '@id': 'https://heshengtan.tw/#temple' },
  };
  if (ev.description) node.description = String(ev.description).replace(/\s+/g, ' ').trim().slice(0, 300);
  if (ev.image_url) node.image = [ev.image_url];
  if (fees.length > 0) {
    node.offers = {
      '@type': fees.length > 1 ? 'AggregateOffer' : 'Offer',
      url: 'https://heshengtan.tw/blessing',
      priceCurrency: 'TWD',
      availability: 'https://schema.org/InStock',
      ...(fees.length > 1
        ? { lowPrice: String(Math.min(...fees)), highPrice: String(Math.max(...fees)), offerCount: fees.length }
        : { price: String(fees[0]) }),
      ...(ev.registration_deadline ? { validThrough: ev.registration_deadline } : {}),
    };
  }
  return node;
};

const site = await fetchSiteInfo();
const deityNames = await fetchDeities();

/** 把一份 HTML 裡的地址／電話／開放時間換成後台設定的值 */
const applySiteInfo = (html) => {
  if (!site) return html;
  const tel = site.phone.replace(/[^\d+]/g, '');
  // 只把開頭的 0 換成 +886-，保留原本的連字號分組（+886-953-945-349）。
  // 全部去掉連字號會變成 +886-953945349 這種不上不下的格式，人和機器都不好讀。
  const intl = site.phone.replace(/^0/, '+886-');
  return html
    // JSON-LD
    .replace(/"telephone":\s*"[^"]*"/, `"telephone": "${intl}"`)
    .replace(/"opens":\s*"[^"]*"/, `"opens": "${site.open}"`)
    .replace(/"closes":\s*"[^"]*"/, `"closes": "${site.close}"`)
    .replace(/"streetAddress":\s*"[^"]*"/, `"streetAddress": "${esc(site.street)}"`)
    .replace(/"addressLocality":\s*"[^"]*"/, `"addressLocality": "${esc(site.locality)}"`)
    .replace(/"addressRegion":\s*"[^"]*"/, `"addressRegion": "${esc(site.region)}"`)
    .replace(/"postalCode":\s*"[^"]*"/, `"postalCode": "${esc(site.postalCode)}"`)
    // noscript 純文字
    .replace(/地址：[^<]*<br \/>/, `地址：${esc(site.address)}<br />`)
    .replace(/電話：<a href="tel:[^"]*"([^>]*)>[^<]*<\/a>/, `電話：<a href="tel:${tel}"$1>${esc(site.phone)}</a>`)
    .replace(/開放時間：每日 [^<]*<br \/>/, `開放時間：每日 ${site.open} – ${site.close}<br />`);
};


for (const r of ACTIVE_ROUTES) {
  let html = template;
  const url = ORIGIN + r.path;

  html = swap(html, /<title>[^<]*<\/title>/, `<title>${esc(r.title)}</title>`, '<title>');
  html = swap(html, /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${esc(r.desc)}" />`, 'meta description');
  html = swap(html, /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${url}" />`, 'canonical');
  html = swap(html, /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${esc(r.title)}" />`, 'og:title');
  html = swap(html, /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${esc(r.desc)}" />`, 'og:description');
  html = swap(html, /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${url}" />`, 'og:url');

  // 這一頁自己的分享圖（沒指定就沿用 index.html 的全站預設）。
  // og:image 與 twitter:image 必須一起換，只換一個會讓 X／Twitter 顯示另一張。
  if (r.image) {
    const img = ORIGIN + r.image;
    html = swap(html, /<meta property="og:image" content="[^"]*" \/>/,
      `<meta property="og:image" content="${img}" />`, 'og:image');
    html = swap(html, /<meta name="twitter:image" content="[^"]*" \/>/,
      `<meta name="twitter:image" content="${img}" />`, 'twitter:image');
    if (r.imageAlt) {
      html = swap(html, /<meta property="og:image:alt" content="[^"]*" \/>/,
        `<meta property="og:image:alt" content="${esc(r.imageAlt)}" />`, 'og:image:alt');
    }
  }

  // 法會的 Event 只留在首頁。
  // 這些分頁是拿 index.html 當模板產的，會連同模板裡的 @graph 一起繼承，
  // 結果「關於我們」「點燈服務」「遷址捐款」也各自宣告了一次同一場法會——
  // 那些頁面根本不是在講這場法會，Google 會回報活動結構化資料問題。
  // 首頁有法會的行動呼籲，留在那裡才對得上「標記的內容使用者看得到」。
  html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/, (m, body) => {
    let doc;
    try { doc = JSON.parse(body); } catch { return m; }   // 解析不了就原樣放過，不要弄壞頁面
    if (!Array.isArray(doc['@graph'])) return m;
    const kept = doc['@graph'].filter((n) => n['@type'] !== 'Event');
    if (kept.length === doc['@graph'].length) return m;
    return `<script type="application/ld+json">\n${JSON.stringify({ ...doc, '@graph': kept }, null, 2)}\n    </script>`;
  });

  // 這一頁自己的 JSON-LD：麵包屑讓檢索器知道站內層級，WebPage 綁回宮廟本體
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': url + '#page',
        url,
        name: r.title,
        description: r.desc,
        inLanguage: 'zh-TW',
        isPartOf: { '@id': ORIGIN + '/#website' },
        about: { '@id': ORIGIN + '/#temple' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '台北古亭和聖壇', item: ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: r.h1, item: url },
        ],
      },
      /**
       * 這一頁提供什麼服務（2026-10-13 補）。
       * 原本各頁只有 WebPage 與麵包屑——那只說得出「站內有這一頁」，
       * 說不出「這一頁是一項服務、多少錢、怎麼辦理」。
       * AI 被問「古亭的媽祖廟點燈多少錢」時，要嘛從內文猜、要嘛答不出來。
       * 點燈的價格從 lamp_service_configs 來，廟方調價會跟著變（不要寫死）。
       */
      ...(r.service ? [{
        '@type': 'Service',
        '@id': url + '#service',
        name: r.service.name,
        description: r.service.description,
        serviceType: r.service.name,
        provider: { '@id': ORIGIN + '/#temple' },
        areaServed: { '@type': 'City', name: '臺北市' },
        url,
        ...(r.path === '/lamps' && lampServices.length > 0 ? {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: '點燈項目',
            itemListElement: lampServices.map((l) => ({
              '@type': 'Offer',
              name: l.name,
              price: String(Number(l.fee) || 0),
              priceCurrency: 'TWD',
              availability: 'https://schema.org/InStock',
              url,
            })),
          },
        } : {}),
      }] : []),
    ],
  };
  html = html.replace('</head>',
    `  <script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n    </script>\n  </head>`);

  // 不執行 JS 的檢索器讀得到的實際文字
  const noscript = `
    <noscript>
      <div style="max-width:44rem;margin:0 auto;padding:2.5rem 1.25rem;font-family:'Noto Serif TC',serif;color:#3D2800;line-height:1.9">
        <h1 style="font-size:1.75rem;margin:0 0 1rem">${esc(r.h1)}</h1>
${bodyOf(r).map((p) => `        <p>${esc(p)}</p>`).join('\n')}
        <p style="margin-top:1.5rem">台北古亭和聖壇｜${site ? esc(site.address) : '100 臺北市中正區晉江街 72 巷 9 號'}｜電話 <a href="tel:${site ? site.phone.replace(/[^\d+]/g, '') : '0953945349'}" style="color:#7C5C1E">${site ? esc(site.phone) : '0953-945-349'}</a>｜每日 ${site ? `${site.open} – ${site.close}` : '06:00 – 23:00'}</p>
        <p style="margin-top:1.25rem">${NAV_LINKS.filter((l) => l.path !== r.path)
          .map((l) => `<a href="${l.path}" style="color:#7C5C1E;margin-right:1rem">${esc(l.label)}</a>`).join('')}</p>
        <p style="color:#7C5C1E">本頁的線上登記功能需要啟用 JavaScript。</p>
      </div>
    </noscript>`;
  html = html.replace('<div id="root"></div>', '<div id="root"></div>\n' + noscript);

  const out = resolve(DIST, r.path.slice(1) + '.html');
  writeFileSync(out, applySiteInfo(html), 'utf8');
  console.log(`prerender  ${r.path.padEnd(12)} → dist${r.path}.html`);
}

// ── 首頁：注入 FAQ（結構化資料 + noscript 純文字）─────────────────────────
{
  let home = template;

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': ORIGIN + '/#faq',
    inLanguage: 'zh-TW',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  home = home.replace('</head>',
    `  <script type="application/ld+json">\n${JSON.stringify(faqLd, null, 2)}\n    </script>\n  </head>`);

  /**
   * 即將舉行的活動（Event）。**不要寫死在 index.html 裡**——原本那樣寫，
   * 法會辦完標記還掛著，Search Console 回報過期活動，AI 讀到的也是錯的。
   * 一場都沒有就整個不輸出：沒有標記好過一個騙人的標記。
   */
  if (upcomingEvents.length > 0) {
    const eventsLd = {
      '@context': 'https://schema.org',
      '@graph': upcomingEvents.map(toEventNode),
    };
    home = home.replace('</head>',
      `  <script type="application/ld+json">\n${JSON.stringify(eventsLd, null, 2)}\n    </script>\n  </head>`);
  }

  const marker = '<p style="margin-top:1.75rem;color:#7C5C1E">本網站需要啟用 JavaScript';
  if (!home.includes(marker)) throw new Error('prerender: 在 index.html 的 noscript 裡找不到結尾段落');
  const faqText = `<h2 style="font-size:1.15rem;margin:1.75rem 0 .5rem">常見問題</h2>
${faq.map((f) => `        <p><strong>${esc(f.q)}</strong><br />${esc(f.a)}</p>`).join('\n')}
        `;
  home = home.replace(marker, faqText + marker);

  writeFileSync(resolve(DIST, 'index.html'), applySiteInfo(home), 'utf8');
  console.log(`prerender  /            → dist/index.html（FAQ ${faq.length} 題）`);
}

// llms.txt 也是給不執行 JS 的爬蟲看的靜態檔，同樣要跟著後台走
if (site) {
  const llmsPath = resolve(DIST, 'llms.txt');
  try {
    const txt = readFileSync(llmsPath, 'utf8')
      .replace(/- 地址：.*/, `- 地址：${site.address}`)
      .replace(/- 電話：.*/, `- 電話：${site.phone}`)
      .replace(/- 開放時間：.*/, `- 開放時間：每日 ${site.open} – ${site.close}`);
    writeFileSync(llmsPath, txt, 'utf8');
    console.log('prerender  llms.txt      基本資料已同步');
  } catch (e) {
    console.log(`prerender  llms.txt 未更新：${e.message}`);
  }
}

/**
 * sitemap.xml 由 ROUTES 產生，不再手工維護。
 *
 * 為什麼改：public/sitemap.xml 是手寫的，新增 /scripture 時要記得回去補一筆——
 * 而「要記得」的事情遲早會忘。少一筆的後果不會有任何錯誤訊息，只是那一頁
 * 比較晚被發現。而且原本 /deities 那筆連 lastmod 都漏了。
 *
 * lastmod 用建置日期：這些頁面的靜態內容（noscript、FAQ、神尊名單、基本資料）
 * 都是建置當下從資料庫抓的快照，所以「這份快照產生於今天」是誠實的說法。
 */
{
  // **明確釘住 Asia/Taipei，不要用 toISOString()，也不要靠機器的本地時區。**
  // toISOString() 是 UTC，台灣早上 8 點前會少一天（CLAUDE.md 有記，我第一版還是踩了）。
  // 但改成「本地時區」也不夠：那是**建置機器**的本地時區，而 Vercel 的
  // 建置機跑在 UTC——所以本機產出 09-02、線上卻是 09-01，只有部署到正式站
  // 才看得出來（實測踩到）。前端的日期規則講的是使用者的裝置（在台灣），
  // 建置腳本沒有這個前提，必須自己指定時區。
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
  const entries = [{ path: '/', priority: '1.0' }, ...ACTIVE_ROUTES];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((r) => `  <url>
    <loc>${ORIGIN}${r.path === '/' ? '/' : r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${r.priority || '0.8'}</priority>
  </url>`).join('\n')}
</urlset>
`;
  writeFileSync(resolve(DIST, 'sitemap.xml'), xml, 'utf8');
  console.log(`prerender  sitemap.xml   ${entries.length} 筆（lastmod ${today}）`);
}

console.log(`prerender  完成 ${ACTIVE_ROUTES.length} 頁`);
