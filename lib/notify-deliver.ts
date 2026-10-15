/**
 * 通知信眾的共用層：找到人、選管道、送出去
 *
 * ── 為什麼抽出來 ──
 * 廟方 2026-10-16 一口氣要了六個通知功能（確認信、匯款資訊、未匯款提醒、
 * 問事前一天提醒、點燈到期、年度捐獻明細）。每一個都要做同樣三件事：
 * 拿電話去對會員帳號找信箱與 LINE、依收件人分組、LINE 優先 email 墊底。
 * 複製到每個端點就是今天才修過的那種錯——祈福金額的算法有三份複製品，
 * 其中兩份同時漏掉同一件事，漏了三個月沒人發現。一份就好。
 *
 * ── 為什麼放在 repo 根目錄的 `lib/` 而不是 `api/_lib/` ──
 * 2026-10-16 第一版放在 `api/_lib/deliver.ts`，結果**四支 import 它的端點
 * 全部 FUNCTION_INVOCATION_FAILED**（連原本正常的 notify-confirm 也掛了），
 * 而沒 import 它的 keepalive／republish／notify-registration 都還活著。
 * `_` 開頭不當成路由那個慣例是 Next.js 的；這種「裸 api/ 目錄」的專案，
 * Vercel 會把 `api/` 底下**每一個檔**都當成函式入口，而這個檔沒有 default export。
 * **共用模組要放在 `api/` 之外**，由各端點用相對路徑 import，Vercel 打包時會帶上。
 *
 * ── 為什麼不直接用前端的 services/ ──
 * 那些模組會把 supabase client 整包拉進無伺服器函式。這裡一律用 REST 直打，
 * 配 service role key（報名表的 RLS 不讓一般角色讀）。
 */

export type Row = Record<string, any>;

export const clean = (v: unknown): string => String(v ?? '').trim();

/** 看起來像信箱就好。擋的是空字串與明顯的垃圾，不做嚴格驗證（擋太嚴只會讓該寄的沒寄） */
export const isEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/** Resend 的錯誤訊息，遮掉信箱後截短——這些回應可能被回給公開端點的呼叫者 */
export const resendReason = (detail: string): string => {
  let msg = detail;
  try {
    const j = JSON.parse(detail) as { message?: string; name?: string };
    msg = String(j.message || j.name || detail);
  } catch { /* 不是 JSON 就用原文 */ }
  return msg.replace(/[\w.+-]+@[\w.-]+\.[\w.-]+/g, '***@***').slice(0, 300);
};

/** 伺服器端的設定，一次讀齊。缺的那幾項由呼叫端決定要不要繼續 */
export interface Env {
  supabaseUrl: string; anonKey: string; serviceKey: string;
  resendKey: string; from: string; lineToken: string;
}

export const readEnv = (): Env => ({
  supabaseUrl: process.env.VITE_SUPABASE_URL ?? '',
  anonKey:     process.env.VITE_SUPABASE_ANON_KEY ?? '',
  serviceKey:  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  resendKey:   process.env.RESEND_API_KEY ?? '',
  from:        process.env.NOTIFY_FROM || '和聖壇 <noreply@heshengtan.tw>',
  lineToken:   process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
});

export const svcHeaders = (env: Env) => ({ apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}` });

/**
 * `in.(…)` 的值。**逗號是 PostgREST 的分隔符**，整串丟進 encodeURIComponent
 * 會把它變成 %2C、於是「兩個值」變成「一個含逗號的怪值」，一筆都對不到
 * ——而症狀只是「信沒寄」，從外面看不出是這裡。要逐個值編碼再用逗號串。
 */
export const inList = (values: string[]): string =>
  values.map(v => `"${encodeURIComponent(v.replace(/"/g, ''))}"`).join(',');

/** 只留長得像 UUID 的，括號或逗號混進 `in.(…)` 會把查詢打壞 */
export const uuids = (list: string[]): string[] =>
  [...new Set(list.filter(x => /^[0-9a-f-]{36}$/i.test(x)))];

/** 一個人的聯絡方式 */
export interface Contact { email: string; lineId: string; isMember: boolean }

