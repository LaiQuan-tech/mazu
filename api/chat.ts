// 官網的 AI 客服（2026-10-30，廟方：「做一個 ai 的聊天機器人⋯⋯資料庫就是官網與天上聖母經的內容」）。
//
// ── 用 Google Gemini，因為它有免費額度 ──
// 廟方 2026-10-30 在四個方案裡選了這一條（「B 好了」）：要「會整理、會換句話說」
// 的回答，但不想先儲值。Anthropic 那一版寫過也驗過，**在 git 歷史裡**（commit c4e3816），
// 要換回去的話只有 `askModel()` 這一支要動。
//
// ── 為什麼要有後端，前端不能直接打 ──
// API 金鑰等於「誰拿到誰就能用廟方的額度」。前端的環境變數（VITE_ 開頭）會被 Vite
// 直接內嵌進 JS，任何人打開開發者工具都看得到。所以金鑰只放伺服器端的
// `GEMINI_API_KEY`（**不加 VITE_ 前綴**，同 VERCEL_DEPLOY_HOOK_URL／RESEND_API_KEY）。
//
// ── 用的是 generateContent 不是新的 Interactions API ──
// 後者的多輪對話靠 `previous_interaction_id`（狀態存在 Google 那邊），而這支是
// 無伺服器函式、對話歷史由前端帶上來，**無狀態才對得起來**；而且它的
// `system_instruction` 不是頂層欄位，要包進 `agent_config` 裡，多一層會錯的地方。
// `models.generateContent` 仍然是有文件的正式端點，欄位是 `systemInstruction` ＋
// `contents`，前一輪的回答角色叫 **`model`** 不是 `assistant`。
//
// ── 知識庫就是給 AI 檢索器看的那一份，不另外做 ──
// `dist/ai-kb.txt` 由 `scripts/prerender.js` 在建置時產生＝llms.txt ＋ 各頁 noscript，
// 48,675 字。**整包塞進 systemInstruction，不做向量檢索**：這個大小塞得下，而
// 切塊＋嵌入＋相似度搜尋要多一張資料表、一支流程、一次 migration（本專案 DDL
// 全部人工跑，還有七支沒跑），外加「檢索沒抓到正確段落」整類的錯。
//
// **這是建置當下的快照**，與 llms.txt 同一個時效性。改完地址／價格／法會日期
// 一定要按後台的「重新發布」，否則機器人會用舊資料回答。搬家期間答出舊地址
// 是這個網站能犯的最糟的錯（見 CLAUDE.md）。
//
// ── 額度 ──
// 免費額度的實際數字 Google 沒有寫在文件上（要去 AI Studio 看自己專案的），
// 而這支每一次問答都會把那 48k 字當輸入送出去。**所以回應裡的 usageMetadata
// 會記進 log**：真的撞到上限時，手上要有實際的數字才知道該砍哪裡
// （最大的一塊是經文，佔 36,473 字、74%，可以改成只有問到經文才帶）。

interface ResLike {
  status: (code: number) => ResLike;
  json: (body: unknown) => void;
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

/**
 * 預設用 Flash-Lite：這個任務是「照著手上的文字回答」，不需要很強的推理，
 * 而免費額度是按用量算的，輕一點的模型撐得比較久。
 * 覺得答得不夠好就在 Vercel 設 `GEMINI_MODEL=gemini-3.8-flash`，不必改程式。
 */
const MODEL = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();

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
 * 只擋得住同一個人一直按。免費額度本身就是最後一道牆（撞到就停，不會變成帳單）。
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
- 遇到醫療、法律、金錢的具體決定，請對方諮詢專業人士，不要給建議。

回答裡放網址時，直接寫完整網址（例如 https://heshengtan.tw/lamps），不要用 Markdown 連結語法。`;

interface Turn { role: 'user' | 'assistant'; content: string }

/**
 * 真正去問模型的那一支。**換供應商只要改這裡。**
 * 回傳 `{ reply }` 或 `{ error }`——呼叫端不必知道是哪一家、回應長什麼樣。
 */
const askModel = async (key: string, system: string, turns: Turn[]): Promise<{ reply?: string; error?: string }> => {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        // 前一輪的回答在 Gemini 叫 `model`，不是 `assistant`——照抄會整段被忽略
        contents: turns.map((t) => ({
          role: t.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: t.content }],
        })),
        generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.3 },
      }),
    },
  );

  if (!r.ok) {
    const detail = await r.text();
    console.error('gemini failed:', r.status, detail.slice(0, 500));
    // 429 ＝ 免費額度用完或太頻繁。**要跟一般的故障分開講**，
    // 否則廟方只會看到「壞了」而不知道是額度的問題。
    if (r.status === 429) return { error: '今天的詢問次數已達上限，請用 LINE 詢問，或明天再試。' };
    return { error: '客服暫時無法回應，請稍後再試，或用 LINE 詢問。' };
  }

  const data = await r.json() as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    usageMetadata?: Record<string, number>;
  };

  // 額度要留下數字：真的撞到上限時才知道一次問答吃掉多少（見檔頭）
  if (data.usageMetadata) console.log('gemini usage:', JSON.stringify(data.usageMetadata));

  // 整個提示被安全機制擋下來（沒有 candidates，只有 promptFeedback）
  if (data.promptFeedback?.blockReason) {
    console.error('gemini blocked prompt:', data.promptFeedback.blockReason);
    return { error: '這個問題我沒辦法回答，請改個問法，或用 LINE 詢問。' };
  }

  const cand = data.candidates?.[0];
  const reply = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();

  if (!reply) {
    // `MAX_TOKENS` 砍斷與安全機制擋下都會落在這裡，分開講才有用
    console.error('gemini empty reply, finishReason =', cand?.finishReason);
    if (cand?.finishReason === 'MAX_TOKENS') return { error: '這個問題的答案太長了，請分開問。' };
    return { error: '客服沒有回應，請再問一次，或用 LINE 詢問。' };
  }
  return { reply };
};

