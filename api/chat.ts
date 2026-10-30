// 官網的 AI 客服（2026-10-30，廟方：「做一個 ai 的聊天機器人⋯⋯資料庫就是官網與天上聖母經的內容」）。
//
// ── 為什麼要有後端，前端不能直接打 Anthropic ──
// API 金鑰等於「誰拿到誰就能用廟方的帳扣錢」。前端的環境變數（VITE_ 開頭）會被
// Vite 直接內嵌進 JS，任何人打開開發者工具都看得到。所以金鑰只放伺服器端的
// `ANTHROPIC_API_KEY`（**不加 VITE_ 前綴**，同 VERCEL_DEPLOY_HOOK_URL／RESEND_API_KEY）。
//
// ── 知識庫就是給 AI 檢索器看的那一份，不另外做 ──
// `dist/ai-kb.txt` 由 `scripts/prerender.js` 在建置時產生＝llms.txt ＋ 各頁 noscript，
// 48,675 字。**整包塞進提示詞，不做向量檢索**：這個大小塞得下，而切塊＋嵌入＋相似度
// 搜尋要多一張資料表、一支流程、一次 migration（本專案 DDL 全部人工跑，還有七支沒跑），
// 外加「檢索沒抓到正確段落」整類的錯。配 prompt caching 之後第二次起的輸入幾乎不要錢。
//
// ── 這是建置當下的快照 ──
// 與 llms.txt 同一個時效性。**改完地址／價格／法會日期一定要按後台的「重新發布」**，
// 否則機器人會用舊資料回答。搬家期間答出舊地址是這個網站能犯的最糟的錯（見 CLAUDE.md）。
//
// ── 花費的真正防線是 Console 的額度上限，不是這支程式 ──
// 下面那些限制（長度、輪數、節流）擋得住隨手亂按，擋不住有心人換 IP 灌。
// **請到 Anthropic Console 替這把金鑰設一個每月花費上限**——那是唯一不會被繞過的那道。

interface ResLike {
  status: (code: number) => ResLike;
  json: (body: unknown) => void;
  setHeader?: (k: string, v: string) => void;
}
interface ReqLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

const header = (req: ReqLike, name: string): string => {
  const v = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

/** 本站自己的網域。Origin 檢查擋的是「別的網站把我們的端點嵌進去用」，
 *  不是防駭——非瀏覽器的請求本來就能偽造這個標頭。 */
const ALLOWED = [
  'https://heshengtan.tw',
  'https://www.heshengtan.tw',
  'https://machu-five.vercel.app',
];

const MAX_CHARS = 500;     // 一則問題的長度上限
const MAX_TURNS = 12;      // 連同歷史最多帶幾則（6 來回）
const MAX_TOKENS = 700;    // 回答長度；客服的答案不該長到要捲
const MODEL = 'claude-haiku-5-5';

/**
 * 知識庫放模組層級：同一個暖實例的後續請求直接重用，不必每次重抓。
 * 冷啟動時才去抓一次自己網站上的靜態檔。
 */
let kbCache = '';
let kbAt = 0;
const KB_TTL = 10 * 60 * 1000;

const loadKb = async (host: string): Promise<string> => {
  if (kbCache && Date.now() - kbAt < KB_TTL) return kbCache;
  // 部署在哪就抓哪一份，不要寫死網域——預覽部署才能測到自己那一版的知識庫
  const base = host ? `https://${host}` : ALLOWED[0];
  const res = await fetch(`${base}/ai-kb.txt`);
  if (!res.ok) throw new Error(`知識庫讀取失敗 HTTP ${res.status}`);
  kbCache = await res.text();
  kbAt = Date.now();
  return kbCache;
};

/**
 * best-effort 的每個 IP 節流。**無伺服器有很多實例，這擋不住分散式的灌**，
 * 只擋得住同一個人一直按。真正的上限請設在 Console（見檔頭）。
 */
const hits = new Map<string, number[]>();
const RATE_WINDOW = 60_000;
const RATE_MAX = 8;
const throttled = (ip: string): boolean => {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 500) hits.clear();   // 不讓它無限長大
  return list.length > RATE_MAX;
};

