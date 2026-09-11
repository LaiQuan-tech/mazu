// 產生首頁的分享卡片圖（public/og-hero.jpg）。
//
// 用法（sharp 不是本專案的相依套件，裝在暫存資料夾跑就好，別寫進 package.json）：
//   mkdir -p /tmp/cut && cd /tmp/cut && npm init -y && npm i sharp
//   node scripts/build-og-hero.js /tmp/cut/node_modules [輸出目錄]
// 第一個參數是 sharp 所在的 node_modules。本專案是 ESM（package.json 的
// type: module），NODE_PATH 對 import 沒作用，所以用 createRequire——
// 與 build-og-scripture.js、build-icons.js 同一個做法。
// 第二個參數可指到暫存目錄先驗收，不給就直接覆蓋 public/。
//
// ── 為什麼要有這支 ──
// og-hero.jpg 的版面必須與網站 Hero 一致，但 Hero 的三尊排法在 2026-09-01～02
// 之間改了三次（並排 → 主神居中 → 前後疊），每次都要手工重合成一張。這支把
// 那個手工流程固定下來：改完 Hero 跑一次就好。
//
// ── DEITIES 的座標怎麼來的 ──
// **不是憑感覺排的，是量出來的**。把瀏覽器視窗設成 1200×630（正好是 og:image
// 的尺寸），開 https://heshengtan.tw/，量三張 <img> 的 getBoundingClientRect()，
// 直接抄進來。這樣卡片與網站首屏是同一個版面，不必自己換算比例。
// Hero 改動後要重量一次——量測片段見本檔最下方註解。
//
// ── 背景為什麼不是單純的 hero-gold ──
// 實測舊卡片上方被壓暗（頂端只保留原色的 0.54，到 y=300 回到 1.0 後持平），
// 那是 Hero 為了讓導覽列看得清楚加的暗化。卡片沿用字標帶素材，若背景不套同一條
// 漸層，接縫會出現明顯色差。這裡不寫死那條曲線，而是**從字標帶自己反推**：
// 同一列上，字標帶的顏色除以金底的顏色就是保留比例。素材換了也不會失準。
import { createRequire } from 'node:module';
import { statSync } from 'node:fs';
import path, { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharpPath = process.argv[2];
if (!sharpPath) {
  console.error('用法：node scripts/build-og-hero.js <sharp 的 node_modules 路徑> [輸出目錄]');
  process.exit(1);
}
const sharp = require(path.join(resolve(sharpPath), 'sharp'));

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const OUT = process.argv[3] ? resolve(process.argv[3]) : PUB;

const W = 1200, H = 630;
const STRIP = 440;            // 字標帶寬度；三尊都在這條線右邊，不會互相干擾
const CLEAN = [300, 430];     // 字標帶裡沒有字的乾淨區間，用來反推暗化比例

// 量自首頁在 1200×630 下的實際渲染（2026-09-02；濟公 2026-09-12 換照片後重量，
// 坐姿帶椅背那張比較寬，只有他的 left 與 w 變了，另外兩尊沒動）。
// draw 是繪製順序＝z-index 由小到大：三媽在最底（廟方要「二媽與濟公站在她面前」，
// 她只露出頭與冠帽），濟公次之，二媽在最前。
const DEITIES = [
  { file: 'hero-sanma',  left: 739, top:  88, w: 343, h: 617 },  // z-1 最底，主神
  { file: 'hero-jigong', left: 618, top: 309, w: 235, h: 359 },  // z-2
  { file: 'hero-erma',   left: 930, top: 227, w: 246, h: 479 },  // z-3 最前
];

const raw = (img) => img.raw().toBuffer({ resolveWithObject: true });

(async () => {
  const gold = await raw(sharp(path.join(PUB, 'hero-gold.jpg')).resize(W, H, { fit: 'cover' }));
  const strip = await raw(sharp(path.join(ROOT, 'scripts/assets/og-hero-wordmark.jpg')));

  // 逐列反推暗化比例（只看 R、G——B 在金色上數值極小，比值不穩）
  const keep = [];
  for (let y = 0; y < H; y++) {
    let sum = 0, n = 0;
    for (let x = CLEAN[0]; x <= CLEAN[1]; x++) {
      const ig = (y * W + x) * gold.info.channels;
      const is = (y * strip.info.width + x) * strip.info.channels;
      for (const k of [0, 1]) {
        if (gold.data[ig + k] > 12) { sum += strip.data[is + k] / gold.data[ig + k]; n++; }
      }
    }
    keep.push(n ? sum / n : 1);
  }

  const bg = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    const r = keep[y];
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * gold.info.channels, o = (y * W + x) * 3;
      for (const k of [0, 1, 2]) bg[o + k] = Math.min(255, Math.round(gold.data[i + k] * r));
    }
  }

  const layers = [{
    input: await sharp(path.join(ROOT, 'scripts/assets/og-hero-wordmark.jpg')).png().toBuffer(),
    left: 0, top: 0,
  }];
  for (const d of DEITIES) {
    // 超出畫布的部分要先裁掉——sharp 的 composite 不接受超界的圖層
    const cutR = Math.max(0, d.left + d.w - W);
    const cutB = Math.max(0, d.top + d.h - H);
    let buf = await sharp(path.join(PUB, d.file + '.png')).resize(d.w, d.h).png().toBuffer();
    if (cutR || cutB) {
      buf = await sharp(buf).extract({ left: 0, top: 0, width: d.w - cutR, height: d.h - cutB }).png().toBuffer();
    }
    layers.push({ input: buf, left: d.left, top: Math.max(0, d.top) });
  }

  const dest = path.join(OUT, 'og-hero.jpg');
  await sharp(bg, { raw: { width: W, height: H, channels: 3 } })
    .composite(layers)
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(dest);

  console.log(`og-hero.jpg  ${W}x${H}  ${(statSync(dest).size / 1024) | 0}KB  →  ${dest}`);
  console.log(`  頂端保留 ${keep[0].toFixed(3)}、y=300 保留 ${keep[300].toFixed(3)}（由字標帶反推）`);
  for (const d of DEITIES) console.log(`  ${d.file.padEnd(12)} x ${d.left}–${d.left + d.w}  y ${d.top}–${d.top + d.h}`);
})();

// ── Hero 改動後怎麼重量 DEITIES ──
// 瀏覽器視窗設成 1200×630，開 https://heshengtan.tw/，執行：
//
//   [...document.querySelectorAll('img')]
//     .filter(i => /hero-(jigong|sanma|erma)/.test(i.currentSrc))
//     .map(i => { const r = i.getBoundingClientRect(); return {
//       file: i.currentSrc.split('/').pop().split('?')[0].replace('.webp',''),
//       left: Math.round(r.left), top: Math.round(r.top),
//       w: Math.round(r.width), h: Math.round(r.height),
//       z: +getComputedStyle(i.parentElement).zIndex }; })
//     .sort((a, b) => a.z - b.z);
//
// 依 z 由小到大排好貼回 DEITIES 即可（陣列順序就是繪製順序）。
// 量之前先強制重繪一次，否則可能量到還沒排版完的值：
//   document.querySelectorAll('.hero-deity').forEach(p => {
//     p.style.display='none'; void p.offsetHeight; p.style.display=''; });
