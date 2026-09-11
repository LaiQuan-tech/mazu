const sharp = require('sharp');
const D = process.env.HOME + '/Downloads/';

const hsv = (r,g,b) => {
  r/=255; g/=255; b/=255;
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b), d=mx-mn;
  let h=0;
  if (d) {
    if (mx===r) h=60*(((g-b)/d)%6);
    else if (mx===g) h=60*((b-r)/d+2);
    else h=60*((r-g)/d+4);
    if (h<0) h+=360;
  }
  return [h, mx?d/mx:0, mx];
};

/** 從邊界長進來的連通元件 = 背景。predicate 判定「顏色像不像背景」 */
function floodBg(isBgColor, W, H) {
  const bg = new Uint8Array(W*H);
  const st = [];
  const push = i => { if (!bg[i] && isBgColor(i)) { bg[i]=1; st.push(i); } };
  for (let x=0;x<W;x++){ push(x); push((H-1)*W+x); }
  for (let y=0;y<H;y++){ push(y*W); push(y*W+W-1); }
  while (st.length) {
    const i=st.pop(), x=i%W, y=(i/W)|0;
    if (x>0) push(i-1); if (x<W-1) push(i+1);
    if (y>0) push(i-W); if (y<H-1) push(i+W);
  }
  return bg;
}

const erodeMask = (m, W, H, k) => {
  let a = m;
  for (let t=0;t<k;t++) {
    const b = new Uint8Array(a);
    for (let y=1;y<H-1;y++) for (let x=1;x<W-1;x++) { const i=y*W+x;
      if (a[i] && (!a[i-1]||!a[i+1]||!a[i-W]||!a[i+W])) b[i]=0; }
    a = b;
  }
  return a;
};
const dilateMask = (m, W, H, k) => {
  let a = m;
  for (let t=0;t<k;t++) {
    const b = new Uint8Array(a);
    for (let y=1;y<H-1;y++) for (let x=1;x<W-1;x++) { const i=y*W+x;
      if (!a[i] && (a[i-1]||a[i+1]||a[i-W]||a[i+W])) b[i]=1; }
    a = b;
  }
  return a;
};

/** 只留最大的一塊前景，去掉零星殘渣 */
function largestComponent(fg, W, H) {
  const seen = new Uint8Array(W*H);
  let best = null, bestSize = 0;
  for (let s=0;s<W*H;s++) {
    if (!fg[s] || seen[s]) continue;
    const st=[s]; seen[s]=1; const comp=[s];
    while (st.length) {
      const i=st.pop(), x=i%W, y=(i/W)|0;
      const nb=[]; if(x>0)nb.push(i-1); if(x<W-1)nb.push(i+1); if(y>0)nb.push(i-W); if(y<H-1)nb.push(i+W);
      for (const j of nb) if (fg[j] && !seen[j]) { seen[j]=1; st.push(j); comp.push(j); }
    }
    if (comp.length > bestSize) { bestSize = comp.length; best = comp; }
  }
  const out = new Uint8Array(W*H);
  if (best) for (const i of best) out[i]=1;
  return out;
}