/**
 * 拿電話去對 `member_profiles`，一次回答三件事：
 *   這個人是不是會員（決定要不要邀他入會）
 *   他的會員帳號信箱（沒自填信箱時的備援）
 *   他的 LINE userId（能不能推播）
 *
 * **LINE userId 存在 `auth.identities`（provider = `custom:line` 的 `sub`），
 * 不必另開欄位。** 拿得到的前提是 Login channel 與官方帳號在同一個 Provider 底下
 * （LINE 的使用者 ID 綁 Provider 不綁 channel，見 CLAUDE.md）。
 *
 * `wantLine` 為 false 時不去翻沒必要的 auth 帳號——已經自填信箱的人不需要備援。
 */
export const lookupContacts = async (
  env: Env, phones: string[], opts: { wantLine: boolean; needEmailFor: Set<string> },
): Promise<Map<string, Contact>> => {
  const out = new Map<string, Contact>();
  const list = [...new Set(phones.map(clean).filter(Boolean))];
  if (list.length === 0) return out;
  const svc = svcHeaders(env);

  const mp = await fetch(
    `${env.supabaseUrl}/rest/v1/member_profiles?select=user_id,phone&phone=in.(${inList(list)})`,
    { headers: svc },
  );
  const profiles: Row[] = mp.ok ? await mp.json().catch(() => []) : [];
  const rows = Array.isArray(profiles) ? profiles : [];
  rows.forEach(p => {
    if (p.phone) out.set(clean(p.phone), { email: '', lineId: '', isMember: true });
  });

  const needAuth = rows.filter(p =>
    p.user_id && p.phone && (opts.wantLine || opts.needEmailFor.has(clean(p.phone))));
  await Promise.all(needAuth.map(async p => {
    try {
      const u = await fetch(`${env.supabaseUrl}/auth/v1/admin/users/${p.user_id}`, { headers: svc });
      if (!u.ok) return;
      const j = await u.json() as {
        email?: string;
        identities?: { provider?: string; id?: string; identity_data?: { sub?: string } }[];
      };
      const key = clean(p.phone);
      const cur = out.get(key) ?? { email: '', lineId: '', isMember: true };
      const e = clean(j.email);
      // LINE 登入的帳號沒有信箱（LINE 不給），查不到不是錯誤
      if (isEmail(e)) cur.email = e;
      const line = (j.identities ?? []).find(i => i.provider === 'custom:line');
      const uid = clean(line?.identity_data?.sub || line?.id);
      if (uid) cur.lineId = uid;
      out.set(key, cur);
    } catch { /* 查不到就當作沒有 */ }
  }));
  return out;
};

/** 寄一封信。成功回 Resend 的信件 id，失敗回遮過的原因 */
export const sendMail = async (
  env: Env, to: string, subject: string, text: string,
): Promise<{ id?: string; error?: string }> => {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.from, to: [to], subject, text }),
  });
  if (!r.ok) {
    const detail = await r.text();
    console.error('mail failed', r.status, detail.slice(0, 300));
    return { error: resendReason(detail) };
  }
  const sent = await r.json().catch(() => ({})) as { id?: string };
  return { id: sent.id };
};

/**
 * 用官方帳號推一則訊息給某個人。
 *
 * **失敗最常見的原因是「他沒加好友或封鎖了」**，那不是壞掉、也不該讓整個請求失敗
 * ——回 ok:false 讓呼叫端退回 email。訊息裡不會有個資，仍然只取前 200 字，
 * 而且不把 userId 回給呼叫端。文字上限 5000 字，截斷只是防呆。
 */
export const pushLine = async (
  env: Env, to: string, text: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.lineToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
    });
    if (r.ok) return { ok: true };
    const detail = (await r.text()).slice(0, 200);
    console.error('line push failed', r.status, detail);
    return { ok: false, error: `LINE 回 ${r.status}：${detail}` };
  } catch (e) {
    console.error('line push error', e);
    return { ok: false, error: 'LINE 推送失敗' };
  }
};

/** 一個收件人要收到的東西 */
export interface Parcel {
  /** 這一則涵蓋哪幾筆（成功之後要蓋章的 id） */
  ids: string[];
  /** 這個人的聯絡方式 */
  contact: Contact;
  /** 自填的信箱（優先於會員帳號的） */
  ownEmail?: string;
  subject: string;
  /** LINE 與 email 共用的本文 */
  body: string;
  /** 只有 email 才加的信尾（署名、入會邀請）——LINE 的對話框不需要 */
  mailTail?: string;
}

export interface DeliverResult {
  sentIds: string[];
  results: { via: 'line' | 'mail'; to: string; id?: string; error?: string; 備註?: string }[];
}

