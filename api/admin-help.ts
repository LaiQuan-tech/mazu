// 後台的操作小幫手（2026-11-18 廟方：「我想在後台，做一個聊天機器人，來協助後台人員操作，資料內容都以後台為主」）。
//
// ── 只教操作，不碰信眾資料（廟方同日選的） ──
// 這支**一筆資料庫的報名紀錄都不讀**，送給 Gemini 的只有：操作手冊（lib/admin-manual.ts）、
// 這個人的角色看得到哪些頁、以及他打的問題。所以沿用前台客服那把 `GEMINI_API_KEY` 就好——
// 免費方案的條款允許 Google 用送進去的內容改進模型，**這正是不能讓它讀名冊的理由**。
// 前端的輸入框也提醒工作人員不要把信眾姓名電話打進來。
//
// ── 要管理員身分 ──
// 手冊本身不是秘密，但這支吃的是廟方的 AI 額度，公開的話誰都能拿來用。
// 授權照 api/republish.ts：拿登入者的 Supabase token 去讀 admin_profiles，RLS 只讓人讀自己那一列，
// 非管理員必然拿到空陣列 → 403。順便讀出 role，告訴模型這個人看得到哪幾頁。
//
// ── 兩層 ──
// ① AI（有金鑰、叫得動）  ② 手冊搜尋（沒金鑰、額度用完、Google 掛了都落在這裡，同 api/chat.ts）
//
// **相對 import 要帶 `.js`、共用模組放 lib/**（見 CLAUDE.md，兩件事都會害線上 500）。
import { ADMIN_MANUAL, ROLE_PAGES, searchManual } from '../lib/admin-manual.js';

interface ResLike { status: (code: number) => ResLike; json: (body: unknown) => void }
interface ReqLike { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }

const header = (req: ReqLike, name: string): string => {
  const v = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

const MAX_CHARS = 500;
const MAX_TURNS = 12;
const MAX_TOKENS = 900;
const MODEL = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();

const RULES = `你是台北古亭和聖壇「網站後台」的操作小幫手，對象是廟裡的工作人員（不是信眾）。
依照下面「後台操作手冊」回答「怎麼在後台做某件事」。

格式
- 一律繁體中文、台灣用語。不要使用 emoji。
- **越短越好：一兩句、最多三個步驟**，例如「到『點燈管理』→ 那一盞燈的『報名名單』→ 按『標記已收款』」。
  畫面會自動在你的回答下面放「前往 XX」按鈕，所以**一定要寫出頁面名稱**，其餘細節不必講（2026-11-18 廟方：「簡單說明後，直接顯示按鈕，導去該頁即可」）。
  頁面名稱與按鈕名稱用「」框起來，**而且要跟手冊寫的一字不差**——工作人員會照著字去找按鈕。
- 不要說「根據手冊」。

必須遵守
- **只根據手冊回答。手冊沒寫的，就說「這個我不確定」**，請對方問管理員或開發人員，不要猜按鈕名稱。
- 這個人的身分看不到的頁面，要直接講「這一頁要管理員帳號才看得到」，不要叫他去找。
- 你**看不到任何報名資料**，也不能幫忙改資料。被問到「某某人報了什麼」「這個月幾筆」，
  就說你只負責教操作，請他到對應的頁面用搜尋或篩選鈕查，並告訴他是哪一頁、怎麼查。
- 不要要求對方提供信眾的姓名、電話、生日。對方自己打了也不要複述。`;

interface Turn { role: 'user' | 'assistant'; content: string }

const askModel = async (key: string, system: string, turns: Turn[]): Promise<{ reply?: string; error?: string }> => {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: turns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] })),
        generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.2 },
      }),
    },
  );
  if (!r.ok) {
    console.error('admin-help gemini failed:', r.status, (await r.text()).slice(0, 300));
    return { error: r.status === 429 ? 'quota' : 'fail' };
  }
  const data = await r.json() as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: Record<string, number>;
  };
  if (data.usageMetadata) console.log('admin-help usage:', JSON.stringify(data.usageMetadata));
  const reply = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  return reply ? { reply } : { error: 'empty' };
};

export default async function handler(req: ReqLike, res: ResLike): Promise<void> {
  if ((req.method || 'GET').toUpperCase() !== 'POST') { res.status(405).json({ ok: false, error: '只接受 POST' }); return; }

  // Vercel 上的 VITE_SUPABASE_URL 結尾帶了換行（見 CLAUDE.md），一定要 trim
  const supabaseUrl = (process.env.VITE_SUPABASE_URL ?? '').trim();
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  if (!supabaseUrl || !anonKey) { res.status(500).json({ ok: false, error: '伺服器未設定 Supabase 環境變數' }); return; }

  const auth = header(req, 'authorization');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) { res.status(401).json({ ok: false, error: '未登入' }); return; }

  let role = 'admin';
  try {
    const check = await fetch(`${supabaseUrl}/rest/v1/admin_profiles?select=role&limit=1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!check.ok) { res.status(401).json({ ok: false, error: '登入狀態已失效，請重新登入' }); return; }
    const rows = await check.json() as { role?: string }[];
    if (!Array.isArray(rows) || rows.length === 0) { res.status(403).json({ ok: false, error: '只有後台人員可以使用' }); return; }
    role = rows[0]?.role || 'admin';
  } catch {
    res.status(502).json({ ok: false, error: '無法確認身分，請稍後再試' }); return;
  }

  const body = (req.body ?? {}) as { messages?: unknown };
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages: Turn[] = raw
    .filter((m): m is Turn => !!m && typeof m === 'object'
      && ((m as Turn).role === 'user' || (m as Turn).role === 'assistant')
      && typeof (m as Turn).content === 'string')
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    res.status(400).json({ ok: false, error: '沒有收到問題' }); return;
  }
  const question = messages[messages.length - 1].content;

  const pages = ROLE_PAGES[role] ?? ROLE_PAGES.admin;
  const system = `${RULES}\n\n這個人的身分：${role}，看得到的頁面：${pages.join('、')}。\n\n以下是後台操作手冊。\n\n${ADMIN_MANUAL}`;

  const key = process.env.GEMINI_API_KEY;
  if (key) {
    try {
      const { reply } = await askModel(key, system, messages);
      if (reply) { res.status(200).json({ ok: true, reply, mode: 'ai' }); return; }
    } catch (e) {
      console.error('admin-help failed:', e);
    }
  }
  // AI 叫不動：把手冊裡最相關的段落原文給他，總比「壞了」有用
  const found = searchManual(question);
  res.status(200).json({
    ok: true,
    mode: 'search',
    reply: found || '這個我在操作手冊裡找不到。請換個說法再問，或直接問管理員。',
  });
}
