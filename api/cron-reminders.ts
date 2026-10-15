/**
 * 三種提醒：未匯款、問事前一天、點燈到期續點
 *
 * ── 目前是「手動寄」，沒有排程 ──
 * 廟方 2026-10-16 決定：「手動提醒通知好了，不要自動。」
 * `vercel.json` 的 crons 裡**刻意沒有這一支**，只剩 keepalive。
 * 要改回自動，把 `{ "path": "/api/cron-reminders", "schedule": "0 1 * * *" }`
 * 加回去即可（UTC 01:00 ＝ 台北早上 9 點），程式這邊不必動——
 * CRON_SECRET 那條授權路徑留著就是為了這個。
 *
 * **檔名維持 cron-reminders**：改名要同時動 vercel.json、後台的 fetch 路徑
 * 與這份註解，而名字本身不影響行為；哪天真的改回自動，名字也還是對的。
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
} from '../lib/notify-deliver.js';

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
  /**
   * **刻意沒有「只回看 N 天」的上限**（廟方 2026-10-16 決定）。
   *
   * 原本有 30 天的下限，防的是「第一次上線就對著整段歷史發一輪信」。
   * 但提醒改成手動之後那個風險本來就不在了——廟方按之前看得到完整名單；
   * 而上限換來的是另一個更糟的問題：**久久沒按的話，超過 30 天的人會從名單上
   * 靜靜地消失、從來沒被提醒過**，而且沒有任何地方看得出來。
   *
   * 現在欠款的人會一直留在名單上，直到被提醒或付款為止。
   * 代價是名單可能很長，所以明細**由舊到新排**——最可能該放棄的那幾筆排在最前面，
   * 廟方一眼就看得到「這筆 700 天前的還要提醒嗎」。
   */
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

  /**
   * 查一張表。**失敗要說失敗，不可以回空陣列。**
   *
   * 第一版失敗時回 `[]`，於是「真的沒有人要提醒」與「查詢整個壞掉」在畫面上
   * 長得一模一樣——都是「0 位」。廟方 2026-10-16 按下預覽看到四個 0，問我
   * 「你有把握嗎」，而我沒有：那正是一個看起來很安心、但可能在說謊的數字。
   * 一種提醒壞掉仍然不該讓另外兩種不跑，所以錯誤是「帶著回去」而不是「丟出去」。
   */
  const q = async (path: string): Promise<{ rows: Row[]; error?: string }> => {
    try {
      const r = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, { headers: svc });
      if (!r.ok) {
        const why = (await r.text()).slice(0, 160);
        console.error('cron query failed', path, r.status, why);
        return { rows: [], error: `查詢失敗（${r.status}）：${why}` };
      }
      const j = await r.json();
      return { rows: Array.isArray(j) ? j : [] };
    } catch (e) {
      console.error('cron query error', path, e);
      return { rows: [], error: `查詢失敗：${e instanceof Error ? e.message : String(e)}` };
    }
  };

  /**
   * 只問筆數（母體）。
   * **「0 位」要能分辨是哪一種 0**：沒有人欠款，還是有一堆人欠款但都落在
   * 時間窗之外／都已經提醒過。母體講出來，廟方一眼就看得出是哪一種。
   */
  const countOf = async (path: string): Promise<number | undefined> => {
    try {
      const r = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
        headers: { ...svc, Prefer: 'count=exact', Range: '0-0' },
      });
      if (!r.ok) return undefined;
      const cr = r.headers.get('content-range') ?? '';   // 形如 `0-0/23`
      const n = Number(cr.split('/')[1]);
      return Number.isFinite(n) ? n : undefined;
    } catch { return undefined; }
  };

  /**
   * 把一批「同一種提醒」的紀錄送出去。
   * 依收件人分組（同一個人報了三盞燈只收到一則），交給共用層選管道。
   */
  const send = async (
    table: string, column: string, rows: Row[],
    subject: string, compose: (rows: Row[]) => string[],
  ): Promise<{ 已送: number; 結果: unknown[]; 蓋章失敗?: string }> => {
    if (rows.length === 0) return { 已送: 0, 結果: [] };
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
    // dry 不會走到這裡（report() 先攔掉），所以這支只管真的寄
    const { sentIds, results } = await deliver(env, parcels);
    const st = await stamp(env, table, column, sentIds);
    return { 已送: sentIds.length, 結果: results, ...(st.ok ? {} : { 蓋章失敗: st.why }) };
  };

  const 稱呼 = (rows: Row[]) => {
    const 本人 = rows.find(x => clean(x.contact_label) === '本人');
    const names = new Set(rows.map(x => clean(x.name)));
    const n = 本人 ? clean(本人.name) : names.size === 1 ? clean(rows[0].name) : '';
    return `${n ? `${n} ` : ''}您好：`;
  };

  try {
    const out: Record<string, unknown> = { 執行者: who, 日期: today(), ...(dry ? { 模式: '預覽（不寄送）' } : {}) };

    /** 幾天前（台北日界） */
    const daysAgo = (iso: string): number =>
      Math.floor((Date.now() - Date.parse(iso)) / 86400000);

    /**
     * 一種提醒的完整報告。
     * **三件事缺一不可**：是誰（不是只有數字）、母體（0 位是哪一種 0）、
     * 以及查詢有沒有失敗（失敗就說失敗，不要混在 0 裡）。
     */
    type Report = {
      對象: number;
      母體?: string;
      查詢錯誤?: string;
      明細?: string[];
      已送?: number;
      結果?: unknown;
      蓋章失敗?: string;
    };

    const report = async (
      table: string, column: string, got: { rows: Row[]; error?: string },
      母體: string | undefined, detail: (r: Row) => string,
      subject: string, compose: (rows: Row[]) => string[],
    ): Promise<Report> => {
      if (got.error) return { 對象: 0, 查詢錯誤: got.error, ...(母體 ? { 母體 } : {}) };
      const rep: Report = { 對象: got.rows.length, ...(母體 ? { 母體 } : {}) };
      // 明細一律附上——預覽的重點就是「是誰」，而執行完也該留下寄給了誰
      rep.明細 = got.rows.map(detail);
      if (got.rows.length === 0 || dry) return rep;
      const sent = await send(table, column, got.rows, subject, compose);
      return { ...rep, 已送: sent.已送, 結果: sent.結果, ...(sent.蓋章失敗 ? { 蓋章失敗: sent.蓋章失敗 } : {}) };
    };

    const toDay = dayOffset(-RULES.未匯款天數);
    const 待匯款 = encodeURIComponent('待匯款');
    const 已收款 = encodeURIComponent('已收款');
    const 已取消 = encodeURIComponent('已取消');

    // ── ① 未匯款提醒 ──
    // 只看「送出超過 N 天、但還沒超過回看天數」的，避免第一次上線掃到整段歷史
    {
      const compose = (label: string) => (rows: Row[]) => [
        稱呼(rows), '',
        `提醒您，您在和聖壇的${label}（共 ${rows.length} 筆）尚未收到款項：`, '',
        ...rows.map(x => `・${clean(x.name)}`), '',
        ...(匯款.length ? [...匯款, ''] : []),
        '若您已經匯款，款項入帳需要一些時間，請忽略本則訊息。',
        '如需取消或有任何疑問，歡迎與本壇聯繫。',
      ];
      // 只有「送出滿 N 天」這一個下限；沒有上限（理由見 RULES）。
      // 由舊到新排，最可能該放棄的那幾筆會排在明細最前面
      const 範圍 = `&created_at=lte.${toDay}&order=created_at.asc`;

      const lampAll = await countOf(`lamp_registrations?select=id&status=eq.${待匯款}`);
      const lamp = await q(`lamp_registrations?select=id,name,phone,email,contact_label,service_id,created_at`
        + `&status=eq.${待匯款}&payment_reminded_at=is.null${範圍}&limit=200`);
      // 燈種名稱要查出來，不然明細上只有人名、看不出欠的是哪一盞
      const names = new Map<string, string>();
      const ids = [...new Set(lamp.rows.map(x => clean(x.service_id)).filter(x => /^[0-9a-f-]{36}$/i.test(x)))];
      if (ids.length > 0) {
        (await q(`lamp_service_configs?select=id,name,fee&id=in.(${ids.join(',')})`)).rows
          .forEach(x => names.set(x.id, `${clean(x.name)} NT$${Number(x.fee ?? 0).toLocaleString()}`));
      }
      out['未匯款提醒_點燈'] = await report(
        'lamp_registrations', 'payment_reminded_at', lamp,
        lampAll === undefined ? undefined : `待匯款共 ${lampAll} 筆，其中 ${lamp.rows.length} 筆送出滿 ${RULES.未匯款天數} 天且未提醒過`,
        x => `${clean(x.name)}　${names.get(clean(x.service_id)) ?? '點燈'}　${daysAgo(x.created_at)} 天前`,
        '點燈登記尚未收到款項', compose('點燈登記'));

      const blessAll = await countOf(`blessing_registrations?select=id&status=eq.${待匯款}`);
      const bless = await q(`blessing_registrations?select=id,name,phone,email,event_id,package_fee,selected_addons,created_at`
        + `&status=eq.${待匯款}&payment_reminded_at=is.null${範圍}&limit=200`);
      const events = new Map<string, { title: string; fee: number }>();
      const evIds = [...new Set(bless.rows.map(x => clean(x.event_id)).filter(x => /^[0-9a-f-]{36}$/i.test(x)))];
      if (evIds.length > 0) {
        (await q(`blessing_events?select=id,title,fee&id=in.(${evIds.join(',')})`)).rows
          .forEach(x => events.set(x.id, { title: clean(x.title), fee: Number(x.fee ?? 0) }));
      }
      out['未匯款提醒_祈福'] = await report(
        'blessing_registrations', 'payment_reminded_at', bless,
        blessAll === undefined ? undefined : `待匯款共 ${blessAll} 筆，其中 ${bless.rows.length} 筆送出滿 ${RULES.未匯款天數} 天且未提醒過`,
        x => {
          const ev = events.get(clean(x.event_id));
          // 金額規則與 serviceAmount.ts 一致：方案費優先，沒方案才用活動的統一費用
          const addons: { fee?: number }[] = Array.isArray(x.selected_addons) ? x.selected_addons : [];
          const amt = (Number(x.package_fee ?? ev?.fee ?? 0) || 0)
            + addons.reduce((s, a) => s + (Number(a.fee) || 0), 0);
          return `${clean(x.name)}　${ev?.title ?? '祈福活動'} NT$${amt.toLocaleString()}　${daysAgo(x.created_at)} 天前`;
        },
        '祈福報名尚未收到款項', compose('祈福活動報名'));
    }

    // ── ② 問事前一天提醒 ──
    // 問事是現場收費又佔場次名額，放鳥的成本是實在的
    {
      const tomorrow = dayOffset(1);
      const 場次 = await countOf(`booking_sessions?select=id&session_date=eq.${tomorrow}`);
      const got = await q(`bookings?select=id,name,phone,email,contact_label,booking_date,booking_time,type`
        + `&booking_date=eq.${tomorrow}&reminder_sent_at=is.null&status=neq.${已取消}&limit=200`);
      out['問事提醒'] = await report(
        'bookings', 'reminder_sent_at', got,
        場次 === undefined ? undefined
          : 場次 === 0 ? `${tomorrow} 沒有辦事日場次` : `${tomorrow} 有 ${場次} 個場次`,
        x => `${clean(x.name)}${x.type ? `（${clean(x.type)}）` : ''}　${clean(x.booking_time)}`,
        '明日問事提醒', g => [
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
    // expires_at 為 NULL 時以「建立日 + 1 年」推算，所以要把兩種情況分開查。
    {
      const paidAll = await countOf(`lamp_registrations?select=id&status=eq.${已收款}`);
      const 已設 = await q(`lamp_registrations?select=id,name,phone,email,contact_label,service_id,expires_at`
        + `&status=eq.${已收款}&renew_notified_at=is.null`
        + `&expires_at=gte.${today()}&expires_at=lte.${dayOffset(RULES.到期前幾天)}&limit=200`);
      const 推算 = await q(`lamp_registrations?select=id,name,phone,email,contact_label,service_id,created_at`
        + `&status=eq.${已收款}&renew_notified_at=is.null&expires_at=is.null`
        + `&created_at=gte.${dayOffset(-365)}&created_at=lte.${dayOffset(-365 + RULES.到期前幾天)}&limit=200`);
      const got = {
        rows: [...已設.rows, ...推算.rows],
        error: 已設.error ?? 推算.error,
      };
      const lampNames = new Map<string, string>();
      const ids = [...new Set(got.rows.map(x => clean(x.service_id)).filter(x => /^[0-9a-f-]{36}$/i.test(x)))];
      if (ids.length > 0) {
        (await q(`lamp_service_configs?select=id,name&id=in.(${ids.join(',')})`)).rows
          .forEach(x => lampNames.set(x.id, clean(x.name)));
      }
      out['點燈到期提醒'] = await report(
        'lamp_registrations', 'renew_notified_at', got,
        paidAll === undefined ? undefined
          : `已收款共 ${paidAll} 筆，其中 ${got.rows.length} 筆在 ${RULES.到期前幾天} 天內到期`
            + `（${已設.rows.length} 筆有設到期日、${推算.rows.length} 筆以建立日＋1 年推算）`,
        x => `${clean(x.name)}　${lampNames.get(clean(x.service_id)) ?? '點燈'}`
          + `　${x.expires_at ? `到期 ${String(x.expires_at).slice(0, 10)}` : '推算即將到期'}`,
        '點燈即將期滿，歡迎續點', g => [
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
