import React from 'react';

/**
 * 太極圖示（2026-11-10 廟方：「首頁宮廟服務的祈福法會 icon 可以換成☯嗎？」）。
 *
 * **不直接放 ☯ 這個字元**：它在 iOS 與部分 Android 上會被畫成彩色的 emoji，
 * 跟旁邊兩張卡的白色線條圖示（lucide）擺在一起風格不一，而且全站規則是不用 emoji。
 * 所以照 lucide 的規格自己畫：24×24、`currentColor`、外框線寬 2，用法與 lucide 的元件一樣
 * （`className="w-8 h-8 text-white"`）。
 *
 * 陰的那一半用填色、陽的那一半留空，兩顆魚眼一實一空。**空心的那顆用 evenodd 挖洞**，
 * 不是疊一個底色的圓——圖示的底是 `bg-temple-red`、hover 時換成 `bg-temple-gold`，
 * 寫死任何一個顏色都會在另一個狀態露餡。
 */
const TaijiIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    {/* 右半圓＋左下小半圓－右上小半圓，再挖掉下方那顆魚眼 */}
    <path
      d="M12 2a10 10 0 0 1 0 20a5 5 0 0 1 0-10a5 5 0 0 0 0-10z M13.6 17a1.6 1.6 0 1 0-3.2 0a1.6 1.6 0 1 0 3.2 0z"
      fill="currentColor"
      fillRule="evenodd"
      stroke="none"
    />
    <circle cx="12" cy="7" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);

export default TaijiIcon;
