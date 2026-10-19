// 產生 17 沐浴車（/shower、17bath.org）自己的網站圖示 public/bath-*。
//
// 用法（換品牌圖示時重跑）：
//   cd /tmp && npm i sharp && cd -
//   node scripts/build-bath-icons.js /tmp/node_modules
// 第一個參數是 sharp 所在的 node_modules 路徑。
// 刻意不寫進 package.json：理由同 scripts/build-icons.js（一年跑不到一次的原生套件）。
//
// ── 為什麼不直接用海報 ──
// 沐浴車的海報很漂亮，但 favicon 在分頁上只有 16px——人、車、廟、泡泡縮到那個
// 尺寸會糊成一團粉紅色塊，認不出是什麼。小尺寸下讀得出來的只有「17」兩個數字，
// 所以圖示就是品牌粉紅底＋白色的 17。
//
// ── 為什麼不靠 dominant-baseline 置中 ──
// 第一版用 `dominant-baseline="central"` 排字，librsvg 算出來的位置偏上，
// 16px 那一格裡數字只佔 7 列（44% 高）、底下空一大條。文字的實際墨水範圍
// 跟字型的 em 方框不一樣，**要量了才知道**：這支先把字渲染出來量 alpha 的
// 邊界，再換算成 viewBox 座標的 transform，讓墨水自己置中並吃滿指定的比例。
//
// ── 為什麼 ICO 裡包 PNG ──
// 同 scripts/build-icons.js：ICO 只是容器，現代瀏覽器吃得下內嵌 PNG，
// 一個檔就能塞 16/32/48 三種尺寸讓系統自己挑。
// **每一格都是用該尺寸重新渲染 SVG**，不是把大圖縮下來——16px 那一格要靠
// 向量渲染才有銳利的筆畫。

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = resolve(ROOT, 'public');

const modulesPath = process.argv[2];
if (!modulesPath) {
  console.error('用法：node scripts/build-bath-icons.js <sharp 所在的 node_modules 路徑>');
  process.exit(1);
}
// NODE_PATH 對 ESM 的 import 沒有作用，要用 createRequire（CLAUDE.md 記過這條）
const sharp = createRequire(resolve(modulesPath) + '/')('sharp');

const VB = 512;                 // SVG 的 viewBox 邊長，所有座標都在這個尺度上
const TEXT = '17';
const INK_H = 0.62;             // 墨水高度佔整張圖的比例
const INK_W_MAX = 0.80;         // 寬度上限（數字太寬時改由寬度決定縮放）
const FROM = '#B01350';         // 品牌粉紅（取自海報上的車身與志工衣）
const TO   = '#E0457F';
const FONT = 'Helvetica,Arial,sans-serif';

/** 量墨水用的那一版：白字、透明底、不做任何位移 */
const probeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${VB}" height="${VB}" viewBox="0 0 ${VB} ${VB}">
  <text x="${VB / 2}" y="${VB / 2}" fill="#fff" font-family="${FONT}" font-weight="700"
        font-size="300" text-anchor="middle" dominant-baseline="central" letter-spacing="-10">${TEXT}</text>
</svg>`;

/** 回傳墨水在 viewBox 座標裡的邊界 */
async function inkBox() {
  const { data, info } = await sharp(Buffer.from(probeSvg)).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > 40) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error('build-bath-icons: 量不到文字的墨水範圍');
  const sx = VB / info.width, sy = VB / info.height;   // probe 就是 VB 大小，但別假設
  return { x0: x0 * sx, y0: y0 * sy, w: (x1 - x0 + 1) * sx, h: (y1 - y0 + 1) * sy };
}

const box = await inkBox();
// 高度與寬度兩個上限取比較嚴的那一個，數字才不會溢出方框
const k = Math.min((VB * INK_H) / box.h, (VB * INK_W_MAX) / box.w);
// 把墨水的中心搬到畫布中心（先縮放，再平移到位）
const tx = VB / 2 - (box.x0 + box.w / 2) * k;
const ty = VB / 2 - (box.y0 + box.h / 2) * k;

const svg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${VB} ${VB}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${FROM}"/><stop offset="1" stop-color="${TO}"/>
  </linearGradient></defs>
  <rect width="${VB}" height="${VB}" fill="url(#g)"/>
  <g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${k.toFixed(4)})">
    <text x="${VB / 2}" y="${VB / 2}" fill="#fff" font-family="${FONT}" font-weight="700"
          font-size="300" text-anchor="middle" dominant-baseline="central" letter-spacing="-10">${TEXT}</text>
  </g>
</svg>`;

const png = (s) => sharp(Buffer.from(svg(s))).resize(s, s).png().toBuffer();

/** ICO 容器：6 bytes 檔頭 ＋ 每格 16 bytes 目錄 ＋ 各格的 PNG */
function ico(entries) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(entries.length, 4);
  const dir = [];
  let off = 6 + entries.length * 16;
  for (const [size, buf] of entries) {
    const d = Buffer.alloc(16);
    d.writeUInt8(size >= 256 ? 0 : size, 0);
    d.writeUInt8(size >= 256 ? 0 : size, 1);
    d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6);
    d.writeUInt32LE(buf.length, 8); d.writeUInt32LE(off, 12);
    dir.push(d); off += buf.length;
  }
  return Buffer.concat([head, ...dir, ...entries.map((e) => e[1])]);
}

const bufs = {};
for (const s of [16, 32, 48, 96, 180]) bufs[s] = await png(s);

writeFileSync(resolve(PUBLIC, 'bath-favicon.ico'), ico([[16, bufs[16]], [32, bufs[32]], [48, bufs[48]]]));
writeFileSync(resolve(PUBLIC, 'bath-favicon-32.png'), bufs[32]);
// 96×96 是給 Google 搜尋結果用的（只採用 48 的倍數，見 index.html 的註解）
writeFileSync(resolve(PUBLIC, 'bath-icon-96.png'), bufs[96]);
writeFileSync(resolve(PUBLIC, 'bath-apple-touch-icon.png'), bufs[180]);

console.log(`墨水 ${box.w.toFixed(0)}×${box.h.toFixed(0)} → 縮放 ${k.toFixed(3)}、位移 (${tx.toFixed(0)}, ${ty.toFixed(0)})`);
console.log('產出：bath-favicon.ico bath-favicon-32.png bath-icon-96.png bath-apple-touch-icon.png');
