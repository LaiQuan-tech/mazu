// 寄給信眾的信：廟方確認後的「確認信」，與捐獻的「感謝信」
//
// ── 為什麼需要 ──
// 廟方 2026-10-13：「報名經後台管理人員確認後，應該要發一個報名完成的確認信」、
// 「捐獻，直接寄感謝信」。信眾送出表單只看到畫面上一句「報名成功」，關掉分頁就什麼都
// 沒有了；而他真正要等的是廟方確認（場次排得進去嗎、款項收到了嗎），那件事發生時他
// 完全不知道。
//
// ── 與 notify-registration 的關鍵差別：**收件人是信眾，不是廟方** ──
// notify-registration 可以是公開端點，因為它只會寄到 NOTIFY_TO 那一個固定的廟方信箱
// ——最壞的情況是廟方收到重複通知。這支寄的是資料庫裡那筆報名填的信箱，
// **公開就等於「猜中任何一筆的 UUID 就能對那個人寄信」**，是一台針對特定人的騷擾工具。
//
// ── 所以有兩種模式，差別只在「防線是什麼」 ──
// 問事／點燈／祈福／法會：**要管理員身分**。帶登入者的 Supabase token 去讀
//   `admin_profiles`，那張表的 RLS 只讓人讀自己那一列，非管理員必然拿到空陣列 → 403
//   （同 api/republish.ts）。這條路**刻意不設時間窗**——確認本來就是幾天後的事。
// 隨喜捐獻（`open: true`）：**不要求身分**。它沒有「已確認」這個狀態（後台那一頁只是
//   一份紀錄清單），而捐款人要的本來也不是「我們確認了」，是一句謝謝；所以由前台在
//   **送出成功當下**呼叫，而送出的人就是捐款人本人，他沒有也不該有管理員 token。
//   換來的防線是 notify-registration 那一套：**只寄「建立未滿 NOTIFY_WINDOW_MIN 分鐘」
//   的那幾筆**。猜中某筆的 UUID 最多只能在那十分鐘內讓捐款人多收到一封感謝信，
//   而下面的蓋章連那一封都擋掉。
//
// ── 防重複：confirm_sent_at（registration_email.sql 加的）──
// 後台的狀態是一顆下拉選單，會被改來改去（按錯、改回、再改過來），每次變成「已確認」
// 就寄一封的話，信眾會收到一疊一樣的信。寄之前先看它，**寄成功才蓋章**——寄失敗刻意
// 不蓋，廟方再按一次就重試；蓋了的話那個人永遠收不到信而且沒人知道。
//
// ── 一筆訂單只寄一封 ──
// 同廟方對通知信的要求（2026-10-12「揪團是像同一筆訂單」）：`id` 收得下一整批，
// 前端把連續幾次確認攢在一起送過來（services/notifyConfirm.ts），
// 這裡依**收件信箱**分組，同一個人只寄一封、裡面列出那幾筆。
//
// ── 沒填信箱的人怎麼辦（廟方選的方案：表單加信箱＋會員帳號補位）──
// 信箱是選填，長輩多半不會填。沒填時拿電話回頭對 member_profiles，
// 對得上就寄到那個會員帳號的信箱。對不上就不寄——**不寄比寄錯好**。
// 注意兩件事：
//  (1) 電話是逐字比對。會員自己報名時填進去的就是 member_profiles 那一欄的值，
//      所以對得上；訪客手打的格式不同就對不上，那也只是回到「不寄」。
//  (2) 這沿用了全站既有的「電話當鍵」弱點（見 CLAUDE.md 的 my_phone()）：
//      有人填了別人的電話，信就會寄到那個會員的信箱。沒有擴大暴露面
//      ——那個會員本來就能在會員中心看到以他電話報名的紀錄——但要知道這件事。
//
// ── 本機驗不了，要用 node 跑 ──
// `vite dev` 不跑 `api/`，所以這支在本機一定 404。驗的方法是用 esbuild 打包成 .mjs、
// 用 node 跑並 stub `globalThis.fetch` 假扮 Supabase 與 Resend——授權、時間窗、分組、
// 去重、退件、migration 沒跑，這些分支多到不可能靠部署後手測。
//
// ── 環境變數 ──
// RESEND_API_KEY／SUPABASE_SERVICE_ROLE_KEY／VITE_SUPABASE_URL／VITE_SUPABASE_ANON_KEY，
// 寄件者用 NOTIFY_FROM。**伺服器端的那幾個絕對不要加 VITE_ 前綴**，
// 加了會被 Vite 內嵌進前端 JS 等於公開金鑰（同 VERCEL_DEPLOY_HOOK_URL 的理由）。

