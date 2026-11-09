/**
 * 首頁「影像紀錄」下方那一排 Instagram 最新貼文（2026-11-09 廟方：「和聖壇的 ig
 * ＠heshengtan0318 經營得很好，我想在官網也讓信眾可以看到 ig 的貼文」）。
 *
 * 兩種呼叫：
 *   GET /api/ig          → 最新 4 則的清單（JSON）
 *   GET /api/ig?img=<id> → 那一則的縮圖（圖片本身，由我們的網域送出）
 *
 * ── 為什麼走自己的伺服器，不用 IG 官方的嵌入碼 ──
 * 嵌入碼每一則都是一整塊 IG 的程式與 cookie，四則就會明顯拖慢首頁；而且沒按之前
 * 就先讓每個信眾被 Meta 記上一筆——同 VideoFacade「沒按播放不向 Google 要東西」那條原則。
 * 所以清單與圖片都從這裡出去，**信眾的瀏覽器一個請求都不會發到 IG**。
 *
 * ── 圖片只收 id，不收網址 ──
 * 同 api/si.ts 的理由：收整串網址就是一個任意網址的代理（SSRF）。這裡收 id，
 * 再用我們自己的權杖去問 IG 那一則的圖在哪——問得到就代表那是我們帳號的貼文。
 *
 * ── 權杖 ──
 * Instagram 的長效權杖 60 天過期，可以續期（要滿 24 小時才能續）。
 * 第一次的權杖放 Vercel 的 `IG_ACCESS_TOKEN`（**不加 VITE_ 前綴**，加了會被內嵌進前端 JS）；
 * 之後這支每 7 天自己續一次，新的權杖存進 Supabase 的 `app_secrets`
 * （`supabase/migrations/app_secrets.sql`，只有 service role 讀得到）。
 * 資料表優先、環境變數墊底：那張表還沒建也能用，只是 60 天後會過期。
 *
 * ── 失敗就回空清單 ──
 * 前台拿到空的就整排不畫。IG 是加分的，抓不到不該讓首頁出現破圖或錯誤訊息。
 */

const GRAPH = 'https://graph.instagram.com';
const LIMIT = 4;
/** 多抓幾則：過濾掉不合格的之後還要湊得滿 4 則，手機的 2×2 才不會空一格 */
const FETCH = 8;
/** 幾天續一次權杖。60 天過期，7 天續一次留了很大的餘裕（期間沒人看首頁也沒關係） */
const REFRESH_AFTER_DAYS = 7;
const TOKEN_KEY = 'ig_access_token';

type Token = { value: string; updatedAt: number | null; fromTable: boolean };

const supabaseBase = () => (process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const serviceKey = () => (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

async function readToken(): Promise<Token | null> {
  const base = supabaseBase();
  const key = serviceKey();
  if (base && key) {
    try {
      const r = await fetch(`${base}/rest/v1/app_secrets?key=eq.${TOKEN_KEY}&select=value,updated_at`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (r.ok) {
        const rows = await r.json();
        if (rows[0]?.value) return { value: rows[0].value, updatedAt: Date.parse(rows[0].updated_at), fromTable: true };
      }
      // 表還沒建（404）或其他錯誤：退回環境變數
    } catch { /* 同上 */ }
  }
  const env = (process.env.IG_ACCESS_TOKEN || '').trim();
  return env ? { value: env, updatedAt: null, fromTable: false } : null;
}

/** 續期並寫回資料表。任何一步失敗都不影響這一次的回應，下次再試 */
async function maybeRefresh(token: Token): Promise<void> {
  const stale = token.updatedAt === null
    || Date.now() - token.updatedAt > REFRESH_AFTER_DAYS * 86400e3;
  const base = supabaseBase();
  const key = serviceKey();
  if (!stale || !base || !key) return;
  try {
    const r = await fetch(`${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token.value)}`);
    if (!r.ok) { console.warn('ig refresh failed:', r.status, await r.text()); return; }
    const j = await r.json();
    if (!j.access_token) return;
    await fetch(`${base}/rest/v1/app_secrets?on_conflict=key`, {
      method: 'POST',
      headers: {
        apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ key: TOKEN_KEY, value: j.access_token, updated_at: new Date().toISOString() }),
    });
  } catch (e) {
    console.warn('ig refresh error:', e);
  }
}

/** 貼文說明只留第一行、截短：當圖片的替代文字與滑過去的提示用，不是要在首頁印整篇 */
const shortCaption = (c: unknown): string => {
  const first = String(c ?? '').split('\n').map(s => s.trim()).find(Boolean) ?? '';
  return first.length > 60 ? `${first.slice(0, 60)}…` : first;
};

async function handleImage(id: string, token: Token, res: any): Promise<void> {
  if (!/^\d{5,30}$/.test(id)) { res.status(400).send('bad id'); return; }
  const meta = await fetch(`${GRAPH}/${id}?fields=media_type,media_url,thumbnail_url&access_token=${encodeURIComponent(token.value)}`);
  if (!meta.ok) { res.status(404).send('not found'); return; }
  const m = await meta.json();
  // 影片用封面，其餘（圖片、輪播的第一張）用 media_url
  const src = m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url;
  if (!src) { res.status(404).send('not found'); return; }
  const img = await fetch(src);
  if (!img.ok) { res.status(502).send('upstream error'); return; }
  const buf = Buffer.from(await img.arrayBuffer());
  res.setHeader('Content-Type', img.headers.get('content-type') || 'image/jpeg');
  res.setHeader('Content-Length', String(buf.length));
  // 同一則貼文的圖不會變，CDN 留一天；IG 那邊的原始網址會過期，所以不能只把網址丟給前台
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
  res.status(200).send(buf);
}

export default async function handler(req: any, res: any): Promise<void> {
  const empty = () => {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.status(200).json({ posts: [] });
  };

  const token = await readToken();
  if (!token) { empty(); return; }

  const img = req.query?.img;
  try {
    if (img) { await handleImage(String(img), token, res); return; }

    const r = await fetch(`${GRAPH}/me/media?fields=id,caption,permalink,timestamp,media_type&limit=${FETCH}&access_token=${encodeURIComponent(token.value)}`);
    if (!r.ok) {
      console.warn('ig feed failed:', r.status, await r.text());
      empty();
      return;
    }
    const j = await r.json();
    const ok = (j.data ?? []).map((p: any) => ({
      id: String(p.id),
      permalink: String(p.permalink ?? ''),
      caption: shortCaption(p.caption),
      isVideo: p.media_type === 'VIDEO',
    })).filter((p: { permalink: string }) => p.permalink.startsWith('https://www.instagram.com/'));
    // 取偶數則：手機是兩欄，三則會在第二列空一格（帳號貼文少於 4 則時才會發生）
    const posts = ok.slice(0, ok.length >= LIMIT ? LIMIT : ok.length - (ok.length % 2));

    await maybeRefresh(token);

    // 一小時抓一次；IG 那邊掛了的時候，CDN 繼續送舊的一天，首頁不會突然空掉
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({ posts });
  } catch (e) {
    console.error('ig handler error:', e);
    if (img) res.status(502).send('upstream error'); else empty();
  }
}
