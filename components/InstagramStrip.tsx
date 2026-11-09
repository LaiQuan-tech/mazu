import React, { useEffect, useState } from 'react';
import { Play } from 'lucide-react';

/**
 * 首頁「影像紀錄」影片下方的 IG 最新四則（2026-11-09）。資料由 `api/ig.ts` 給，理由見那支的檔頭。
 *
 * ── 為什麼放這裡 ──
 * 影片與 IG 講的都是「和聖壇的日常」，放在同一區最自然。不放公佈欄旁邊：廟方發在 IG
 * 的活動海報多半就是公佈欄那一張，並排是同一件事講兩次。不另開一區：首頁 2026-10-23
 * 才砍掉三分之一，廟方要它短。
 *
 * ── 四則 ──
 * 跟上面公佈欄的四則一致：桌機一列四張、手機 2×2，兩種排法最後一列都是滿的。
 *
 * ── 抓不到就整排不畫 ──
 * 權杖還沒設、過期、IG 掛了，`api/ig` 都回空清單，這裡就什麼都不畫——不留空框、不印錯誤。
 * 「追蹤」那顆鈕跟著一起消失：沒有貼文時單獨一顆鈕掛在影片下面很突兀，
 * 而頁尾本來就有 IG 的連結。
 *
 * `vite dev` 不跑 `api/`，所以本機一定看不到這一排，那是正常的。
 */

interface IgPost {
  id: string;
  permalink: string;
  caption: string;
  isVideo: boolean;
}

/** 從 IG 帳號網址取出 @帳號，取不到就不顯示帳號名 */
const handleOf = (url: string): string => {
  const m = url.match(/instagram\.com\/([A-Za-z0-9._]+)/);
  return m ? `@${m[1]}` : '';
};

const InstagramStrip: React.FC<{ profileUrl: string }> = ({ profileUrl }) => {
  const [posts, setPosts] = useState<IgPost[]>([]);

  useEffect(() => {
    if (!profileUrl.trim()) return;
    let alive = true;
    fetch('/api/ig')
      .then(r => (r.ok ? r.json() : { posts: [] }))
      .then(j => { if (alive) setPosts(Array.isArray(j.posts) ? j.posts : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [profileUrl]);

  if (!profileUrl.trim() || posts.length === 0) return null;
  const handle = handleOf(profileUrl);

  return (
    <div className="mt-10">
      <p className="text-center text-sm text-gray-500 mb-4">Instagram 最新動態</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {posts.map(p => (
          <a
            key={p.id}
            href={p.permalink}
            target="_blank"
            rel="noopener noreferrer"
            // 讀屏軟體要知道這會離開網站、去的是 IG
            aria-label={`在 Instagram 開啟貼文${p.caption ? `：${p.caption}` : ''}`}
            title={p.caption || undefined}
            className="tap group relative block aspect-square overflow-hidden rounded-xl bg-temple-gold/10"
          >
            <img
              src={`/api/ig?img=${encodeURIComponent(p.id)}`}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              // 單張抓不到就藏起來，留下的金色底框比破圖示好看
              onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
            />
            {p.isVideo && (
              <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/55 flex items-center justify-center" aria-hidden="true">
                <Play className="w-3.5 h-3.5 text-white translate-x-px" fill="currentColor" />
              </span>
            )}
          </a>
        ))}
      </div>
      <div className="text-center mt-5">
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tap inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-temple-gold/50 text-temple-red font-medium hover:bg-temple-gold/10 transition-colors"
        >
          在 Instagram 追蹤{handle && ` ${handle}`}
        </a>
      </div>
    </div>
  );
};

export default InstagramStrip;
