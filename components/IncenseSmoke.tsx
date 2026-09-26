import React, { useEffect, useRef } from 'react';

/**
 * 拜拜的香煙（Hero 左側）——一縷細長的白煙
 *
 * **不要用粒子。** 第一版是粒子模擬，一散開單顆的濃度就掉到看不見，
 * 整體只剩一片模糊的霧，完全不像廟方要的那種「細細長長的一縷」。
 * 真實的線香煙在層流段是**一條連續的細絲**，靠邊界的剪力扭成麻花，
 * 所以這裡直接畫「一條會捲的曲線」，而不是一堆各自飄的點。
 *
 * 形狀怎麼來的：
 *   中心線 x = 起點 + 擾動強度(高度) × Σ 幾個不同頻率的正弦
 *   ——擾動隨高度才加進來（下段直、上段捲），這是線香層流轉紊流的真實行為。
 *   相位裡的 u^1.5 讓越高處振盪越密，出現越往上越緊的螺旋，就是照片裡的麻花感。
 *
 * 為什麼看得出在動：整條曲線的相位隨時間往上跑（advection），
 * 而且跑的速度就是煙速——**煙的形狀是被氣流整段帶著走的**，
 * 不是煙穿過一條固定的蛇形通道。
 *
 * 立體感靠線寬：粗細用同一組相位的 cos 調變，
 * 曲線「正面朝你」時寬、「側面朝你」時窄，看起來就是一條扭轉的緞帶而不是一條麵條。
 *
 * 沒有接縫：三組頻率取不整除的比例，波形不會週期重複，也就沒有「又回到開頭」。
 * 沒有香枝：起點壓在畫面底緣之下，加上底部的淡入。
 *
 * **為什麼是「填滿的緞帶」而不是「描邊的線」**（2026-08-10 修）：
 * 第一版把曲線切成 40 段、每段各自 `stroke()`，粗細與濃度取該段中點。
 * 這麼做有兩個地方會讓 alpha 疊加，看起來就是一串反光的顆粒：
 *   (1) `lineCap:'round'` 讓每段的圓頭與下一段的圓頭重疊，40 個接縫 × 4 道 = 160 個亮點；
 *   (2) 螺旋本來就會自我交疊，兩次 stroke 的交疊處濃度直接相加。
 * 改成「沿中心線往外推半個線寬，繞一圈成為封閉多邊形，整條一次 `fill()`」之後：
 * 沒有接縫可言，而且 canvas 預設的 nonzero 填充規則對**自我交疊只填一次**，
 * 交疊處不會變亮。濃度改用一條垂直線性漸層帶（alphaAt 只跟高度有關，剛好對得上），
 * 粗細則逐點連續變化，不再有分段的突跳。
 */

/** 曲線取樣點數。線很細，取太少會看到折角 */
const SAMPLES = 240;

/** 層流段：這個高度比例以下幾乎不擾動（煙是直的） */
const LAMINAR = 0.26;
/** 過渡帶：再過這麼多比例，擾動才完全加滿 */
const TRANSITION = 0.28;

/** 煙從底部升到頂端要幾秒。這是「煙快不快」，形狀的相位也跟著它換算 */
const RISE_SECONDS = 5.6;

/** 橫向擺幅（佔畫布高度的比例）。太大會變成大波浪像蛇在游，要的是小而密的捲 */
const SWAY = 0.052;

/**
 * 螺旋的「側視壓扁率」。這是讓煙看起來會捲、而不是左右折的關鍵。
 *
 * 只讓 x 擺動、y 一路往上，畫出來是鋸齒（像閃電）。真實的煙是繞著上升軸的**螺旋**，
 * 從側面看，螺旋的每一圈會投影成一個壓扁的橢圓——曲線因此會往回繞、甚至自我交疊，
 * 那才是照片裡的麻花。所以 y 也要跟著相位繞，只是幅度比 x 小（透視壓扁）。
 * 0 = 退回鋸齒，太大會變成一串圓圈。
 */
const COIL = 0.42;

/** 煙芯線寬（佔畫布高度的比例）。這是最細那一道，柔邊靠外面幾道疊出來 */
const W_BASE = 0.0032;

