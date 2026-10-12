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

/**
 * 層流段：這個高度比例以下幾乎不擾動（煙是直的）。
 * **香粉一樣有筆直的那一段，不要砍掉**（廟方 2026-10-13 給的物理特徵）：
 * 剛燒出來的煙受熱膨脹、密度變小，是被熱空氣整團垂直帶上去的，所以下段是直的；
 * 升高之後溫度下降、受周圍微弱氣流擾動，才開始卷曲、擴散、打轉。
 * 我第一版把這段砍到 0.07（以為香粉一出來就蓬開）——那是錯的，
 * 香粉與線香的差別在**量**不在結構：來源更寬、煙更多更厚，但「先直後亂」是一樣的。
 */
const LAMINAR = 0.22;
/** 過渡帶：再過這麼多比例，擾動才完全加滿 */
const TRANSITION = 0.30;

/** 煙從底部升到頂端要幾秒。這是「煙快不快」，形狀的相位也跟著它換算 */
const RISE_SECONDS = 5.6;

/** 橫向擺幅（佔畫布高度的比例）。太大會變成大波浪像蛇在游 */
const SWAY = 0.060;

/**
 * 螺旋的「側視壓扁率」。這是讓煙看起來會捲、而不是左右折的關鍵。
 *
 * 只讓 x 擺動、y 一路往上，畫出來是鋸齒（像閃電）。真實的煙是繞著上升軸的**螺旋**，
 * 從側面看，螺旋的每一圈會投影成一個壓扁的橢圓——曲線因此會往回繞、甚至自我交疊，
 * 那才是照片裡的麻花。所以 y 也要跟著相位繞，只是幅度比 x 小（透視壓扁）。
 * 0 = 退回鋸齒，太大會變成一串圓圈。
 * 香粉比線香略鬆一點，但**不能太鬆**：廟方要的「卷曲、擴散、打轉的優美線條」
 * 正是靠這個值。一度收到 0.22，整團就只剩上下飄、沒有翻捲了。
 */
const COIL = 0.36;

/**
 * 煙芯線寬（佔畫布高度的比例）。這是最細那一道，柔邊靠外面幾道疊出來。
 * 香粉的煙比線香厚得多——線香是 0.0032（約 2px），這裡放大到四倍，
 * 相鄰的縷要寬到彼此重疊，整團才糊得起來。
 */
const W_BASE = 0.0105;

/**
 * 疊四道畫出柔邊：由寬而淡到窄而濃。
 * 只畫一道的話，不是銳利得像鐵絲，就是糊得像霧——真實的煙是「有亮芯的柔邊」。
 * mul 是線寬倍率、a 是濃度倍率。
 *
 * 濃度是舊版（分段描邊）的 1.3 倍。舊版看起來比較濃有一部分是假的：
 * 接縫與自我交疊處 alpha 疊加，那些多出來的亮度就是使用者看到的顆粒。
 * 改成整條填滿之後不再疊加，離線量到平均亮度掉 17%，乘回 1.3 才與原本的濃度相當。
 *
 * **改成香粉之後比重要往「寬而柔」那一端移**（2026-10-13）：
 * 線香那一版最內圈是 `mul 1.0 / a 0.442`，一條很亮的芯——那正是「看得出一條一條線」
 * 的原因，對線香是對的（細煙本來就有亮芯），對香粉是錯的。
 * 現在四道的濃度幾乎拉平（0.052～0.076），相鄰的縷才會糊在一起讀成一團，
 * 而不是幾條並排的緞帶。
 *
 * **寬度不能靠一直加 `mul` 解決**：中途試過 `mul 13 / a 0.030`，那一道算出來的
 * 半寬超過 800px，但 `0.030 × 255 ≈ 7.6` **低於看得見的門檻**——量畫布像素時
 * 整道都掃不到，等於白算。要讓量感出來是「寬度收一點、但讓寬的那幾道真的看得見」。
 *
 * **要讀成雲就得把濃度從中線搬到外圍**（2026-10-13 第三次調）。
 * 線香版與第一版香粉都是「越內圈越濃」，每一縷因此有一條亮芯——五道疊起來
 * 中心 0.27、邊緣只剩 0.05，眼睛就專挑那條亮線看，十幾縷並排就是「一絲一絲」。
 * 現在最外那道獨佔 0.105、裡面四道加起來才 0.084：單縷變成一塊**平頂**的淡斑，
 * 相鄰的斑疊起來才是連續的一團。
 * 中途試過反方向（把單縷的擾動抹平讓它們更像）——那是錯的，單縷越平滑越容易
 * 被認出是一條線，紋理反而要留著讓彼此打散。
 */
