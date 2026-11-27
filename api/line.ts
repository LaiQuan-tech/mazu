// LINE：報名後加好友、對上是誰（2026-11-27 廟方：「報名後常常沒辦法聯絡信眾，報名完就請他加
// 和聖壇 LINE 好友，並讓我們知道他在 LINE 的名稱」）。資料表見 supabase/migrations/line_links.sql。
//
// 一支檔案兩種用途（Vercel Hobby 方案一次部署最多 12 支函式，api/ 已經 11 支）：
//
// 1. 前台要確認碼：POST {action:'code', table, ids}
//    報名剛送出（一小時內）的那幾筆 → 發一組 6 碼確認碼，回 { code, basicId }。
//    完成頁用它組出 https://line.me/R/oaMessage/<basicId>/?報名確認%20<code>，
//    信眾一按就打開 LINE、對話框裡已經帶好那句話。
//    **只給剛送出的**：不然拿到別人的報名 id 就能替那幾筆發碼、把通知收走。
//
// 2. LINE webhook：POST（有 x-line-signature）
//    LINE Developers 的 Webhook URL 設成 https://heshengtan.tw/api/line 。
//    **一定要驗簽章**（Channel secret 做 HMAC-SHA256）：不驗的話誰都能假冒 LINE 送
//    「某某 userId 傳了確認碼」過來，把任意一筆報名綁到自己的 LINE。
//    收到「報名確認 XXXXXX」：
//      - 先向 LINE 拿他的顯示名稱。拿不到＝還沒加好友（LINE 只給好友的資料），回一句請他先加好友；
//        不加好友的話之後也推不到，綁了沒有用。
//      - 綁到那幾筆（line_links），回一句「收到了」（回覆訊息不計入每月則數）。
//    **其他訊息一律不回**：官方帳號的聊天要留給廟方的人回，機器人插嘴只會擾亂。
//
// 環境變數（都不加 VITE_ 前綴）：
//   LINE_CHANNEL_SECRET        Messaging API channel 的 Channel secret（驗簽章用）
//   LINE_CHANNEL_ACCESS_TOKEN  既有的推播權杖（拿名稱、回覆、查 basicId）
//   SUPABASE_SERVICE_ROLE_KEY、VITE_SUPABASE_URL  既有

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { clean, readEnv, svcHeaders, uuids, type Row } from '../lib/notify-deliver.js';

interface ResLike { status: (code: number) => ResLike; json: (body: unknown) => void }
interface ReqLike extends AsyncIterable<Buffer | string> {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

const TABLES = new Set(['bookings', 'lamp_registrations', 'blessing_registrations', 'donations', 'fahui_registrations']);
/** 確認碼字母：去掉 0/O、1/I/L 這些長輩容易看錯的 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_RE = /報名確認\s*([A-Za-z0-9]{6})/;
/** 只替「剛送出」的報名發碼 */
const FRESH_MS = 60 * 60_000;

const header = (req: ReqLike, name: string): string => {
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] ?? '' : v ?? '';
};

/**
 * 原始內容。簽章是對「LINE 送來的原始位元組」算的，解析成物件再轉回字串就對不上了。
 * Vercel 的 req.body 是讀到才解析的，所以只要沒碰過它，串流還在。
 */
const rawBody = async (req: ReqLike): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  return Buffer.concat(chunks).toString('utf8');
};

