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
// 原圖是灰底紅線的點陣圖（實測底 #d0d0d0、線 #c02030，線佔 18.5%）。
//   alpha  由「綠通道離背景多遠」推出來——灰底 g=208、紅線 g=32，中間值就是
//          去鋸齒的邊緣。**不要用二值化的色鍵**：線很細，硬切會讓邊緣鋸齒化，
//          淡化之後整張看起來髒髒的。
//   顏色   一律換成 temple-gold #C49820（原圖的紅與全站配色不合）。
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
/** 輸出邊長。底紋最大會鋪到約 560px，880 有足夠餘裕給 2x 螢幕 */
const SIZE = 880;

(async () => {
  const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: ch } = info;

  // ── 1. 找紋樣的實際範圍 ──
  // 原圖四周有大片留白，直接用整張會讓紋樣在版面上小一圈、位置也難對。
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      if (data[i] - Math.max(data[i + 1], data[i + 2]) > 40) {
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

  // ── 2. 灰底紅線 → 金線＋alpha ──
  // 背景與線條的綠通道各自取自實際像素，換一張原圖也不必改常數。
  let bgG = 0, nbg = 0, inkG = 255;
  for (let i = 0; i < data.length; i += ch) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r - Math.max(g, b) > 40) { if (g < inkG) inkG = g; }
    else { bgG += g; nbg++; }
  }
  bgG = bgG / nbg;
  const span = Math.max(1, bgG - inkG);

  const out = Buffer.alloc(sw * sh * 4);
  let inkPx = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = ((y + sy) * W + (x + sx)) * ch;
      const a = Math.max(0, Math.min(1, (bgG - data[i + 1]) / span));
      const o = (y * sw + x) * 4;
      out[o] = INK[0]; out[o + 1] = INK[1]; out[o + 2] = INK[2];
      out[o + 3] = Math.round(a * 255);
      if (a > 0.5) inkPx++;
    }
  }

  await sharp(out, { raw: { width: sw, height: sh, channels: 4 } })
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    // palette：線條只有一個色相、其餘是 alpha 階調，調色盤正好適用。
    // 實測 880px：無調色盤 839KB → palette+quality 80 是 153KB，肉眼看不出差別
    // （這是 opacity 0.05 的背景，就算有輕微色階也看不到）。
    // webp 對這種帶 alpha 的線稿反而更差（436KB），不要換。
    .png({ palette: true, quality: 80, effort: 10, compressionLevel: 9 })
    .toFile(OUT);

  console.log(`團鳳紋  ${SIZE}x${SIZE}  ${(statSync(OUT).size / 1024) | 0}KB  →  ${OUT}`);
  console.log(`  原圖 ${W}x${H}，裁到 ${sw}x${sh}（紋樣範圍 x ${x0}–${x1} y ${y0}–${y1}）`);
  console.log(`  背景綠通道 ${bgG.toFixed(0)}、線條 ${inkG} → alpha 跨距 ${span.toFixed(0)}`);
  console.log(`  線條覆蓋率 ${(inkPx / (sw * sh) * 100).toFixed(1)}%（參考站的團龍紋是 16.2%）`);
})();
