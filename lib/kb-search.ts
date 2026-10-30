/**
 * 不用 AI 的站內搜尋（2026-10-30）。
 *
 * ── 為什麼需要它 ──
 * 廟方選了「先做這個」：Anthropic 與 Google 現在都要先儲值（Gemini 的免費那批模型
 * 已對新使用者關閉，現役的一律回 402 prepayment credits are depleted），
 * 而這支**不用帳號、不用金鑰、不花錢**，今天就能上線。
 *
 * ── 比 AI 版強的一點，不是弱點 ──
 * 它是把官網原文那一段**找出來**給信眾看，不是生成——所以它
 * **不可能編出一組銀行帳號，也不可能講出舊地址**。那兩件事正是這個網站最不能
 * 犯的錯（見 CLAUDE.md：搬家期間答出舊地址是這個網站能犯的最糟的錯）。
 * AI 版要靠一整套提示詞去求它別犯，這一版是結構上就做不到。
 * 代價是它不會整理、不會換句話說。
 *
 * ── 為什麼是 bigram 不是關鍵字 ──
 * 中文沒有空格，照空白切等於整句當一個詞。斷詞要字典、字典要維護，
 * 而**相鄰兩字**已經夠用：「開放時間」拆成 開放／放時／時間，問句「幾點開放」
 * 拆成 幾點／點開／開放，靠「開放」這一組就對得上。
 * 再乘上 IDF（越少段落出現的組越值錢），「的」「是」那種到處都有的組自然被壓下去。
 */

/** 一段可以被找出來、而且說得出它從哪一頁來的文字 */
export interface Chunk {
  /** 這一段屬於哪一頁（例如「點燈服務」） */
  page: string;
  /** 那一頁的網址，給信眾點過去看完整內容 */
  url: string;
  text: string;
}

export interface Hit extends Chunk {
  score: number;
}