interface ResLike {
  status: (code: number) => ResLike;
  json: (body: unknown) => void;
}
interface ReqLike {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}

type Row = Record<string, any>;

/**
 * 可以寄信的表，以及每一種信要怎麼寫。
 * 白名單而不是黑名單——日後多一張表要明確加進來。
 *
 * `line` 回傳的是信眾看得懂的句子，不是欄位傾倒：
 * 他要知道的是「我報的是什麼、什麼時候來、花了多少錢」。
 * 後台用的 source／備註之類一律不寫進去。
 *
 * `open: true` ＝這張表不要求管理員身分（目前只有 `donations`，理由見檔頭）。
 */
const TABLES: Record<string, {
  label: string;
  /** 這一筆的一行摘要，列在名單裡 */
  line: (r: Row, ctx: Ctx) => string;
  /** 信件主旨（前面會自動加「[和聖壇] 」） */
  subject: string;
  /** 名單前面那句話。`n` 是筆數 */
  intro: (n: number) => string;
  /** 名單後面要補的話，例如問事要提醒到壇時間 */
  extra?: string[];
  /** 結尾那句。捐獻的 intro 已經說了「感謝」，再謝一次是同一件事講兩次 */
  closing?: string;
  /**
   * 這一筆的金額，多筆時用來算合計。回 undefined ＝這一種沒有金額（問事是現場收費）。
   * **合計一律由明細加總、不存也不信任任何既有的總額欄位**（同財務憑證那條原則）：
   * 加總算得出來的東西存下來，一旦與明細對不起來就沒有辦法知道該信哪個。
   */
  amount?: (r: Row, ctx: Ctx) => number | undefined;
  /** 不要求管理員身分（改用「建立未滿 10 分鐘」當防線） */
  open?: boolean;
}> = {
  bookings: {
    label: '預約問事',
    subject: '預約問事已確認',
    intro: n => `您在和聖壇的預約問事已經由本壇確認${n > 1 ? `，共 ${n} 筆` : ''}：`,
    // **問事是現場收費，不事先匯款**（廟方 2026-10-13）。要寫出來：
    // 其餘幾種都要先匯款，信眾收到一封「已確認」很容易以為自己也漏了匯款那一步。
    extra: [
      '請於預約的日期與時段到壇，若需改期請先與本壇聯繫。',
      '問事於現場繳費，不需事先匯款。',
    ],
    line: r => [
      `${r.name}`,
      r.type ? `（${r.type}）` : '',
      r.booking_date ? `　${r.booking_date}` : '',
      r.booking_time ? ` ${r.booking_time}` : '',
    ].join(''),
  },
  lamp_registrations: {
    label: '點燈登記',
    subject: '點燈登記已確認、款項已收到',
    intro: n => `您在和聖壇的點燈登記已經由本壇確認，款項也已收到${n > 1 ? `，共 ${n} 筆` : ''}：`,
    line: (r, ctx) => {
      const c = ctx.lamp.get(clean(r.service_id));
      return `${r.name}　${c?.name ?? '點燈'}${c ? `　NT$${c.fee.toLocaleString()}` : ''}`;
    },
    amount: (r, ctx) => ctx.lamp.get(clean(r.service_id))?.fee,
  },
  blessing_registrations: {
    label: '祈福活動報名',
    subject: '祈福活動報名已確認、款項已收到',
    intro: n => `您在和聖壇的祈福活動報名已經由本壇確認，款項也已收到${n > 1 ? `，共 ${n} 筆` : ''}：`,
    line: (r, ctx) => {
      const addons: { name?: string; fee?: number }[] = Array.isArray(r.selected_addons) ? r.selected_addons : [];
      const total = blessingTotal(r);
      return [
        `${r.name}`,
        ctx.event.get(clean(r.event_id)) ? `　${ctx.event.get(clean(r.event_id))}` : '',
        r.package_name ? `（${r.package_name}）` : '',
        addons.length > 0 ? `　加購：${addons.map(a => clean(a.name)).filter(Boolean).join('、')}` : '',
        `　NT$${total.toLocaleString()}`,
      ].join('');
    },
    amount: r => blessingTotal(r),
  },
  /**
   * 隨喜捐獻：**感謝信，不是確認信**，而且不等廟方確認（廟方 2026-10-13）。
   * `open: true` 讓前台在送出成功後直接呼叫——捐款人自己不可能有管理員 token。
   */
  donations: {
    label: '隨喜捐獻',
    subject: '感謝您的護持',
    open: true,
    intro: n => `感謝您護持和聖壇。以下是我們收到的捐獻紀錄${n > 1 ? `，共 ${n} 筆` : ''}：`,
    extra: ['若為匯款，款項入帳後本壇會再行核對；如有疑問歡迎與本壇聯繫。'],
    closing: '願神明庇佑，闔家平安。',
    line: r => `${r.name}　${r.type ?? ''} NT$${Number(r.amount ?? 0).toLocaleString()}${r.repair_project_name ? `（${r.repair_project_name}）` : ''}`,
    amount: r => Number(r.amount ?? 0),
  },
  fahui_registrations: {
    label: '法會報名',
    subject: '法會報名已確認、款項已收到',
    intro: () => '您在和聖壇的法會報名已經由本壇確認，款項也已收到：',
    line: r => `${r.name}　共 NT$${Number(r.total_amount ?? 0).toLocaleString()}`,
    amount: r => Number(r.total_amount ?? 0),
  },
};

