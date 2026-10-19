import React, { useEffect, useRef, useState } from 'react';

/**
 * 青花墨流（`?hero=sumi`，2026-10-20）
 *
 * 廟方給的參考是 suminagashi（墨流し）——**墨浮在水面上被推著跑**，不是墨滲進紙裡。
 * 這兩件事的物理完全不同，所以做法也完全不同：
 *   滲進紙裡（`HeroInkGold`）＝ 一團一團疊上去，位置不會變，靠累積出濃淡。
 *   浮在水上（這一支）    ＝ 墨會**被水流帶著走**，所以必須真的算一個速度場。
 * 前者用 2D canvas 疊圖就好，後者只能用 GPU 跑流體。
 *
 * ── 跑的是什麼 ──
 * 標準的 Stable Fluids，每一幀七個 pass：
 *   curl → vorticity（渦度補強，不然小漩渦一下就被數值黏滯吃掉）
 *   → divergence → pressure（Jacobi 疊代）→ gradientSubtract（把速度場壓成無散度）
 *   → advect velocity → advect dye
 * 滑鼠的位移當成外力打進速度場，墨（dye）只是被那個場帶著走的被動量。
 *
 * ── 青花與泥金 ──
 * 底不是 DOM 的漸層，是 display shader 自己畫的靛藍；墨是泥金。
 * 所以這一層就是整個首屏的底，神尊（z-10）直接站在上面。
 *
 * **墨點打的是「環」不是「團」。** 那是 suminagashi 的招牌：真的做法是黑墨與
 * 分散劑交替滴在水面上，推開成一圈一圈的同心環。高斯團打出來是一朵雲，
 * 看起來像煙不像墨流。
 *
 * ── 效能（這一頁的信眾以長者居多、舊手機比例不低）──
 *   模擬解析度與 dye 解析度都刻意壓低（流體本來就是平滑的，低解析度看不出來），
 *   壓力疊代只跑 14 次，DPR 上限 1.5。
 *   **沒有互動就不跑**：最後一次下墨之後再跑幾秒就停掉 rAF，不是永遠掛著一個迴圈。
 *   捲離首屏或切到別的分頁也停。
 *
 * ── 接不住的時候退回去 ──
 * 沒有 WebGL2、拿不到浮點 render target、或使用者開了「減少動態效果」，
 * 一律退回 `HeroInkGold`（2D canvas 那版）。流體模擬本身就是一個停不下來的動畫，
 * 開了減少動態效果的人不該被迫看它跑。
 */

