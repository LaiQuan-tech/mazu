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
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/**
 * Supabase 的網址。**一定要 `.trim()`。**
 *
 * Vercel 上那個環境變數的值結尾帶了一個換行字元。REST 查詢沒事——`fetch()` 會把
 * 網址正規化，所以神尊、公告、經文都抓得到——但**把它串成字串寫進 sitemap 就是
 * 一個中間帶換行的壞網址**，實測那些 `<image:loc>` 全部 404。
 * 症狀很賊：建置不會錯、XML 也解析得過、頁面完全正常，只有真的去抓那些圖才會發現。
 * 順手也把結尾的斜線去掉，免得哪天變成 `…co//storage/…`。
 */
const SUPA_URL = (process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');

/** 公開儲存桶。資料庫存的是相對路徑，要自己接成完整網址 */
const STORAGE = (p) => (/^https?:\/\//.test(String(p).trim()) ? String(p).trim()
  : `${SUPA_URL}/storage/v1/object/public/site-images/${String(p).trim()}`);
const ORIGIN = 'https://heshengtan.tw';
/** 沐浴車自己的網域。`org` 路由的正本在這裡，不在宮廟那邊（見下方 origin 的註解） */
const BATH_ORIGIN = 'https://17bath.org';

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
    // 刻意不進導覽列（進香一年就那幾天），但要進 sitemap——搜「媽祖進香 洗澡車」找得到
    // 正是這一頁存在的意義。
    // /shower/checkin 不預渲染也不進 sitemap：那是志工的憑證網址，不該被索引。
    enabled: true,
    path: '/shower',
    priority: '0.6',
    // 品牌是「17 沐浴車」（臺中市媽祖聖沐慈善協會，2026-10-16 授權使用）。
    // 搜尋字兩種都要照顧：認得品牌的人搜「17沐浴車」，不認得的搜「進香 洗澡車」。
    title: '17 沐浴車｜媽祖進香免費沐浴服務位置查詢',
    desc: '17 沐浴車配合媽祖進香活動，為香燈腳提供免費沐浴服務。位置由現場志工即時回報，本頁可查目前地點並一鍵開啟導航。臺中市媽祖聖沐慈善協會主辦。',
    h1: '17 沐浴車',
    // 這一頁幾乎都是靠 LINE 轉傳進來的，分享卡片就是它的門面。
    // 海報是 4:3，直接給 LINE 會被裁掉標題，所以用裁好的 1200x630 版
    // （`og-shower.jpg`，由協會海報裁上半部產生）。
    image: '/og-shower.jpg',
    imageAlt: '17 沐浴車｜臺中市媽祖聖沐慈善協會　關懷每位香客，從沐浴開始。',
    // 這一頁的網站圖示用沐浴車自己那組（`public/bath-*`），不要用和聖壇的
    // （廟方 2026-10-20：「17bath.org 的 Favicon，不要用和聖壇的」）。
    // 17bath.org/ 會 307 轉到這一頁，所以這一行同時就決定了那個網域的 favicon。
    // 值是檔名前綴，對應 public/ 底下的 bath-favicon.ico 等四個檔。
    icons: 'bath-',
    /**
     * **這一頁的主體不是和聖壇。**（2026-10-20 補）
     * 其餘每一頁的 WebPage 都 `about: #temple`、Service 都 `provider: #temple`，
     * 這一頁照抄的話，AI 被問「17 沐浴車是誰辦的」會答「台北古亭和聖壇」——
     * 錯的，而且是把別人的功勞算到自己頭上。主辦從頭到尾都是協會。
     * 有 `org` 的路由，WebPage 的 `about` 與 Service 的 `provider` 都改指這個節點。
     */
    org: {
      '@type': ['NGO', 'Organization'],
      name: '臺中市媽祖聖沐慈善協會',
      alternateName: ['17 沐浴車', '媽祖聖沐慈善協會'],
      description: '臺中市立案的慈善協會，由 17 位企業家共同響應公益發起，打造 17 沐浴車，'
        + '配合媽祖進香活動為香燈腳提供免費沐浴服務，也曾前往花蓮災區提供服務。',
      url: 'https://17bath.org/',
      sameAs: [
        'https://17bath.org/',
        'https://www.facebook.com/profile.php?id=61574029464178',
        'https://lin.ee/SUoSKti',
      ],
    },
    service: {
      name: '17 沐浴車免費沐浴服務',
      description: '配合媽祖進香活動，為走在進香路上的香燈腳提供免費盥洗服務。'
        + '不收取任何費用。車輛隨進香隊伍移動，位置由現場志工即時回報。',
      // **「免費」是這一頁最常被問、也最該被答對的一件事**，所以不是只寫在內文裡，
      // 要讓結構化資料自己講得出來（Offer 的 price 0 ＋ isAccessibleForFree）。
      free: true,
      // 各地媽祖進香路線會經過的縣市。寫「臺北市」（其他頁的預設值）是錯的，
      // 這台車從來不在台北——而「在哪裡服務」正是這一頁存在的理由。
      // **不要只寫白沙屯那條路線的縣市**（廟方 2026-10-20：「還有大甲媽祖，大庄媽祖」）：
      // 大甲媽走到嘉義新港，只列到雲林就把一半的行程漏掉了。
      areaServed: ['苗栗縣', '臺中市', '彰化縣', '雲林縣', '嘉義縣'],
    },
images: [
      { src: '/shower-banner.jpg', alt: '17 沐浴車｜臺中市媽祖聖沐慈善協會在媽祖進香沿線提供免費沐浴服務' },
      { src: '/shower-volunteer.jpg', alt: '17 沐浴車志工招募｜替媽祖服務每一位香燈腳' },
      { src: '/shower-donate.png', alt: '17 沐浴車愛心捐贈' },
    ],
        faq: 'shower',
    /**
     * 不執行 JS 的檢索器只讀得到 noscript，所以這一頁的實際內容要在這裡講完。
     * 位置是即時的、不可能寫進靜態檔（也不該——它每小時都在變），
     * 但「誰辦的、給誰用、要不要錢、位置怎麼來的、多久更新一次」是不會變的，
     * 而那恰好就是 AI 被問到時要回答的東西。
     */
    body: [
      '17 沐浴車由臺中市媽祖聖沐慈善協會主辦，配合媽祖進香活動，為辛苦走在進香路上的香燈腳提供免費沐浴服務，不收取任何費用。',
      '協會由 17 位企業家共同響應公益發起，合力打造這台沐浴車，車名的「17」就是這個由來。服務內容曾獲壹電視 NEXT TV 專題報導。',
      '沐浴車隨進香隊伍移動，停放的地點會變。本頁顯示每台車目前停放的地點與最後回報時間，可直接開啟 Google 地圖導航前往。位置由現場志工在現場回報，出發前請再確認一次；超過兩小時沒有更新的位置，頁面會另外標示提醒。',
      '服務對象：參與媽祖進香活動的香燈腳、進香信眾、隨香人員與進香志工。',
      '曾隨行的進香活動包含白沙屯媽祖進香、大甲媽祖遶境進香、大庄媽祖進香等，不限於其中某一個。',
      '非進香期間本頁不會有位置資料。協會也在花蓮災區提供過沐浴服務。',
      '這一頁的網址有兩個：17bath.org 與 heshengtan.tw/shower，內容相同。',
      // 捐款的對象是協會不是和聖壇。AI 被問到「怎麼支持沐浴車」時答得出來的
      // 前提是這裡講過——而這一段同時被 heshengtan.tw 供應，所以要指名收款單位。
      '想支持這項服務有兩條路，入口都在頁面下方：志工招募，以及愛心捐贈（線上表單 '
      + 'https://forms.gle/ZVwrpyRLzKnMmWcaA ）。兩者都由臺中市媽祖聖沐慈善協會受理，'
      + '與台北古亭和聖壇自己的捐獻管道無關，不要互相代換。',
    ],
    // noscript 頁尾要署協會的名，不是和聖壇的地址電話與開放時間——
    // 那是一間在台北的宮廟，而這台車在進香路上，兩者擺在一起會被當成同一個單位。
    footer: '臺中市媽祖聖沐慈善協會｜17 沐浴車｜'
      + 'Facebook：17沐浴車｜網址 https://17bath.org/',
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
      // 價格從 lamp_service_configs 抓（見下方 llms.txt 那段的註解）；抓不到就用這串保底
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
    // 緊急祈願燈。常設服務，**不收費**——那是廟方寫在文案裡的承諾，
    // 所以 service 不給 offers（沒有價格就不要宣告價格），desc 與內文都要把
    // 「免費」講出來：會搜到這一頁的人多半正在急難中，那是他第一個要確認的事。
    path: '/urgent',
    service: { name: '緊急祈願燈', description: '為手術住院、升學考試或為先人祈請冥福接引的信眾，由本壇代為向神明稟告、祈福點燈。不收取任何費用，可線上登記。' },
    priority: '0.8',
    title: '緊急祈願燈｜急難代為稟告祈福，不收費｜台北古亭和聖壇',
    desc: '手術住院、病苦關卡、升學考試，或為先人祈請冥福接引，皆可向台北古亭和聖壇登記《緊急祈願燈》，由本壇代為稟告、祈福點燈。不收取任何費用，可線上登記。',
    h1: '緊急祈願燈',
    body: [
      '世間若有急難之時，一念祈願，亦可化作守護的力量。和聖壇秉持濟世初心，在神明慈悲護佑之下，特設《緊急祈願燈》，為有急難之人代為稟告、祈福點燈。',
      '無論是手術住院、病苦關卡、升學考試，或為先人祈請冥福接引，皆可向本壇登記祈願。',
      '本壇《緊急祈願燈》不收取任何費用，只願以一念誠心，上達神明。願一盞燈火，為祈願者帶來光明與轉機。',
      '登記時請選擇祈願情況（手術或住院／升學考試或考證照／冥福接引），並留下聯絡電話。冥福接引限三等親內親屬。',
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
  {
    // 2026-10-23 從首頁 #donation 搬成獨立分頁。首頁只留一張 CTA 卡。
    // 與 /relocation 是兩回事：那一頁是遷址專款（另一個銀行帳戶），這一頁是一般護持。
    path: '/donation',
    service: { name: '隨喜捐獻', description: '護持壇務、添油香、物資捐贈等隨喜護持項目，金額隨喜。' },
    priority: '0.7',
    title: '隨喜捐獻｜護持台北古亭和聖壇壇務',
    desc: '隨喜捐獻護持台北古亭和聖壇。護持項目金額隨喜，可線上登記捐獻意向，廟方人員將與您聯繫後續事宜。',
    h1: '隨喜捐獻 / 護持項目',
    body: [
      '您的每一分心意，都是支持和聖壇持續弘揚神恩、服務大眾的力量。',
      '線上填寫姓名、聯絡方式與捐款金額即可登記捐獻意向，廟方人員會與您聯繫後續事宜；護持項目可在表單中選擇。',
      '道場遷址另有專屬的募資專款與匯款帳號，請改至「遷址捐款」頁。',
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

/**
 * 沐浴車的常見問題。**與 `components/ShowerPage.tsx` 讀同一個檔**——
 * 畫面、FAQPage 標記、noscript 純文字三個地方必須是同一份內容，
 * 各寫一份的話改了答案就會變成「標記的內容使用者看不到」（FAQPage 的規則就是這條）。
 * 這一份刻意放檔案不放資料庫：它講的是協會的服務，後台沒有、也不該有它的編輯介面。
 */
const SHOWER_FAQ = JSON.parse(readFileSync(resolve(DIST, '..', 'content', 'shower-faq.json'), 'utf8'));
/** 沐浴車的影片清單。**與 components/ShowerPage.tsx 讀的是同一份**，兩邊不會各自漂移。 */
const SHOWER_VIDEOS = JSON.parse(readFileSync(resolve(DIST, '..', 'content', 'shower-videos.json'), 'utf8'));

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
      `${url}/rest/v1/deities?select=name,title,description,image_path,is_visible,display_order&order=display_order`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('沒有資料');
    const list = rows.filter((r) => r.is_visible !== false)
      .map((r) => ({ name: (r.name || '').trim(), title: (r.title || '').trim(),
        desc: (r.description || '').trim(), image: r.image_path || null }))
      .filter((r) => r.name);
    if (list.length === 0) throw new Error('沒有顯示中的神尊');
    console.log(`prerender  神尊名單來源：資料庫（${list.length} 尊，${list.filter((d) => d.image).length} 尊有照片）`);
    return list;
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

/**
 * noscript 裡的站內連結，**兩個網域各自成一份**（2026-10-27 廟方：「和聖壇不要有
 * 沐浴車的資訊，因為目前搜尋會混淆了」）。
 *
 * 原本是一份共用清單，於是**每一個和聖壇的頁面都在 noscript 裡連到 /shower**，
 * 而沐浴車那一頁又反過來連回十幾個宮廟頁面——等於主動告訴檢索器「這兩個是同一
 * 個站」。搜尋「和聖壇」會跑出沐浴車、搜「沐浴車」會跑出宮廟，正是廟方看到的症狀。
 * 現在宮廟的清單不含 `org` 路由，`org` 路由也不連回宮廟。
 */
const TEMPLE_NAV = [{ path: '/', label: '首頁' },
  ...ACTIVE_ROUTES.filter((r) => !r.org).map((r) => ({ path: r.path, label: r.h1 }))];

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
      `${url}/rest/v1/bulletins?select=title,category,content,image_url,created_at,is_pinned&order=is_pinned.desc,created_at.desc&limit=10`,
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

/**
 * 天上聖母經的 136 段（2026-10-25 補）。
 *
 * **為什麼非做不可**：`/scripture` 是全站最有價值的一頁——長文、獨特、有人真的
 * 在搜「天上聖母經」——但它的內容是 React 跑起來才去 `scripture_verses` 抓的，
 * 所以靜態 HTML 只有 ROUTES 裡那兩句手寫介紹。實測線上 `/scripture` 的 noscript
 * 只有 **264 個字**，而且搜不到「爾時」這種經文詞。不執行 JS 的 AI 檢索器看到的
 * 就是一頁空殼；Google 雖然會跑 JS，但那是排隊、延後的第二輪處理，對一個今年
 * 才上線的新站不該指望它。
 *
 * 資料庫優先、`scripture-data.json` 保底——與點燈價格、FAQ、神尊名單同一套作法：
 * 廟方在後台改了經文，下次部署就跟上；讀不到資料庫也不會開天窗。
 */
const fetchScripture = async () => {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const res = await fetch(
        `${url}/rest/v1/scripture_verses?select=section_number,verse,annotation,image_path,display_order&order=display_order`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('沒有資料');
      console.log(`prerender  聖母經來源：資料庫（${rows.length} 段，${rows.filter((r) => r.image_path).length} 段有插圖）`);
      return rows.map((r) => ({ n: r.section_number, verse: r.verse || '', ann: r.annotation || '', image: r.image_path || null }));
    } catch (e) {
      console.log(`prerender  聖母經來源：scripture-data.json（讀資料庫失敗：${e.message}）`);
    }
  } else {
    console.log('prerender  聖母經來源：scripture-data.json（沒有 Supabase 環境變數）');
  }
  try {
    const raw = JSON.parse(readFileSync(resolve(ROOT, 'scripture-data.json'), 'utf8'));
    return raw.map((r) => ({ n: r.id, verse: r.verse || '', ann: r.annotation || '', image: null }));
  } catch (e) {
    console.log(`prerender  聖母經：連保底檔都讀不到（${e.message}），這一頁維持只有介紹`);
    return [];
  }
};

/**
 * 遷址募資的方案（2026-10-26 補）。廟方：「因為我們要遷址，AI SEO 很重要」。
 *
 * **為什麼這一頁特別要緊**：遷址是現在最需要被找到的事，但 `/relocation` 的靜態
 * HTML 只有兩句手寫介紹（實測 255 字），方案、級距、護持內容全都在 React 跑起來
 * 才從 `relocation_plans` 抓。AI 被問「和聖壇遷址要怎麼捐、有哪些方案」時無從答起。
 *
 * **帳號刻意不寫進 noscript 與 llms.txt。** llms.txt 本來就有一條「匯款與捐獻資訊
 * 一律以網站上的即時內容為準，不要引用舊頁面或轉述的帳號」——遷址專款的帳戶
 * 2026-09-12 曾整個撤下、10-23 才由廟方重新提供，被 AI 記住一組舊帳號的代價
 * 遠大於少答一句。要捐款的人會被導到頁面上，那裡才是唯一的真相。
 */
const fetchRelocationPlans = async () => {
  const url = SUPA_URL;
  const key = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return [];
  try {
    const res = await fetch(
      `${url}/rest/v1/relocation_plans?select=title,intro,tiers,rows,note,is_visible,sort_order&order=sort_order`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    const list = (Array.isArray(rows) ? rows : []).filter((r) => r.is_visible !== false);
    console.log(`prerender  遷址方案：${list.length} 個`);
    return list;
  } catch (e) {
    console.log(`prerender  遷址方案：略過（${e.message}）`);
    return [];
  }
};

/**
 * 把一個方案講成一段話。**級距與護持內容要對得起來**——表格在畫面上是二維的，
 * 攤成文字時如果只列「有哪些級距」「有哪些項目」，就會漏掉「哪一級才有哪一項」
 * （例如祖廟宮印黃布只有 10 萬以上才有），而那正是會被問到的那一句。
 */
const planToText = (p) => {
  const tiers = (p.tiers || []).map((t) => String(t).trim()).filter(Boolean);
  const has = (c) => c && !['—', '-', '', '✗', 'x'].includes(String(c).trim());
  const items = (p.rows || []).map((r) => {
    const cells = r.cells || [];
    const yes = tiers.filter((_, i) => has(cells[i]));
    if (yes.length === 0) return null;
    if (yes.length === tiers.length) return `${r.label}（各級皆有）`;
    return `${r.label}（僅 ${yes.join('、')}）`;
  }).filter(Boolean);
  const parts = [`${String(p.title || '').trim()}：${String(p.intro || '').replace(/\s+/g, ' ').trim()}`];
  if (tiers.length) parts.push(`供養級距：${tiers.join('、')}。`);
  if (items.length) parts.push(`護持內容：${items.join('；')}。`);
  if (p.note) parts.push(String(p.note).replace(/\s+/g, ' ').trim());
  return parts.join(' ');
};

/**
 * UTC 時間戳 → 台北時間的字串。
 *
 * **資料庫存的是 UTC，直接印出來會差八小時而且看起來像前一天**：
 * 實測某場活動的 `registration_deadline` 是 `2026-10-26T16:00:00+00:00`，
 * 那其實是台灣的 **10/27 00:00**，照著印就變成「報名截止 10-26」——
 * 對報名的人來說是少了一整天。同 CLAUDE.md「日期一律本地時區組字串」那條，
 * 差別在於**建置機跑在 UTC**，所以不能用機器的本地時間，要明寫 Asia/Taipei。
 */
const twTime = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const f = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d).reduce((o, p) => (o[p.type] = p.value, o), {});
  return `${f.year}-${f.month}-${f.day} ${f.hour}:${f.minute}`;
};

/**
 * 近期的問事場次（2026-10-26 補）。「這個月哪幾天可以問事」是信眾最常問的一件事，
 * 而 `/booking` 的 noscript 原本只有一句手寫概括——場次全在 React 跑起來才抓。
 *
 * **只取今天以後、而且還開放的場次**（`is_active`）：快照會過期（下次部署才更新），
 * 所以寧可少列也不要列出已經關閉的場次，叫人白跑一趟比沒有資訊糟。
 * 上限 12 場，再多對爬蟲也只是雜訊。
 */
const fetchBookingSessions = async () => {
  const url = SUPA_URL;
  const key = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return [];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
  try {
    const res = await fetch(
      `${url}/rest/v1/booking_sessions?select=session_date,session_time,is_active&is_active=eq.true&session_date=gte.${today}`
      + '&order=session_date,session_time&limit=12',
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    console.log(`prerender  問事場次：${Array.isArray(rows) ? rows.length : 0} 場`);
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    console.log(`prerender  問事場次：略過（${e.message}）`);
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
const scriptureRows = await fetchScripture();
const relocationPlans = await fetchRelocationPlans();
const bookingSessions = await fetchBookingSessions();
const feastSnapshot = await fetchFeasts();

const bodyOf = (r) => {
  if (r.path === '/deities' && deityCards && deityCards.length) {
    // 名單之外再把每一尊的稱號與簡介接上——原本只有一串名字，
    // 而「這尊是誰、管什麼」才是信眾與 AI 真正會問的（2026-10-25 補）
    return [...r.body,
      `本壇目前奉祀的神尊共 ${deityCards.length} 尊：${deityCards.map((d) => d.name).join('、')}。`,
      ...deityCards.filter((d) => d.title || d.desc)
        .map((d) => [d.name, d.title, d.desc].filter(Boolean).join('　')),
    ];
  }
  if (r.path === '/bulletins' && bulletinSnapshot.length > 0) {
    return [...r.body, ...bulletinSnapshot.map((b) => {
      const d = String(b.created_at || '').slice(0, 10).replace(/-/g, '/');
      const brief = String(b.content || '').replace(/\s+/g, ' ').trim().slice(0, 90);
      return `${d}　【${b.category || '公告'}】${b.title}${brief ? `——${brief}…` : ''}`;
    })];
  }
  if (r.path === '/blessing' && upcomingEvents.length > 0) {
    /**
     * 即將舉行的祈福活動。`upcomingEvents` 是 Event 標記本來就在抓的那一份，
     * **不要另外抓一次**——兩份來源遲早會不一致（同行事曆直接讀 booking_sessions
     * 而不另建一份的理由）。
     * 費用的規則與全站一致：**有方案就用方案、沒有方案才用活動本身的 fee**
     * （見 CLAUDE.md 那條漏了三個月、把每一筆都算成 0 的 bug）。
     */
    return [...r.body, ...upcomingEvents.map((ev) => {
      const pkgs = Array.isArray(ev.packages) ? ev.packages : [];
      const fees = pkgs.map((p) => Number(p?.fee ?? 0)).filter((n) => n > 0);
      const fee = fees.length ? `${Math.min(...fees).toLocaleString()}–${Math.max(...fees).toLocaleString()} 元`
        : (Number(ev.fee) > 0 ? `${Number(ev.fee).toLocaleString()} 元` : '');
      const when = ev.end_date && ev.end_date !== ev.start_date ? `${ev.start_date}～${ev.end_date}` : ev.start_date;
      const desc = String(ev.description || '').replace(/\s+/g, ' ').trim();
      return [`${String(ev.title || '').trim()}（${when}）`, fee && `費用 ${fee}`,
        ev.registration_deadline && `報名截止 ${twTime(ev.registration_deadline)}`, desc].filter(Boolean).join('　');
    })];
  }
  if (r.path === '/booking' && bookingSessions.length > 0) {
    // 同一天可能有好幾個時段，合成一行才不會變成一串重複的日期
    const byDate = new Map();
    for (const s2 of bookingSessions) {
      // **`session_time` 是自由文字不是時間**（實際值長這樣：「晚上 19:00–21:00」），
      // 所以不可以 slice——切過會變成「晚上 19」。原樣用就好。
      const t = String(s2.session_time || '').trim();
      byDate.set(s2.session_date, [...(byDate.get(s2.session_date) || []), t].filter(Boolean));
    }
    return [...r.body,
      `近期可預約的辦事日（問事）共 ${byDate.size} 天：`
      + [...byDate.entries()].map(([d, ts]) => `${d}${ts.length ? `（${ts.join('、')}）` : ''}`).join('、')
      + '。實際名額與是否額滿請以本頁的線上預約為準。'];
  }
  if (r.path === '/relocation' && relocationPlans.length > 0) {
    return [...r.body, ...relocationPlans.map(planToText),
      '捐款方式與專款帳號請見本頁面上的匯款資訊；遷址專款與一般隨喜捐獻是不同的帳戶，請勿混用。'];
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

/**
 * 把 `/lamps` 的 noscript 價目換成資料庫裡的。
 *
 * ROUTES 是模組層級的常值、在抓資料之前就定義好了，所以只能事後改它那一行。
 * 理由同 llms.txt 那段：JSON-LD 的價格早就是資料庫來的，noscript 卻寫死，
 * **廟方調一次價，給 Google 的與給不執行 JS 的爬蟲的就對不起來**。
 * 抓不到價格就保留原本那串保底值（寫死的舊價也好過沒有價錢）。
 */
if (lampServices.length > 0) {
  const lamps = ROUTES.find((r) => r.path === '/lamps');
  if (lamps?.body?.length) {
    const 價目 = lampServices
      .map((l) => `${l.name}（每年 NT$${Number(l.fee ?? 0).toLocaleString()}）`)
      .join('、');
    lamps.body[0] = `農曆新年期間提供${價目}，祈求流年順遂、元辰光彩。`;
  }
}

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
const deityCards = await fetchDeities();

/**
 * 首頁有哪些圖。首頁的 noscript 寫在 index.html 裡（不是這支產的），
 * 所以這裡只服務圖片 sitemap。三尊神尊是全站最該被搜到的照片，
 * 書法是 2026-10-25 上的品牌標語。
 */
const HOME_IMAGES = [
  { src: '/hero-sanma.png', alt: '天上聖母三媽（本壇主神）｜台北古亭和聖壇' },
  { src: '/hero-erma.png', alt: '天上聖母二媽｜台北古亭和聖壇' },
  { src: '/hero-jigong.png', alt: '濟公活佛｜台北古亭和聖壇' },
  { src: '/hero-calligraphy.png', alt: '書法：像家就是家｜台北古亭和聖壇' },
];

/**
 * 這一頁有哪些圖片（2026-10-25 補）。給 `<noscript>` 與**圖片 sitemap** 共用，
 * 兩邊同一份來源，不會一邊有一邊沒有。
 *
 * **為什麼要做**：實測線上每一頁的靜態 HTML 裡 `<img>` 都是 **0**——神尊照片、
 * 經文插圖、公告海報全部是 React 插進去的。Google 圖片搜尋雖然會跑 JS，但站上
 * 幾乎所有圖都是 `loading="lazy"`，而算繪時並不會捲動頁面，折線以下的圖很可能
 * 從頭到尾沒被載入過。**圖片 sitemap 是唯一不依賴算繪的管道**，所以它才是重點；
 * noscript 裡那幾張是順便給不執行 JS 的 AI 檢索器看的。
 *
 * 只收「這一頁真的有、而且說得出是什麼」的圖：說不出 alt 的不要放進來。
 */
const imagesFor = (r) => {
  const out = [];
  if (r.path === '/deities' && deityCards) {
    for (const d of deityCards) {
      if (d.image) out.push({ loc: STORAGE(d.image), alt: [d.name, d.title].filter(Boolean).join('　') });
    }
  }
  if (r.path === '/bulletins') {
    for (const b of bulletinSnapshot) {
      if (b.image_url) out.push({ loc: STORAGE(b.image_url), alt: `${(b.title || '公告').trim()}｜台北古亭和聖壇` });
    }
  }
  if (r.path === '/scripture') {
    for (const v of scriptureRows) {
      if (v.image) out.push({ loc: STORAGE(v.image), alt: `天上聖母經 第 ${v.n} 段 插圖` });
    }
  }
  // `org` 路由的圖掛在它自己的網域底下，不要掛回宮廟（同 canonical 的理由）
  if (r.images) out.push(...r.images.map((i) => ({ loc: (r.org ? BATH_ORIGIN : ORIGIN) + i.src, alt: i.alt })));
  /**
   * **壞網址一律不要進 sitemap。** 指到 404 的圖比沒有圖更糟——Search Console 會
   * 一直回報抓取失敗，而且是整批。所以這裡不只擋「沒有 Supabase 網址」那種
   * （會組出 `undefined/storage/…`），也擋任何含空白或換行的（見 SUPA_URL 的註解，
   * 那個環境變數真的帶過換行，而且一路到線上才被抓到）。
   */
  return out.filter((i) => i.loc && /^https:\/\/[^\s]+$/.test(i.loc) && !i.loc.includes('undefined'));
};

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
  /**
   * **`org` 路由的正本網址是它自己的網域。**（2026-10-27 改；在那之前 canonical
   * 指向 heshengtan.tw/shower，等於跟 Google 宣告「沐浴車是和聖壇的頁面」，
   * 而那正是搜尋結果互相混淆的根源。）
   * canonical、og:url、JSON-LD 的 @id 與麵包屑都跟著走這個網址，不能只改其中一個。
   */
  const origin = r.org ? BATH_ORIGIN : ORIGIN;
  const url = origin + r.path;

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

  /**
   * 這一頁自己的網站圖示（沒指定就沿用 index.html 那組和聖壇的）。
   * `/shower` 是獨立的網站（17bath.org），分頁上掛和聖壇的 logo 會讓香客
   * 以為自己點錯地方。
   * **四個標籤要一起換**：瀏覽器是從全部的 <link rel="icon"> 裡自己挑一個用
   * （挑的規則各家不同），少換一個就可能挑到剩下的那個舊圖示，
   * 症狀是「換了但有時候還是舊的」，極難查。
   * 檔名只差一個前綴，所以用前綴組字串，不必再維護一份對照表。
   */
  if (r.icons) {
    const p = r.icons;
    html = swap(html, /<link rel="icon" href="\/favicon\.ico"/,
      `<link rel="icon" href="/${p}favicon.ico"`, 'favicon.ico');
    html = swap(html, /<link rel="icon" type="image\/png" href="\/icon-96\.png"/,
      `<link rel="icon" type="image/png" href="/${p}icon-96.png"`, 'icon-96.png');
    html = swap(html, /<link rel="icon" type="image\/png" href="\/favicon-32\.png"/,
      `<link rel="icon" type="image/png" href="/${p}favicon-32.png"`, 'favicon-32.png');
    html = swap(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/,
      `<link rel="apple-touch-icon" href="/${p}apple-touch-icon.png"`, 'apple-touch-icon.png');
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
        // 這一頁在講誰。多數頁是宮廟本體，`org` 路由（沐浴車）是別的單位，見該路由的註解。
        about: { '@id': r.org ? url + '#org' : ORIGIN + '/#temple' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '台北古亭和聖壇', item: ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: r.h1, item: url },
        ],
      },
      // 這一頁談的是別的單位時，那個單位自己要是一個節點，才有東西可以被指到
      ...(r.org ? [{ '@id': url + '#org', ...r.org }] : []),
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
        provider: { '@id': r.org ? url + '#org' : ORIGIN + '/#temple' },
        areaServed: (r.service.areaServed ?? ['臺北市']).map((n) => ({ '@type': 'City', name: n })),
        url,
        // 免費的服務要講得出「免費」。只寫在內文裡，AI 得自己從句子推；
        // 給 Offer 一個 price 0 才是機器讀得懂的講法（緊急祈願燈也是免費的，
        // 但它目前沒開這個旗標——要補的話在那一筆加 `free: true` 就好）。
        ...(r.service.free ? {
          isAccessibleForFree: true,
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'TWD',
            availability: 'https://schema.org/InStock',
            url,
          },
        } : {}),
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
      /**
       * 這一頁自己的常見問題（`faq: 'shower'`）。
       * **畫面上看得到的那一份才可以標記**——內容與 `components/ShowerPage.tsx`
       * 讀的是同一個 `content/shower-faq.json`，兩邊不會各自漂移。
       * 首頁的 FAQ 走另一條路（資料庫、App.tsx 執行期覆寫），不要混在一起。
       */
      ...(r.faq === 'shower' ? [{
        '@type': 'FAQPage',
        '@id': url + '#faq',
        inLanguage: 'zh-TW',
        mainEntity: SHOWER_FAQ.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }] : []),
    ],
  };
  html = html.replace('</head>',
    `  <script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n    </script>\n  </head>`);

  // 不執行 JS 的檢索器讀得到的實際文字（GPTBot／ClaudeBot／PerplexityBot 都不跑 JS）

  // 這一頁自己的常見問題也要寫進來：爬蟲讀得到的只有這裡，
  // 而問答正是被引用時最好用的格式（一問一答，不必自己從長段落裡切）。
  const faqText = r.faq === 'shower'
    ? `\n        <h2 style="font-size:1.15rem;margin:1.75rem 0 .5rem">常見問題</h2>\n`
      + SHOWER_FAQ.map((f) => `        <p><strong>${esc(f.q)}</strong><br />${esc(f.a)}</p>`).join('\n')
    : '';

  // 署名：有 `org` 的路由署那個單位（沐浴車是協會的），其餘署宮廟。
  const footerText = r.footer
    ? esc(r.footer)
    : `台北古亭和聖壇｜${site ? esc(site.address) : '100 臺北市中正區晉江街 72 巷 9 號'}｜電話 <a href="tel:${site ? site.phone.replace(/[^\d+]/g, '') : '0953945349'}" style="color:#7C5C1E">${site ? esc(site.phone) : '0953-945-349'}</a>｜每日 ${site ? `${site.open} – ${site.close}` : '06:00 – 23:00'}`;

  /**
   * 站內連結。**`org` 的路由要用絕對網址指回 heshengtan.tw。**
   * 這一份 HTML 同時被 17bath.org 供應，相對網址在那個網域上會變成
   * `17bath.org/booking`、`17bath.org/lamps`⋯⋯而 SPA 的萬用規則真的會把
   * 整個和聖壇網站在沐浴車的網域底下再長一份出來。爬蟲照著爬就是兩個網域
   * 各有一套一模一樣的內容，誰是正本就說不清楚了。
   */
  // `org` 路由不連回宮廟（理由見 TEMPLE_NAV）；宮廟的連結用相對路徑即可
  const navLinks = r.org ? [] : TEMPLE_NAV;

  /**
   * 經文全文。**只有 `/scripture` 有**，而且是整整 136 段——這一頁的價值就在這裡，
   * 只摘要幾段等於把最該被索引的內容留在 JS 裡。`verse` 的換行是刻意的斷句，
   * 轉成 `<br />`（**先 esc 再換**，順序反了會把標籤自己跳脫掉）。
   */
  const scriptureText = r.path !== '/scripture' || scriptureRows.length === 0 ? '' :
    '\n' + scriptureRows.map((v) => {
      const verse = esc(v.verse).replace(/\n/g, '<br />');
      const ann = v.ann ? `\n        <p style="margin:0 0 .75rem;color:#5C4310">${esc(v.ann)}</p>` : '';
      return `        <h2 style="font-size:1rem;margin:1.25rem 0 .35rem;color:#7C5C1E">第 ${esc(String(v.n))} 段</h2>\n`
           + `        <p style="margin:0 0 .35rem">${verse}</p>${ann}`;
    }).join('\n');

  const pageImgs = imagesFor(r);
  const imgText = pageImgs.length === 0 ? '' :
    '\n' + pageImgs.map((i) =>
      `        <img src="${i.loc}" alt="${esc(i.alt)}" style="max-width:100%;height:auto;margin:.5rem 0" />`).join('\n');

  const noscript = `
    <noscript>
      <div style="max-width:44rem;margin:0 auto;padding:2.5rem 1.25rem;font-family:'Noto Serif TC',serif;color:#3D2800;line-height:1.9">
        <h1 style="font-size:1.75rem;margin:0 0 1rem">${esc(r.h1)}</h1>
${bodyOf(r).map((p) => `        <p>${esc(p)}</p>`).join('\n')}${scriptureText}${imgText}${faqText}
        <p style="margin-top:1.5rem">${footerText}</p>
        <p style="margin-top:1.25rem">${navLinks.filter((l) => l.path !== r.path)
          .map((l) => `<a href="${l.path}" style="color:#7C5C1E;margin-right:1rem">${esc(l.label)}</a>`).join('')}</p>
        <p style="color:#7C5C1E">${r.org ? '本頁的沐浴車位置查詢需要啟用 JavaScript。' : '本頁的線上登記功能需要啟用 JavaScript。'}</p>
      </div>
    </noscript>`;
  /**
   * **先拿掉模板自己那份 noscript，再放這一頁的。**
   * 模板是 index.html，它的 noscript 寫的是首頁（宮壇簡介、地址電話、神尊照片）。
   * 原本只「加一份」，結果每個分頁都夾帶著首頁那 726 字——13 頁各複製一份同樣的
   * 內容，對不執行 JS 的檢索器來說，每一頁的獨特內容都被這段稀釋掉
   * （2026-10-25 發現，是既有問題不是這次改出來的）。
   * 首頁那一份不受影響：它走下面另一個區塊、直接用 template 產。
   */
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/, '');
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

/**
 * llms.txt 也是給不執行 JS 的爬蟲看的靜態檔，同樣要跟著後台走。
 *
 * ── 點燈價格也要同步，不是只有基本資料 ──
 * 2026-10-13 發現：`/lamps` 的 JSON-LD（OfferCatalog）是從 `lamp_service_configs`
 * 抓的，但 llms.txt 與 noscript 的那串價格是**寫死的**。
 * 廟方在後台調一次價，同一個網站就會對 AI 說一種價、對 Google 說另一種
 * ——而且不會有任何錯誤訊息（同「開放時間散在六處」那次事故的成因）。
 * **「多少錢」正是最常被問、最容易答錯的一項**，所以一律從資料庫來。
 * 抓不到價格時（Supabase 暫停、沒有環境變數）就維持檔案裡原本那串，
 * 不要把它洗成空的——寫死的舊價也好過沒有價錢。
 */
const lampPriceLine = () => lampServices
  .map((l) => `${l.name}（每年 NT$${Number(l.fee ?? 0).toLocaleString()}）`)
  .join('、');

if (site || lampServices.length > 0 || relocationPlans.length > 0) {
  const llmsPath = resolve(DIST, 'llms.txt');
  try {
    let txt = readFileSync(llmsPath, 'utf8');
    if (site) {
      txt = txt
        .replace(/- 地址：.*/, `- 地址：${site.address}`)
        .replace(/- 電話：.*/, `- 電話：${site.phone}`)
        .replace(/- 開放時間：.*/, `- 開放時間：每日 ${site.open} – ${site.close}`);
    }
    if (relocationPlans.length > 0) {
      /**
       * 遷址那一行原本只有「分月供養與單次供養兩種方案」。遷址是現在最需要被
       * 找到的事，AI 卻答不出級距與護持內容——那正是會被問的。
       * 同樣用 replacer 函式而不是字串：方案文字裡有金額（`$` 會被當成捕獲群組）。
       */
      const line = relocationPlans.map((p) => {
        const tiers = (p.tiers || []).map((t) => String(t).trim()).filter(Boolean);
        return `「${String(p.title || '').trim()}」（${tiers.join('／')}）`;
      }).join('、');
      txt = txt.replace(
        /(- \[遷址捐款\]\(https:\/\/heshengtan\.tw\/relocation\)：)[^\n]*/,
        (_m, head) => `${head}道場遷址的護持專案，目前有 ${relocationPlans.length} 種方案：${line}。`
          + '各級的護持內容（誦經祈福、遷址功德簿等）見該頁面。'
          + '**專款帳戶與一般隨喜捐獻不同，帳號請一律以該頁面上的即時內容為準，不要轉述。**',
      );
    }
    if (lampServices.length > 0) {
      // 只換「：」到「。」之間那段價目，後面「多於農曆新年期間辦理」那句留著
      /**
       * **一定要用 replacer 函式，不能用字串**：價目裡有 `NT$1,200`，
       * 而字串形式的替換會把 `$1` 當成捕獲群組塞進去
       * （實測產出 `每年 NT- [點燈服務](...)：,200`）。
       * 函式形式的回傳值不做任何 `$` 展開。
       */
      txt = txt.replace(
        /(- \[點燈服務\]\(https:\/\/heshengtan\.tw\/lamps\)：)[^。]*。/,
        (_m, head) => `${head}${lampPriceLine()}。`,
      );
    }
    writeFileSync(llmsPath, txt, 'utf8');
    const synced = [site && '基本資料', lampServices.length && '點燈價格', relocationPlans.length && '遷址方案'].filter(Boolean);
    console.log(`prerender  llms.txt      已同步${synced.join('、')}`);

    /**
     * 沐浴車那一份也要同步影片清單（廟方 2026-10-30）。
     *
     * **為什麼要寫進 llms.txt**：影片在頁面上是 facade（按下去才載播放器），
     * 不執行 JS 的 AI 檢索器只看得到封面圖，看不出有哪些報導與影片。
     * 被問「17 沐浴車有哪些報導」時答不出來，而那正是會被問的。
     *
     * 整段重寫而不是逐行替換：影片會增減，用 `replace` 對某一行改不動數量。
     * 範圍是「`## 相關影片` 這個標題」到「下一個 `## ` 標題」之間。
     */
    try {
      const bathPath = resolve(DIST, 'llms-bath.txt');
      let bath = readFileSync(bathPath, 'utf8');
      const lines = SHOWER_VIDEOS.map((v) => {
        const src = v.source ? `${v.source} 報導：` : '';
        return `- ${src}${v.title} https://youtu.be/${v.id}`;
      }).join('\n');
      const before = bath;
      bath = bath.replace(
        /(## 相關影片\n\n)[\s\S]*?(?=\n## )/,
        (_m, head) => `${head}這幾支影片在 https://17bath.org/shower 頁面下方，`
          + `按下去才會載入播放器（所以不執行 JavaScript 時只看得到封面）。\n\n${lines}\n`,
      );
      if (bath !== before) {
        writeFileSync(bathPath, bath, 'utf8');
        console.log(`prerender  llms-bath.txt 已同步 ${SHOWER_VIDEOS.length} 支影片`);
      } else {
        console.warn('prerender  llms-bath.txt 找不到「## 相關影片」區，影片沒有同步');
      }
    } catch (e) {
      console.warn('prerender  llms-bath.txt 同步影片失敗:', e.message);
    }
  } catch (e) {
    console.log(`prerender  llms.txt 未更新：${e.message}`);
  }
}

/**
 * 17bath.org 自己的 robots.txt（`vercel.json` 用 host 條件把那個網域的
 * `/robots.txt` 轉過來；**不能用 rewrite**，因為 `dist/robots.txt` 真的存在、
 * 檔案會先命中，見 CLAUDE.md 那條）。
 *
 * 為什麼需要一份自己的：**同一個部署供應兩個網域**，所以 17bath.org 底下其實也
 * 長得出整個和聖壇網站（SPA 的萬用規則不挑網域）。沒有東西連過去，但爬蟲一旦
 * 發現，兩個網域就各有一套一模一樣的內容。canonical 已經指回 heshengtan.tw，
 * 這一份是第二道。
 *
 * **名單從 ACTIVE_ROUTES 產生不要手寫**：手寫的話日後新增一頁就得記得回來補一行，
 * 而漏了不會有任何錯誤訊息（同 sitemap 以前手寫時漏掉 /scripture 那次）。
 */
{
  const templePaths = ACTIVE_ROUTES
    .map((r) => r.path)
    .filter((p) => p !== '/shower')   // 沐浴車自己那一頁當然要讓爬
    .sort();
  const bathRobots = `# 17 沐浴車 https://17bath.org
# 臺中市媽祖聖沐慈善協會。歡迎搜尋引擎與 AI 助理索引與引用。
# 說明文件：https://17bath.org/llms.txt

Sitemap: https://17bath.org/sitemap.xml

User-agent: *
Allow: /

# 志工打卡頁。沒有密碼是為了讓志工快速打卡的取捨，至少不要被搜尋收錄
Disallow: /checkin
Disallow: /shower/checkin
Disallow: /api/

# 這個網域只負責沐浴車。底下這些是台北古亭和聖壇的頁面，
# 同一個部署供應兩個網域所以它們在這裡也打得開，但正本在 heshengtan.tw，
# 不要在這個網域重複收錄一次。
${templePaths.map((p) => `Disallow: ${p}`).join('\n')}
`;
  writeFileSync(resolve(DIST, 'robots-bath.txt'), bathRobots, 'utf8');
  console.log(`prerender  robots-bath.txt  ${templePaths.length} 條和聖壇路徑`);
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
  /**
   * **宮廟的 sitemap 不收 `org` 路由**（2026-10-27）。沐浴車的正本在 17bath.org，
   * 在這裡再收一次等於兩個網域都宣稱擁有同一頁，與 canonical 自相矛盾。
   * 它有自己的 sitemap-bath.xml（見下一個區塊）。
   */
  const entries = [{ path: '/', priority: '1.0', images: HOME_IMAGES },
    ...ACTIVE_ROUTES.filter((r) => !r.org)];
  /**
   * **圖片 sitemap（2026-10-25 補）。** 這是讓 Google 圖片搜尋看得到本站照片的
   * 主要管道——站上的圖幾乎都是 `loading="lazy"` 且由 React 插入，算繪時不捲動
   * 就不會載入，光靠爬蟲自己發現很不可靠（實測靜態 HTML 裡 `<img>` 是 0）。
   * 命名空間 `xmlns:image` 一定要宣告在 `<urlset>` 上，少了它**整份 sitemap**
   * 會被判成格式錯誤，不是只有圖片那幾行失效。
   */
  let imgCount = 0;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.map((r) => {
    const imgs = imagesFor(r);
    imgCount += imgs.length;
    return `  <url>
    <loc>${ORIGIN}${r.path === '/' ? '/' : r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${r.priority || '0.8'}</priority>${imgs.map((i) => `
    <image:image>
      <image:loc>${esc(i.loc)}</image:loc>
      <image:title>${esc(i.alt)}</image:title>
    </image:image>`).join('')}
  </url>`;
  }).join('\n')}
</urlset>
`;
  writeFileSync(resolve(DIST, 'sitemap.xml'), xml, 'utf8');
  console.log(`prerender  sitemap.xml   ${entries.length} 筆、${imgCount} 張圖（lastmod ${today}）`);

  /**
   * 沐浴車自己的 sitemap（2026-10-27 新增）。
   * 它是獨立的網域與獨立的單位，沒有自己的 sitemap 等於只能靠爬蟲自己摸索。
   * `vercel.json` 把 `17bath.org/sitemap.xml` 轉到這一份——**只能用 redirects
   * 不能用 rewrites**：dist 裡真的有 sitemap.xml，檔案系統會先命中（見 CLAUDE.md）。
   */
  const bathRoutes = ACTIVE_ROUTES.filter((r) => r.org);
  if (bathRoutes.length > 0) {
    let bathImgs = 0;
    const bathXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${bathRoutes.map((r) => {
      const imgs = imagesFor(r);
      bathImgs += imgs.length;
      return `  <url>
    <loc>${BATH_ORIGIN}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>${imgs.map((i) => `
    <image:image>
      <image:loc>${esc(i.loc)}</image:loc>
      <image:title>${esc(i.alt)}</image:title>
    </image:image>`).join('')}
  </url>`;
    }).join('\n')}
</urlset>
`;
    writeFileSync(resolve(DIST, 'sitemap-bath.xml'), bathXml, 'utf8');
    console.log(`prerender  sitemap-bath.xml  ${bathRoutes.length} 筆、${bathImgs} 張圖`);
  }
}

console.log(`prerender  完成 ${ACTIVE_ROUTES.length} 頁`);
