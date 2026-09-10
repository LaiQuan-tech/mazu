// 把團鳳紋原圖轉成網站用的底紋（public/pattern-phoenix.png）
//
// 用法（sharp 不是本專案的相依套件，裝在暫存資料夾跑就好，別寫進 package.json）：
//   mkdir -p /tmp/cut && cd /tmp/cut && npm init -y && npm i sharp
//   node scripts/build-phoenix-pattern.js /tmp/cut/node_modules <原圖> [輸出路徑]
// 與 build-og-hero.js、build-og-scripture.js 同一個慣例（ESM 用 createRequire 取套件）。
//
// ── 為什麼是鳳不是龍 ──
// 參考的北港武德宮用團龍紋，但那是財神廟。本壇主祀天上聖母，龍鳳相對、女神配鳳；
// 媽祖受歷代敕封至「天后」，鳳紋正是后妃的紋章。
//
// ── 為什麼不自己用程式畫 ──
// 試過。程序化生成畫得出圓框與雲紋，但畫不出像樣的鳳——尾羽的疏密、翅膀的層次
// 是手繪功夫，盲調貝茲曲線到不了那個水準，淡化之後「構圖偏一邊」也遮不掉。
// 廟方 2026-09-10 提供現成線稿，改成轉換既有的圖。
//
// ── 轉換的作法 ──
// 吃得下三種常見的紋樣素材，模式自動判斷（看整張的平均飽和度）：
//   灰底紅線 / 白底黑線   → 亮度模式：alpha = 這個像素比背景暗多少
//   彩色紋樣 + 中性背景   → 飽和度模式：alpha = 這個像素有多鮮豔
//
// **飽和度模式是為了棋盤格**：從去背預覽截下來的圖，那層灰白格子是真的像素。
// 用亮度抽會把格子一起帶進成品；但格子是純灰階、紋樣是飽和色，用飽和度一刀
// 就分乾淨（實測橘龍那張：龍 rgb(240,120,24)、格子 rgb(240,240,240)）。
//
// 兩種模式共通：**不要用二值化的色鍵**。線很細，硬切會讓邊緣鋸齒化，
// 淡化之後整張看起來髒髒的；要保留去鋸齒的中間值。
// 顏色一律換成 temple-gold #C49820。
// 濃淡不寫進圖裡，交給 CSS 的 opacity（見 index.css 的 .pattern-phoenix）——
// 想調淡一點不必重跑這支腳本。
import { createRequire } from 'node:module';
import { statSync } from 'node:fs';
import path, { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const [sharpPath, srcArg, outArg] = process.argv.slice(2);
if (!sharpPath || !srcArg) {
  console.error('用法：node scripts/build-phoenix-pattern.js <sharp 的 node_modules 路徑> <原圖> [輸出路徑]');
  process.exit(1);
}
const sharp = require(path.join(resolve(sharpPath), 'sharp'));

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(srcArg);
const OUT = outArg ? resolve(outArg) : path.join(ROOT, 'public/pattern-phoenix.png');

/** 網站主色。原圖是紅的，跟全站的廟紅＋金配色打架 */
const INK = [0xc4, 0x98, 0x20];
/**
 * 輸出邊長的上限。底紋最大鋪到 490px，880 給 2x 螢幕足夠餘裕。
 * **實際尺寸不會超過原圖**：放大只是把模糊的東西變大，徒增檔案體積。
 * 下限 520 是顯示尺寸的 1.06 倍，再小就看得出鋸齒。
 */
const MAX_SIZE = 880;
const MIN_SIZE = 520;

(async () => {
  const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: ch } = info;

  const lum = (i) => data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  /** 0（純灰）～1（最鮮豔）。用 max-min 而不是 HSL 的 S：後者在很暗處會爆衝 */
  const sat = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b);
    return mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx;
  };

  // ── 模式判斷：整張的平均飽和度夠高就是彩色紋樣 ──
  // 線稿類的素材（黑線、紅線）平均飽和度很低，因為絕大多數面積是中性的留白。
  let satSum = 0, satN = 0;
  for (let i = 0; i < data.length; i += ch) { const s = sat(i); if (s > 0.35) satN++; satSum += s; }
  const COLOUR_MODE = satN / (W * H) > 0.05;

  // ── 0. 背景亮度：四角各取 12×12 的中位數 ──
  // 素材的留白不一定是純白，而四角幾乎一定是背景。
  const corner = [];
  for (const [ox, oy] of [[0, 0], [W - 12, 0], [0, H - 12], [W - 12, H - 12]]) {
    for (let y = oy; y < oy + 12; y++) for (let x = ox; x < ox + 12; x++) corner.push(lum((y * W + x) * ch));
  }
  corner.sort((a, b) => a - b);
  const bgL = corner[corner.length >> 1];

  // ── 1. 找紋樣的實際範圍 ──
  // 原圖四周有大片留白，直接用整張會讓紋樣在版面上小一圈、位置也難對。
  // 亮度模式的門檻取背景的七成：夠低才不會把去鋸齒的灰邊算成邊界，
  // 夠高才不會漏掉細線。飽和度模式則以「明顯帶色」為界。
  const edge = bgL * 0.7;
  const isInk = (i) => (COLOUR_MODE ? sat(i) > 0.3 : lum(i) < edge);
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isInk((y * W + x) * ch)) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  const pad = 6;
  const bx = Math.max(0, x0 - pad), by = Math.max(0, y0 - pad);
  const bw = Math.min(W - bx, x1 - x0 + 1 + pad * 2);
  const bh = Math.min(H - by, y1 - y0 + 1 + pad * 2);
  // 正方形化：團紋是圓的，長寬不一致會壓扁
  const side = Math.max(bw, bh);
  const sx = Math.max(0, Math.round(bx - (side - bw) / 2));
  const sy = Math.max(0, Math.round(by - (side - bh) / 2));
  const sw = Math.min(side, W - sx), sh = Math.min(side, H - sy);

  // ── 2. 上色 → 金色＋alpha ──
  // 兩種模式各自的動態範圍都取自實際像素，不寫死常數。
  let inkL = 255, maxS = 0;
  for (let i = 0; i < data.length; i += ch) {
    const l = lum(i); if (l < inkL) inkL = l;
    const s = sat(i); if (s > maxS) maxS = s;
  }
  const span = Math.max(1, bgL - inkL);
  const alphaOf = (i) =>
    COLOUR_MODE
      ? Math.max(0, Math.min(1, sat(i) / Math.max(0.01, maxS * 0.9)))
      : Math.max(0, Math.min(1, (bgL - lum(i)) / span));

  const out = Buffer.alloc(sw * sh * 4);
  let inkPx = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = ((y + sy) * W + (x + sx)) * ch;
      const a = alphaOf(i);
      const o = (y * sw + x) * 4;
      out[o] = INK[0]; out[o + 1] = INK[1]; out[o + 2] = INK[2];
      out[o + 3] = Math.round(a * 255);
      if (a > 0.5) inkPx++;
    }
  }

  const SIZE = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.max(sw, sh)));
  await sharp(out, { raw: { width: sw, height: sh, channels: 4 } })
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    // palette：線條只有一個色相、其餘是 alpha 階調，調色盤正好適用。
    // 實測 880px：無調色盤 839KB → palette+quality 80 是 153KB，肉眼看不出差別
    // （這是 opacity 0.05 的背景，就算有輕微色階也看不到）。
    // webp 對這種帶 alpha 的線稿反而更差（436KB），不要換。
    .png({ palette: true, quality: 80, effort: 10, compressionLevel: 9 })
    .toFile(OUT);

  console.log(`紋樣  ${SIZE}x${SIZE}  ${(statSync(OUT).size / 1024) | 0}KB  →  ${OUT}`);
  console.log(`  原圖 ${W}x${H}，裁到 ${sw}x${sh}（紋樣範圍 x ${x0}–${x1} y ${y0}–${y1}）`);
  console.log(`  模式：${COLOUR_MODE ? '飽和度（彩色紋樣，可濾掉棋盤格）' : '亮度（線稿）'}`);
  console.log(COLOUR_MODE
    ? `  最高飽和度 ${maxS.toFixed(2)}`
    : `  背景亮度 ${bgL.toFixed(0)}、線條最深 ${inkL.toFixed(0)} → alpha 跨距 ${span.toFixed(0)}`);
  console.log(`  線條覆蓋率 ${(inkPx / (sw * sh) * 100).toFixed(1)}%（參考站的團龍紋是 16.2%）`);
})();