/**
 * 疊四道畫出柔邊：由寬而淡到窄而濃。
 * 只畫一道的話，不是銳利得像鐵絲，就是糊得像霧——真實的煙是「有亮芯的柔邊」。
 * mul 是線寬倍率、a 是濃度倍率。
 *
 * 濃度是舊版（分段描邊）的 1.3 倍。舊版看起來比較濃有一部分是假的：
 * 接縫與自我交疊處 alpha 疊加，那些多出來的亮度就是使用者看到的顆粒。
 * 改成整條填滿之後不再疊加，離線量到平均亮度掉 17%，乘回 1.3 才與原本的濃度相當。
 */
const PASSES = [
  { mul: 7.0, a: 0.058 },
  { mul: 3.6, a: 0.110 },
  { mul: 1.8, a: 0.221 },
  { mul: 1.0, a: 0.442 },
];

/**
 * 濃度漸層的節點數。濃度只跟高度有關（見 alphaAt），所以可以用一條垂直漸層帶掉，
 * 不必逐段換 globalAlpha——那正是舊版產生顆粒感的原因之一。
 */
const GRADIENT_STOPS = 32;

/** 緞帶的最小半寬（實際像素）。再細下去在高解析度螢幕上會斷斷續續 */
const MIN_HALF_PX = 0.34;

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * 三組空間頻率（每單位高度的相位）。比例刻意不整除，合成波不會週期重複。
 * 越後面的頻率越高、權重越小，負責細部的小捲。
 */
const K = [11.0, 24.7, 41.3];
const AMP = [1.0, 0.40, 0.17];

/**
 * 每個頻率成分「往上跑的速度」相對於煙速的倍率。
 *
 * 三個成分若用同一個速度，合成波就是整條剛體平移——**形狀永遠長一樣，只是滑上去**。
 * 給不同的倍率（而且彼此不成簡單比例）之後，成分之間會互相錯開，
 * 疊出來的輪廓就一直在變形，也永遠不會回到某個看過的形狀。
 */
const DRIFT = [1.0, 0.83, 1.19];

/**
 * 擺幅的慢速呼吸：每個成分的振幅再乘上一個很慢的正弦。
 * 這是「形狀不一樣」的第二層——有時候捲得大、有時候幾乎是直的，像真的有微風。
 * 頻率同樣取不整除的比例。
 */
const BREATH_HZ = [0.037, 0.061, 0.089];
const BREATH_DEPTH = 0.42;

/**
 * 香爐的位置：佔畫布寬度。**全站只有這一爐**（廟方 2026-09-26 確認：實際只有左邊
 * 那一爐，神明後面沒有香）。曾經做過右邊再加一爐，已移除。
 *
 * **關鍵是「所有的煙都從這個爐口聚攏升起」**——廟裡是一個爐插很多支香，煙在爐口
 * 幾乎重疊、越往上才散開。做成各自獨立的平行煙柱就沒有共同的源頭，看起來像貼了
 * 好幾條線（第一版就是這樣，廟方指正了）。
 *
 * 桌機的 0.25 是量出來的：再往左會被「和聖壇」直式標題壓到（實測標題佔 5.1%～15.4%），
 * 再往右就進神尊區（1280px 實測三尊橫跨 30.6%～69.4%）。手機另有一組值，見下。
 */
const CENSER_X_WIDE = 0.25;
/**
 * 窄螢幕的爐口要往右挪。
 *
 * 擺幅是以**畫布高度**為基準（`SWAY * h`），手機又高又窄，同樣的像素擺幅換算成
 * 寬度百分比就大得多——桌機（1009×768）量到煙佔 17.2%～30.9%，同一組參數在手機
 * （390×844）卻散到 3.1%～40.5%，左邊直接壓到直式標題（實測佔 5.1%～15.4%）。
 * 手機上神尊橫跨 −1.6%～101.6%（整個寬度），煙本來就是從神尊背後經過（z-10 對
 * z-20），所以往右挪不會有新問題，只是讓開標題。
 */
const CENSER_X_NARROW = 0.34;

/**
 * 煙往外散開的速率。`u^1.25` 讓它在爐口幾乎不散、越往上越開，這是真的香爐的
 * 樣子——不是從底部就呈扇形。
 *
 * **散開的幅度要收住，而且要把擺幅一起算進去**：煙的橫向範圍 = `spread` ＋ 擺幅，
 * 而擺幅（`SWAY`，以畫布高度為基準）本身就佔約 ±5% 的畫布寬度。只看 spread 會低估，
 * 第一版開到 ±0.07 就量出 14.1%～34.9%，兩邊都越界。改動後要用讀畫布像素的方式
 * 實測左右緣，不要用眼睛估。
 */