/**
 * 把一批 Parcel 送出去：**LINE 優先、email 墊底、一個人只收到一則**。
 *
 * 兩邊內容一樣，同時送就是同一件事講兩次。LINE 優先是因為本站信眾以長者居多、
 * LINE 他每天在看；**推不出去（沒加好友、封鎖、權杖過期）才退回 email**
 * ——不退的話那個人什麼都收不到，而後台看起來像已經通知了。
 * 退回成功不算 error，但留一句備註，廟方才知道這位信眾的 LINE 是斷的。
 */
export const deliver = async (env: Env, parcels: Parcel[]): Promise<DeliverResult> => {
  const out: DeliverResult = { sentIds: [], results: [] };
  for (const p of parcels) {
    const mail = isEmail(clean(p.ownEmail)) ? clean(p.ownEmail) : p.contact.email;
    const full = p.body + (p.mailTail ?? '');

    if (env.lineToken && p.contact.lineId) {
      const r = await pushLine(env, p.contact.lineId, p.body);
      if (r.ok) {
        out.results.push({ via: 'line', to: 'LINE' });
        out.sentIds.push(...p.ids);
        continue;
      }
      if (!mail) { out.results.push({ via: 'line', to: 'LINE', error: r.error }); continue; }
      const m = await sendMail(env, mail, p.subject, full);
      out.results.push({
        via: 'mail', to: '***@***', id: m.id, error: m.error,
        備註: 'LINE 推不出去（多半是沒加官方帳號好友），已改寄信箱',
      });
      if (!m.error) out.sentIds.push(...p.ids);
      continue;
    }

    if (!mail) { out.results.push({ via: 'mail', to: '***@***', error: '沒有可用的聯絡方式' }); continue; }
    const m = await sendMail(env, mail, p.subject, full);
    out.results.push({ via: 'mail', to: '***@***', id: m.id, error: m.error });
    if (!m.error) out.sentIds.push(...p.ids);
  }
  return out;
};

/**
 * 蓋章：成功的才蓋。
 * **失敗的刻意不蓋**，下次會重試；蓋了的話那個人永遠收不到而且沒人知道。
 */
export const stamp = async (
  env: Env, table: string, column: string, ids: string[],
): Promise<{ ok: boolean; why?: string }> => {
  if (ids.length === 0) return { ok: true };
  const r = await fetch(`${env.supabaseUrl}/rest/v1/${table}?id=in.(${ids.join(',')})`, {
    method: 'PATCH',
    headers: { ...svcHeaders(env), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ [column]: new Date().toISOString() }),
  });
  if (r.ok) return { ok: true };
  const why = (await r.text()).slice(0, 200);
  console.error('stamp failed', table, column, r.status, why);
  return { ok: false, why };
};

/** 廟方的匯款資訊與聯絡方式（site_settings，後台可改——不要在程式裡寫死帳號） */
export const siteSettings = async (env: Env, keys: string[]): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  try {
    const r = await fetch(
      `${env.supabaseUrl}/rest/v1/site_settings?select=key,value&key=in.(${keys.join(',')})`,
      { headers: svcHeaders(env) },
    );
    const list: Row[] = r.ok ? await r.json().catch(() => []) : [];
    (Array.isArray(list) ? list : []).forEach(x => out.set(x.key, clean(x.value)));
  } catch { /* 讀不到就讓呼叫端用保底值 */ }
  return out;
};

/** 匯款資訊的文字段落。**帳號一律來自 site_settings**，程式裡不留第二份 */
export const bankLines = (s: Map<string, string>): string[] => {
  const name = s.get('bank_name'), acct = s.get('bank_account');
  if (!name || !acct) return [];
  return [
    '匯款資訊',
    `銀行：${name}${s.get('bank_code') ? `（代碼 ${s.get('bank_code')}）` : ''}`,
    ...(s.get('bank_branch') ? [`分行：${s.get('bank_branch')}`] : []),
    `帳號：${acct}`,
    ...(s.get('bank_holder') ? [`戶名：${s.get('bank_holder')}`] : []),
  ];
};

/** 信尾的署名。LINE 不用——官方帳號的對話框本來就知道是誰傳的、而且可以回覆 */
export const mailSignature = (s: Map<string, string>): string => [
  '',
  '──',
  '和聖壇',
  ...(s.get('info_address') ? [`地址：${s.get('info_address')}`] : []),
  ...(s.get('info_phone')   ? [`電話：${s.get('info_phone')}`]   : []),
  'https://heshengtan.tw',
  '',
  '（本信由系統寄出，請勿直接回覆。）',
].join('\n');