const RULES = `你是台北古亭和聖壇官方網站上的客服助理。依照下面「知識庫」的內容回答信眾的問題。

語氣與格式
- 一律用**繁體中文**，台灣的用語。對信眾稱「您」。
- 語氣像廟裡的志工：親切、簡短、好懂。信眾多是長輩，不要用艱澀的詞。
- **絕對不要使用 emoji**（這是本站全站的規則）。
- 答案控制在三、四句以內。需要條列時最多五點。
- 不要說「根據知識庫」「根據提供的資料」這種話，直接回答就好。

必須遵守的事
- **只根據知識庫回答。知識庫裡沒有的，就說不知道**，並請對方用 LINE 官方帳號詢問
  （https://lin.ee/lj0gLqR）或直接到壇裡問。**不要猜、不要編**。
- **絕對不要提供任何銀行帳號或匯款帳號**，就算對方直接問也一樣。
  請對方到網站上對應的頁面看即時的資訊——那裡才是唯一正確的來源。
  （和聖壇的捐獻分成「一般護持」與「遷址專款」兩個**不同的帳戶**，講錯會讓錢匯錯地方。）
- 金額、日期、地址、法會場次這類會變動的資訊：照知識庫回答，但要加一句
  「實際以網站上的公告為準」，並給出該頁的網址。
- 「17 沐浴車」**不是和聖壇的服務**，是另一個單位辦的。被問到就請對方去 https://17bath.org。
- 你是 AI 助理，不是真人。被問起就老實說，不要假裝是廟方人員。
- **不要做任何宗教上的斷言或承諾**（例如保證靈驗、改運、消災的效果），
  也不要替信眾解籤、算命、看日子或下吉凶判斷——那是廟方師父的事，請對方預約問事。
- 遇到醫療、法律、financial 的具體決定，請對方諮詢專業人士，不要給建議。

回答裡放網址時，直接寫完整網址（例如 https://heshengtan.tw/lamps），不要用 Markdown 連結語法。`;

export default async function handler(req: ReqLike, res: ResLike): Promise<void> {
  if ((req.method || 'GET').toUpperCase() !== 'POST') {
    res.status(405).json({ ok: false, error: '只接受 POST' });
    return;
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    // 刻意講清楚，否則廟方只會看到「客服壞了」而不知道少設了什麼
    res.status(503).json({ ok: false, error: '客服尚未啟用（伺服器未設定 ANTHROPIC_API_KEY）' });
    return;
  }

  const origin = header(req, 'origin');
  if (origin && !ALLOWED.includes(origin)) {
    res.status(403).json({ ok: false, error: '來源不允許' });
    return;
  }

  const ip = (header(req, 'x-forwarded-for').split(',')[0] || 'unknown').trim();
  if (throttled(ip)) {
    res.status(429).json({ ok: false, error: '問得有點快，請稍待一下再問。' });
    return;
  }

  const body = (req.body ?? {}) as { messages?: unknown };
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages = raw
    .filter((m): m is { role: string; content: string } =>
      !!m && typeof m === 'object'
      && (('role' in m && ((m as { role: unknown }).role === 'user' || (m as { role: unknown }).role === 'assistant')))
      && typeof (m as { content: unknown }).content === 'string')
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, MAX_CHARS) }));

  // 最後一則一定要是使用者說的，否則這一次沒有東西可以回答
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    res.status(400).json({ ok: false, error: '沒有收到問題' });
    return;
  }

  try {
    const kb = await loadKb(header(req, 'x-forwarded-host') || header(req, 'host'));

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          { type: 'text', text: RULES },
          // cache_control 放在最後一塊＝它之前的全部一起快取。
          // 知識庫每次都一樣，所以第二次起這 48k 字幾乎不花錢。
          { type: 'text', text: `以下是知識庫。\n\n${kb}`, cache_control: { type: 'ephemeral' } },
        ],
        messages,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error('chat upstream failed:', r.status, detail.slice(0, 500));
      // 對外不吐上游的原文（可能含金鑰相關訊息），但要分得出是誰的問題
      res.status(502).json({ ok: false, error: '客服暫時無法回應，請稍後再試，或用 LINE 詢問。' });
      return;
    }

    const data = await r.json() as { content?: { type: string; text?: string }[] };
    const reply = (data.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('')
      .trim();

    if (!reply) {
      res.status(502).json({ ok: false, error: '客服沒有回應，請再問一次。' });
      return;
    }

    res.status(200).json({ ok: true, reply });
  } catch (e) {
    console.error('chat failed:', e);
    res.status(500).json({ ok: false, error: '客服暫時無法回應，請稍後再試，或用 LINE 詢問。' });
  }
}