const fanOut = (u: number): number => Math.pow(u, 1.25);

/**
 * 每一縷煙。
 *
 * 廟方要「香火鼎盛」，所以從兩縷（一柱＋分岔）擴成多縷。**多縷不是把同一條複製幾份**
 * ——同形同速的複本一眼就看得出是貼上去的。每一縷都要在幾個維度上錯開：
 * 爐內位置、散開方向、相位、擺幅、粗細濃度（＝遠近）、上升速度、捲曲頻率。
 * 速度與頻率尤其關鍵：兩者都一樣的話，花紋會永遠保持同步，像同一段影片播兩次。
 *
 * **煙可以從神尊後面經過**：煙是 z-10、神尊那一層是 z-20，所以散開後即使越過
 * 神尊的範圍也是從背後掠過，不會糊到臉——那反而像真的廟裡的樣子。
 */
interface Strand {
  /** 在爐內的位置偏移（佔畫布寬度）。香是一支支插著的，不是全部疊在同一點 */
  base: number;
  /** 升到頂端時往外散開多少（佔畫布寬度），正右負左 */
  spread: number;
  /** 從哪個高度開始出現 */
  from: number;
  /** 相位偏移，讓各縷不同步 */
  phase: number;
  /** 擺幅倍率 */
  sway: number;
  /** 線寬倍率 */
  width: number;
  /** 濃度倍率。越小＝看起來越遠 */
  alpha: number;
  /** 高度倍率。越小＝升得越矮，是「遠近」的第二個線索 */
  height: number;
  /** 上升速度倍率 */
  speed: number;
  /** 捲曲頻率倍率。有的捲得緊、有的幾乎是直的，這一維最能拆散「像複製品」的感覺 */
  freq: number;
  /** 窄螢幕要不要畫。手機畫太多既擠又費電 */
  mobile: boolean;
}

const STRANDS: Strand[] = [
  // 一爐五支香。散開幅度刻意壓得比直覺小：**煙的橫向範圍 = spread + 擺幅**，
  // 而擺幅（SWAY，以畫布高度為基準）本身就佔約 ±5% 的寬度。第一版把 spread 開到
  // ±0.07，量出來的實際範圍是 14.1%～34.9%——左邊壓到直式標題、右邊進了神尊區。
  { base:  0.000, spread:  0.000, from: 0.00, phase: 0.0, sway: 1.00, width: 1.00, alpha: 1.00, height: 1.00, speed: 1.00, freq: 1.00, mobile: true },
  { base:  0.003, spread:  0.018, from: 0.42, phase: 2.7, sway: 1.15, width: 0.62, alpha: 0.50, height: 1.00, speed: 1.00, freq: 1.09, mobile: true },  // 主柱的分岔
  { base: -0.007, spread: -0.030, from: 0.04, phase: 4.1, sway: 0.75, width: 0.72, alpha: 0.46, height: 0.90, speed: 1.13, freq: 0.78, mobile: true },
  { base:  0.008, spread:  0.028, from: 0.06, phase: 1.9, sway: 0.80, width: 0.60, alpha: 0.34, height: 0.80, speed: 0.87, freq: 1.31, mobile: true },
  { base: -0.004, spread: -0.016, from: 0.24, phase: 5.4, sway: 1.00, width: 0.52, alpha: 0.30, height: 0.94, speed: 0.94, freq: 1.44, mobile: false },
];