let basicIdCache = '';
const basicId = async (token: string): Promise<string> => {
  if (basicIdCache) return basicIdCache;
  const r = await fetch('https://api.line.me/v2/bot/info', { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return '';
  basicIdCache = clean(((await r.json()) as { basicId?: string }).basicId);
  return basicIdCache;
};

export default async function handler(req: ReqLike, res: ResLike): Promise<void> {
  const env = readEnv();
  const base = env.supabaseUrl.trim();
  const svc = svcHeaders(env);

  if ((req.method || 'GET').toUpperCase() === 'GET') {
    // 自我檢查：只回「設了沒」
    res.status(200).json({
      ok: true,
      設定狀態: {
        LINE_CHANNEL_SECRET: !!process.env.LINE_CHANNEL_SECRET,
        // Channel secret 是 32 個 0-9a-f。不是這個樣子＝貼錯（貼成 LINE Login 那個 channel、
        // 貼成很長的 access token），LINE 後台按 Verify 就會 401。只回對錯，不回內容
        LINE_CHANNEL_SECRET格式正確: /^[0-9a-f]{32}$/.test((process.env.LINE_CHANNEL_SECRET ?? '').trim()),
        LINE_CHANNEL_SECRET前後有空白或換行: (process.env.LINE_CHANNEL_SECRET ?? '') !== (process.env.LINE_CHANNEL_SECRET ?? '').trim(),
        LINE_CHANNEL_ACCESS_TOKEN: !!env.lineToken,
        SUPABASE_SERVICE_ROLE_KEY: !!env.serviceKey,
      },
      說明: 'LINE webhook（報名確認碼綁定 LINE）與前台取確認碼',
    });
    return;
  }
  if ((req.method || '').toUpperCase() !== 'POST') { res.status(405).json({ ok: false }); return; }

  const raw = await rawBody(req).catch(() => '');
  const signature = header(req, 'x-line-signature');

  // ── LINE webhook ──
  if (signature) {
    // trim：從網頁複製常常多帶一個換行，簽章就整個對不上（2026-11-27 Verify 回 401）
    const secret = (process.env.LINE_CHANNEL_SECRET ?? '').trim();
    if (!secret) { res.status(500).json({ ok: false, error: '沒有設定 LINE_CHANNEL_SECRET' }); return; }
    const expect = createHmac('sha256', secret).update(raw).digest();
    const got = Buffer.from(signature, 'base64');
    if (got.length !== expect.length || !timingSafeEqual(got, expect)) {
      res.status(401).json({ ok: false, error: '簽章不符' });
      return;
    }
    let events: Row[] = [];
    try { events = (JSON.parse(raw) as { events?: Row[] }).events ?? []; } catch { /* 空的也回 200 */ }
    // LINE 後台的「驗證」按鈕送的是空的 events，回 200 就算成功
    for (const ev of events) {
      try { await onEvent(env, base, svc, ev); }
      catch (e) { console.error('line webhook event failed', e); }
    }
    res.status(200).json({ ok: true });
    return;
  }

  // ── 前台取確認碼 ──
  let body: { action?: string; table?: string; ids?: unknown } = {};
  try { body = JSON.parse(raw || '{}'); } catch { /* 下面會回 400 */ }
  const table = clean(body.table);
  const ids = uuids(Array.isArray(body.ids) ? body.ids.map(String) : []).slice(0, 50);
  if (body.action !== 'code' || !TABLES.has(table) || ids.length === 0) {
    res.status(400).json({ ok: false, error: '參數不正確' });
    return;
  }
  if (!env.serviceKey || !env.lineToken) { res.status(200).json({ ok: false, skipped: 'line-off' }); return; }
  try {
    // 法會報名 2026-11-24 起在 blessing_registrations；舊表還在時也找得到
    const physical = table === 'fahui_registrations' ? 'blessing_registrations' : table;
    const look = async (t: string) => {
      const r = await fetch(`${base}/rest/v1/${t}?id=in.(${ids.join(',')})&select=id,created_at`, { headers: svc });
      return r.ok ? (await r.json()) as Row[] : [];
    };
    let rows = await look(physical);
    let srcTable = physical;
    if (rows.length === 0 && table === 'fahui_registrations') { rows = await look(table); srcTable = table; }
    const fresh = rows.filter(x => Date.now() - new Date(x.created_at).getTime() < FRESH_MS);
    if (fresh.length === 0) { res.status(404).json({ ok: false, error: '查無剛送出的報名' }); return; }

    const oa = await basicId(env.lineToken);
    if (!oa) { res.status(200).json({ ok: false, skipped: 'no-basic-id' }); return; }

    for (let attempt = 0; attempt < 3; attempt++) {
      const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
      const ins = await fetch(`${base}/rest/v1/line_link_codes`, {
        method: 'POST',
        headers: { ...svc, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ code, source_table: srcTable, source_ids: fresh.map(x => String(x.id)) }),
      });
      if (ins.ok) { res.status(200).json({ ok: true, code, basicId: oa }); return; }
      if (ins.status !== 409) {
        const why = (await ins.text()).slice(0, 200);
        console.error('line code insert failed', ins.status, why);
        res.status(200).json({ ok: false, skipped: /line_link_codes/.test(why) ? 'sql-missing' : 'db-error' });
        return;
      }
      // 409＝撞號，換一組再試
    }
    res.status(200).json({ ok: false, skipped: 'code-collision' });
  } catch (e) {
    console.error('line code error', e);
    res.status(200).json({ ok: false, skipped: 'error' });
  }
}

const reply = async (token: string, replyToken: string, text: string) => {
  if (!replyToken) return;
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  }).catch(() => { /* 回不了就算了，綁定本身已經完成 */ });
};

