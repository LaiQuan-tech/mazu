import React, { useEffect, useRef, useState } from 'react';

/**
 * 青花墨流（`?hero=sumi`）
 *
 * 效果與 `public/sumi.html` 是**同一套**（廟方 2026-10-20：「動畫用目前的」）。
 * 那一頁是先做出來給廟方定案的獨立展示頁，這一支是把它搬進首頁：
 * 拿掉控制列、畫布改成跟著 Hero 的框而不是整個視窗、座標改成相對於那個框，
 * 其餘的 shader 與參數一個字都沒動。**兩邊要一起改**，不然會各自漂移。
 *
 * 神尊完全沒動：它們是 Hero 既有的 `HERO_DEITIES`（z-10），這一層是 z-0 的底。
 *
 * ── 跑的是什麼 ──
 * suminagashi（墨流し）：墨**浮在水面上被推著跑**，不是滲進紙裡——所以必須真的
 * 算一個速度場（Stable Fluids），疊圖做不出來。每一幀七個 pass：
 *   curl → vorticity（渦度補強）→ divergence → pressure（Jacobi ×20）
 *   → gradientSubtract → advect velocity → advect dye → display
 *
 * ── 五件做出來才知道的事（都在 public/sumi.html 踩過一次）──
 *
 * 1. **一定要 LINEAR。** 不要用 `OES_texture_float_linear` 在不在來決定 LINEAR
 *    還是 NEAREST——那個擴充講的是 32 位元浮點，而 half-float 的線性取樣在
 *    WebGL2 裡是核心功能，本來就有。判斷失誤退到 NEAREST，整片墨會變成馬賽克。
 *
 * 2. **dye 的 alpha 一定要清成 0。** dye 的 a 存的是墨量（預乘模型），清成 1 等於
 *    整張紙一開始就被墨蓋滿、而 rgb 是 0，還原出來是黑的——畫面整片漆黑。
 *
 * 3. **金泥不能用「吸收」算。** 深色紙上的金比紙亮，是顏料蓋上去不是染進去；
 *    Beer–Lambert（紙 × exp(-吸收)）只對「深墨壓淺紙」成立，拿來畫金會越疊越黑。
 *
 * 4. **金要有層次，而且色票是量出來的。** 從 `public/hero-gold.jpg`（首頁原本用的
 *    金箔牆）依亮度取分位平均，那張圖的金由暗到亮是 #D09002 → #DAA505 → #F1D706。
 *    中間那一站釘在官網的 `temple-gold` #C49820。
 *
 * 5. **停下來要自己靜下來，不是被切掉。** 速度場固定低消散時，停止輸入三秒多
 *    速度還剩四成八，這時收掉 rAF 等於把畫面凍結在半途（廟方回報過「很怪」）。
 *    閒置之後把阻力拉高，到收掉迴圈時早就沒有東西在動了。
 *
 * 6. **「減少動態效果」不要整個換成別的效果。** 換掉的話那些人看到的是另一個
 *    長得完全不同的東西，而這支效果本來就只跟著指標動、沒有自己會動的部分。
 *    收斂「手停了還在動」那一段就夠了，見 useEffect 開頭的 `calm`。
 */

const VERT = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
uniform vec2 uTexel;
void main () {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0);
  vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y);
  vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 oColor;