async function cutout(src, out, opt) {
  const { pred, neck = 3, erode = 2, feather = 1.0, height = 1500, blur = 2, fgOpen = 0 } = opt;
  const base = () => sharp(src).resize({ height, fit: 'inside' });
  const { data, info } = await base().blur(blur).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const isBg = i => pred(...hsv(data[i*3], data[i*3+1], data[i*3+2]), data[i*3], data[i*3+1], data[i*3+2]);

  let bg = floodBg(isBg, W, H);
  // 斷細頸：把背景侵蝕幾圈，漏進神尊的細長觸手會斷開，再從邊界重長一次就只剩真的背景
  bg = dilateMask(erodeMask(bg, W, H, neck), W, H, neck);
  const bgSeeded = floodBg(i => bg[i] === 1, W, H);

  let fg = new Uint8Array(W*H);
  for (let i=0;i<W*H;i++) fg[i] = bgSeeded[i] ? 0 : 1;
  fg = largestComponent(fg, W, H);

  // 開運算（先侵蝕再膨脹）：把「只靠一條細邊黏在神尊上的殘渣」切斷後丟掉。
  // 黃牆那張的反光亮斑就是這樣黏在冠帽邊上，用顏色門檻切不掉。
  // 最後再與原始前景取交集，膨脹才不會把輪廓吹胖。
  if (fgOpen > 0) {
    const core = largestComponent(erodeMask(fg, W, H, fgOpen), W, H);
    const grown = dilateMask(core, W, H, fgOpen + 1);
    for (let i=0;i<W*H;i++) fg[i] = (fg[i] && grown[i]) ? 1 : 0;
  }
  fg = erodeMask(fg, W, H, erode);

  const a = Buffer.alloc(W*H);
  for (let i=0;i<W*H;i++) a[i] = fg[i] ? 255 : 0;
  // toColourspace('b-w') 不能省：sharp 對單通道 raw 做 blur 之後會自動升成 3 通道 sRGB，
  // 少了這行拿回來的 buffer 長度是 3 倍，之後用 soft[i] 取 alpha 會整片錯位（debug 了很久）
  const soft = await sharp(a, { raw:{width:W,height:H,channels:1} }).blur(feather).toColourspace('b-w').raw().toBuffer();

  const rgb = await base().removeAlpha().raw().toBuffer();
  const rgba = Buffer.alloc(W*H*4);
  for (let i=0;i<W*H;i++) { rgba[i*4]=rgb[i*3]; rgba[i*4+1]=rgb[i*3+1]; rgba[i*4+2]=rgb[i*3+2]; rgba[i*4+3]=soft[i]; }

  // 自己算 bbox，不用 sharp 的 trim——trim 是看 RGB 相似度，
  // 這裡的 RGB 在透明處仍留著原本的背景像素，會被裁到莫名其妙的範圍
  let x0=W, y0=H, x1=-1, y1=-1;
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) if (soft[y*W+x] > 8) {
    if (x<x0)x0=x; if (x>x1)x1=x; if (y<y0)y0=y; if (y>y1)y1=y;
  }
  if (x1 < 0) throw new Error('遮罩全空：' + out);
  await sharp(rgba, { raw:{width:W,height:H,channels:4} })
    .extract({ left:x0, top:y0, width:x1-x0+1, height:y1-y0+1 }).png().toFile(out);
  await sharp(Buffer.from(soft), { raw:{width:W,height:H,channels:1} }).png().toFile(out.replace('.png','-mask.png'));
  console.log(`${out} ${x1-x0+1}x${y1-y0+1} 前景 ${(fg.reduce((s,v)=>s+v,0)/(W*H)*100).toFixed(1)}%`);
}

/**
 * 砍掉底座下方那一條檯面與影子。
 *
 * 神尊放在白色檯面上拍，底座正下方那一圈檯面被影子與木雕的暖光染色
 * （實測 h 175–220、s 0.20–0.25、v 0.55–0.90），不符合「灰背板」的 pred
 * （s<0.18），會跟著底座一起留下來，成品最底下多一條淺灰薄片，疊在金底上很明顯。
 * 放寬 pred 會傷到扇子的銀絲與白色卷軸（同樣是低飽和高亮度），所以改成事後只看底部。
 *
 * 底座本身是有顏色的木雕（實測 s 0.34–0.40、v 0.24–0.29），從最底列往上找到第一列
 * 「整列寬度夠、飽和度夠、夠暗」的地方當底座的底邊，那一列以下全部透明。
 * 只在最後 8% 的高度裡找，找不到就原樣不動（不是每尊都有這個問題）。
 */
async function trimFloor(pngPath) {
  const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const from = Math.floor(H * 0.92);
  const rows = [];
  for (let y = from; y < H; y++) {
    let n = 0, S = 0, V = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] > 128) { n++; const [, s, v] = hsv(data[i], data[i + 1], data[i + 2]); S += s; V += v; }
    }
    rows.push({ y, n, s: n ? S / n : 0, v: n ? V / n : 0 });
  }
  const maxN = Math.max(...rows.map(r => r.n));
  let cut = -1;
  for (let k = rows.length - 1; k >= 0; k--) {
    const r = rows[k];
    if (r.n >= maxN * 0.85 && r.s > 0.30 && r.v < 0.40) { cut = r.y + 1; break; }
  }
  if (cut < 0 || cut >= H) { console.log(`${pngPath} 底部沒有檯面要砍`); return; }
  await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: 0, top: 0, width: W, height: cut }).png().toFile(pngPath);
  console.log(`${pngPath} 砍掉底部 ${H - cut} 列檯面／影子 → ${W}x${cut}`);
}

module.exports = { cutout, trimFloor, hsv };
