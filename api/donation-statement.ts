/**
 * 年度捐獻明細：把某一年的捐獻紀錄整理成一則，寄給每一位捐款人
 *
 * 廟方 2026-10-16 要的六項裡最後那個小的。年底寄一封給捐款人，列出他這一年的
 * 每一筆與合計。資料本來就在，對捐款人是實在的服務（報稅、對帳、留存）。
 *
 * ── 為什麼是「按鈕」不是排程 ──
 * 一年只發一次，而且什麼時候發是廟方的決定（有人會想等年度結算完）。
 * 為了一年一次掛一條排程，等於多一條平常沒人看、壞了也不會發現的路。
 *
 * ── 一個人一則，不是一筆一則 ──
 * 明細的重點就是「整年加起來多少」，一筆一則等於沒有整理過。
 * 依收件人分組，列出每一筆再給合計。
 *
 * ── 合計一律由明細加總 ──
 * 同財務憑證那條原則：加總算得出來的東西不要另外存，一旦與明細對不起來，
 * 就沒有任何方法知道該信哪一個。
 *
 * ── 已寄過的不再寄 ──
 * `statement_sent_at` 蓋章。重複寄一份「今年的捐獻明細」給同一個人，
 * 比沒寄更糟——他會以為自己被重複入帳了。
 */
import {
  type Row, type Parcel, clean, isEmail, readEnv, svcHeaders,
  lookupContacts, deliver, stamp, siteSettings, mailSignature,
} from '../lib/notify-deliver.js';

interface ResLike { status: (c: number) => ResLike; json: (b: unknown) => void }
interface ReqLike {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}

