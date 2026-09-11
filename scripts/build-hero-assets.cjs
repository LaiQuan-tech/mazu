// Hero 三尊神尊去背 ＋ 產出網頁用檔案
//
// 用法（sharp 不是本專案的相依套件，裝在暫存資料夾跑就好，不要寫進 package.json）：
//   mkdir -p /tmp/cut && cd /tmp/cut && npm init -y && npm i sharp
//   NODE_PATH=/tmp/cut/node_modules node scripts/build-hero-assets.cjs [輸出目錄] [只跑哪一尊]
// 例：只重做濟公、先輸出到暫存目錄看過再覆蓋
//   NODE_PATH=/tmp/cut/node_modules node scripts/build-hero-assets.cjs /tmp/hero-out hero-jigong
//
// **副檔名是 .cjs 不是 .js**：package.json 標了 type: module，副檔名 .js 會被當成
// ESM，頂層的 require 直接 ReferenceError（這支曾經因此完全跑不起來，檔頭寫的
// 用法是失效的，2026-09-02 修正）。改 .cjs 才保得住 CommonJS 語意，
// NODE_PATH 也才對 require 有作用。
//
// 輸出目錄預設是本專案的 public/，可用第一個參數改到別處——
// **驗證改動時務必指定到暫存目錄**，而且**一定要帶第二個參數指定哪一尊**：
// 三媽與二媽現在線上那兩張是廟方直接給的去背圖，不是這支產的，
// 不指定會把全部 JOBS 跑一遍，拿舊照片蓋掉線上的圖。
//
// 換新照片時：改下面 JOBS 的 src 與 pred，跑完直接覆蓋 public/hero-*.webp|png。
// pred 是「這個像素像不像背景」，參數怎麼調見 scripts/cutout-lib.cjs 的說明。
//
// ── 各尊現況 ──
// 濟公：2026-09-12 起是這支產的（原圖 DSC09730.png，灰背板，坐姿持扇那尊；
//   廟方指定換回這張）。三媽、二媽：2026-09-01～02 廟方直接給的去背圖
//   （1875x2500 含 alpha），只裁 alpha 邊界、縮到 1600 高，沒走 cutout。
// 已去背的原圖只要裁邊界＋縮放，別再套 pred。
//
// ── 高度統一 1600 ──
// 三尊的 png 都是 1600 高（神尊本身，不含留白），Hero 的排法是用高度算的，
// 不一樣會讓「臉齊高」的換算失準。cutout 的 height 是整張含留白的畫布高度，
// 所以先以較大的畫布去背，裁掉留白之後再縮到 STATUE_H。
const sharp = require('sharp');
const { cutout, trimFloor } = require('./cutout-lib.cjs');
const D = process.env.HOME + '/Downloads/';
// 寫死絕對路徑換一台機器就壞；改用相對於本檔的位置，並允許用參數覆蓋。
const OUT = (process.argv[2] || require('path').resolve(__dirname, '..', 'public')).replace(/\/*$/, '/');
/** 只跑這一尊（檔名，例 hero-jigong）。不給就全部跑——見檔頭警告 */
const ONLY = process.argv[3];
/** 成品高度（神尊本身）。三尊一致，Hero 的高度換算才成立 */
const STATUE_H = 1600;

// 三尊的去背參數各自不同，因為背景完全是兩回事：
//   三媽（主神，橘袍黑面）拍在黃牆前（牆和橘袍同色系，只能靠飽和度＋過曝亮斑切，
//     寧可留一點牆）。**這個 job 早期叫 hero-erma，因為當時把她誤認成二媽**，
//     檔名已更正為 hero-sanma，pred 參數照舊可用。
//   濟公 拍在灰背板前（低飽和高亮就是背景，好切）——但 public/ 現在那張是
//     2026-09-02 廟方給的正面照，已去背，沒走這裡。
// 二媽（黃袍金冠）不在這裡：2026-09-02 才進 Hero，廟方給的就已去背。
const JOBS = [
  // 黃牆：牆與橘袍是同一個色系（實測牆 h40 s0.99 v0.92、袍緣 h39 s0.98 v0.91，
  // 顏色上根本分不開），只能靠連通性擋。原則是寧可留一點牆——Hero 底就是金色，
  // 殘留的黃看不太出來，少一塊袍子卻很明顯。
  // 反光亮斑那一條要加 s<0.65 才切得掉：不加會連神尊肩後那塊黃布（s0.87 v0.98）一起吃掉。
  { src: 'DSC04874.png',         name: 'hero-sanma',
    pred: (h,s,v) => (h>=20 && h<=55 && v>0.28 && s>0.68) || (v>0.965 && s<0.65),
    neck: 6, erode: 1 },
  // （已退場）hero-mazu：紅袍藍龍紋那尊，2026-09-01 起不在 Hero 上，
  // 留著會產出沒人引用的檔案，所以移出 JOBS。白背板的參數記在這裡備查——
  // 實測背板 s 只有 0.03~0.04、v 0.89~0.97，門檻可以收得非常緊：
  //   pred: (h,s,v) => s < 0.10 && v > 0.72,  neck: 3, erode: 1
  // 之前用 s<0.18 && v>0.55，把神尊身上偏灰白的部位（銀線繡、珍珠、淺色布）一起判成背景。
  // 灰背板：背板是偏藍的灰（h 203~230），神尊整尊是暖色（臉 h42）。
  // 用色相切比用亮度切安全得多——帽尖、扇面、法器都是淺色，用亮度會全部被吃掉。
  // 第二條是給中性灰（飽和度太低時色相不穩）的補漏，門檻抓很緊避免誤傷。
  // 底座下方那條檯面與影子 pred 切不掉（s≈0.2），交給 trimFloor 事後砍，
  // 不要為了它放寬 pred——扇子的銀絲會跟著沒。
  // 畫布 2030：這張原圖上下留白多，神尊只佔畫布高的 80%，要這麼大才夠 1600。
  { src: 'DSC09730.png',         name: 'hero-jigong',
    pred: (h,s,v) => (h>=175 && h<=265 && s<0.18 && v>0.50) || (s<0.04 && v>0.70),
    neck: 3, erode: 1, canvas: 2030, floor: true },
];

(async () => {
  const fs = require('fs');
  const jobs = ONLY ? JOBS.filter(j => j.name === ONLY) : JOBS;
  if (!jobs.length) { console.error(`沒有叫 ${ONLY} 的 job；有：${JOBS.map(j => j.name).join('、')}`); process.exit(1); }
  for (const j of jobs) {
    const tmp = j.name + '-tmp.png';
    // 不用 fgOpen（形態學開運算）：它會刪掉細長的突出物——
    // 濟公手上的法器、帽尖、冠帽流蘇都是那樣被咬掉的。
    await cutout(D + j.src, tmp, { pred: j.pred, neck: j.neck, erode: j.erode, height: j.canvas ?? 1400 });
    if (j.floor) await trimFloor(tmp);
    // 裁掉留白之後才縮到統一高度；cutout 已經裁過 alpha 邊界、trimFloor 只砍底部
    const cut = await sharp(tmp).resize({ height: STATUE_H }).png().toBuffer();
    // WebP 是主要格式；PNG 只是給不支援 WebP 透明的舊 Safari 的後備，壓成調色盤省一半
    // 品質 74 是實測的甜蜜點：神尊在 Hero 最多顯示到 700px 高，再高的品質看不出來只是變胖
    await sharp(cut).webp({ quality: 74, alphaQuality: 82, effort: 6 }).toFile(OUT + j.name + '.webp');
    await sharp(cut).png({ palette: true, colours: 220, compressionLevel: 9 }).toFile(OUT + j.name + '.png');
    const m = await sharp(cut).metadata();
    console.log(`${j.name}  ${m.width}x${m.height}  webp ${(fs.statSync(OUT+j.name+'.webp').size/1024|0)}KB  png ${(fs.statSync(OUT+j.name+'.png').size/1024|0)}KB`);
    fs.unlinkSync(tmp); fs.rmSync(tmp.replace('.png', '-mask.png'), { force: true });
  }
  // 金色底圖：原始檔不一定還在 Downloads，只跑單尊時不碰它
  if (ONLY) return;
  await sharp(D + '新增標題 (3).jpg').jpeg({ quality: 82, mozjpeg: true }).toFile(OUT + 'hero-gold.jpg');
  const gm = await sharp(OUT + 'hero-gold.jpg').metadata();
  console.log(`hero-gold.jpg ${gm.width}x${gm.height} ${(fs.statSync(OUT+'hero-gold.jpg').size/1024|0)}KB`);
})();
