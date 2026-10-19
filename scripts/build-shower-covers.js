// 產生 /shower 影片卡的封面 public/shower-video-<id>.webp|jpg。
//
// 用法（廟方加影片、或上傳者換了預覽圖時重跑）：
//   cd /tmp && npm i sharp && cd -
//   node scripts/build-shower-covers.js /tmp/node_modules rEZZV5X6VHo Ub9tUWn4Jfw
// 第一個參數是 sharp 所在的 node_modules 路徑，後面是 YouTube 的影片 id
// （就是 components/ShowerPage.tsx 的 VIDEOS 裡那一串）。
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

const [, , modulesPath, ...ids] = process.argv;
if (!modulesPath || ids.length === 0) {
  console.error('用法：node scripts/build-shower-covers.js <sharp 所在的 node_modules 路徑> <影片 id>...');
  process.exit(1);
}
// NODE_PATH 對 ESM 的 import 沒有作用，要用 createRequire（CLAUDE.md 記過這條）
const sharp = createRequire(resolve(modulesPath) + '/')('sharp');

// 由好到壞依序試。oardefault 擺第一是為了直式（見檔頭）；
// 16:9 的影片沒有那一張，自然就會落到 maxresdefault。
const CANDIDATES = ['oardefault', 'maxresdefault', 'hq720', 'hqdefault'];

const WIDTH_LANDSCAPE = 640;   // 卡片在桌機最寬約 490，給 2 倍像素密度
const WIDTH_PORTRAIT = 480;    // 直式卡片上限 240，同樣給 2 倍

async function fetchThumb(id) {
  for (const name of CANDIDATES) {
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
  const { name, buf, meta } = await fetchThumb(id);
  const portrait = meta.height > meta.width;
  const width = portrait ? WIDTH_PORTRAIT : WIDTH_LANDSCAPE;
  const base = sharp(buf).resize({ width, withoutEnlargement: true });

  const webp = await base.clone().webp({ quality: 82 }).toBuffer();
  const jpg = await base.clone().jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  writeFileSync(resolve(PUBLIC, `shower-video-${id}.webp`), webp);
  writeFileSync(resolve(PUBLIC, `shower-video-${id}.jpg`), jpg);

  const out = await sharp(webp).metadata();
  console.log(
    `${id}  ${name} ${meta.width}×${meta.height} → ${out.width}×${out.height}`,
    `${portrait ? '直式' : '橫式'}`,
    `webp ${(webp.length / 1024).toFixed(0)}KB / jpg ${(jpg.length / 1024).toFixed(0)}KB`,
  );
}
