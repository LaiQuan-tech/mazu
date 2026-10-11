// 有人報名就寄一封信到廟方信箱
//
// ── 為什麼需要 ──
// 工作人員還沒有習慣每天開後台（廟方 2026-10-11）。報名資料進了資料庫沒人知道，
// 信眾等不到回電。這支讓每一筆報名立刻變成一封信，推到他們本來就會看的 Gmail。
//
// ── 為什麼由後端寄、前端只送一個 id ──
// 前端手上只有使用者自己填的那份資料，直接把內容送過來等於「誰都能叫這支寄任意內容」，
// 那是一台公開的垃圾信發射器。改成前端只送 `{ table, id }`，**信的內容由這支自己去
// 資料庫撈**——撈不到就不寄，所以寄出去的一定是真的存在的報名。
// 撈取要用 service role key：報名表的 RLS 不讓 anon 讀回自己剛寫的那筆（見 CLAUDE.md）。
//
// ── 防重送 ──
// 就算有人猜到某筆報名的 UUID，也只能讓廟方收到那一筆的重複通知。再加一道
// 「建立超過 NOTIFY_WINDOW_MIN 分鐘就不寄」：正常流程是寫入後幾秒內呼叫，
// 而要重送就得在十分鐘內不斷打同一個 id，收益極低。
//
// ── 寄信服務用 Resend ──
// 需要 RESEND_API_KEY 與 NOTIFY_TO 兩個環境變數（**都不要加 VITE_ 前綴**，
// 加了會被 Vite 內嵌進前端 JS，等於把金鑰公開——同 VERCEL_DEPLOY_HOOK_URL 的理由）。
// 沒設定時這支回 204 而不是 500：通知失敗絕對不可以讓報名流程看起來壞掉。

interface ResLike {
  status: (code: number) => ResLike;
  json: (body: unknown) => void;
  end?: () => void;
}
interface ReqLike {
  method?: string;
  body?: unknown;
}

/** 允許通知的表。白名單而不是黑名單——日後多一張表要明確加進來才會寄 */
const TABLES: Record<string, { label: string; title: (r: Record<string, any>) => string }> = {
  bookings:                { label: '預約問事', title: r => `${r.name}　${r.type ?? ''}` },
  lamp_registrations:      { label: '點燈登記', title: r => `${r.name}` },
  blessing_registrations:  { label: '祈福活動報名', title: r => `${r.name}　${r.package_name ?? ''}` },
  fahui_registrations:     { label: '法會報名', title: r => `${r.name}　共 NT$${Number(r.total_amount ?? 0).toLocaleString()}` },
  volunteer_registrations: { label: '志工報名', title: r => `${r.name}` },
  donations:               { label: '隨喜捐獻', title: r => `${r.name}　${r.type ?? ''} NT$${Number(r.amount ?? 0).toLocaleString()}` },
};

/** 超過這麼久的紀錄不再寄通知。擋重送，也擋「拿舊 id 一直打」 */
const NOTIFY_WINDOW_MIN = 10;

/** 信裡要列出來的欄位。刻意不是整列傾倒——地址生日這些在後台看就好 */
const FIELDS: { key: string; label: string }[] = [
  { key: 'name',          label: '姓名' },
  { key: 'phone',         label: '電話' },
  { key: 'type',          label: '項目' },
  { key: 'package_name',  label: '方案' },
  { key: 'amount',        label: '金額' },
  { key: 'total_amount',  label: '金額' },
  { key: 'booking_date',  label: '預約日期' },
  { key: 'booking_time',  label: '預約時段' },
  { key: 'notes',         label: '備註' },
  { key: 'source',        label: '報名來源' },
];

const esc = (v: unknown): string => String(v ?? '').slice(0, 200);

export default async function handler(req: ReqLike, res: ResLike): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey      = process.env.RESEND_API_KEY;
  const to          = process.env.NOTIFY_TO;
  const from        = process.env.NOTIFY_FROM || '和聖壇網站 <noreply@heshengtan.tw>';

  /**
   * GET ＝自我檢查：**只回「設了沒」的布林值，不回任何內容**。
   * 設定這支要跨 Vercel 與 Supabase 兩個後台、四個變數，漏一個的症狀都是
   * 「信沒來」，從外面完全看不出是漏哪一個（2026-10-11 第一次設定就卡在這）。
   * 布林值本身沒有洩漏風險，但省掉的是一來一回的猜測。
   */
  if ((req.method || 'GET').toUpperCase() === 'GET') {
    res.status(200).json({
      ok: true,
      設定狀態: {
        VITE_SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!serviceKey,
        RESEND_API_KEY: !!apiKey,
        NOTIFY_TO: !!to,
        NOTIFY_FROM: process.env.NOTIFY_FROM ? '自訂' : `預設（${from}）`,
      },
      就緒: !!(supabaseUrl && serviceKey && apiKey && to),
    });
    return;
  }

  if ((req.method || 'GET').toUpperCase() !== 'POST') {
    res.status(405).json({ ok: false, error: '只接受 GET（檢查）或 POST（寄送）' });
    return;
  }

  // 還沒設定好就安靜跳過。報名已經寫進資料庫了，通知寄不出去不是信眾的問題
  if (!supabaseUrl || !serviceKey || !apiKey || !to) {
    res.status(204).json({ ok: true, skipped: 'not configured' });
    return;
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) as
    { table?: string; id?: string } | undefined;
  const table = body?.table ?? '';
  const id    = body?.id ?? '';
  const spec  = TABLES[table];
  if (!spec || !/^[0-9a-f-]{36}$/i.test(id)) {
    res.status(400).json({ ok: false, error: '參數不正確' });
    return;
  }

  try {
    // service role 繞過 RLS；只取這一筆
    const r = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}&limit=1`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const rows = r.ok ? await r.json() : [];
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      // 查無此筆＝不是真的報名，不寄
      res.status(404).json({ ok: false, error: '查無此筆' });
      return;
    }

    const createdAt = Date.parse(row.created_at ?? '');
    if (!Number.isNaN(createdAt) && Date.now() - createdAt > NOTIFY_WINDOW_MIN * 60000) {
      res.status(409).json({ ok: false, error: '這筆太舊了，不再通知' });
      return;
    }

    const lines = FIELDS
      .filter(f => row[f.key] !== null && row[f.key] !== undefined && String(row[f.key]).trim() !== '')
      .map(f => `${f.label}：${esc(row[f.key])}`);
    const when = new Date(createdAt || Date.now()).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

    const text = [
      `【${spec.label}】${esc(spec.title(row))}`,
      '',
      ...lines,
      `報名時間：${when}`,
      '',
      '— 完整資料請到後台查看 —',
      'https://heshengtan.tw/?admin=1',
    ].join('\n');

    const send = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      // 主旨要讓人在手機通知列上就看得懂是哪一種、誰報的
      body: JSON.stringify({ from, to: to.split(',').map(s => s.trim()), subject: `[和聖壇] ${spec.label}　${esc(row.name)}`, text }),
    });
    if (!send.ok) {
      const detail = await send.text();
      console.error('notify send failed', send.status, detail.slice(0, 300));
      res.status(502).json({ ok: false, error: '寄送失敗' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('notify error', e);
    res.status(500).json({ ok: false, error: '通知失敗' });
  }
}