/**
 * 祈福一筆的金額 ＝ 方案費 ＋ 所有加購。
 * **與後台應收管理（ReceivablesTab）同一套規則**——兩邊對不起來就沒人信
 * （CLAUDE.md 的既有原則）。隨喜加購的 fee 存的就是信眾自填的實際金額。
 */
const blessingTotal = (r: Row): number => {
  const addons: { fee?: number }[] = Array.isArray(r.selected_addons) ? r.selected_addons : [];
  return Number(r.package_fee ?? 0) + addons.reduce((sum, a) => sum + Number(a.fee ?? 0), 0);
};

/** 一次最多處理幾筆。同一團再多也不會到這個數，這是防灌不是業務限制 */
const MAX_IDS = 50;

/**
 * 「加入會員」的入口。`?member=1` 會讓會員中心自己打開（同 LINE 登入轉回來那條路），
 * 不帶參數的話信眾落在首頁還要自己找那顆鈕。
 */
const MEMBER_URL = 'https://heshengtan.tw/?member=1';

/**
 * 公開那條路（捐獻）只寄「建立未滿這麼久」的紀錄。
 * 與 notify-registration 的同名常數同一個理由與數值，兩邊要一起看。
 */
const NOTIFY_WINDOW_MIN = 10;

/**
 * 點燈的燈種（含費用）、祈福的活動名。
 * 點燈與祈福都是**先匯款**的服務（廟方 2026-10-13），所以這封信的重點是
 * 「收到了多少錢」——光寫「點燈已確認」信眾無從核對，寫了金額他才知道
 * 自己匯的那筆對不對得上。費用在 `lamp_service_configs`，不在報名紀錄上。
 */
interface Ctx {
  lamp: Map<string, { name: string; fee: number }>;
  event: Map<string, string>;
}