const IncenseSmoke: React.FC<{ className?: string }> = ({ className = '' }) => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 線很細，用一半解析度會糊成一團灰。這裡照實際像素畫（上限 2 倍，再高沒意義只是耗電）
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let w = 0, h = 0;
    /** 這次要畫哪幾縷（窄螢幕只留 mobile 那幾條），resize 時重算 */
    let active: Strand[] = STRANDS;
    /** 爐口位置，窄螢幕會往右挪讓開直式標題 */
    let censerX = CENSER_X_WIDE;

    // 中心線、半寬、法線的暫存。每幀重算，先算好再讓四道共用，省掉重複的三角函式
    const N = SAMPLES;
    const cx = new Float32Array(N + 1);
    const cy = new Float32Array(N + 1);
    const cw = new Float32Array(N + 1);
    const nx = new Float32Array(N + 1);
    const ny = new Float32Array(N + 1);
    /** [縷][道] 的濃度漸層。alphaAt 與時間無關，所以只在 resize 時建一次 */
    let gradients: CanvasGradient[][] = [];
    /** 相位每秒推進多少：由煙速換算，讓形狀跟著煙一起往上跑 */
    let omega: number[] = [];
    let clock = 0;

    const resize = () => {
      const r = host.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width * dpr));
      h = Math.max(1, Math.round(r.height * dpr));
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      // 以 CSS 像素判斷，不要用 w（w 已經乘過 dpr，高解析手機會被誤判成桌機）
      const wide = r.width >= 640;
      active = wide ? STRANDS : STRANDS.filter(st => st.mobile);
      censerX = wide ? CENSER_X_WIDE : CENSER_X_NARROW;
      // 形狀往上跑的速度 = 煙速（1/RISE_SECONDS 個畫面高度／秒）
      omega = K.map((k, i) => (k / RISE_SECONDS) * DRIFT[i]);
      buildGradients();
    };

    /**
     * 把濃度曲線烤進垂直漸層。
     * u 與畫布 y 是單調對應（y = h*(1-u) 再加一點螺旋位移），所以一條由上到下的
     * 線性漸層就能重現 alphaAt 的淡入淡出，不必逐段改 globalAlpha——逐段改就會有接縫。
     */
    const buildGradients = () => {
      gradients = STRANDS.map(s => PASSES.map(pass => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        for (let i = 0; i <= GRADIENT_STOPS; i++) {
          const t = i / GRADIENT_STOPS;      // t=0 是畫布頂端
          // 矮的那幾縷只佔畫布下半部，所以畫布座標要先換回它自己的 u：
          // y = h − u·h·height ⇒ u = (1−t)/height。超過 1 表示已經在這縷的頂端之上，不畫。
          const u = (1 - t) / s.height;
          const a = u > 1 ? 0 : alphaAt(u, s) * pass.a;
          g.addColorStop(t, `rgba(255,253,248,${a.toFixed(4)})`);
        }
        return g;
      }));
    };

    /**
     * 中心線。u = 0 在底部、1 在頂端。
     * 回傳的是螺旋投影後的座標：x 走 sin、y 在「往上」之外再疊一個 cos，
     * 兩者同相位就畫出一圈一圈壓扁的橢圓＝側看的螺旋。
     */
    const centerAt = (u: number, t: number, s: Strand): { x: number; y: number } => {
      const turb = smoothstep(LAMINAR, LAMINAR + TRANSITION, u);
      // u^1.5：越高處相位推進越快，螺旋越往上越緊
      const uu = Math.pow(u, 1.5);
      let sx = 0, sy = 0;
      for (let i = 0; i < K.length; i++) {
        // **相位要減去 t，不是加。** u 是「由下往上」的座標：
        // 固定相位的那一點滿足 uu*K − t*ω = 定值，t 增加時 uu 跟著增加，
        // 形狀才會往上跑。寫成加號的話整條煙的花紋是往下掉的（曾經寫錯過）。
        const ph = uu * K[i] * s.freq - t * omega[i] * s.speed + s.phase;
        const breath = 1 + BREATH_DEPTH * Math.sin(t * BREATH_HZ[i] * Math.PI * 2 + s.phase * 1.7);
        sx += Math.sin(ph) * AMP[i] * breath;
        sy += Math.cos(ph) * AMP[i] * breath;
      }
      // 擺幅跟著各縷自己的高度縮，矮的那幾縷才不會擺得跟主柱一樣大
      const r = turb * SWAY * h * s.height * s.sway;
      return {
        // 從爐口同一處升起，越往上越往外散
        x: (censerX + s.base) * w + s.spread * fanOut(u) * w + sx * r,
        // u 由下往上、畫布 y 由上往下；height < 1 的縷只升到畫布的一部分高度
        y: h - u * h * s.height + sy * r * COIL,
      };
    };

    /** 線寬：底部細如線，中段最粗，頂端張開後散掉 */
    const widthAt = (u: number, t: number, s: Strand): number => {
      // 底部細如髮絲，往上才慢慢張開；頂端張到最開就散掉
      const grow = 0.25 + 2.9 * smoothstep(0.08, 0.9, u);
      // 用同一組相位調變粗細：緞帶正面朝你時寬、側面時窄，這是立體感的來源
      const uu = Math.pow(u, 1.5);
      const twist = 0.6 + 0.4 * Math.abs(Math.cos(uu * K[0] * 0.5 * s.freq - t * omega[0] * 0.5 * s.speed + s.phase));
      return W_BASE * h * grow * twist * s.width;
    };

    /** 濃度：底部淡入（看不到起點）、頂端淡出（散掉） */
    const alphaAt = (u: number, s: Strand): number => {
      const fadeIn = smoothstep(0, 0.10, u);
      const fadeOut = 1 - smoothstep(0.62, 1, u);
      const born = smoothstep(s.from, s.from + 0.16, u);
      return fadeIn * fadeOut * born * s.alpha;
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const s of active) {
        const si = STRANDS.indexOf(s);
        // 遠處那幾縷又細又淡，取樣點減半也看不出差別，但省下一半的三角函式。
        // 縷數從 2 條增到 7 條，這一刀是讓總成本只增加約 2.5 倍而不是 3.5 倍的原因。
        const M = s.alpha >= 0.6 ? N : (N >> 1);

        // 中心線與粗細：四道共用，只算一次
        for (let i = 0; i <= M; i++) {
          const u = i / M;
          const p = centerAt(u, clock, s);
          cx[i] = p.x; cy[i] = p.y;
          cw[i] = widthAt(u, clock, s);
        }
        // 法線＝切線轉 90 度。端點用單邊差分，中間用前後鄰點的中央差分
        for (let i = 0; i <= M; i++) {
          const a = i > 0 ? i - 1 : 0;
          const b = i < M ? i + 1 : M;
          const tx = cx[b] - cx[a];
          const ty = cy[b] - cy[a];
          const len = Math.hypot(tx, ty) || 1;
          nx[i] = -ty / len; ny[i] = tx / len;
        }

        for (let pi = 0; pi < PASSES.length; pi++) {
          const mul = PASSES[pi].mul;
          // 去程走一側、回程走另一側，收成一個封閉多邊形。
          // 整條一次 fill()：沒有接縫，nonzero 規則讓自我交疊也只填一次
          ctx.beginPath();
          for (let i = 0; i <= M; i++) {
            const r = Math.max(MIN_HALF_PX * dpr, cw[i] * mul * 0.5);
            const x = cx[i] + nx[i] * r;
            const y = cy[i] + ny[i] * r;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          for (let i = M; i >= 0; i--) {
            const r = Math.max(MIN_HALF_PX * dpr, cw[i] * mul * 0.5);
            ctx.lineTo(cx[i] - nx[i] * r, cy[i] - ny[i] * r);
          }
          ctx.closePath();
          ctx.fillStyle = gradients[si][pi];
          ctx.fill();
        }
      }
    };

    let frame = 0;
    let last = 0;
    let running = true;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (!running) { last = now; return; }
      // dt 夾住上限：切分頁回來時 now 會跳一大段，不夾的話煙會瞬間扭一大圈
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      clock += dt;
      draw();
    };

    resize();
    draw();
    // 這裡刻意**不**看 prefers-reduced-motion。
    // 原本有做這個讓步（系統開了減少動態效果就凍成靜態圖），但廟方兩次回報「煙沒有在動」，
    // 而我無法從開發端確認他們裝置的實際回報值——凍住的失敗方式又完全無從察覺。
    // 這一縷煙面積小、對比低、不是大幅度位移，屬於可接受的環境動態；
    // 要恢復讓步的話，把下面這行改成
    //   if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) frame = requestAnimationFrame(loop);
    frame = requestAnimationFrame(loop);

    const onResize = () => { resize(); draw(); };
    window.addEventListener('resize', onResize);

    const onVisibility = () => { running = !document.hidden; last = 0; };
    document.addEventListener('visibilitychange', onVisibility);

    // 捲離 Hero 就停掉。看不看得到一律以 rect 為準，不採信 IntersectionObserver 的
    // isIntersecting：它只要誤報一次 false，running 就永遠停在 false，
    // 畫面上會留著一張不動的煙，而且沒有任何事件會把它翻回來。
    const recheck = () => {
      const r = host.getBoundingClientRect();
      running = r.bottom > 0 && r.top < window.innerHeight && !document.hidden;
      last = 0;
    };
    window.addEventListener('scroll', recheck, { passive: true });

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(recheck, { threshold: 0 });
      observer.observe(host);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', recheck);
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
      canvas.remove();
    };
  }, []);

  return <div ref={hostRef} className={`incense-stage ${className}`} aria-hidden="true" />;
};

export default IncenseSmoke;