export default async function handler(req: ReqLike, res: ResLike): Promise<void> {
  const method = (req.method || 'GET').toUpperCase();

  /**
   * `GET /api/chat?diag=1` —— 診斷用（照 `notify-registration?domains=1` 的作法）。
   *
   * **為什麼需要這一支**：客服壞掉時前端只看得到「暫時無法回應」，而真正的原因
   * （金鑰無效／API 沒啟用／模型名稱不存在／額度用完）全在 Vercel 的函式 log 裡，
   * 廟方不會去翻，而且本機沒有 Vercel CLI 的時候連我也看不到。
   * 沒有這支就只能在那四種原因之間猜，而它們的症狀一模一樣。
   *
   * **只回模型名稱與 Google 給的狀態碼／訊息，不回傳任何金鑰相關的東西。**
   * Google 對無效金鑰的回覆是「API key not valid」這種描述，不含秘密；
   * 但還是截斷到 300 字，免得日後他們改成更囉嗦的內容而夾帶了不該出現的字。
   */
  if (method === 'GET' && String((req as { query?: Record<string, unknown> }).query?.diag ?? '') === '1') {
    const k = process.env.GEMINI_API_KEY;
    if (!k) { res.status(200).json({ ok: false, 金鑰: '沒有設定 GEMINI_API_KEY' }); return; }
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: { 'x-goog-api-key': k },
      });
      const txt = await r.text();
      if (!r.ok) {
        res.status(200).json({ ok: false, 金鑰長度: k.length, Google回應碼: r.status, Google說: txt.slice(0, 300) });
        return;
      }
      const list = JSON.parse(txt) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
      const usable = (list.models ?? [])
        .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m) => (m.name ?? '').replace(/^models\//, ''));
      res.status(200).json({
        ok: true,
        金鑰長度: k.length,
        目前設定的模型: MODEL,
        這把金鑰用得到它嗎: usable.includes(MODEL),
        可用的模型數: usable.length,
        可用的_flash: usable.filter((n) => n.includes('flash')).slice(0, 20),
      });
    } catch (e) {
      res.status(200).json({ ok: false, 例外: String(e).slice(0, 200) });
    }
    return;
  }

  /**
   * `GET /api/chat?diag=2` —— 真的打一次最小的 generateContent，**把 Google 的原文回來**。
   * `diag=1` 只證明「金鑰能列模型」，證明不了「這個請求的格式它收不收」，
   * 而兩者的症狀在前端一模一樣（都是「暫時無法回應」）。
   * 可以帶 `&kb=1` 連真正的知識庫一起送，用來分辨「格式錯」與「太長／被擋」。
   */
  if (method === 'GET' && String((req as { query?: Record<string, unknown> }).query?.diag ?? '') === '2') {
    const k = process.env.GEMINI_API_KEY;
    if (!k) { res.status(200).json({ ok: false, 金鑰: '沒有設定' }); return; }
    const withKb = String((req as { query?: Record<string, unknown> }).query?.kb ?? '') === '1';
    try {
      const sys = withKb
        ? `${RULES}\n\n以下是知識庫。\n\n${await loadKb(header(req, 'x-forwarded-host') || header(req, 'host'))}`
        : '你是測試用的助理，請只回答「好」。';
      const body = {
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: 'user', parts: [{ text: '開放時間？' }] }],
        generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.3 },
      };
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
        { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': k }, body: JSON.stringify(body) },
      );
      const txt = await r.text();
      res.status(200).json({
        模型: MODEL,
        有帶知識庫: withKb,
        system字數: sys.length,
        回應碼: r.status,
        Google原文: txt.slice(0, 900),
      });
    } catch (e) {
      res.status(200).json({ ok: false, 例外: String(e).slice(0, 300) });
    }
    return;
  }

  if (method !== 'POST') {
    res.status(405).json({ ok: false, error: '只接受 POST' });
    return;
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    // 刻意講清楚，否則廟方只會看到「客服壞了」而不知道少設了什麼
    res.status(503).json({ ok: false, error: '客服尚未啟用（伺服器未設定 GEMINI_API_KEY）' });
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
  const messages: Turn[] = raw
    .filter((m): m is Turn =>
      !!m && typeof m === 'object'
      && (('role' in m && ((m as { role: unknown }).role === 'user' || (m as { role: unknown }).role === 'assistant')))
      && typeof (m as { content: unknown }).content === 'string')
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

  // 最後一則一定要是使用者說的，否則這一次沒有東西可以回答
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    res.status(400).json({ ok: false, error: '沒有收到問題' });
    return;
  }

  try {
    const kb = await loadKb(header(req, 'x-forwarded-host') || header(req, 'host'));
    const { reply, error } = await askModel(key, `${RULES}\n\n以下是知識庫。\n\n${kb}`, messages);
    if (error || !reply) {
      res.status(502).json({ ok: false, error: error || '客服沒有回應，請再問一次。' });
      return;
    }
    res.status(200).json({ ok: true, reply });
  } catch (e) {
    console.error('chat failed:', e);
    res.status(500).json({ ok: false, error: '客服暫時無法回應，請稍後再試，或用 LINE 詢問。' });
  }
}
