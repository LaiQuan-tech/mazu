import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { heroSrc } from '../services/assetUrl';

/**
 * YouTube 影片的「封面代打」（facade）：**預設只畫一張圖，按下去才載入播放器**。
 *
 * ── 為什麼不直接放 iframe ──
 * YouTube 的 iframe 一掛上去就是數百 KB 的 JS 與一批 cookie。本站的信眾以長者
 * 居多、手機不新，而且首頁那一支是「路過看到」不是「特地來看」的——沒按播放
 * 就先替每個人付掉那些流量，是把成本轉嫁給最不該付的人。
 * 網域用 `youtube-nocookie`：**沒按播放之前不該有人被記上一筆。**
 *
 * ── 封面存自己的 public/ 不連 i.ytimg.com ──
 * 同樣的理由：沒按播放之前不必向 Google 發一次請求，而且圖多大、壓多少由我們
 * 決定。代價是上傳者換了預覽圖這邊不會跟著變，重跑
 * `scripts/build-shower-covers.js` 即可（加影片也跑那一支，用法在檔頭）。
 * **檔名要加進 `vite.config.ts` 的 `HERO_FILES`**，否則換圖時網址不變、
 * 信眾會拿到舊快取。
 *
 * ── 這支是 2026-10-24 從 ShowerPage 抽出來的，不是新寫的 ──
 * 首頁也要放影片時，facade 這段機制（長寬比框、封面、播放鈕、換成 iframe）
 * 一字不差會再抄一份。抄第二份就是「改一邊忘了改另一邊」的開始，
 * 而這個 repo 已經為那件事付過一次三個月的代價（見 CLAUDE.md 祈福金額那條）。
 * **各頁自己的部分留在各頁**：沐浴車的粉色與圖說、首頁的金色與區塊標題，
 * 都是呼叫端給的，這裡只管「按下去才載入」這件事。
 *
 * ── 配色不要用 `bg-white` ──
 * 青花紙主題會把 `.bg-white` 與 `bg-white/xx` 一律壓成 `rgba(255,255,255,.07)`
 * （見 `inkTheme.ts`），播放鈕會變成壓在照片上幾乎看不見的一團。
 * 所以 `accent.btn` 一律給方括號的任意色，由呼叫端指定。
 */
export interface VideoAccent {
  /** 圖還沒載進來時那一塊的底色；也是 iframe 載入前的底 */
  box: string;
  /** 播放鈕的底。**不要用 bg-white**，理由見檔頭 */
  btn: string;
  /** 播放鈕裡三角形的顏色 */
  icon: string;
}

const VideoFacade: React.FC<{
  /** YouTube 影片 id */
  id: string;
  /** 無障礙用：螢幕閱讀器會念「播放影片：○○」 */
  title: string;
  /** 封面檔名去掉副檔名，例如 `home-video-UxMaZ5WRrdE`（webp 與 jpg 各一份） */
  cover: string;
  /** 直式（9:16 的 Shorts）。橫式不填 */
  portrait?: boolean;
  accent: VideoAccent;
}> = ({ id, title, cover, portrait, accent }) => {
  const [playing, setPlaying] = useState(false);

  return (
    // 長寬比兩種狀態共用，換成播放器時版面不會跳
    <div className={`relative overflow-hidden rounded-2xl ${accent.box} ${portrait ? 'aspect-[9/16]' : 'aspect-video'}`}>
      {playing ? (
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`播放影片：${title}`}
          className="group absolute inset-0 w-full h-full"
        >
          <picture>
            <source srcSet={heroSrc(`${cover}.webp`)} type="image/webp" />
            <img
              src={heroSrc(`${cover}.jpg`)}
              alt=""
              width={portrait ? 480 : 1280}
              height={portrait ? 854 : 720}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </picture>
          <span className="absolute inset-0 flex items-center justify-center">
            {/* 小卡片上 64px 的圓鈕會佔掉四成高度，窄螢幕縮一號 */}
            <span className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full ${accent.btn} flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110`}>
              <Play className={`w-6 h-6 sm:w-7 sm:h-7 ${accent.icon} translate-x-0.5`} fill="currentColor" aria-hidden="true" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
};

export default VideoFacade;
