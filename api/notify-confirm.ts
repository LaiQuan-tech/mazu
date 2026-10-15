// 通知信眾：廟方確認後的「確認信」，與捐獻的「感謝信」
//
// ── 兩個管道，一個人只收到一則 ──
// **LINE 優先、email 墊底。** 本站信眾以長者居多，LINE 他每天在看，email 不一定；
// 但兩邊內容一樣，同時送就是同一件事講兩次。所以有 LINE 就推 LINE，
// **推不出去（沒加好友、封鎖了、權杖過期）才退回 email**——不退的話那個人什麼都
// 收不到，而後台看起來像已經通知了。
//
// 能推 LINE 的前提是當初把 Login channel 建在與官方帳號**同一個 Provider** 底下
// （2026-10-13 為此整支重建過，見 CLAUDE.md）：LINE 的使用者 ID 綁 Provider 不綁
// channel，不同 Provider 下同一個人是兩個 ID，官方帳號推不到登入時拿到的那個。
// userId 存在 `auth.identities`（provider = `custom:line`），不必另開欄位。
// 沒設 `LINE_CHANNEL_ACCESS_TOKEN` 就整個不推、email 照常——LINE 是加分的那一層。
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

import {
  type Row, type Parcel, clean, isEmail, readEnv, svcHeaders, uuids,
  lookupContacts, deliver, stamp, siteSettings, bankLines, mailSignature,
} from '../lib/notify-deliver';

interface ResLike {
  status: (code: number) => ResLike;
  json: (body: unknown) => void;
}
interface ReqLike {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}


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
  /**
   * `kind=payinfo`：**送出當下**就把匯款資訊推給信眾（廟方 2026-10-16）。
   * 信眾送出後匯款帳號只出現在畫面上，關掉分頁就沒了——所以才會有人匯錯金額、
   * 或打電話來問帳號。只有「要先匯款」的服務有這一段（問事是現場收費）。
   * 這條路與捐獻感謝信同樣是公開的：送出的人就是本人，他沒有管理員 token，
   * 防線一樣是「建立未滿 NOTIFY_WINDOW_MIN 分鐘」＋ payinfo_sent_at 蓋章。
   */
  payinfo?: { subject: string; intro: (n: number) => string };
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
    payinfo: { subject: '點燈登記已收到，請完成匯款', intro: n => `感謝您在和聖壇登記點燈${n > 1 ? `，共 ${n} 盞` : ''}。以下是您的登記內容與匯款資訊：` },
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
    payinfo: { subject: '祈福報名已收到，請完成匯款', intro: n => `感謝您報名和聖壇的祈福活動${n > 1 ? `，共 ${n} 筆` : ''}。以下是您的報名內容與匯款資訊：` },
    label: '祈福活動報名',
    subject: '祈福活動報名已確認、款項已收到',
    intro: n => `您在和聖壇的祈福活動報名已經由本壇確認，款項也已收到${n > 1 ? `，共 ${n} 筆` : ''}：`,
    line: (r, ctx) => {
      const addons: { name?: string; fee?: number }[] = Array.isArray(r.selected_addons) ? r.selected_addons : [];
      const total = blessingTotal(r, ctx);
      return [
        `${r.name}`,
        ctx.event.get(clean(r.event_id)) ? `　${ctx.event.get(clean(r.event_id))!.title}` : '',
        r.package_name ? `（${r.package_name}）` : '',
        addons.length > 0 ? `　加購：${addons.map(a => clean(a.name)).filter(Boolean).join('、')}` : '',
        `　NT$${total.toLocaleString()}`,
      ].join('');
    },
    amount: (r, ctx) => blessingTotal(r, ctx),
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
 * 祈福一筆的金額 ＝ **方案費（沒有方案就用活動的統一費用）** ＋ 所有加購。
 *
 * **與後台的 `services/serviceAmount.ts` 必須同一套規則**（那支是前端的單一來源；
 * 這裡不能直接 import——那會把 supabase client 整包拉進這支無伺服器函式）。
 * 改任何一邊都要同時改另一邊，理由寫在 serviceAmount.ts 的檔頭。
 *
 * **2026-10-16 修**：原本只讀 `package_fee`，而本壇的祈福活動一個都沒有設方案
 * （費用直接填在活動的 `fee` 上），所以金額永遠是 0——廟方收到的 LINE 通知寫
 * 「NT$0」就是這個。隨喜加購的 fee 存的就是信眾自填的實際金額。
 */
const blessingTotal = (r: Row, ctx: Ctx): number => {
  const addons: { fee?: number }[] = Array.isArray(r.selected_addons) ? r.selected_addons : [];
  const base = r.package_fee ?? ctx.event.get(clean(r.event_id))?.fee ?? 0;
  return (Number(base) || 0) + addons.reduce((sum, a) => sum + Number(a.fee ?? 0), 0);
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
  /** 祈福活動的名稱**與費用**：沒有方案的活動，價錢只存在活動的 `fee` 上 */
  event: Map<string, { title: string; fee: number }>;
}

