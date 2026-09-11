import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Hero 神尊圖的版本戳記。
 *
 * ── 為什麼需要 ──
 * 這幾張圖放在 public/，Vite 不會幫它們加指紋，檔名從頭到尾都是 hero-sanma.webp。
 * 廟方換照片時檔名不變，只要有任何一層沒老實照 `must-revalidate` 做
 * （瀏覽器的記憶體快取、CDN、公司 proxy），信眾就會拿到舊圖。
 * 2026-09-02 真的發生過：畫面上同時出現「舊的二媽」與「新的三媽」，
 * 而那兩版剛好是同一尊，看起來就是兩尊一模一樣的神像並排。
 *
 * ── 作法 ──
 * 建置時算每個檔的內容雜湊，注入成 __HERO_V__，App.tsx 把它接在網址後面
 * （`/hero-sanma.webp?v=1a2b3c4d`）。內容一改雜湊就變，等於換了一個網址，
 * 舊快取自然失效——跟 JS bundle 的 index-XXXX.js 是同一個道理。
 * **換圖之後不需要手動改任何版號**，這是刻意的：今天就是因為「要記得改」才出事。
 *
 * index.html 的 preload 由下面那個 plugin 一起補上，兩邊必須是同一個網址，
 * 不然預載的是沒帶版號的那份，等於白預載一次。
 */
// 廟方會換的 Hero 素材。新增檔案就加在這裡，其餘不用動。
const HERO_FILES = [
  'hero-jigong.webp', 'hero-jigong.png',
  'hero-sanma.webp',  'hero-sanma.png',
  'hero-erma.webp',   'hero-erma.png',
  // 兩張背景都要：正式站用金箔牆，?hero=blue 用藍金流體畫（見 App.tsx 的 HERO_VARIANTS）
  'hero-gold.jpg',
  'hero-blue.jpg',
  // 團紋底紋（龍與鳳）。換圖時內容雜湊會變，信眾才不會被舊快取卡住
  'pattern-phoenix.png',
  'pattern-dragon.png',
  // 首頁分享卡。LINE／FB 是拿 og:image 的**網址**當快取鍵，換了圖不換網址，
  // 分享出去永遠是舊卡（2026-09-12 換濟公照片時廟方要求分享卡跟著換）。
  // 注意這只解決「圖的網址」那層：對方也會快取「這個網頁的 og 標籤」，
  // 已經分享過的網址要等它重抓；FB 用 Sharing Debugger 按「重新抓取」，
  // LINE 沒有工具，分享時在網址後面加個 ?v=2 之類就是新網址、會重抓。
  'og-hero.jpg',
];

const heroVersions = (): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const file of HERO_FILES) {
    const full = path.resolve(__dirname, 'public', file);
    if (!fs.existsSync(full)) continue;
    out[file] = crypto.createHash('sha1').update(fs.readFileSync(full)).digest('hex').slice(0, 8);
  }
  return out;
};

/**
 * 把 index.html 裡引用到的這些檔案（preload、og:image、twitter:image、JSON-LD 的 image）
 * 都換成帶版號的網址。清單就是 HERO_FILES：列進去的檔案在 HTML 裡出現就會被補上，
 * 不必另外維護一份「哪些標籤要換」。
 * `(?![?\w])`：已經帶 ?v= 的不重複加；檔名是別的檔名的前綴時不誤中。
 */
const heroPreloadVersion = (versions: Record<string, string>): Plugin => ({
  name: 'hero-preload-version',
  transformIndexHtml(html) {
    const names = Object.keys(versions).map(f => f.replace(/\./g, '\\.')).join('|');
    if (!names) return html;
    return html.replace(new RegExp(`/(${names})(?![?\\w])`, 'g'), (_m, file: string) => `/${file}?v=${versions[file]}`);
  },
});

export default defineConfig(() => {
  const versions = heroVersions();
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    define: {
      __HERO_V__: JSON.stringify(versions),
    },
    plugins: [react(), heroPreloadVersion(versions)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
