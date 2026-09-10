import React from 'react';
import { heroSrc } from '../services/assetUrl';

/**
 * 團紋底紋（龍／鳳）
 *
 * 一枚極淡的圓形紋樣出血到版面邊緣外，當成建築上的紋飾而不是貼紙。
 * 作法參考北港武德宮的團龍紋。版面規則與濃淡的算法見 index.css 的 .pattern-medallion。
 *
 * **父層一定要 `relative overflow-hidden`**：紋樣是絕對定位並往外推四成，
 * 少了 overflow-hidden 會把頁面撐寬產生水平捲軸。
 * 同層的內容要給 `relative z-10`，否則會被壓在紋樣底下（紋樣是 z-0）。
 *
 * `side` 依「哪一側的邊界比較空」決定，不是憑感覺——把頁面切成 12×10 的格子
 * 標記哪些格有內容，數左右各有幾列是空的（量法與各頁的結果記在 CLAUDE.md）。
 */
export type PatternMotif = 'dragon' | 'phoenix';

const PatternMedallion: React.FC<{
  motif: PatternMotif;
  side: 'l' | 'r';
  /** 深色底的區塊。金色在深底上是「比底亮」，方向相反，要更濃才對得上 */
  onDark?: boolean;
}> = ({ motif, side, onDark }) => (
  <div
    className={`pattern-medallion pattern-${motif} pattern-medallion-${side}${onDark ? ' pattern-on-dark' : ''}`}
    aria-hidden="true"
    style={{ backgroundImage: `url(${heroSrc(`pattern-${motif}.png`)})` }}
  />
);

export default PatternMedallion;