const header = (req: ReqLike, name: string): string => {
  const v = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

export default async function handler(req: ReqLike, res: ResLike): Promise<void> {
  /**
   * 設定一次讀齊（共用層的 readEnv）。`lineToken` 沒設就整個不推 LINE、email 照常
   * ——LINE 是加分的那一層，不是必要條件。
   */
  const env = readEnv();
  const { supabaseUrl, anonKey, serviceKey, resendKey: apiKey, from, lineToken } = env;

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
        LINE_CHANNEL_ACCESS_TOKEN: !!lineToken,
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
    { table?: string; id?: string | string[]; kind?: string } | undefined;
  const table = clean(body?.table);
  const spec  = TABLES[table];
  /**
   * `kind`：`confirm`（預設，廟方確認後的確認信／感謝信）或 `payinfo`
   * （送出當下的匯款資訊）。兩者差在文案、蓋章欄位、以及要不要驗管理員身分。
   */
  const payinfo = clean(body?.kind) === 'payinfo';
  const stampCol = payinfo ? 'payinfo_sent_at' : 'confirm_sent_at';
  const ids = (Array.isArray(body?.id) ? body!.id as string[] : [clean(body?.id)])
    .filter(x => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x))
    .slice(0, MAX_IDS);
  if (!spec || ids.length === 0 || (payinfo && !spec.payinfo)) {
    res.status(400).json({ ok: false, error: '參數不正確' });
    return;
  }

  /**
   * ── 授權 ──
   * `spec.open` 的表（捐獻）不驗身分：寄的人就是捐款人本人，他沒有管理員 token。
   * 那條路的防線是下面的「建立未滿 NOTIFY_WINDOW_MIN 分鐘」＋ confirm_sent_at 蓋章。
   * 其餘幾種是廟方確認後才寄的，一律要管理員——不然猜中 UUID 就能對特定人寄信。
   */
  if (!spec.open && !payinfo) {
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
    let fresh = all.filter(x => !x[stampCol]);
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
    if (spec.open || payinfo) {
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
     * ── 拿電話去對 member_profiles（共用層的 lookupContacts）──
     * 一次回答三件事：是不是會員（決定要不要邀他入會）、會員帳號的信箱（備援）、
     * 以及 LINE userId（能不能推播）。
     * `needEmailFor` 只放「沒自填信箱」的那幾支電話——已經填了的不必為了寄信翻他的帳號。
     */
    const contacts = await lookupContacts(env, fresh.map(x => clean(x.phone)), {
      wantLine: !!lineToken,
      needEmailFor: new Set(fresh.filter(x => !isEmail(clean(x.email))).map(x => clean(x.phone))),
    });
    const contactOf = (x: Row) =>
      contacts.get(clean(x.phone)) ?? { email: '', lineId: '', isMember: false };

    /** 這一筆要寄到哪個信箱（自己填的優先，沒填就用會員帳號的） */
    const emailOf = (x: Row): string => {
      const own = clean(x.email);
      return isEmail(own) ? own : contactOf(x).email;
    };
    /** 這一筆的人有沒有 LINE 可以推 */
    const lineOf = (x: Row): string => (lineToken ? contactOf(x).lineId : '');

    /**
     * ── 一個人只收到一則 ──
     * 分組的 key 是 `line:<userId>` 或 `mail:<信箱>`。實際選哪一條、推不出去要不要
     * 退回 email，都交給共用層的 deliver()——那是六個通知功能共用的同一套規則。
     */
    const channelOf = (x: Row): string => {
      const uid = lineOf(x);
      if (uid) return `line:${uid}`;
      const mail = emailOf(x);
      return mail ? `mail:${mail}` : '';
    };

    const sendable = fresh.filter(x => channelOf(x) !== '');
    if (sendable.length === 0) {
      // 不是失敗：這幾筆就是沒有信箱也沒有 LINE。後台要據實顯示，不要假裝寄出去了
      res.status(200).json({ ok: true, skipped: 'no-channel', 無法通知: fresh.length });
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
        const c = await fetch(`${supabaseUrl}/rest/v1/blessing_events?select=id,title,fee&id=in.(${idsNeeded.join(',')})`, { headers: svc });
        const list: Row[] = c.ok ? await c.json().catch(() => []) : [];
        (Array.isArray(list) ? list : []).forEach(x =>
          ctx.event.set(x.id, { title: clean(x.title), fee: Number(x.fee ?? 0) }));
      }
    }


    // 廟方的電話、地址（site_settings，後台可改——不要在這裡寫死）
    const info = await siteSettings(env, [
      'info_address', 'info_phone',
      ...(payinfo ? ['bank_name', 'bank_code', 'bank_branch', 'bank_account', 'bank_holder'] : []),
    ]);
    // 匯款帳號一律來自 site_settings，程式裡不留第二份（後台改帳號不必重新部署）
    const bank = payinfo ? bankLines(info) : [];

    const bodyOf = (rows: Row[]): string[] => {
      /**
       * 稱呼誰。**不可以一律用第一筆的姓名**：會員替父母點燈時，那幾筆的姓名是
       * 父母的，信卻是寄給會員的——開頭變成「王媽媽 您好」寄到兒子的信箱。
       * 標記「本人」的那一筆才是填表的人（四個表單的第一張卡預設就是本人）；
       * 沒有本人、姓名又不只一個時就不稱名，讓下面的名單自己說話。
       */
      const 本人 = rows.find(x => clean(x.contact_label) === '本人');
      const 姓名集 = new Set(rows.map(x => clean(x.name)));
      const 稱呼 = 本人 ? clean(本人.name) : 姓名集.size === 1 ? clean(rows[0].name) : '';
      return [
        `${稱呼 ? `${稱呼} ` : ''}您好：`,
        '',
        payinfo ? spec.payinfo!.intro(rows.length) : spec.intro(rows.length),
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
        // payinfo 的重點就是帳號；確認信那幾句提醒對它不適用
        ...(payinfo
          ? [...(bank.length ? [...bank, ''] : []),
             '匯款完成後，請於備註或與本壇聯繫時提供帳號後五碼，以利核對。',
             '款項確認後本壇會再通知您。']
          : [...(spec.extra ? [...spec.extra, ''] : []),
             spec.closing ?? '感謝您的護持，願神明庇佑。']),
      ];
    };

    /**
     * email 才有的信尾：邀請入會 ＋ 署名。
     *
     * **LINE 那邊刻意都不要**：
     *  (1) 收得到 LINE 推播就表示他用 LINE 登入過、**本來就是會員**，再邀請一次是雜訊；
     *  (2) 署名與「請勿回覆」在官方帳號的對話框裡沒有意義——他知道是誰傳的，

     *      而且那個對話框本來就可以回覆（會進官方帳號的收件匣）。
     */
    const mailTail = (rows: Row[]): string[] => [
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
       */
      ...(rows.every(x => !contactOf(x).isMember)
        ? ['',
           '想查詢您歷次的紀錄嗎？用 LINE 一按就能加入會員，不必記密碼。',
           '加入時請留同一支電話，過去的報名紀錄會自動出現。',
           MEMBER_URL]
        : []),
      // 署名走共用層的 mailSignature：六個通知功能的信尾只能有一份
      mailSignature(info),
    ];

    /**
     * ── 組成「一個人一則」交給共用層送出 ──
     * 分組、LINE 優先、推不出去退回 email、成功才蓋章，全部在 deliver()／stamp() 裡。
     */
    const groups = new Map<string, Row[]>();
    sendable.forEach(x => {
      const k = channelOf(x);
      groups.set(k, [...(groups.get(k) ?? []), x]);
    });

    const parcels: Parcel[] = [...groups.values()].map(rows => ({
      ids: rows.map(x => x.id),
      contact: contactOf(rows[0]),
      ownEmail: clean(rows[0].email),
      subject: `[和聖壇] ${payinfo ? spec.payinfo!.subject : spec.subject}`,
      body: bodyOf(rows).join('\n'),
      mailTail: mailTail(rows).join('\n'),
    }));

    const { sentIds, results } = await deliver(env, parcels);

    const st = await stamp(env, table, stampCol, sentIds);
    if (!st.ok) {
      // 已經通知出去了，章沒蓋上。據實回報——下一次確認會重送，廟方要知道為什麼
      res.status(200).json({
        ok: true, 已通知: sentIds.length, 結果: results,
        警告: '已經通知出去了，但「已寄送」的紀錄沒寫進資料庫，再次確認時可能重複通知一次。',
        // 最可能的原因就是 registration_email.sql 還沒在 Supabase 跑過
        原因: new RegExp(stampCol).test(st.why ?? '')
          ? '資料表沒有 confirm_sent_at 欄位，請執行 supabase/migrations/registration_email.sql'
          : `資料庫回應：${(st.why ?? '').slice(0, 80)}`,
      });
      return;
    }

    const failed = results.filter(x => x.error).length;
    res.status(failed > 0 && sentIds.length === 0 ? 502 : 200).json({
      ok: sentIds.length > 0,
      已通知: sentIds.length,
      // 分開數，不然看不出 LINE 到底有沒有在運作
      LINE: results.filter(x => x.via === 'line' && !x.error).length,
      信件: results.filter(x => x.via === 'mail' && !x.error).length,
      無法通知: fresh.length - sendable.length,
      已通知過: all.length - fresh.length,
      結果: results,
    });
  } catch (e) {
    console.error('confirm error', e);
    res.status(500).json({ ok: false, error: '寄送確認信失敗' });
  }
}
