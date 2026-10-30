// 產生影片卡的封面 public/<前綴><id>.webp|jpg。
//
// 用法（廟方加影片、或上傳者換了預覽圖時重跑）：
//   cd /tmp && npm i sharp && cd -
//   node scripts/build-shower-covers.js /tmp/node_modules rEZZV5X6VHo Ub9tUWn4Jfw
//   node scripts/build-shower-covers.js /tmp/node_modules --prefix=home-video- --width=1280 UxMaZ5WRrdE
// 第一個參數是 sharp 所在的 node_modules 路徑，後面是 YouTube 的影片 id
// （就是 components/ShowerPage.tsx 的 VIDEOS 裡那一串）。
// `--prefix=` 預設 `shower-video-`；首頁那一支（App.tsx 的 HOME_VIDEO）用 `home-video-`。
// `--width=` 覆寫橫式的輸出寬度，給版面比較寬的卡片用（直式不受影響）。
// **產出的檔名要加進 vite.config.ts 的 HERO_FILES**，否則換圖時網址不變、信眾會拿到舊快取。
// 刻意不寫進 package.json：理由同 scripts/build-icons.js。
//
// ── 為什麼要自己存一份，不直接連 i.ytimg.com ──
// 這一頁的人常常是在進香路上、一格訊號，而影片卡是 facade（按下去才載播放器）。
// 封面若直接連 Google，等於沒按播放也先向他們發一次請求、也被記上一筆；
// 自己存還能決定圖多大、壓多少。代價是上傳者換了預覽圖這邊不會跟著變，重跑這支即可。
//
// ── 直式影片要抓 oardefault ──
// YouTube 對每支影片都生得出 16:9 的 maxresdefault，**直式短片那一張是補過邊的**，
// 拿來當封面會在卡片上出現兩條黑邊。只有 `oardefault.jpg`（original aspect ratio）
// 是原始比例，而且**它只有非 16:9 的影片才有**——所以「抓不抓得到 oardefault」
// 同時就是「這支是不是直式」的判斷依據，不必另外維護一份清單。

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = resolve(ROOT, 'public');