async function onEvent(env: ReturnType<typeof readEnv>, base: string, svc: Record<string, string>, ev: Row): Promise<void> {
  if (ev.type !== 'message' || ev.message?.type !== 'text') return;
  const m = CODE_RE.exec(String(ev.message.text ?? ''));
  if (!m) return;                                   // 一般聊天：不插嘴
  const code = m[1].toUpperCase();
  const userId = clean(ev.source?.userId);
  const rt = clean(ev.replyToken);
  if (!userId) return;

  const r = await fetch(`${base}/rest/v1/line_link_codes?code=eq.${code}&select=*`, { headers: svc });
  const row = r.ok ? ((await r.json()) as Row[])[0] : undefined;
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    await reply(env.lineToken, rt, '這組報名確認碼找不到或已經過期。若需要協助，請直接在這裡留言，廟方會回覆您。');
    return;
  }
  if (row.used_by && row.used_by !== userId) {
    await reply(env.lineToken, rt, '這組報名確認碼已經由另一個 LINE 帳號確認過了。若有疑問，請直接在這裡留言，廟方會回覆您。');
    return;
  }

  // LINE 只給「已加好友」的人的資料；拿不到就是還沒加
  const p = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${env.lineToken}` },
  });
  if (!p.ok) {
    await reply(env.lineToken, rt, `請先把「和聖壇」加為好友，再傳一次：\n報名確認 ${code}\n加了好友，之後的報名確認、匯款與感謝狀通知才能用 LINE 傳給您。`);
    return;
  }
  const name = clean(((await p.json()) as { displayName?: string }).displayName).slice(0, 100);

  const ids: string[] = Array.isArray(row.source_ids) ? row.source_ids.map(String) : [];
  const up = await fetch(`${base}/rest/v1/line_links?on_conflict=source_table,source_id`, {
    method: 'POST',
    headers: { ...svc, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(ids.map(id => ({
      source_table: row.source_table, source_id: id, line_user_id: userId, line_name: name || null,
      linked_at: new Date().toISOString(),
    }))),
  });
  if (!up.ok) {
    console.error('line link upsert failed', up.status, (await up.text()).slice(0, 200));
    await reply(env.lineToken, rt, '系統暫時無法確認，請稍後再傳一次，或直接在這裡留言。');
    return;
  }
  await fetch(`${base}/rest/v1/line_link_codes?code=eq.${code}`, {
    method: 'PATCH',
    headers: { ...svc, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ used_at: new Date().toISOString(), used_by: userId }),
  });
  await reply(env.lineToken, rt,
    `收到了，感謝您！這次的報名${ids.length > 1 ? `（${ids.length} 筆）` : ''}已經連結到這個 LINE，`
    + '之後的確認、匯款與感謝狀通知都會用 LINE 傳給您。有任何問題也可以直接在這裡留言。');
}