/** 標點與空白不帶資訊，算 bigram 之前先拿掉，否則「。開」這種組會混進去 */
const STRIP = /[\s，。、；：！？「」『』（）()《》〈〉．·\-—…"'’”“\[\]{}|/\\#*＞>]+/g;

const bigrams = (s: string): string[] => {
  const t = s.replace(STRIP, '');
  const out: string[] = [];
  for (let i = 0; i + 1 < t.length; i += 1) out.push(t.slice(i, i + 2));
  return out;
};

/**
 * 問法 → 官網用語。**這張表是這支搜尋品質的主要來源。**
 *
 * 長輩問的是「幾點開門」，而官網寫的是「開放時間」；問「多少錢」而頁面上是
 * 「NT$」與「費用」。沒有這一層，字面上對不起來的問題就會整個找不到，
 * 而那正是最常被問的那幾題。
 *
 * **只做同義擴充，不做改寫**：把對應的官網詞「加」進查詢，原本的字一個都不拿掉。
 * 猜錯了最多是多比對幾個沒命中的組，不會把原本問得到的問題弄不見。
 */
const ALIASES: [RegExp, string][] = [
  [/幾點|開門|關門|營業|開放|休息/, '開放時間 每日'],
  [/多少錢|價格|費用|收費|價目|怎麼算|要錢/, '費用 NT$ 每年'],
  [/在哪|地址|怎麼去|怎麼走|位置|交通|停車/, '地址 臺北市 中正區'],
  [/電話|聯絡|怎麼找|客服/, '電話 聯絡'],
  [/問事|辦事|請示|收驚|改運/, '預約問事 辦事日'],
  [/點燈|光明燈|太歲|安太歲|財利燈|本命/, '點燈服務 太歲祈安燈 光明'],
  [/法會|普渡|超渡|拔渡|消災/, '祈福法會 法會'],
  [/捐|護持|添油|香油|功德金|樂捐/, '捐獻 護持 遷址'],
  [/經文|誦經|念經|唸經|媽祖經|聖母經|幾段/, '天上聖母經 經文'],
  [/神明|神尊|拜什麼|主祀|供奉|金身/, '祀奉神尊 天上聖母'],
  [/生日|聖誕|農曆|節慶|日期/, '歲時節慶 聖誕 農曆'],
  [/會員|註冊|登入|加入/, '會員 登入'],
  [/沐浴車|洗澡車|17bath/, '17 沐浴車'],
  [/遷址|搬家|新壇|蓋廟/, '遷址 護持'],
];

/**
 * **使用者自己打的字，要比我們替他猜的字有份量。**
 *
 * 第一版把別名直接串在查詢後面、一視同仁，結果「沐浴車在哪裡」被自己的別名害了：
 * 「在哪裡」觸發「地址 臺北市 中正區」，廟的地址那一段於是壓過「沐浴車」，
 * 答出了**一個不是我們辦的服務的錯地址**。
 *
 * 所以分成兩袋、給不同的權重。別名只是補救「問法與官網用語對不上」，
 * 它不該有能力蓋掉人家真正打出來的那個詞。
 */
const ORIGINAL_W = 2.5;
const ALIAS_W = 1;

const expand = (q: string): { gram: string; w: number }[] => {
  const bag = new Map<string, number>();
  for (const g of bigrams(q)) bag.set(g, Math.max(bag.get(g) ?? 0, ORIGINAL_W));
  for (const [re, add] of ALIASES) {
    if (!re.test(q)) continue;
    for (const g of bigrams(add)) if (!bag.has(g)) bag.set(g, ALIAS_W);
  }
  return [...bag].map(([gram, w]) => ({ gram, w }));
};

/**
 * 把知識庫切成段落。
 *
 * 邊界用知識庫自己的結構：`===== 頁名（網址）=====` 是換頁，空行是換段。
 * **太短的段落往後黏**——「- 電話：02-…」自己一段的話，找出來的東西沒有上下文，
 * 信眾看不出那是什麼的電話。黏到 `MIN` 以上才算一段。
 */
const MIN = 60;
const MAX = 420;

export const buildIndex = (kb: string): Chunk[] => {
  const chunks: Chunk[] = [];
  let page = '台北古亭和聖壇';
  let url = 'https://heshengtan.tw/';
  let buf: string[] = [];

  const flush = () => {
    const text = buf.join('\n').trim();
    buf = [];
    if (text.length >= 12) chunks.push({ page, url, text });
  };

  for (const rawLine of kb.split('\n')) {
    const line = rawLine.trimEnd();
    const head = line.match(/^=====\s*(.+?)（(https?:\/\/[^）]+)）\s*=====$/);
    if (head) {
      flush();
      page = head[1].trim();
      url = head[2].trim();
      continue;
    }
    if (!line.trim()) { if (buf.join('').length >= MIN) flush(); continue; }
    buf.push(line.trim());
    if (buf.join('\n').length >= MAX) flush();
  }
  flush();
  return chunks;
};

/** 每一組 bigram 出現在幾個段落裡——越少見越值錢 */
const idfOf = (chunks: Chunk[]): Map<string, number> => {
  const df = new Map<string, number>();
  for (const c of chunks) {
    for (const g of new Set(bigrams(c.text))) df.set(g, (df.get(g) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  const n = chunks.length || 1;
  df.forEach((d, g) => idf.set(g, Math.log(1 + n / (1 + d))));
  return idf;
};

export interface Index { chunks: Chunk[]; idf: Map<string, number> }

export const indexKb = (kb: string): Index => {
  const chunks = buildIndex(kb);
  return { chunks, idf: idfOf(chunks) };
};

/**
 * 找出最相關的幾段。
 *
 * **長度要正規化**：不除以長度的話，最長的那幾段（經文的註解動輒三百字）
 * 會因為「字多所以碰巧命中多」而永遠排第一。除以 sqrt(長度) 是常見的折衷——
 * 完全除以長度又會讓一句話的短段落佔盡便宜。
 */
export const search = (index: Index, query: string, top = 3): Hit[] => {
  const grams = expand(query);
  if (grams.length === 0) return [];

  /**
   * **試過「把最罕見的詞當成過濾條件」，結果整體變差，已經退掉。**
   * 想法是「問句裡最罕見的詞，答案裡一定要有」，用來修「沐浴車在哪裡」被
   * 「和聖壇在哪裡」贏走那一題。但最罕見的那個詞常常是無關緊要的那個：
   * 「匯款帳號是多少」的最罕見組變成「帳號」，於是濾到只剩講**會員帳號**的段落；
   * 「媽祖生日是哪一天」被濾到只剩講匯款的段落。修一題、壞四題。
   * 沐浴車那題改用下面的 HARD_RULES 處理——那本來就是一條業務規則，不是檢索問題。
   */
  const hits: Hit[] = [];
  for (const c of index.chunks) {
    const have = new Set(bigrams(c.text));
    let s = 0;
    for (const { gram, w } of grams) if (have.has(gram)) s += (index.idf.get(gram) ?? 0) * w;
    if (s > 0) hits.push({ ...c, score: s / Math.sqrt(c.text.length) });
  }
  hits.sort((a, b) => b.score - a.score);

  // 同一頁最多給兩段：三段都來自經文的話，信眾等於只拿到一頁的內容
  const perPage = new Map<string, number>();
  const picked: Hit[] = [];
  for (const h of hits) {
    const n = perPage.get(h.page) ?? 0;
    if (n >= 2) continue;
    perPage.set(h.page, n + 1);
    picked.push(h);
    if (picked.length >= top) break;
  }
  return picked;
};

/**
 * 分數太低就當作沒找到。
 *
 * **寧可說「我找不到」也不要塞一段不相干的文字給信眾**——後者看起來像在答非所問，
 * 而且會讓他以為官網真的只有這些。門檻是拿實際的問題試出來的（見 commit）。
 */
export const WEAK = 1.5;

/**
 * **有些事不能交給檢索去賭。**
 *
 * 沐浴車不是和聖壇辦的（2026-10-27 才把兩邊的 canonical、sitemap 與 llms.txt
 * 切乾淨）。而「沐浴車在哪裡」與「和聖壇在哪裡」只差「沐浴」「浴車」兩組 bigram，
 * 其餘全部重疊——實測檢索穩定地回廟自己的地址，**等於對一個不是我們的服務
 * 報了我們的地址**。那不是排序調一調的問題，那是一條業務規則。
 *
 * 這張表刻意只收「答錯的代價特別大、而且答案是固定的」那幾種。
 * 要控制它的大小：每多一條就多一個會過期的寫死答案。
 */
const HARD_RULES: [RegExp, string][] = [
  [/沐浴車|洗澡車|17\s?bath|沐浴/,
    '「17 沐浴車」不是台北古亭和聖壇的服務，是另一個單位在媽祖進香期間提供的免費盥洗服務。\n'
    + '車子的位置、時間與其他問題，請到他們自己的網站查詢：\nhttps://17bath.org'],
];

/** 命中就直接回答，不進檢索。沒命中回空字串。 */
export const hardAnswer = (q: string): string =>
  HARD_RULES.find(([re]) => re.test(q))?.[1] ?? '';

/** 把搜尋結果組成要顯示的文字。找不到就回空字串，由呼叫端決定怎麼講。 */
export const formatHits = (hits: Hit[]): string => {
  const good = hits.filter((h) => h.score >= WEAK);
  if (good.length === 0) return '';
  return good
    .map((h) => `【${h.page}】\n${h.text}\n${h.url}`)
    .join('\n\n');
};