const header = (req: ReqLike, name: string): string => {
  const v = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

const clean = (v: unknown): string => String(v ?? '').trim();

/** 看起來像信箱就好。擋的是空字串與明顯的垃圾，不做嚴格驗證（擋太嚴只會讓該寄的沒寄） */
const isEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/** Resend 的錯誤訊息，遮掉信箱後截短（同 notify-registration 的理由） */
const resendReason = (detail: string): string => {
  let msg = detail;
  try {
    const j = JSON.parse(detail) as { message?: string; name?: string };
    msg = String(j.message || j.name || detail);
  } catch { /* 不是 JSON 就用原文 */ }
  return msg.replace(/[\w.+-]+@[\w.-]+\.[\w.-]+/g, '***@***').slice(0, 300);
};

export default async function handler(req: ReqLike, res: ResLike): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey     = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey      = process.env.RESEND_API_KEY;
  const from        = process.env.NOTIFY_FROM || '和聖壇 <noreply@heshengtan.tw>';

  /**
   * GET ＝自我檢查，只回「設了沒」的布林值。
   * 這支要跨 Vercel 與 Supabase 兩個後台、四個變數，漏一個的症狀都是「信沒來」。
   * **刻意不要求管理員身分**：布林值沒有洩漏風險，而設定壞掉的時候
   * 往往正是登不進後台或拿不到 token 的時候，要求身分會讓這支在最需要它時沒用。
   */
  if ((req.method || 'GET').toUpperCase() === 'GET') {
    res.status(200).json({
      ok: true,
      設定狀態: {
        VITE_SUPABASE_URL: !!supabaseUrl,
        VITE_SUPABASE_ANON_KEY: !!anonKey,
        SUPABASE_SERVICE_ROLE_KEY: !!serviceKey,
        RESEND_API_KEY: !!apiKey,
        NOTIFY_FROM: process.env.NOTIFY_FROM ? '自訂' : `預設（${from}）`,
      },
      就緒: !!(supabaseUrl && anonKey && serviceKey && apiKey),
      說明: '寄給信眾的信（不是給廟方的通知信）。捐獻的感謝信由前台公開呼叫，其餘幾種的確認信要管理員身分。',
      可寄的表: Object.entries(TABLES).map(([k, v]) => `${k}${v.open ? '（公開）' : '（需管理員）'}`),
    });
    return;
  }

  if ((req.method || 'GET').toUpperCase() !== 'POST') {
    res.status(405).json({ ok: false, error: '只接受 GET（檢查）或 POST（寄送）' });
    return;
  }

  if (!supabaseUrl || !anonKey || !serviceKey || !apiKey) {
    // 這支與報名流程無關（確認是後台的動作），所以照實回 500 而不是安靜的 204
    res.status(500).json({ ok: false, error: '伺服器未設定寄信所需的環境變數' });
    return;
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) as
    { table?: string; id?: string | string[] } | undefined;
  const table = clean(body?.table);
  const spec  = TABLES[table];
  const ids = (Array.isArray(body?.id) ? body!.id as string[] : [clean(body?.id)])
    .filter(x => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x))
    .slice(0, MAX_IDS);
  if (!spec || ids.length === 0) {
    res.status(400).json({ ok: false, error: '參數不正確' });
    return;
  }

  /**
   * ── 授權 ──
   * `spec.open` 的表（捐獻）不驗身分：寄的人就是捐款人本人，他沒有管理員 token。
   * 那條路的防線是下面的「建立未滿 NOTIFY_WINDOW_MIN 分鐘」＋ confirm_sent_at 蓋章。
   * 其餘幾種是廟方確認後才寄的，一律要管理員——不然猜中 UUID 就能對特定人寄信。
   */
  if (!spec.open) {
    const auth = header(req, 'authorization');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) {
      res.status(401).json({ ok: false, error: '未登入' });
      return;
    }
    try {
      const check = await fetch(`${supabaseUrl}/rest/v1/admin_profiles?select=user_id&limit=1`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      });
      if (!check.ok) {
        res.status(401).json({ ok: false, error: '登入狀態已失效，請重新登入' });
        return;
      }
      const rows = await check.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        res.status(403).json({ ok: false, error: '只有管理員可以寄確認信' });
        return;
      }
    } catch (e) {
      res.status(502).json({ ok: false, error: '無法確認管理員身分：' + (e instanceof Error ? e.message : String(e)) });
      return;
    }
  }

  const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  try {
    // service role 繞過 RLS（報名表的 RLS 不讓一般角色讀）
    const r = await fetch(
      `${supabaseUrl}/rest/v1/${table}?id=in.(${ids.join(',')})&order=created_at.asc&limit=${MAX_IDS}`,
      { headers: svc },
    );
    if (!r.ok) {
      res.status(502).json({ ok: false, error: `讀取報名資料失敗（${r.status}）` });
      return;
    }
    const fetched = await r.json();
    const all: Row[] = Array.isArray(fetched) ? fetched : [];
    if (all.length === 0) {
      res.status(404).json({ ok: false, error: '查無此筆' });
      return;
    }

    // 寄過的不再寄。狀態被改來改去時，這一行就是信眾不會收到一疊重複信的原因
    let fresh = all.filter(x => !x.confirm_sent_at);
    if (fresh.length === 0) {
      res.status(200).json({ ok: true, skipped: 'already-sent', 已寄過: all.length });
      return;
    }
    /**
     * 公開那條路（捐獻）另外擋「太舊的」。正常流程是送出後幾秒內呼叫，
     * 所以十分鐘綽綽有餘；而要拿舊 id 騷擾捐款人就得在那十分鐘內打同一支。
     * **管理員那條路刻意不設時間窗**：確認本來就是幾天後的事，身分驗證才是那邊的防線。
     * 整批裡混到過期的只丟掉那幾筆，不要讓同一團的其他人都收不到。
     */
    if (spec.open) {
      const 太舊 = fresh.length;
      fresh = fresh.filter(x => {
        const t = Date.parse(x.created_at ?? '');
        return Number.isNaN(t) || Date.now() - t <= NOTIFY_WINDOW_MIN * 60000;
      });
      if (fresh.length === 0) {
        res.status(409).json({ ok: false, error: '這幾筆太舊了，不再寄送', 筆數: 太舊 });
        return;
      }
    }

    /**
     * ── 拿電話去對 member_profiles，一次問完 ──
     * 這一份查詢同時回答兩件事：
     *   (1) 沒填信箱的人，寄到他會員帳號的信箱（備援）；
     *   (2) 這個人**是不是已經是會員**——是的話信末那段「加入會員」就不要出現。
     * 原本只查「沒填信箱」那幾筆，現在改成**全部都查**：差別只有一次查詢，
     * 而少了它就會對著已經是會員的人叫他加入會員。
     */
    const memberPhones = new Set<string>();      // 這些電話已經有會員帳號
    const byPhone = new Map<string, string>();   // 電話 → 會員帳號的信箱
    {
      const phones = [...new Set(fresh.map(x => clean(x.phone)).filter(Boolean))];
      if (phones.length > 0) {
        // member_profiles 的電話是會員自己填的，報名時也是直接帶那一欄，所以逐字比對得上
        //
        // **`in.(…)` 裡的逗號是 PostgREST 的分隔符**：整串丟進 encodeURIComponent
        // 會把它變成 %2C，於是「兩個電話」變成「一個含逗號的怪電話」，一筆都對不到
        // ——而症狀只是「確認信沒寄」，從外面看不出是這裡。要逐個值編碼再用逗號串。
        // 值本身也要編（`+` 不編會被解成空白），引號則是 PostgREST 的字串界定符。
        const q = phones.map(x => `"${encodeURIComponent(x.replace(/"/g, ''))}"`).join(',');
        const mp = await fetch(
          `${supabaseUrl}/rest/v1/member_profiles?select=user_id,phone&phone=in.(${q})`,
          { headers: svc },
        );
        const profiles: Row[] = mp.ok ? await mp.json().catch(() => []) : [];
        const list = Array.isArray(profiles) ? profiles : [];
        list.forEach(p => { if (p.phone) memberPhones.add(clean(p.phone)); });
        // 帳號的信箱在 auth.users，只有 admin API 拿得到。**只問真的需要的那幾個**
        // ——已經自己填了信箱的人不必為了寄信去翻他的帳號
        const needAuth = list.filter(p =>
          p.user_id && p.phone &&
          fresh.some(x => clean(x.phone) === clean(p.phone) && !isEmail(clean(x.email))));
        await Promise.all(needAuth.map(async p => {
          try {
            const u = await fetch(`${supabaseUrl}/auth/v1/admin/users/${p.user_id}`, { headers: svc });
            if (!u.ok) return;
            const j = await u.json() as { email?: string };
            const e = clean(j.email);
            // LINE 登入的帳號沒有信箱（LINE 不給），那就是查不到，不是錯誤
            if (isEmail(e)) byPhone.set(clean(p.phone), e);
          } catch { /* 查不到就當作沒有 */ }
        }));
      }
    }

    const recipientOf = (x: Row): string => {
      const own = clean(x.email);
      if (isEmail(own)) return own;
      return byPhone.get(clean(x.phone)) ?? '';
    };

    const sendable = fresh.filter(x => recipientOf(x) !== '');
    if (sendable.length === 0) {
      // 不是失敗：這幾筆就是沒有信箱可寄。後台要據實顯示，不要假裝寄出去了
      res.status(200).json({ ok: true, skipped: 'no-email', 無信箱: fresh.length });
      return;
    }

    // ── 信裡要寫得出「哪一種燈」「哪一場活動」 ──
    const ctx: Ctx = { lamp: new Map(), event: new Map() };
    // 這些 id 要串進 `in.(…)`，先確認長得像 UUID——括號或逗號混進去會把查詢打壞
    const uuids = (list: string[]): string[] =>
      [...new Set(list.filter(x => /^[0-9a-f-]{36}$/i.test(x)))];
    if (table === 'lamp_registrations') {
      const idsNeeded = uuids(sendable.map(x => clean(x.service_id)));
      if (idsNeeded.length > 0) {
        const c = await fetch(`${supabaseUrl}/rest/v1/lamp_service_configs?select=id,name,fee&id=in.(${idsNeeded.join(',')})`, { headers: svc });
        const list: Row[] = c.ok ? await c.json().catch(() => []) : [];
        (Array.isArray(list) ? list : []).forEach(x =>
          ctx.lamp.set(x.id, { name: clean(x.name), fee: Number(x.fee ?? 0) }));
      }
    }
    if (table === 'blessing_registrations') {
      const idsNeeded = uuids(sendable.map(x => clean(x.event_id)));
      if (idsNeeded.length > 0) {
        const c = await fetch(`${supabaseUrl}/rest/v1/blessing_events?select=id,title&id=in.(${idsNeeded.join(',')})`, { headers: svc });
        const list: Row[] = c.ok ? await c.json().catch(() => []) : [];
        (Array.isArray(list) ? list : []).forEach(x => ctx.event.set(x.id, clean(x.title)));
      }
    }

    // 廟方的電話與地址放在 site_settings（不要在這裡寫死：改了後台這裡就會跟著變）
    const info = new Map<string, string>();
    try {
      const s = await fetch(`${supabaseUrl}/rest/v1/site_settings?select=key,value&key=in.(info_address,info_phone)`, { headers: svc });
      const list: Row[] = s.ok ? await s.json().catch(() => []) : [];
      (Array.isArray(list) ? list : []).forEach(x => info.set(x.key, clean(x.value)));
    } catch { /* 讀不到就不寫那兩行，不要讓確認信寄不出去 */ }

    // ── 依收件信箱分組，一個人一封 ──
    const groups = new Map<string, Row[]>();
    sendable.forEach(x => {
      const to = recipientOf(x);
      groups.set(to, [...(groups.get(to) ?? []), x]);
    });

    const results: { to: string; id?: string; error?: string }[] = [];
    const sentIds: string[] = [];

    for (const [to, rows] of groups) {
      /**
       * 稱呼誰。**不可以一律用第一筆的姓名**：會員替父母點燈時，那幾筆的姓名是
       * 父母的，信卻是寄給會員的——開頭變成「王媽媽 您好」寄到兒子的信箱。
       * 標記「本人」的那一筆才是填表的人（四個表單的第一張卡預設就是本人）；
       * 沒有本人、姓名又不只一個時就不稱名，讓下面的名單自己說話。
       */
      const 本人 = rows.find(x => clean(x.contact_label) === '本人');
      const 姓名集 = new Set(rows.map(x => clean(x.name)));
      const 稱呼 = 本人 ? clean(本人.name) : 姓名集.size === 1 ? clean(rows[0].name) : '';
      const text = [
        `${稱呼 ? `${稱呼} ` : ''}您好：`,
        '',
        spec.intro(rows.length),
        '',
        ...rows.map(x => `・${spec.line(x, ctx)}`),
        /**
         * 多筆才印合計，而且**每一筆都算得出金額才印**。
         * 少算一筆的「合計」比沒有合計糟：信眾會拿它去對自己匯的金額，對不上就要打電話。
         */
        ...(() => {
          if (rows.length < 2 || !spec.amount) return [];
          const vals = rows.map(x => spec.amount!(x, ctx));
          if (vals.some(v => v === undefined)) return [];
          return [`　　合計 NT$${vals.reduce((a, b) => a! + b!, 0)!.toLocaleString()}`];
        })(),
        '',
        ...(spec.extra ? [...spec.extra, ''] : []),
        spec.closing ?? '感謝您的護持，願神明庇佑。',
        /**
         * ── 還不是會員的人，邀請他加入 ──
         * 報名**不需要帳號**（四個表單對訪客是開放的），所以報過名的人絕大多數
         * 沒有會員帳號，在後台的「會員管理」裡看不到（廟方 2026-10-13 問起）。
         * 成功頁那顆「立即加入會員」只有一瞬間，而這封信他會留著——而且是廟方
         * 剛確認完、他正放心的時候，比填完表單那一刻更願意多按一下。
         *
         * **已經是會員的不要寄這段**：對著會員叫他加入會員是雜訊。
         * 判斷用電話對 member_profiles（上面那份查詢順便回答的）。
         * 一群人共用一個收件信箱時，**只要其中一個是會員就整段不出現**
         * ——寧可少講一次，也不要對著會員喊話。
         *
         * **「用同一支電話」是這段裡最有用的一句**，不是客套：報名紀錄一律以電話為鍵
         * （`my_phone()`），電話對得上，他過去的點燈問事捐獻就會自己出現、不必重填。
         * 填別支電話的話那些紀錄就接不起來，而他不會知道為什麼。
         *
         * 也要點名 LINE：本站信眾以長者居多，記 email 與密碼是真實的門檻，
         * 而「不必記密碼」正是他會按下去的理由（同會員中心把 LINE 排在信箱之前）。
         */
        ...(rows.every(x => !memberPhones.has(clean(x.phone)))
          ? ['',
             '想查詢您歷次的紀錄嗎？用 LINE 一按就能加入會員，不必記密碼。',
             '加入時請留同一支電話，過去的報名紀錄會自動出現。',
             MEMBER_URL]
          : []),
        '',
        '──',
        '和聖壇',
        ...(info.get('info_address') ? [`地址：${info.get('info_address')}`] : []),
        ...(info.get('info_phone')   ? [`電話：${info.get('info_phone')}`]   : []),
        'https://heshengtan.tw',
        '',
        '（本信由系統寄出，請勿直接回覆。）',
      ].join('\n');

      const send = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject: `[和聖壇] ${spec.subject}`, text }),
      });
      if (!send.ok) {
        const detail = await send.text();
        console.error('confirm send failed', send.status, detail.slice(0, 300));
        results.push({ to: '***@***', error: resendReason(detail) });
        continue;
      }
      const sent = await send.json().catch(() => ({})) as { id?: string };
      results.push({ to: '***@***', id: sent.id });
      rows.forEach(x => sentIds.push(x.id));
    }

    // ── 蓋章：寄成功的才蓋 ──
    // 寄失敗的刻意不蓋，廟方再按一次就會重試；蓋了的話那個人永遠收不到信而且沒人知道。
    if (sentIds.length > 0) {
      const stamp = await fetch(`${supabaseUrl}/rest/v1/${table}?id=in.(${sentIds.join(',')})`, {
        method: 'PATCH',
        headers: { ...svc, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ confirm_sent_at: new Date().toISOString() }),
      });
      if (!stamp.ok) {
        // 信已經寄出去了，章沒蓋上。據實回報——下一次確認會重寄，廟方要知道為什麼
        const why = (await stamp.text()).slice(0, 200);
        console.error('confirm stamp failed', stamp.status, why);
        res.status(200).json({
          ok: true, 已寄出: sentIds.length, 結果: results,
          警告: '信已寄出，但「已寄送」的紀錄沒寫進資料庫，再次確認時可能重寄一封。',
          // 最可能的原因就是 registration_email.sql 還沒在 Supabase 跑過
          原因: /confirm_sent_at/.test(why)
            ? '資料表沒有 confirm_sent_at 欄位，請執行 supabase/migrations/registration_email.sql'
            : `資料庫回 ${stamp.status}`,
        });
        return;
      }
    }

    const failed = results.filter(x => x.error).length;
    res.status(failed > 0 && sentIds.length === 0 ? 502 : 200).json({
      ok: sentIds.length > 0,
      已寄出: sentIds.length,
      無信箱: fresh.length - sendable.length,
      已寄過: all.length - fresh.length,
      結果: results,
    });
  } catch (e) {
    console.error('confirm error', e);
    res.status(500).json({ ok: false, error: '寄送確認信失敗' });
  }
}