const header = (req: ReqLike, name: string): string => {
  const v = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

/** 一次最多寄幾位。超過的再按一次——寧可分兩批，也不要一口氣打爆配額 */
const MAX_PEOPLE = 80;

export default async function handler(req: ReqLike, res: ResLike): Promise<void> {
  const env = readEnv();

  if ((req.method || 'GET').toUpperCase() === 'GET') {
    res.status(200).json({
      ok: true,
      就緒: !!(env.supabaseUrl && env.serviceKey && env.resendKey),
      說明: '把某一年的捐獻明細寄給每一位捐款人。只有管理員可以呼叫；加 dry=true 只預覽不寄送。',
    });
    return;
  }
  if ((req.method || 'GET').toUpperCase() !== 'POST') {
    res.status(405).json({ ok: false, error: '只接受 GET（檢查）或 POST（寄送）' });
    return;
  }
  if (!env.supabaseUrl || !env.anonKey || !env.serviceKey || !env.resendKey) {
    res.status(500).json({ ok: false, error: '伺服器未設定寄信所需的環境變數' });
    return;
  }

  // ── 授權：只有管理員 ──
  const auth = header(req, 'authorization');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) { res.status(401).json({ ok: false, error: '未登入' }); return; }
  try {
    const check = await fetch(`${env.supabaseUrl}/rest/v1/admin_profiles?select=user_id&limit=1`, {
      headers: { apikey: env.anonKey, Authorization: `Bearer ${token}` },
    });
    if (!check.ok) { res.status(401).json({ ok: false, error: '登入狀態已失效，請重新登入' }); return; }
    const rows = await check.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(403).json({ ok: false, error: '只有管理員可以寄送年度明細' });
      return;
    }
  } catch (e) {
    res.status(502).json({ ok: false, error: '無法確認管理員身分：' + (e instanceof Error ? e.message : String(e)) });
    return;
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) as
    { year?: number | string; dry?: boolean } | undefined;
  const year = Number(body?.year);
  const dry = body?.dry === true;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    res.status(400).json({ ok: false, error: '年份不正確' });
    return;
  }

  const svc = svcHeaders(env);
  try {
    /**
     * 年度區間用**台北時間**的 1/1 00:00 到隔年 1/1 00:00（+08:00）。
     * 用 UTC 切的話，1 月 1 日早上 8 點前的捐款會被算到前一年
     * （同 prerender lastmod 踩過的坑）。
     */
    const from = `${year}-01-01T00:00:00+08:00`;
    const to   = `${year + 1}-01-01T00:00:00+08:00`;
    const r = await fetch(
      `${env.supabaseUrl}/rest/v1/donations`
      + `?select=id,name,phone,email,amount,type,repair_project_name,created_at`
      + `&created_at=gte.${encodeURIComponent(from)}&created_at=lt.${encodeURIComponent(to)}`
      + `&statement_sent_at=is.null&order=created_at.asc&limit=2000`,
      { headers: svc },
    );
    if (!r.ok) { res.status(502).json({ ok: false, error: `讀取捐獻紀錄失敗（${r.status}）` }); return; }
    const all: Row[] = await r.json().catch(() => []);
    const rows = Array.isArray(all) ? all : [];
    if (rows.length === 0) {
      res.status(200).json({ ok: true, skipped: 'nothing', 說明: `${year} 年沒有尚未寄送明細的捐獻紀錄` });
      return;
    }

    const info = await siteSettings(env, ['info_address', 'info_phone']);
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

    const fmtDay = (iso: string) =>
      new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit' })
        .format(new Date(iso));

    const parcels: Parcel[] = [...groups.values()].slice(0, MAX_PEOPLE).map(g => {
      const total = g.reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const names = new Set(g.map(x => clean(x.name)));
      const 稱呼 = names.size === 1 ? clean(g[0].name) : '';
      return {
        ids: g.map(x => x.id),
        contact: contactOf(g[0]),
        ownEmail: clean(g[0].email),
        subject: `[和聖壇] ${year} 年度捐獻明細`,
        body: [
          `${稱呼 ? `${稱呼} ` : ''}您好：`, '',
          `感謝您在 ${year} 年對和聖壇的護持。以下是這一年的捐獻紀錄，共 ${g.length} 筆：`, '',
          ...g.map(x => `・${fmtDay(x.created_at)}　${clean(x.name)}　${clean(x.type)}`
            + `${x.repair_project_name ? `（${clean(x.repair_project_name)}）` : ''}`
            + `　NT$${(Number(x.amount) || 0).toLocaleString()}`),
          // 合計由上面的明細加總，不另外存——存了就可能與明細對不起來
          `　　合計 NT$${total.toLocaleString()}`, '',
          '若與您的紀錄有出入，歡迎與本壇聯繫核對。',
          '願神明庇佑，闔家平安。',
        ].join('\n'),
        mailTail: mailSignature(info),
      };
    });

    if (dry) {
      res.status(200).json({
        ok: true, 模式: '預覽（不寄送）', 年份: year,
        筆數: rows.length, 人數: groups.size, 這次會寄: parcels.length,
        無法通知: rows.length - [...groups.values()].flat().length,
        預覽: parcels.slice(0, 3).map(p => ({ 管道: p.contact.lineId ? 'LINE' : 'email', 內容: p.body })),
      });
      return;
    }

    const { sentIds, results } = await deliver(env, parcels);
    const st = await stamp(env, 'donations', 'statement_sent_at', sentIds);
    res.status(200).json({
      ok: sentIds.length > 0, 年份: year,
      筆數: rows.length, 人數: groups.size, 已寄: results.filter(x => !x.error).length,
      涵蓋筆數: sentIds.length,
      無法通知: rows.length - [...groups.values()].flat().length,
      ...(groups.size > MAX_PEOPLE ? { 提醒: `這次寄了 ${MAX_PEOPLE} 位，還有 ${groups.size - MAX_PEOPLE} 位，請再按一次` } : {}),
      ...(st.ok ? {} : { 警告: '已寄出，但「已寄送」的紀錄沒寫進資料庫，再按一次會重複寄送。', 原因: st.why }),
      結果: results,
    });
  } catch (e) {
    console.error('donation statement error', e);
    res.status(500).json({ ok: false, error: '寄送年度明細失敗' });
  }
}
