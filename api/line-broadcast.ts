/**
 * 把一則公佈欄公告群發到 LINE 官方帳號的所有好友
 *
 * 廟方 2026-10-16 要的六項之一（起因是更早的「要在祈福管理上架一次，又要在
 * 公布欄上架一次，有沒有辦法不要做二次工」）。
 *
 * ── 這支與其他通知完全不同：它是「對所有人」且「收不回來」且「要算錢」 ──
 * 其餘的通知都是寄給特定的報名人，寄錯最多是一個人收到不相干的信。
 * 群發是送到官方帳號的**每一位好友**，送出去就撤不回，而且每一位都算一則
 * 訊息配額（超過方案的量要付費）。所以這裡的防護比別支都嚴：
 *   只有管理員（帶後台的 Supabase token）
 *   一則公告只能群發一次（`broadcast_at` 蓋章；要再發必須先在資料庫清掉）
 *   公告必須是「已發佈」狀態，草稿不給發
 *   內容由後端自己去資料庫撈，前端只送 id——同 notify-registration 的理由，
 *   讓前端送內容等於把這支變成「誰都能叫它對所有好友發任意文字」
 *
 * ── 為什麼不做「自動同步」 ──
 * 廟方在官方帳號後台本來就能群發，而且那邊的圖文訊息編輯器比這裡好用。
 * 這支省下的只是「同一件事貼兩次」，不是「做不到」。所以是一顆**要人按**的鈕，
 * 不是上架就自動發——自動發等於每改一次錯字就打擾所有好友一次。
 */
import { type Row, clean, readEnv, svcHeaders, stamp } from './_lib/deliver';

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

/** LINE 的文字訊息上限 5000 字；留一點餘裕給結尾的連結 */
const TEXT_LIMIT = 4500;

export default async function handler(req: ReqLike, res: ResLike): Promise<void> {
  const env = readEnv();

  if ((req.method || 'GET').toUpperCase() === 'GET') {
    // 自我檢查：只回「設了沒」。順便讓後台知道這個功能能不能用
    res.status(200).json({
      ok: true,
      設定狀態: { LINE_CHANNEL_ACCESS_TOKEN: !!env.lineToken, SUPABASE_SERVICE_ROLE_KEY: !!env.serviceKey },
      就緒: !!(env.lineToken && env.serviceKey && env.supabaseUrl),
      說明: '把一則公告群發給官方帳號的所有好友。只有管理員可以呼叫，一則只能發一次。',
    });
    return;
  }
  if ((req.method || 'GET').toUpperCase() !== 'POST') {
    res.status(405).json({ ok: false, error: '只接受 GET（檢查）或 POST（群發）' });
    return;
  }
  if (!env.supabaseUrl || !env.anonKey || !env.serviceKey) {
    res.status(500).json({ ok: false, error: '伺服器未設定 Supabase 環境變數' });
    return;
  }
  if (!env.lineToken) {
    res.status(500).json({ ok: false, error: '伺服器未設定 LINE_CHANNEL_ACCESS_TOKEN' });
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
      res.status(403).json({ ok: false, error: '只有管理員可以群發' });
      return;
    }
  } catch (e) {
    res.status(502).json({ ok: false, error: '無法確認管理員身分：' + (e instanceof Error ? e.message : String(e)) });
    return;
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) as
    { id?: string } | undefined;
  const id = clean(body?.id);
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    res.status(400).json({ ok: false, error: '參數不正確' });
    return;
  }

  const svc = svcHeaders(env);
  try {
    const r = await fetch(
      `${env.supabaseUrl}/rest/v1/bulletins?select=id,title,content,image_url,publish_at,broadcast_at&id=eq.${id}`,
      { headers: svc },
    );
    const list: Row[] = r.ok ? await r.json().catch(() => []) : [];
    const b = Array.isArray(list) ? list[0] : undefined;
    if (!b) { res.status(404).json({ ok: false, error: '查無此公告' }); return; }

    /**
     * 還沒到發佈時間的不給發。`bulletins` 沒有「草稿」旗標，控制可見性的是
     * `publish_at`（null 或已到時間才對外顯示，見 `getBulletins`）——
     * 排程在未來的公告，信眾在網站上還看不到，群發出去就會對不起來。
     */
    const publishAt = clean(b.publish_at);
    if (publishAt && Date.parse(publishAt) > Date.now()) {
      res.status(409).json({
        ok: false, error: '這則公告還沒到發佈時間，信眾在網站上還看不到',
        發佈時間: publishAt,
      });
      return;
    }
    // 發過就不再發。要重發得先在資料庫把 broadcast_at 清掉——刻意做得麻煩
    if (b.broadcast_at) {
      res.status(409).json({
        ok: false, error: '這則公告已經群發過了', 群發時間: b.broadcast_at,
        說明: '群發會送到所有好友並計入訊息配額，所以一則只發一次。真的要重發請聯繫工程師。',
      });
      return;
    }

    const title = clean(b.title);
    const content = clean(b.content);
    const text = [title, '', content].join('\n').slice(0, TEXT_LIMIT)
      + `\n\nhttps://heshengtan.tw/bulletins/${b.id}`;

    /**
     * 有海報就一併送圖。LINE 的 image 訊息要 HTTPS 的 jpeg/png，
     * Supabase storage 的公開網址符合；不符合的就只送文字，不要讓整則發不出去。
     */
    const img = clean(b.image_url);
    const messages: unknown[] = [{ type: 'text', text }];
    if (/^https:\/\/.+\.(jpe?g|png)(\?.*)?$/i.test(img)) {
      messages.unshift({ type: 'image', originalContentUrl: img, previewImageUrl: img });
    }

    const send = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.lineToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    if (!send.ok) {
      const detail = (await send.text()).slice(0, 300);
      console.error('line broadcast failed', send.status, detail);
      res.status(502).json({ ok: false, error: '群發失敗', 原因: `LINE 回 ${send.status}：${detail}` });
      return;
    }

    const st = await stamp(env, 'bulletins', 'broadcast_at', [b.id]);
    res.status(200).json({
      ok: true, 已群發: true, 含圖: messages.length > 1,
      ...(st.ok ? {} : {
        警告: '已經群發出去了，但「已群發」的紀錄沒寫進資料庫，再按一次會重複發送。',
        原因: /broadcast_at/.test(st.why ?? '')
          ? '資料表沒有 broadcast_at 欄位，請執行 supabase/migrations/notify_features_2026_10.sql'
          : (st.why ?? '').slice(0, 80),
      }),
    });
  } catch (e) {
    console.error('broadcast error', e);
    res.status(500).json({ ok: false, error: '群發失敗' });
  }
}
