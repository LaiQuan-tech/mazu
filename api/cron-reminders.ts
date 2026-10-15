/**
 * 每天跑一次的三種提醒：未匯款、問事前一天、點燈到期續點
 *
 * 廟方 2026-10-16 要的六項裡的三項。三種都是「掃一遍資料庫、找出該提醒的人、
 * 每人寄一次、蓋章」，所以合成同一支排程，不要開三個端點。
 *
 * ── 第一次跑的時候最危險 ──
 * 資料庫裡躺著幾個月的舊紀錄。沒有上下限的話，這支一上線就會對著所有歷史資料
 * 發一輪信——那是最糟的第一印象，而且收不回來。所以每一種都有**時間窗**
 * （見各自的 RULES），而且預設支援 `?dry=1` 只看不寄。
 * **上線後請先用 dry 跑一次**，確認筆數合理再讓排程接手。
 *
 * ── 授權 ──
 * 這支會對信眾發信，公開等於「誰都能叫它提早發一輪」。兩種身分擇一：
 *   Vercel Cron：設了 `CRON_SECRET` 之後，Vercel 會自動帶
 *                `Authorization: Bearer <CRON_SECRET>` 來呼叫；
 *   管理員：後台的 token（讓廟方能手動補跑、或用 dry 預覽）。
 * **`CRON_SECRET` 沒設的話排程跑不動**（只剩管理員能手動觸發）——這是刻意的，
 * 寧可功能先不自動跑，也不要留一個誰都能觸發的發信端點。GET 的自我檢查會講。
 *
 * ── 日期一律釘 Asia/Taipei ──
 * Vercel 的機器跑在 UTC。用 UTC 算「明天」，台灣早上 8 點前會整個差一天
 * ——問事提醒就會在錯的日子寄出去（同 prerender 的 lastmod 踩過的坑）。
 */
import {
  type Row, type Parcel, clean, isEmail, readEnv, svcHeaders,
  lookupContacts, deliver, stamp, siteSettings, bankLines, mailSignature,
} from './_lib/deliver';

interface ResLike { status: (c: number) => ResLike; json: (b: unknown) => void }
interface ReqLike {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}

/** 台北時區的「今天」，格式 YYYY-MM-DD */
const today = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());

/** 台北時區的某一天（offset 天後） */
const dayOffset = (days: number): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' })
    .format(new Date(Date.now() + days * 86400000));

const RULES = {
  /** 送出後幾天還沒收到款就提醒一次 */
  未匯款天數: 3,
  /** 只回頭看這麼多天內的報名。**防的是第一次上線對著所有歷史資料發信** */
  未匯款回看天數: 30,
  /** 點燈期滿前幾天提醒續點 */
  到期前幾天: 30,
  /** 一次最多寄幾個人。超過的留到明天——寧可慢一點，也不要一口氣打爆配額 */
  每次上限: 60,
};

