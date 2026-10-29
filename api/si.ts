/**
 * 圖片代理：把 Supabase Storage 的公開圖片改由我們自己的網域送出。
 *
 * ── 為什麼需要這支 ──
 * 廟方 2026-10-30：「天上聖母經……我目前搜尋一張圖都沒看到。」
 * 查出來不是 SEO 沒做（noscript 有 9 萬字、sitemap 有 136 張圖），
 * 而是 **Supabase Storage 對每一個公開檔案都送 `X-Robots-Tag: none`**
 * ——那等同於 `noindex, nofollow`，Google 抓到之後直接丟掉，
 * 而且不會有任何錯誤訊息（Search Console 只會顯示「已檢索，未建立索引」）。
 * 三種取得方式都一樣：原始檔案、圖片轉換端點、不同 bucket 的圖。
 * 那個標頭是 Supabase 寫死的，我們這邊沒有任何設定可以關掉。
 *
 * 所以唯一的出路是**讓圖片從我們自己的網域送出**，標頭由我們決定。
 *
 * ── 只收路徑，不收網址 ──
 * `p` 是 bucket 內的相對路徑（`scripture/1773431776363.png`），
 * 完整網址在這裡組。**絕對不要讓呼叫端傳整串網址**——那就變成一個
 * 任意網址的代理（SSRF），誰都能拿我們的網域去抓別人的東西。
 * 路徑還要擋掉 `..` 與開頭的 `/`，否則可以跳出 bucket。
 *
 * ── 快取 ──
 * 檔名是上傳時的時間戳，同一個路徑的內容不會變，所以給一年 immutable。
 * （Supabase 原本送的是 `private, no-cache`，等於每一次都重抓。）
 * `s-maxage` 讓 Vercel 的 CDN 也留一份，第二個人起就不會再進到這支函式。
 */

/** 只開放這些 bucket。多一個 bucket 就多一個可以被拿來掃描的面 */
const BUCKETS = new Set(['site-images']);

const BAD_PATH = /(^\/)|(\.\.)|(^https?:)|[\u0000-\u001f]/;

export default async function handler(req: any, res: any): Promise<void> {
  const base = (process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  if (!base) { res.status(500).send('missing VITE_SUPABASE_URL'); return; }

  // Vercel 的 rewrite 會把 /si/<path> 轉成 ?p=<path>
  const raw = req.query?.p;
  const path = Array.isArray(raw) ? raw.join('/') : String(raw ?? '');
  const bucket = String(req.query?.b ?? 'site-images');

  if (!path || BAD_PATH.test(path) || !BUCKETS.has(bucket)) {
    res.status(400).send('bad path');
    return;
  }

  try {
    const upstream = await fetch(
      `${base}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`,
    );
    if (!upstream.ok) {
      // 404 要照實回 404，不要回 200 配一張空白——那會讓壞掉的圖被當成有效內容收錄
      res.status(upstream.status === 404 ? 404 : 502).send('not found');
      return;
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Length', String(buf.length));
    // **這裡刻意不轉送上游的標頭**：要擋掉的正是上游的 X-Robots-Tag: none
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    res.setHeader('X-Robots-Tag', 'all');
    res.status(200).send(buf);
  } catch (e) {
    console.error('si proxy failed:', e);
    res.status(502).send('upstream error');
  }
}