const [, , modulesPath, ...rest] = process.argv;
const flag = (name, fallback) => {
  const hit = rest.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const PREFIX = flag('prefix', 'shower-video-');
/**
 * `--frame=2` 改抓 YouTube **自動從影片擷取的畫面**（`hq1`/`hq2`/`hq3`），
 * 不要上傳者自訂的那張縮圖。
 *
 * 為什麼需要：自訂縮圖是為了在 YouTube 的清單裡搶眼而做的，常常是整片深色
 * 加大字（「十七道光」那支就是黑底白書法）。單獨看很好，但排進我們這一頁的
 * 影片清單裡，旁邊都是粉色與現場照片，那張黑的像破了一個洞
 * （廟方 2026-10-30：「底色不要有黑色版本，正常即可」）。
 *
 * **自動擷取的畫面是 4:3、上下有黑邊**（16:9 的影片被裝進 4:3 的框），
 * 所以下面要裁。1/2/3 分別是影片的 1/4、2/4、3/4 處。
 */
const FRAME = Number(flag('frame', 0)) || 0;
const WIDTH_OVERRIDE = Number(flag('width', 0)) || 0;
const ids = rest.filter(a => !a.startsWith('--'));
if (!modulesPath || ids.length === 0) {
  console.error('用法：node scripts/build-shower-covers.js <sharp 所在的 node_modules 路徑> [--prefix=…] [--width=…] <影片 id>...');
  process.exit(1);
}
// NODE_PATH 對 ESM 的 import 沒有作用，要用 createRequire（CLAUDE.md 記過這條）
const sharp = createRequire(resolve(modulesPath) + '/')('sharp');

// 由好到壞依序試。oardefault 擺第一是為了直式（見檔頭）；
// 16:9 的影片沒有那一張，自然就會落到 maxresdefault。
const CANDIDATES = ['oardefault', 'maxresdefault', 'hq720', 'hqdefault'];

/**
 * 裁掉上下的黑邊（letterbox）。
 *
 * **判斷「整列都很暗」而不是「某幾個像素是黑的」**：畫面本身可能有大片暗部
 * （夜景、深色衣服），但黑邊是**整列從左到右都暗**。所以逐列取平均亮度，
 * 只從最上與最下往內找，碰到第一列不夠暗就停——中間再暗也不碰。
 * 找不到黑邊就原樣回傳，所以對本來就沒有黑邊的圖套用它是安全的。
 */
async function trimBars(sharp, buf) {
  const img = sharp(buf);
  const { width, height } = await img.metadata();
  const raw = await img.clone().greyscale().raw().toBuffer();
  const rowMean = (y) => {
    let s = 0;
    for (let x = 0; x < width; x += 1) s += raw[y * width + x];
    return s / width;
  };
  const DARK = 24;            // 0–255；真正的黑邊壓得很低，24 已經很寬鬆
  let top = 0, bottom = height - 1;
  while (top < height - 1 && rowMean(top) < DARK) top += 1;
  while (bottom > top + 1 && rowMean(bottom) < DARK) bottom -= 1;
  const h = bottom - top + 1;
  if (h >= height) return { buf, trimmed: 0 };
  return {
    buf: await sharp(buf).extract({ left: 0, top, width, height: h }).toBuffer(),
    trimmed: height - h,
  };
}

const WIDTH_LANDSCAPE = 640;   // 卡片在桌機最寬約 490，給 2 倍像素密度
const WIDTH_PORTRAIT = 480;    // 直式卡片上限 240，同樣給 2 倍

async function fetchThumb(id) {
  /**
   * 自動擷取的畫面有三種解析度，**由大到小試**：
   *   `maxres{N}` 1280×720（16:9，不必裁）→ `sd{N}` 640×480 → `hq{N}` 480×360
   * 後兩種是 4:3，16:9 的影片裝進去上下會有黑邊，由 `trimBars()` 裁掉。
   * 不是每支影片三種都有，所以依序試而不是寫死一種。
   */
  const names = FRAME
    ? [`maxres${FRAME}`, `sd${FRAME}`, `hq${FRAME}`, ...CANDIDATES]
    : CANDIDATES;
  for (const name of names) {
    const res = await fetch(`https://i.ytimg.com/vi/${id}/${name}.jpg`);
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    // YouTube 對沒有大圖的影片會回一張 120×90 的灰底佔位圖，別把它當封面用
    if (meta.width < 320) continue;
    return { name, buf, meta };
  }
  throw new Error(`${id}：四種縮圖都抓不到`);
}

for (const id of ids) {
  const got = await fetchThumb(id);
  const { name } = got;
  // 只有自動擷取的畫面需要裁黑邊；自訂縮圖本來就是滿版的
  const { buf, trimmed } = /^(maxres|sd|hq)\d$/.test(name)
    ? await trimBars(sharp, got.buf)
    : { buf: got.buf, trimmed: 0 };
  const meta = trimmed > 0 ? await sharp(buf).metadata() : got.meta;
  const portrait = meta.height > meta.width;
  const width = portrait ? WIDTH_PORTRAIT : (WIDTH_OVERRIDE || WIDTH_LANDSCAPE);
  const base = sharp(buf).resize({ width, withoutEnlargement: true });

  const webp = await base.clone().webp({ quality: 82 }).toBuffer();
  const jpg = await base.clone().jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  writeFileSync(resolve(PUBLIC, `${PREFIX}${id}.webp`), webp);
  writeFileSync(resolve(PUBLIC, `${PREFIX}${id}.jpg`), jpg);

  const out = await sharp(webp).metadata();
  console.log(
    `${id}  ${name} ${meta.width}×${meta.height} → ${out.width}×${out.height}`,
    `${portrait ? '直式' : '橫式'}${trimmed > 0 ? `　裁掉黑邊 ${trimmed}px` : ''}`,
    `webp ${(webp.length / 1024).toFixed(0)}KB / jpg ${(jpg.length / 1024).toFixed(0)}KB`,
  );
}