const PASSES = [
  { mul: 7.0, a: 0.105 },
  { mul: 4.6, a: 0.042 },
  { mul: 3.0, a: 0.022 },
  { mul: 1.9, a: 0.012 },
  { mul: 1.1, a: 0.008 },
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
/**
 * 各頻率的權重。
 * 線香版是 [1.0, 0.40, 0.17]。香粉版略收到 [1.0, 0.30, 0.11]——**但不能收太多**：
 * 中途試過壓到 [1.0, 0.18, 0.05]，單縷確實變平滑，結果反而更像一條條直線
 * （越平滑的曲線越容易被眼睛認出是「一條」）。留一點高頻讓相鄰的縷互相穿插，
 * 才有助於糊成一團。真正決定「一絲或一團」的是 PASSES 的濃度分佈，不是這裡。
 */
const AMP = [1.0, 0.30, 0.11];

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
 * 桌機原本是 0.25（配線香那一版量出來的）。**2026-10-13 改成香粉之後往右挪到 0.285**：
 * 煙的橫向範圍從 13.7% 擴到 32%，左緣一路壓到 8.0%、實測有 3577 個像素蓋在直式標題上。
 * 往右挪是讓開標題，代價是更深入神尊區——那沒關係，桌機的煙是 z-10、神尊 z-20，
 * 散開後是從神尊背後掠過，本來就像廟裡的樣子。
 * 標題那條線是硬的，神尊那條不是。手機另有一組值，見下。
 */
const CENSER_X_WIDE = 0.285;
/**
 * 窄螢幕的爐口要往右挪。
 *
 * 擺幅是以**畫布高度**為基準（`SWAY * h`），手機又高又窄，同樣的像素擺幅換算成
 * 寬度百分比就大得多——桌機（1009×768）量到煙佔 17.2%～30.9%，同一組參數在手機
 * （390×844）卻散到 3.1%～40.5%，左邊直接壓到直式標題（實測佔 5.1%～15.4%）。
 * 手機上神尊橫跨 −1.6%～101.6%（整個寬度），煙本來就是從神尊背後經過（z-10 對
 * z-20），所以往右挪不會有新問題，只是讓開標題。
 */
const CENSER_X_NARROW = 0.52;

/**
 * 窄螢幕的橫向收斂倍率（擺幅與散開幅度一起乘）。
 *
 * **擺幅是以畫布高度為基準**（`SWAY * h`），手機又高又窄，同樣的像素擺幅換算成
 * 寬度百分比就大得多。香粉版把煙放大之後這件事被放大到不能忽視：
 * 同一組參數在桌機量到 11.1%～41.8%，在手機（375×812）散到 **1.7%～75.3%**，
 * 直接蓋住直式標題 4671 個像素。
 * 乘上這個倍率之後橫向範圍才回到合理值；桌機不受影響（只在 `wide === false` 時套用）。
 */
const NARROW_SCALE = 0.52;

/**
 * 煙往外散開的速率。
 * 線香用的是 `u^1.25`。香粉只略微提早一點（`u^1.15`）——**不要改成小於 1**：
 * 擴散是「後期」才發生的（廟方給的物理特徵：升高、降溫、受擾動才擴散打轉），
 * 指數小於 1 等於一離開粉面就張成扇形，那不是煙，是噴霧。
 * 香粉比線香寬的是**起點**（粉面有寬度，見 STRANDS 的 base 攤開範圍），不是張開的速率。
 *
 * **散開的幅度要收住，而且要把擺幅一起算進去**：煙的橫向範圍 = `spread` ＋ 擺幅，
 * 而擺幅（`SWAY`，以畫布高度為基準）本身就佔約 ±5% 的畫布寬度。只看 spread 會低估，
 * 第一版開到 ±0.07 就量出 14.1%～34.9%，兩邊都越界。改動後要用讀畫布像素的方式
 * 實測左右緣，不要用眼睛估。
 */
const fanOut = (u: number): number => Math.pow(u, 1.15);

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

/**
 * 一爐香粉（2026-10-13 廟方：「目前是模擬三柱香，我想用模擬香粉，讓整個煙很大」）。
 *
 * **香粉與線香的差別不是粗細，是來源的形狀。** 線香是一支支插著的點源，
 * 所以上一版的 `base` 只在 ±0.008 之內（幾支香擠在同一個爐口）。
 * 香粉是**一整片粉面在燒**，每一處都在冒煙，所以 `base` 要攤開到整個粉面的寬度；
 * 縷數也要夠多，彼此疊起來才會讀成「一團」而不是「幾條線」。
 *
 * **每一縷的 alpha 要比線香版低。** 縷數從 5 變 17、線寬又粗了三倍，
 * 沿用舊的濃度會疊成一塊白板。靠「多而淡」堆出厚度，不是靠「少而濃」。
 *
 * **要讀成「一團」而不是「一條條」，靠的是密度不是粗細**（2026-10-13 廟方第二次回饋）。
 * 第一版 11 縷、間距大於單縷的柔邊寬度，縫隙就看得出來。現在把位置排密、
 * 中間再插一批專門補縫的淡縷，相鄰的柔邊才互相填滿。
 * 同時壓掉高頻擾動（見 AMP）與粗細調變（見 twist）——那兩個是「單縷被認出來」的主因。
 *
 * 錯開的維度與線香版相同（位置／散向／相位／擺幅／粗細／速度／頻率），
 * 理由也一樣：同形同速的複本一眼就看得出是貼上去的。
 * `from` 刻意參差——粉面各處不是同時起煙的。
 */
const STRANDS: Strand[] = [
  // 中段（粉面正中），最濃最高
  { base:  0.000, spread:  0.004, from: 0.00, phase: 0.0, sway: 1.00, width: 1.00, alpha: 0.62, height: 1.00, speed: 1.00, freq: 1.00, mobile: true },
  { base: -0.009, spread: -0.016, from: 0.00, phase: 2.7, sway: 1.06, width: 0.96, alpha: 0.58, height: 0.99, speed: 1.06, freq: 0.86, mobile: true },
  { base:  0.010, spread:  0.018, from: 0.00, phase: 4.1, sway: 0.94, width: 0.94, alpha: 0.56, height: 0.98, speed: 0.93, freq: 1.17, mobile: true },
  { base: -0.019, spread: -0.032, from: 0.01, phase: 1.9, sway: 0.90, width: 0.88, alpha: 0.50, height: 0.96, speed: 1.12, freq: 0.74, mobile: true },
  { base:  0.020, spread:  0.034, from: 0.01, phase: 5.4, sway: 0.92, width: 0.86, alpha: 0.48, height: 0.95, speed: 0.88, freq: 1.33, mobile: true },
  // 中外圈
  { base: -0.028, spread: -0.046, from: 0.03, phase: 3.3, sway: 0.84, width: 0.78, alpha: 0.42, height: 0.93, speed: 1.00, freq: 1.09, mobile: true },
  { base:  0.029, spread:  0.048, from: 0.03, phase: 0.8, sway: 0.86, width: 0.76, alpha: 0.41, height: 0.92, speed: 0.96, freq: 0.95, mobile: true },
  { base: -0.037, spread: -0.058, from: 0.05, phase: 2.2, sway: 0.76, width: 0.68, alpha: 0.35, height: 0.89, speed: 1.19, freq: 0.68, mobile: true },
  { base:  0.038, spread:  0.060, from: 0.05, phase: 4.8, sway: 0.78, width: 0.66, alpha: 0.34, height: 0.88, speed: 0.82, freq: 1.47, mobile: true },
  // 填縫：位置刻意落在上面幾縷之間，專門補空隙，所以淡
  { base: -0.005, spread:  0.012, from: 0.08, phase: 1.1, sway: 1.02, width: 0.72, alpha: 0.33, height: 0.97, speed: 1.08, freq: 1.26, mobile: true },
  { base:  0.005, spread: -0.010, from: 0.09, phase: 5.9, sway: 1.00, width: 0.70, alpha: 0.32, height: 0.96, speed: 0.90, freq: 0.81, mobile: false },
  { base: -0.014, spread: -0.024, from: 0.14, phase: 3.9, sway: 0.88, width: 0.64, alpha: 0.29, height: 0.94, speed: 1.03, freq: 1.12, mobile: false },
  { base:  0.015, spread:  0.026, from: 0.15, phase: 0.4, sway: 0.90, width: 0.62, alpha: 0.28, height: 0.93, speed: 0.97, freq: 0.89, mobile: false },
  { base: -0.024, spread: -0.040, from: 0.22, phase: 2.5, sway: 0.82, width: 0.58, alpha: 0.25, height: 0.90, speed: 1.10, freq: 1.38, mobile: false },
  { base:  0.025, spread:  0.042, from: 0.24, phase: 4.4, sway: 0.84, width: 0.56, alpha: 0.24, height: 0.89, speed: 0.86, freq: 0.77, mobile: false },
  // 最外圍的薄霧，負責讓團的邊緣糊掉而不是切齊
  { base: -0.044, spread: -0.068, from: 0.12, phase: 1.6, sway: 0.68, width: 0.52, alpha: 0.18, height: 0.84, speed: 1.15, freq: 0.92, mobile: false },
  { base:  0.045, spread:  0.070, from: 0.13, phase: 5.1, sway: 0.70, width: 0.50, alpha: 0.17, height: 0.83, speed: 0.84, freq: 1.21, mobile: false },
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
    /** 窄螢幕要把橫向幅度收起來，見 NARROW_SCALE */
    let narrowScale = 1;

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
      narrowScale = wide ? 1 : NARROW_SCALE;
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
      const r = turb * SWAY * h * s.height * s.sway * narrowScale;
      return {
        // 從爐口同一處升起，越往上越往外散
        x: (censerX + s.base) * w + s.spread * narrowScale * fanOut(u) * w + sx * r,
        // u 由下往上、畫布 y 由上往下；height < 1 的縷只升到畫布的一部分高度
        y: h - u * h * s.height + sy * r * COIL,
      };
    };

    /** 線寬：底部就已經有寬度（粉面是一片），往上再張開 */
    const widthAt = (u: number, t: number, s: Strand): number => {
      /**
       * 線香版是 `0.25 + 2.9 × …`：底部細如髮絲、往上才張開——那是對的，
       * 因為線香是**一個點**在燒。
       * 香粉的粉面本身就有寬度，煙一離開粉面就是一片，所以起點給 0.70 不是 0.25
       * （0.25 是「底部細如髮絲」，那一行正是「底部看起來還是幾條細線」的主因）。
       * 但也不要給到 1.0 ——那樣底部就跟中段一樣寬，少了「受熱向上帶、往上才張開」
       * 的層次；廟方描述的初期是直線上升的柱，不是一開始就攤平的一片。
       */
      const grow = 0.70 + 2.40 * smoothstep(0.06, 0.88, u);
      // 用同一組相位調變粗細：緞帶正面朝你時寬、側面時窄，這是立體感的來源
      const uu = Math.pow(u, 1.5);
      // 0.6+0.4 是線香版：緞帶忽寬忽窄，立體感強但也最像「一條帶子」。
      // 香粉版收到 0.86+0.14——還留一點呼吸，但不讓單縷的輪廓被認出來。
      const twist = 0.86 + 0.14 * Math.abs(Math.cos(uu * K[0] * 0.5 * s.freq - t * omega[0] * 0.5 * s.speed + s.phase));
      // **不要把 narrowScale 乘進線寬**：試過，手機上的重疊反而從 317px 惡化到 6122px。
      // 線寬變細之後濃度集中、原本在門檻下的像素都浮出來了，適得其反。
      // 窄螢幕的讓位改用「爐口往右挪」處理（見 CENSER_X_NARROW）。
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