const BASE_VERT = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
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
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 oColor;
`;

/** 速度場的外力：一般的高斯團 */
const SPLAT_VEL = HEAD + `
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec2 uPoint;
uniform vec2 uForce;
uniform float uRadius;
void main () {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec2 add = exp(-dot(p, p) / uRadius) * uForce;
  oColor = vec4(texture(uTarget, vUv).xy + add, 0.0, 1.0);
}`;

/**
 * 墨點：**環狀**不是團狀（理由見檔頭）。
 * `uInner` 是環心的半徑，`uBand` 是環的厚薄。
 */
const SPLAT_DYE = HEAD + `
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec2 uPoint;
uniform float uAmount;
uniform float uInner;
uniform float uBand;
void main () {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  float d = length(p);
  float ring = exp(-((d - uInner) * (d - uInner)) / uBand);
  oColor = vec4(texture(uTarget, vUv).x + ring * uAmount, 0.0, 0.0, 1.0);
}`;

const ADVECT = HEAD + `
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexelSim;
uniform float uDt;
uniform float uDissipation;
void main () {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexelSim;
  oColor = texture(uSource, coord) / (1.0 + uDissipation * uDt);
}`;

const DIVERGENCE = HEAD + `
uniform sampler2D uVelocity;
void main () {
  float l = texture(uVelocity, vL).x;
  float r = texture(uVelocity, vR).x;
  float t = texture(uVelocity, vT).y;
  float b = texture(uVelocity, vB).y;
  vec2 c = texture(uVelocity, vUv).xy;
  // 邊界：牆面反射，不然墨會從邊緣漏出去、整片慢慢變平
  if (vL.x < 0.0) { l = -c.x; }
  if (vR.x > 1.0) { r = -c.x; }
  if (vT.y > 1.0) { t = -c.y; }
  if (vB.y < 0.0) { b = -c.y; }
  oColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}`;

const CURL = HEAD + `
uniform sampler2D uVelocity;
void main () {
  float l = texture(uVelocity, vL).y;
  float r = texture(uVelocity, vR).y;
  float t = texture(uVelocity, vT).x;
  float b = texture(uVelocity, vB).x;
  oColor = vec4(0.5 * (r - l - t + b), 0.0, 0.0, 1.0);
}`;

const VORTICITY = HEAD + `
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uCurlAmount;
uniform float uDt;
void main () {
  float l = texture(uCurl, vL).x;
  float r = texture(uCurl, vR).x;
  float t = texture(uCurl, vT).x;
  float b = texture(uCurl, vB).x;
  float c = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
  force /= length(force) + 0.0001;
  force *= uCurlAmount * c;
  force.y *= -1.0;
  vec2 vel = texture(uVelocity, vUv).xy + force * uDt;
  oColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);
}`;

const PRESSURE = HEAD + `
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main () {
  float l = texture(uPressure, vL).x;
  float r = texture(uPressure, vR).x;
  float t = texture(uPressure, vT).x;
  float b = texture(uPressure, vB).x;
  float div = texture(uDivergence, vUv).x;
  oColor = vec4((l + r + b + t - div) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT = HEAD + `
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main () {
  float l = texture(uPressure, vL).x;
  float r = texture(uPressure, vR).x;
  float t = texture(uPressure, vT).x;
  float b = texture(uPressure, vB).x;
  vec2 vel = texture(uVelocity, vUv).xy - vec2(r - l, t - b);
  oColor = vec4(vel, 0.0, 1.0);
}`;

/**
 * 上色：青花的底 ＋ 泥金的墨。
 * 濃度換成不透明度用 `1 - exp(-k·d)`，到頂是漸近不是一刀切——
 * 線性的話濃的地方會削平成一塊死金，看不出墨的層次。
 */
const DISPLAY = HEAD + `
uniform sampler2D uDye;
void main () {
  float d = texture(uDye, vUv).x;
  vec3 deep = vec3(0.059, 0.102, 0.184);
  vec3 lift = vec3(0.133, 0.220, 0.420);
  vec3 paper = mix(deep, lift, smoothstep(0.0, 1.0, vUv.y));
  // 釉光：一道很寬很淡的斜掃，水面才不是平的
  paper += vec3(0.055, 0.070, 0.090) * smoothstep(0.75, 0.0, abs(vUv.x * 0.8 + vUv.y * 0.6 - 0.75));
  vec3 gold = vec3(0.886, 0.761, 0.498);
  float a = 1.0 - exp(-d * 5.2);
  /**
   * **濃度低的地方不要直接往金色插值。** 靛藍混一點點金是灰的，整片看起來像
   * 蒙了一層霧而不是泥金（實測墨流的紋路偏灰）。先讓薄的地方往暖處偏一點，
   * 濃的地方才真的是金，層次才立得起來。
   */
  vec3 warm = mix(paper, vec3(0.42, 0.44, 0.40), clamp(a * 1.6, 0.0, 1.0));
  oColor = vec4(mix(warm, gold, clamp(a * a * 1.25, 0.0, 1.0)), 1.0);
}`;

type FBO = { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number };
type Double = { read: FBO; write: FBO; swap: () => void };

const HeroSuminagashi: React.FC<{ fallback: React.ReactNode }> = ({ fallback }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // 流體模擬是一個停不下來的動畫，開了「減少動態效果」的人不該被迫看它跑
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setFailed(true); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: false, depth: false, stencil: false, antialias: false, powerPreference: 'low-power',
    });
    // 沒有 WebGL2，或拿不到浮點 render target（舊 iOS 常見）就退回 2D 那版
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) { setFailed(true); return; }
    const linear = !!gl.getExtension('OES_texture_float_linear');
    const filter = linear ? gl.LINEAR : gl.NEAREST;

    const compile = (type: number, src: string): WebGLShader | null => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { gl.deleteShader(sh); return null; }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, BASE_VERT);
    if (!vs) { setFailed(true); return; }

    const programs: WebGLProgram[] = [];
    const make = (fragSrc: string): { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> } | null => {
      const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
      const p = fs && gl.createProgram();
      if (!fs || !p) return null;
      gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
      gl.deleteShader(fs);
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

    const prog = {
      splatVel: make(SPLAT_VEL), splatDye: make(SPLAT_DYE), advect: make(ADVECT),
      divergence: make(DIVERGENCE), curl: make(CURL), vorticity: make(VORTICITY),
      pressure: make(PRESSURE), gradient: make(GRADIENT), display: make(DISPLAY),
    };
    if (Object.values(prog).some((v) => !v)) { setFailed(true); return; }

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // 配置過的全部記起來。少了這個，每次 allocate 都是十張新的貼圖加十個 FBO，
    // 舊的沒人刪——手機捲動時網址列一收一放就會觸發一次，記憶體一路往上疊。
    const owned: { texes: WebGLTexture[]; fbos: WebGLFramebuffer[] } = { texes: [], fbos: [] };
    const releaseAll = () => {
      owned.texes.forEach((t) => gl.deleteTexture(t));
      owned.fbos.forEach((f) => gl.deleteFramebuffer(f));
      owned.texes = []; owned.fbos = [];
    };

    const makeFBO = (w: number, h: number, internal: number, format: number): FBO => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      owned.texes.push(tex); owned.fbos.push(fbo);
      return { tex, fbo, w, h };
    };
    const makeDouble = (w: number, h: number, internal: number, format: number): Double => {
      let a = makeFBO(w, h, internal, format);
      let b = makeFBO(w, h, internal, format);
      return {
        get read() { return a; }, get write() { return b; },
        swap() { const t = a; a = b; b = t; },
      } as Double;
    };

    // 解析度刻意低：流體本來就是平滑的，低解析度看不太出來，但省下來的是四倍
    const SIM = 128;
    const DYE = 320;
    let aspect = 1;
    let velocity!: Double;
    let dye!: Double;
    let divergenceFBO!: FBO;
    let curlFBO!: FBO;
    let pressure!: Double;

    let gridW = 0;
    let gridH = 0;

    const allocate = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      aspect = Math.max(0.2, r.width / Math.max(1, r.height));
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      const sw = aspect >= 1 ? Math.round(SIM * aspect) : SIM;
      const sh = aspect >= 1 ? SIM : Math.round(SIM / aspect);
      const dw = aspect >= 1 ? Math.round(DYE * aspect) : DYE;
      const dh = aspect >= 1 ? DYE : Math.round(DYE / aspect);
      /**
       * **格子大小沒變就不要重配。** 畫布的 CSS 尺寸一變 ResizeObserver 就會叫一次，
       * 而手機捲動時網址列一收一放高度就變——每次都重配不只是浪費，
       * 重配等於把水面清空，使用者畫到一半的墨會憑空消失。
       * 後端像素還是要跟著更新（上面那兩行），那只是改畫布大小不涉及模擬。
       */
      if (sw === gridW && sh === gridH) return;
      gridW = sw; gridH = sh;
      releaseAll();
      velocity = makeDouble(sw, sh, gl.RG16F, gl.RG);
      dye = makeDouble(dw, dh, gl.R16F, gl.RED);
      divergenceFBO = makeFBO(sw, sh, gl.R16F, gl.RED);
      curlFBO = makeFBO(sw, sh, gl.R16F, gl.RED);
      pressure = makeDouble(sw, sh, gl.R16F, gl.RED);
    };
    allocate();

    const blit = (target: FBO | null) => {
      if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); gl.viewport(0, 0, target.w, target.h); }
      else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const bind = (slot: number, tex: WebGLTexture) => { gl.activeTexture(gl.TEXTURE0 + slot); gl.bindTexture(gl.TEXTURE_2D, tex); };
    const useProg = (q: { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }, w: number, h: number) => {
      gl.useProgram(q.p);
      if (q.u.uTexel) gl.uniform2f(q.u.uTexel, 1 / w, 1 / h);
      return q.u;
    };

    // ── 下墨與施力 ──────────────────────────────────────────────
    const splat = (x: number, y: number, dx: number, dy: number, ink: number) => {
      const v = velocity.read;
      let u = useProg(prog.splatVel!, v.w, v.h);
      bind(0, v.tex);
      gl.uniform1i(u.uTarget!, 0);
      gl.uniform1f(u.uAspect!, aspect);
      gl.uniform2f(u.uPoint!, x, y);
      gl.uniform2f(u.uForce!, dx, dy);
      gl.uniform1f(u.uRadius!, 0.0009);
      blit(velocity.write); velocity.swap();

      if (ink <= 0) return;
      const d = dye.read;
      u = useProg(prog.splatDye!, d.w, d.h);
      bind(0, d.tex);
      gl.uniform1i(u.uTarget!, 0);
      gl.uniform1f(u.uAspect!, aspect);
      gl.uniform2f(u.uPoint!, x, y);
      gl.uniform1f(u.uAmount!, ink);
      // 環心半徑與厚薄：每次隨機一點，疊起來才像一圈一圈不是同一個印章
      gl.uniform1f(u.uInner!, 0.03 + Math.random() * 0.055);
      gl.uniform1f(u.uBand!, 0.00012 + Math.random() * 0.00018);
      blit(dye.write); dye.swap();
    };

    // ── 每一幀 ─────────────────────────────────────────────────
    const DT = 0.016;
    const step = () => {
      const v = velocity.read;
      let u = useProg(prog.curl!, v.w, v.h);
      bind(0, v.tex); gl.uniform1i(u.uVelocity!, 0);
      blit(curlFBO);

      u = useProg(prog.vorticity!, v.w, v.h);
      bind(0, velocity.read.tex); bind(1, curlFBO.tex);
      gl.uniform1i(u.uVelocity!, 0); gl.uniform1i(u.uCurl!, 1);
      gl.uniform1f(u.uCurlAmount!, 26); gl.uniform1f(u.uDt!, DT);
      blit(velocity.write); velocity.swap();

      u = useProg(prog.divergence!, v.w, v.h);
      bind(0, velocity.read.tex); gl.uniform1i(u.uVelocity!, 0);
      blit(divergenceFBO);

      // 壓力場不清零：上一幀的解是這一幀很好的起點，疊代次數可以少一半
      for (let i = 0; i < 14; i++) {
        u = useProg(prog.pressure!, v.w, v.h);
        bind(0, pressure.read.tex); bind(1, divergenceFBO.tex);
        gl.uniform1i(u.uPressure!, 0); gl.uniform1i(u.uDivergence!, 1);
        blit(pressure.write); pressure.swap();
      }

      u = useProg(prog.gradient!, v.w, v.h);
      bind(0, pressure.read.tex); bind(1, velocity.read.tex);
      gl.uniform1i(u.uPressure!, 0); gl.uniform1i(u.uVelocity!, 1);
      blit(velocity.write); velocity.swap();

      u = useProg(prog.advect!, v.w, v.h);
      bind(0, velocity.read.tex);
      gl.uniform1i(u.uVelocity!, 0); gl.uniform1i(u.uSource!, 0);
      gl.uniform2f(u.uTexelSim!, 1 / v.w, 1 / v.h);
      gl.uniform1f(u.uDt!, DT); gl.uniform1f(u.uDissipation!, 0.22);
      blit(velocity.write); velocity.swap();

      const d = dye.read;
      u = useProg(prog.advect!, d.w, d.h);
      bind(0, velocity.read.tex); bind(1, d.tex);
      gl.uniform1i(u.uVelocity!, 0); gl.uniform1i(u.uSource!, 1);
      gl.uniform2f(u.uTexelSim!, 1 / v.w, 1 / v.h);
      // 墨幾乎不消散：墨流的紋路是留在水面上的，不是一下就散掉的煙
      gl.uniform1f(u.uDt!, DT); gl.uniform1f(u.uDissipation!, 0.012);
      blit(dye.write); dye.swap();

      u = useProg(prog.display!, canvas.width, canvas.height);
      bind(0, dye.read.tex); gl.uniform1i(u.uDye!, 0);
      blit(null);
    };

    // ── 迴圈：只在還有東西在動的時候跑 ──────────────────────────
    let raf = 0;
    let liveUntil = 0;
    const loop = () => {
      raf = 0;
      step();
      if (performance.now() < liveUntil && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const wake = (ms: number) => {
      liveUntil = Math.max(liveUntil, performance.now() + ms);
      if (!raf && !document.hidden) raf = requestAnimationFrame(loop);
    };

    const prev = { x: 0, y: 0, ok: false };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = 1 - (e.clientY - r.top) / r.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) { prev.ok = false; return; }
      /**
       * 外力的倍率。**太大的話水面會被打爆**：實測給 6200 時，一次橫掃就把整片墨
       * 推出畫面外，掃完畫面是乾淨的靛藍——力道大到變成擦掉而不是攪動。
       * 再加一個上限擋住「滑鼠突然跳很遠」（切視窗回來、兩個螢幕之間移動）那種
       * 單幀巨大位移，不然一下就把水攪散。
       */
      const k = 1500;
      const dx = prev.ok ? Math.max(-26, Math.min(26, (x - prev.x) * k)) : 0;
      const dy = prev.ok ? Math.max(-26, Math.min(26, (y - prev.y) * k)) : 0;
      prev.x = x; prev.y = y; prev.ok = true;
      const moved = Math.hypot(dx, dy);
      if (moved < 1.5) return;
      splat(x, y, dx, dy, Math.min(0.17, 0.02 + moved * 0.0006));
      wake(4200);
    };
    const onDown = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = 1 - (e.clientY - r.top) / r.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      splat(x, y, 0, 0, 0.55);   // 按下去滴一滴，推開成一圈
      wake(5200);
    };
    const onVisible = () => { if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; } };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('visibilitychange', onVisible);

    const ro = new ResizeObserver(() => { allocate(); wake(600); });
    ro.observe(canvas);

    // 開場先畫一次，不然沒碰過之前是全黑
    step();

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('visibilitychange', onVisible);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      releaseAll();
      programs.forEach((p) => gl.deleteProgram(p));
      gl.deleteShader(vs);
      gl.deleteBuffer(quad);
    };
  }, []);

  if (failed) return <>{fallback}</>;
  return (
    <div className="hero-sumi absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="hero-sumi-canvas" />
    </div>
  );
};

export default HeroSuminagashi;