const header = (req: ReqLike, name: string): string => {
  const v = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

export default async function handler(req: ReqLike, res: ResLike): Promise<void> {
  const env = readEnv();
  const cronSecret = process.env.CRON_SECRET ?? '';
  const svc = svcHeaders(env);
  const url = String(req.url ?? '');
  const dry = /[?&]dry=1/.test(url);

  const ready = !!(env.supabaseUrl && env.serviceKey && env.resendKey);

  // ── 授權 ──
  const auth = header(req, 'authorization');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  let who = '';
  if (cronSecret && token && token === cronSecret) {
    who = 'cron';
  } else if (token && env.supabaseUrl && env.anonKey) {
    try {
      const check = await fetch(`${env.supabaseUrl}/rest/v1/admin_profiles?select=user_id&limit=1`, {
        headers: { apikey: env.anonKey, Authorization: `Bearer ${token}` },
      });
      const rows = check.ok ? await check.json() : [];
      if (Array.isArray(rows) && rows.length > 0) who = 'admin';
    } catch { /* 下面會擋掉 */ }
  }
  if (!who) {
    res.status(401).json({
      ok: false,
      error: '需要 Vercel Cron 的 CRON_SECRET 或管理員身分',
      設定狀態: { CRON_SECRET: !!cronSecret, 就緒: ready },
      說明: cronSecret
        ? '排程已可運作；手動觸發請帶管理員 token，加 ?dry=1 只預覽不寄送。'
        : '**尚未設定 CRON_SECRET，排程不會自動執行**。請在 Vercel 加這個環境變數（值自訂、夠長即可）並重新部署。',
    });
    return;
  }
  if (!ready) {
    res.status(500).json({ ok: false, error: '伺服器未設定寄信所需的環境變數' });
    return;
  }

  const info = await siteSettings(env, [
    'info_address', 'info_phone',
    'bank_name', 'bank_code', 'bank_branch', 'bank_account', 'bank_holder',
  ]);
  const 署名 = mailSignature(info);
  const 匯款 = bankLines(info);

  /** 查一張表。失敗回空陣列——一種提醒壞掉不該讓另外兩種也不跑 */
  const q = async (path: string): Promise<Row[]> => {
    try {
      const r = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, { headers: svc });
      if (!r.ok) { console.error('cron query failed', path, r.status); return []; }
      const j = await r.json();
      return Array.isArray(j) ? j : [];
    } catch (e) { console.error('cron query error', path, e); return []; }
  };

  /**
   * 把一批「同一種提醒」的紀錄送出去。
   * 依收件人分組（同一個人報了三盞燈只收到一則），交給共用層選管道。
   */
  const send = async (
    table: string, column: string, rows: Row[],
    subject: string, compose: (rows: Row[]) => string[],
  ) => {
    if (rows.length === 0) return { 對象: 0, 已送: 0, 結果: [] as unknown[] };
    const contacts = await lookupContacts(env, rows.map(x => clean(x.phone)), {
      wantLine: !!env.lineToken,
      needEmailFor: new Set(rows.filter(x => !isEmail(clean(x.email))).map(x => clean(x.phone))),
    });
    const contactOf = (x: Row) => contacts.get(clean(x.phone)) ?? { email: '', lineId: '', isMember: false };
    const keyOf = (x: Row) => {
      const c = contactOf(x);
      if (env.lineToken && c.lineId) return `line:${c.lineId}`;
      const mail = isEmail(clean(x.email)) ? clean(x.email) : c.email;
      return mail ? `mail:${mail}` : '';
    };
    const groups = new Map<string, Row[]>();
    rows.filter(x => keyOf(x) !== '').forEach(x => {
      const k = keyOf(x);
      groups.set(k, [...(groups.get(k) ?? []), x]);
    });
    const parcels: Parcel[] = [...groups.values()].slice(0, RULES.每次上限).map(g => ({
      ids: g.map(x => x.id),
      contact: contactOf(g[0]),
      ownEmail: clean(g[0].email),
      subject: `[和聖壇] ${subject}`,
      body: compose(g).join('\n'),
      mailTail: 署名,
    }));
    if (dry) {
      return {
        對象: rows.length, 已送: 0,
        預覽: parcels.map(p => ({ 筆數: p.ids.length, 管道: p.contact.lineId ? 'LINE' : 'email', 內容: p.body })),
      };
    }
    const { sentIds, results } = await deliver(env, parcels);
    const st = await stamp(env, table, column, sentIds);
    return { 對象: rows.length, 已送: sentIds.length, 蓋章: st.ok, ...(st.ok ? {} : { 蓋章失敗: st.why }), 結果: results };
  };

  const 稱呼 = (rows: Row[]) => {
    const 本人 = rows.find(x => clean(x.contact_label) === '本人');
    const names = new Set(rows.map(x => clean(x.name)));
    const n = 本人 ? clean(本人.name) : names.size === 1 ? clean(rows[0].name) : '';
    return `${n ? `${n} ` : ''}您好：`;
  };

  try {
    const out: Record<string, unknown> = { 執行者: who, 日期: today(), ...(dry ? { 模式: '預覽（不寄送）' } : {}) };

    // ── ① 未匯款提醒 ──
    // 只看「送出超過 N 天、但還沒超過回看天數」的，避免第一次上線掃到整段歷史
    {
      const from = dayOffset(-RULES.未匯款回看天數);
      const to   = dayOffset(-RULES.未匯款天數);
      const lamp = await q(`lamp_registrations?select=id,name,phone,email,contact_label,created_at`
        + `&status=eq.${encodeURIComponent('待匯款')}&payment_reminded_at=is.null`
        + `&created_at=gte.${from}&created_at=lte.${to}&limit=200`);
      const bless = await q(`blessing_registrations?select=id,name,phone,email,created_at`
        + `&status=eq.${encodeURIComponent('待匯款')}&payment_reminded_at=is.null`
        + `&created_at=gte.${from}&created_at=lte.${to}&limit=200`);
      const compose = (label: string) => (rows: Row[]) => [
        稱呼(rows), '',
        `提醒您，您在和聖壇的${label}（共 ${rows.length} 筆）尚未收到款項：`, '',
        ...rows.map(x => `・${clean(x.name)}`), '',
        ...(匯款.length ? [...匯款, ''] : []),
        '若您已經匯款，款項入帳需要一些時間，請忽略本則訊息。',
        '如需取消或有任何疑問，歡迎與本壇聯繫。',
      ];
      out['未匯款提醒_點燈'] = await send('lamp_registrations', 'payment_reminded_at', lamp, '點燈登記尚未收到款項', compose('點燈登記'));
      out['未匯款提醒_祈福'] = await send('blessing_registrations', 'payment_reminded_at', bless, '祈福報名尚未收到款項', compose('祈福活動報名'));
    }

    // ── ② 問事前一天提醒 ──
    // 問事是現場收費又佔場次名額，放鳥的成本是實在的
    {
      const tomorrow = dayOffset(1);
      const rows = await q(`bookings?select=id,name,phone,email,contact_label,booking_date,booking_time,type`
        + `&booking_date=eq.${tomorrow}&reminder_sent_at=is.null`
        + `&status=neq.${encodeURIComponent('已取消')}&limit=200`);
      out['問事提醒'] = await send('bookings', 'reminder_sent_at', rows, '明日問事提醒', g => [
        稱呼(g), '',
        `提醒您，明天（${tomorrow}）有向和聖壇預約的問事：`, '',
        ...g.map(x => `・${clean(x.name)}${x.type ? `（${clean(x.type)}）` : ''}　${clean(x.booking_time)}`), '',
        '問事於現場繳費，不需事先匯款。',
        '若需改期或取消，請提前與本壇聯繫，讓名額留給其他信眾。',
      ]);
    }

    // ── ③ 點燈到期續點提醒 ──
    // 點燈是一年一期。沒有提醒等於每年重新招客一次。
    // **只提醒已收款的**：沒付款的那批該收到的是未匯款提醒，不是續點。
    // expires_at 為 NULL 時以「建立日 + 1 年」推算，所以這裡要把兩種情況分開查。
    {
      const from = today();
      const to   = dayOffset(RULES.到期前幾天);
      const 已設到期 = await q(`lamp_registrations?select=id,name,phone,email,contact_label,service_id,expires_at`
        + `&status=eq.${encodeURIComponent('已收款')}&renew_notified_at=is.null`
        + `&expires_at=gte.${from}&expires_at=lte.${to}&limit=200`);
      // 沒設 expires_at 的：換算成「建立日落在一年前的那個區間」
      const 推算 = await q(`lamp_registrations?select=id,name,phone,email,contact_label,service_id,created_at`
        + `&status=eq.${encodeURIComponent('已收款')}&renew_notified_at=is.null&expires_at=is.null`
        + `&created_at=gte.${dayOffset(-365)}&created_at=lte.${dayOffset(-365 + RULES.到期前幾天)}&limit=200`);
      const lampNames = new Map<string, string>();
      const ids = [...new Set([...已設到期, ...推算].map(x => clean(x.service_id)).filter(x => /^[0-9a-f-]{36}$/i.test(x)))];
      if (ids.length > 0) {
        (await q(`lamp_service_configs?select=id,name&id=in.(${ids.join(',')})`))
          .forEach(x => lampNames.set(x.id, clean(x.name)));
      }
      const rows = [...已設到期, ...推算];
      out['點燈到期提醒'] = await send('lamp_registrations', 'renew_notified_at', rows, '點燈即將期滿，歡迎續點', g => [
        稱呼(g), '',
        `您在和聖壇的點燈即將期滿（共 ${g.length} 盞）：`, '',
        ...g.map(x => `・${clean(x.name)}　${lampNames.get(clean(x.service_id)) ?? '點燈'}`), '',
        '點燈為一年一期。若要續點，歡迎至本壇網站重新登記，或與本壇聯繫。',
        'https://heshengtan.tw/lamps',
      ]);
    }

    res.status(200).json({ ok: true, ...out });
  } catch (e) {
    console.error('cron-reminders error', e);
    res.status(500).json({ ok: false, error: '提醒作業失敗' });
  }
}