`;

const F_SPLAT_VEL = HEAD + `
uniform sampler2D uTarget; uniform float uAspect; uniform vec2 uPoint;
uniform vec2 uForce; uniform float uRadius;
void main () {
  vec2 p = vUv - uPoint; p.x *= uAspect;
  oColor = vec4(texture(uTarget, vUv).xy + exp(-dot(p, p) / uRadius) * uForce, 0.0, 1.0);
}`;

/** `uRing>0.5` 打的是**環**不是團——那是墨流し的招牌（同心環被水流拉開成大理石紋） */
const F_SPLAT_DYE = HEAD + `
uniform sampler2D uTarget; uniform float uAspect; uniform vec2 uPoint; uniform vec4 uInk;
uniform float uRadius; uniform float uInner; uniform float uRing;
void main () {
  vec2 p = vUv - uPoint; p.x *= uAspect; float d = length(p);
  float g = exp(-dot(p, p) / uRadius);
  float r = exp(-((d - uInner) * (d - uInner)) / uRadius);
  oColor = texture(uTarget, vUv) + uInk * mix(g, r, step(0.5, uRing));
}`;

const F_ADVECT = HEAD + `
uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 uTexelSim;
uniform float uDt; uniform float uDissipation;
void main () {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexelSim;
  oColor = texture(uSource, coord) / (1.0 + uDissipation * uDt);
}`;

const F_DIVERGENCE = HEAD + `
uniform sampler2D uVelocity;
void main () {
  float l = texture(uVelocity, vL).x, r = texture(uVelocity, vR).x;
  float t = texture(uVelocity, vT).y, b = texture(uVelocity, vB).y;
  vec2 c = texture(uVelocity, vUv).xy;
  // 邊界當牆：不這樣做墨會從邊緣流掉，整片慢慢變平
  if (vL.x < 0.0) l = -c.x;
  if (vR.x > 1.0) r = -c.x;
  if (vT.y > 1.0) t = -c.y;
  if (vB.y < 0.0) b = -c.y;
  oColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}`;

const F_CURL = HEAD + `
uniform sampler2D uVelocity;
void main () {
  float l = texture(uVelocity, vL).y, r = texture(uVelocity, vR).y;
  float t = texture(uVelocity, vT).x, b = texture(uVelocity, vB).x;
  oColor = vec4(0.5 * (r - l - t + b), 0.0, 0.0, 1.0);
}`;

const F_VORTICITY = HEAD + `
uniform sampler2D uVelocity; uniform sampler2D uCurl;
uniform float uCurlAmount; uniform float uDt;
void main () {
  float l = texture(uCurl, vL).x, r = texture(uCurl, vR).x;
  float t = texture(uCurl, vT).x, b = texture(uCurl, vB).x, c = texture(uCurl, vUv).x;
  vec2 f = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
  f /= length(f) + 0.0001; f *= uCurlAmount * c; f.y *= -1.0;
  oColor = vec4(clamp(texture(uVelocity, vUv).xy + f * uDt, -1200.0, 1200.0), 0.0, 1.0);
}`;

const F_PRESSURE = HEAD + `
uniform sampler2D uPressure; uniform sampler2D uDivergence;
void main () {
  float l = texture(uPressure, vL).x, r = texture(uPressure, vR).x;
  float t = texture(uPressure, vT).x, b = texture(uPressure, vB).x;
  oColor = vec4((l + r + b + t - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`;

const F_GRADIENT = HEAD + `
uniform sampler2D uPressure; uniform sampler2D uVelocity;
void main () {
  float l = texture(uPressure, vL).x, r = texture(uPressure, vR).x;
  float t = texture(uPressure, vT).x, b = texture(uPressure, vB).x;
  oColor = vec4(texture(uVelocity, vUv).xy - vec2(r - l, t - b), 0.0, 1.0);
}`;

/** 青花紙 ＋ 有層次的泥金。色票與寫法見檔頭第 3、4 點 */
const F_DISPLAY = HEAD + `
uniform sampler2D uDye; uniform vec2 uRes; uniform vec2 uDyeTexel; uniform float uFade;
float hash (vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise (vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main () {
  vec3 base = mix(vec3(0.059, 0.098, 0.180), vec3(0.125, 0.200, 0.361), smoothstep(0.0, 1.0, vUv.y));
  // 纖維：兩個方向都拉長，交錯起來才像手漉的紙。
  // **深色紙上的纖維是「比底亮」的**，照淺紙那樣寫（乘小於一）會變成一條條黑痕。
  float f1 = vnoise(vec2(vUv.x * 180.0, vUv.y * 1400.0));
  float f2 = vnoise(vec2(vUv.x * 1500.0, vUv.y * 140.0));
  float f3 = vnoise(vUv * vec2(60.0, 52.0));
  base *= 1.0 + 0.13 * (f1 - 0.5) + 0.10 * (f2 - 0.5) + 0.09 * (f3 - 0.5);
  base *= 1.0 + 0.040 * (hash(floor(vUv * uRes)) - 0.5);
  float v = length((vUv - 0.5) * vec2(1.0, 0.86));
  base *= 1.0 - 0.30 * smoothstep(0.30, 0.85, v);

  float amt = max(texture(uDye, vUv).a, 0.0);
  // 金泥也吃纖維：紙上有纖維的地方沾得多一點，邊緣才會毛
  float raw = clamp(1.0 - exp(-amt * 4.2 * (1.0 + 0.30 * (f1 + f2 - 1.0))), 0.0, 1.0);
  // **色帶吃 raw、混色吃 cover。** 兩個都吃 cover 的話，退場時色帶會一路走回
  // 最暗那一階，金是「變褐」才消失的——廟方說的「化掉」就是這個。
  // 分開之後金到最後一刻都還是金，只是越來越透。
  float cover = raw * uFade;

  vec3 gDeep = vec3(0.816, 0.565, 0.008);
  vec3 gMid  = vec3(0.769, 0.596, 0.125);
  vec3 gTop  = vec3(0.945, 0.843, 0.180);
  vec3 metal = raw < 0.5 ? mix(gDeep, gMid, raw * 2.0) : mix(gMid, gTop, (raw - 0.5) * 2.0);
  vec3 col = mix(base, metal, cover);

  // 褶子的反光。取樣位移要用 dye 自己的 texel——用畫布的 texel 會因為 dye 解析度
  // 低得多而幾乎取到同一點，梯度等於零、完全沒有效果。
  float aL = texture(uDye, vUv - vec2(uDyeTexel.x, 0.0)).a;
  float aR = texture(uDye, vUv + vec2(uDyeTexel.x, 0.0)).a;
  float aB = texture(uDye, vUv - vec2(0.0, uDyeTexel.y)).a;
  float aT = texture(uDye, vUv + vec2(0.0, uDyeTexel.y)).a;
  vec3 n = normalize(vec3((aR - aL) * 7.0, (aT - aB) * 7.0, 1.0));
  float spec = pow(clamp(dot(n, normalize(vec3(-0.55, 0.62, 0.56))), 0.0, 1.0), 11.0);
  col += vec3(1.0, 0.94, 0.74) * spec * 0.55 * smoothstep(0.04, 0.30, cover);

  oColor = vec4(col, 1.0);
}`;

type FBO = { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number };
type Double = { read: FBO; write: FBO; swap: () => void };
type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

const HeroSuminagashi: React.FC<{ fallback: React.ReactNode }> = ({ fallback }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    /**
     * 「減少動態效果」**不整個退回 2D 那版，改成讓它一停就靜下來**。
     *
     * 原本是直接 `setFailed`，結果開了那個設定的人看到的是 `HeroInkGold`
     * （2D、半解析度、糊的），而 `public/sumi.html` 根本沒有這個判斷——
     * 兩邊因此長得完全不一樣，廟方回報「動畫又回到 320 畫，不是 sumi.html 的效果」。
     * 實測那台機器 `prefers-reduced-motion` 是 true，hero 真的在跑 2D 那版。
     *
     * 而這個效果**沒有任何自己會動的東西**：不自動下墨、不自動流，
     * 完全是跟著使用者自己的指標走的，比較接近 hover 而不是自動播放。
     * 真正該收斂的是「手停了畫面還在動好幾秒」那一段，所以那一段收到半秒內收完，
     * 視覺維持一模一樣。
     */
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /**
     * 手機檔位（廟方 2026-10-20 回報「手機上泥金動畫很卡」）。
     *
     * 一幀要跑二十幾個全螢幕 pass，最貴的兩個是**壓力迭代**（20 次）與
     * **display**（3 次 vnoise ＋ hash ＋ 4 次 dye 取樣，而且是以畫布全解析度跑）。
     * 桌機吃得下，手機吃不下——iPhone dpr 3 被夾到 2 之後畫布還是接近
     * 800×1400，等於每幀一百多萬個 fragment 跑那支很重的 shader。
     *
     * 用 `pointer: coarse` 當判斷：它問的是「這臺機器的指標準不準」，
     * 剛好就是「是不是手機平板」，比抓 UA 可靠也不會隨機型過時。
     * 四個值一起降，單降哪一個都不夠。
     */
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const SIM_N = coarse ? 176 : 256;
    const PRESSURE_ITERS = coarse ? 12 : 20;
    const DPR_CAP = coarse ? 1.3 : 2;
    const DYE_CAP = coarse ? 720 : 1024;
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: false, depth: false, stencil: false, antialias: false, powerPreference: 'low-power',
    });
    // 沒有 WebGL2 或拿不到浮點 render target（舊 iOS 常見）就退回 2D 那版
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) { setFailed(true); return; }

    const sh = (type: number, src: string): WebGLShader | null => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, VERT);
    if (!vs) { setFailed(true); return; }

    const programs: WebGLProgram[] = [];
    const make = (src: string): Prog | null => {
      const f = sh(gl.FRAGMENT_SHADER, src);
      const p = f && gl.createProgram();
      if (!f || !p) return null;
      gl.attachShader(p, vs); gl.attachShader(p, f); gl.linkProgram(p);
      gl.deleteShader(f);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { gl.deleteProgram(p); return null; }
      programs.push(p);
      const u: Record<string, WebGLUniformLocation | null> = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        if (info) u[info.name] = gl.getUniformLocation(p, info.name);
      }
      return { p, u };
    };

    const P = {
      splatVel: make(F_SPLAT_VEL), splatDye: make(F_SPLAT_DYE), advect: make(F_ADVECT),
      divergence: make(F_DIVERGENCE), curl: make(F_CURL), vorticity: make(F_VORTICITY),
      pressure: make(F_PRESSURE), gradient: make(F_GRADIENT), display: make(F_DISPLAY),
    };
    if (Object.values(P).some((v) => !v)) { setFailed(true); return; }

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // 配置過的全部記起來：少了這個，每次重配都是十張新貼圖＋十個 FBO、舊的沒人刪，
    // 手機捲動時網址列一收一放就觸發一次，記憶體一路往上疊。
    let owned: Array<[WebGLTexture, WebGLFramebuffer]> = [];
    const release = () => {
      owned.forEach(([t, f]) => { gl.deleteTexture(t); gl.deleteFramebuffer(f); });
      owned = [];
    };
    const fbo = (w: number, h: number, internal: number, format: number): FBO => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      // **一律 LINEAR**（理由見檔頭第 1 點）
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
      const f = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h);
      // **alpha 要清成 0**（理由見檔頭第 2 點）
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      owned.push([tex, f]);
      return { tex, fbo: f, w, h };
    };
    const makeDouble = (w: number, h: number, internal: number, format: number): Double => {
      let a = fbo(w, h, internal, format);
      let b = fbo(w, h, internal, format);
      return { get read() { return a; }, get write() { return b; }, swap() { const t = a; a = b; b = t; } } as Double;
    };

    const SIM = SIM_N;
    let aspect = 1;
    let gw = 0;
    let gh = 0;
    let velocity!: Double;
    let dye!: Double;
    let divergenceF!: FBO;
    let curlF!: FBO;
    let pressure!: Double;

    const allocate = () => {
      const r = host.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
      const W = Math.max(1, Math.round(r.width * dpr));
      const H = Math.max(1, Math.round(r.height * dpr));
      canvas.width = W; canvas.height = H;
      aspect = Math.max(0.2, W / H);
      const sw = aspect >= 1 ? Math.round(SIM * aspect) : SIM;
      const shh = aspect >= 1 ? SIM : Math.round(SIM / aspect);
      // 格子沒變就不要重配——重配等於把水面清空，畫到一半的墨會憑空消失
      if (sw === gw && shh === gh) return;
      gw = sw; gh = shh;
      // dye 跟著螢幕走、上限 1024。低解析度的 dye 放大就是一格一格的馬賽克。
      const long = Math.min(DYE_CAP, Math.max(640, Math.round(Math.max(W, H) * 0.75)));
      const dw = aspect >= 1 ? long : Math.round(long * aspect);
      const dh = aspect >= 1 ? Math.round(long / aspect) : long;
      release();
      velocity = makeDouble(sw, shh, gl.RG16F, gl.RG);
      dye = makeDouble(dw, dh, gl.RGBA16F, gl.RGBA);
      divergenceF = fbo(sw, shh, gl.R16F, gl.RED);
      curlF = fbo(sw, shh, gl.R16F, gl.RED);
      pressure = makeDouble(sw, shh, gl.R16F, gl.RED);
    };
    allocate();

    const blit = (t: FBO | null) => {
      if (t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.viewport(0, 0, t.w, t.h); }
      else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const bind = (i: number, tex: WebGLTexture) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex); };
    const use = (q: Prog, w: number, h: number) => {
      gl.useProgram(q.p);
      if (q.u.uTexel) gl.uniform2f(q.u.uTexel, 1 / w, 1 / h);
      return q.u;
    };

    // 官網的金 temple-gold #C49820（這是中間那一站，深淺兩端在 display 裡）
    const INK = [196 / 255, 152 / 255, 32 / 255];

    const splat = (x: number, y: number, fx: number, fy: number, amount: number, ring: boolean, inner?: number) => {
      const v = velocity.read;
      let u = use(P.splatVel!, v.w, v.h);
      bind(0, v.tex);
      gl.uniform1i(u.uTarget!, 0); gl.uniform1f(u.uAspect!, aspect);
      gl.uniform2f(u.uPoint!, x, y); gl.uniform2f(u.uForce!, fx, fy);
      gl.uniform1f(u.uRadius!, 0.0012);
      blit(velocity.write); velocity.swap();

      if (amount <= 0) return;
      const d = dye.read;
      u = use(P.splatDye!, d.w, d.h);
      bind(0, d.tex);
      gl.uniform1i(u.uTarget!, 0); gl.uniform1f(u.uAspect!, aspect);
      gl.uniform2f(u.uPoint!, x, y);
      // 預乘：rgb = 顏色×量、a = 量
      gl.uniform4f(u.uInk!, INK[0] * amount, INK[1] * amount, INK[2] * amount, amount);
      gl.uniform1f(u.uRadius!, ring ? 0.00022 : 0.00060);
      gl.uniform1f(u.uInner!, inner !== undefined ? inner : 0.020 + Math.random() * 0.045);
      gl.uniform1f(u.uRing!, ring ? 1 : 0);
      blit(dye.write); dye.swap();
    };

    const clearDye = (): void => {
      for (const f of [dye.read, dye.write]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
        gl.viewport(0, 0, f.w, f.h);
        gl.clearColor(0, 0, 0, 0);          // alpha 一樣要是 0（理由見檔頭第 2 點）
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    };

    const DT = 0.016;
    let lastInput = 0;

    /**
     * 閒置之後把阻力拉高，讓水自己靜下來（理由見檔頭第 5 點）。
     * `calm` 時斜率大得多——實測 D=12 每幀只剩 0.839，半秒就收乾淨，
     * 所以「手停了還在動」那段幾乎不存在，但畫面本身完全一樣。
     */
    const velDissipation = (now: number): number => {
      const idle = (now - lastInput) / 1000;
      if (calm) return idle < 0.05 ? 0.20 : Math.min(12, 0.20 + idle * 14);
      if (idle < 1.2) return 0.20;
      return Math.min(4.0, 0.20 + (idle - 1.2) * 0.9);
    };

    /**
     * 滑鼠停下來之後，金慢慢退掉（廟方 2026-10-20）。
     *
     * **不用 dye 的 dissipation 做這件事。** 那條是 `值 /= (1 + D·dt)`，而畫面看到的是
     * `1 - exp(-濃度 · 4.2)`——濃度掉到剩三成畫面都還是滿的，再掉一點就整片一起崩，
     * 看起來是「斷掉」不是「退掉」。退場要的是可預期的曲線，所以直接給一個係數。
     * 墨本身維持幾乎不退（0.008）：墨流的紋路是留在水面上的。
     *
     * smoothstep 是為了頭尾都不要有硬邊——開始退與退完的那一瞬間都不該看得出來。
     */
    const FADE_HOLD = 1.2;
    const FADE_SECS = 5.0;
    const inkFade = (now: number): number => {
      const idle = (now - lastInput) / 1000;
      if (calm) return Math.max(0, 1 - idle / 0.55);
      if (idle <= FADE_HOLD) return 1;
      const k = Math.min(1, (idle - FADE_HOLD) / FADE_SECS);
      return 1 - k * k * (3 - 2 * k);
    };

    const step = () => {
      const v = velocity.read;
      let u = use(P.curl!, v.w, v.h);
      bind(0, v.tex); gl.uniform1i(u.uVelocity!, 0); blit(curlF);

      u = use(P.vorticity!, v.w, v.h);
      bind(0, velocity.read.tex); bind(1, curlF.tex);
      gl.uniform1i(u.uVelocity!, 0); gl.uniform1i(u.uCurl!, 1);
      gl.uniform1f(u.uCurlAmount!, 30); gl.uniform1f(u.uDt!, DT);
      blit(velocity.write); velocity.swap();

      u = use(P.divergence!, v.w, v.h);
      bind(0, velocity.read.tex); gl.uniform1i(u.uVelocity!, 0); blit(divergenceF);

      // 壓力場不清零：上一幀的解是這一幀很好的起點，疊代次數可以省一半
      for (let i = 0; i < PRESSURE_ITERS; i++) {
        u = use(P.pressure!, v.w, v.h);
        bind(0, pressure.read.tex); bind(1, divergenceF.tex);
        gl.uniform1i(u.uPressure!, 0); gl.uniform1i(u.uDivergence!, 1);
        blit(pressure.write); pressure.swap();
      }

      u = use(P.gradient!, v.w, v.h);
      bind(0, pressure.read.tex); bind(1, velocity.read.tex);
      gl.uniform1i(u.uPressure!, 0); gl.uniform1i(u.uVelocity!, 1);
      blit(velocity.write); velocity.swap();

      u = use(P.advect!, v.w, v.h);
      bind(0, velocity.read.tex);
      gl.uniform1i(u.uVelocity!, 0); gl.uniform1i(u.uSource!, 0);
      gl.uniform2f(u.uTexelSim!, 1 / v.w, 1 / v.h);
      gl.uniform1f(u.uDt!, DT); gl.uniform1f(u.uDissipation!, velDissipation(performance.now()));
      blit(velocity.write); velocity.swap();

      const d = dye.read;
      u = use(P.advect!, d.w, d.h);
      bind(0, velocity.read.tex); bind(1, d.tex);
      gl.uniform1i(u.uVelocity!, 0); gl.uniform1i(u.uSource!, 1);
      gl.uniform2f(u.uTexelSim!, 1 / v.w, 1 / v.h);
      // 墨幾乎不退：墨流的紋路是留在水面上的，不是一下就散掉的煙
      gl.uniform1f(u.uDt!, DT); gl.uniform1f(u.uDissipation!, 0.008);
      blit(dye.write); dye.swap();

      const fade = inkFade(performance.now());
      // 退乾淨之後把 dye 真的清掉。只淡顯示不清場的話，下次一動滑鼠
      // uFade 跳回 1，剛剛「退掉」的那整片金會原封不動地跳出來。
      if (fade <= 0) clearDye();

      u = use(P.display!, canvas.width, canvas.height);
      bind(0, dye.read.tex);
      gl.uniform1i(u.uDye!, 0);
      gl.uniform2f(u.uRes!, canvas.width, canvas.height);
      gl.uniform2f(u.uDyeTexel!, 1 / d.w, 1 / d.h);
      gl.uniform1f(u.uFade!, fade);
      blit(null);
    };

    let raf = 0;
    let liveUntil = 0;
    /**
     * Hero 捲出畫面就不要跑。**這在手機上比任何一個參數都有感**：
     * 手指捲頁本身就是一連串 pointermove，等於「邊捲邊攪水」——
     * 捲動與流體模擬搶同一幀，捲起來就是頓的。捲過去之後還會再跑七秒。
     * 看不見就直接停，省下來的是整個模擬。
     */
    let onScreen = true;
    const loop = () => {
      raf = 0;
      step();
      if (performance.now() < liveUntil && onScreen && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const wake = (ms: number) => {
      liveUntil = Math.max(liveUntil, performance.now() + ms);
      if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(loop);
    };

    let px = 0;
    let py = 0;
    let hasPrev = false;
    let sinceRing = 0;

    /**
     * **只有滑鼠在動的時候才有東西發生**：沒有點擊下墨、沒有自動演出。
     * 監聽掛在 window 不是畫布上——畫布是 `pointer-events: none`（否則會把導覽列
     * 與按鈕的點擊吃掉），所以自己拿框的 rect 換算座標，落在框外就不畫。
     * 捲離首屏之後 rect 跑掉，座標自然落在框外，不必另外做可見性判斷。
     */
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const x = (e.clientX - r.left) / r.width;
      const y = 1 - (e.clientY - r.top) / r.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) { hasPrev = false; return; }
      // 力道要夾住：滑鼠突然跳很遠（切視窗回來）會一下把水攪散
      const fx = hasPrev ? Math.max(-70, Math.min(70, (x - px) * 5200)) : 0;
      const fy = hasPrev ? Math.max(-70, Math.min(70, (y - py) * 5200)) : 0;
      const moved = Math.hypot(fx, fy);
      px = x; py = y; hasPrev = true;
      if (moved < 0.8) return;

      // 連續的筆觸用團，每隔一段才補一組同心環。
      // 環太密太濃的話整條會變成一串疙瘩像麻花，而不是一道被攪開的墨。
      splat(x, y, fx, fy, Math.min(0.072, 0.012 + moved * 0.0016), false);
      if (++sinceRing >= 11) {
        sinceRing = 0;
        const base = 0.016 + Math.random() * 0.010;
        for (let i = 0; i < 2; i++) splat(x, y, 0, 0, 0.14 - i * 0.05, true, base * (1 + i * 1.8));
      }
      lastInput = performance.now();
      wake(calm ? 900 : 7000);   // 退場在 6.2 秒結束，之後畫面已經沒東西了
    };
    const onVisible = () => { if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; } };

    // 門檻給 0：只要露出一點點就算在畫面上，不然剛捲回來的那一下會是靜止的
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (!onScreen && raf) { cancelAnimationFrame(raf); raf = 0; }
      else if (onScreen) wake(600);   // 回到畫面上補畫幾幀，退場才接得上
    }, { threshold: 0 });
    io.observe(host);

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('visibilitychange', onVisible);
    const ro = new ResizeObserver(() => { allocate(); wake(400); });
    ro.observe(host);

    step();   // 先畫一次紙，不然沒人動滑鼠之前是一片黑

    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVisible);
      ro.disconnect();
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      release();
      programs.forEach((p) => gl.deleteProgram(p));
      gl.deleteShader(vs);
      gl.deleteBuffer(quad);
    };
  }, []);

  if (failed) return <>{fallback}</>;
  return (
    <div ref={hostRef} className="hero-sumi absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="hero-sumi-canvas" />
    </div>
  );
};

export default HeroSuminagashi;
