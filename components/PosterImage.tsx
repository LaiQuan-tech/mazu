import React, { useState } from 'react';

/**
 * 廟方海報的顯示方式（公佈欄 /bulletins 與祈福活動 /blessing 共用）。
 *
 * ── 一、不裁、不壓 ──
 * 廟方否決過兩次裁切：2026-09-26「只看得到中間 36%，標題與 QR code 全被切掉」、
 * 2026-10-11「直接就把圖在欄位內大大的展開，下面再接文字即可，這樣比較大氣」。
 * 海報上印的就是活動資訊（日期、費用、祈願文），裁掉等於把內容裁掉。
 *
 * 壓扁是另一個坑：`w-full` ＋ `max-h` 會把直式海報的寬度釘成欄寬、高度又被上限夾住，
 * 比例就沒了（實測 853×1280 變成 780×576）。這裡用 `object-contain` 擋下來——
 * **外框是外框、圖是圖**，直式海報在框裡依比例縮並置中。**不要把 contain 拿掉。**
 *
 * ── 二、位置要先占好，不然每張卡都會跳一下 ──
 * `loading="lazy"` 的圖在載入前高度是 0，圖一到位卡片就長高、下面整串往下彈
 * （廟方 2026-10-25 回報過首頁「會跳一下」，同一個病）。
 * 資料庫只存網址、沒有存尺寸，所以**先用 3:2 占位**：廟方的海報現在幾乎都是 3:2
 * （實測 1525×1031、1526×1030、1200×810），這些等於完全不跳；
 * 只有舊的直式海報（853×1280）會在載入後補一次高度，而且只補那一張。
 *
 * ── 三、高度上限由呼叫端決定 ──
 * 同一張海報在「收合的清單」與「展開的內容」該佔的份量不一樣，
 * 所以 `maxH` 是傳進來的 Tailwind class，不寫死在這裡。
 */

/**
 * 收合／清單狀態的高度上限。**這個數字是算出來的，不是調出來的。**
 *
 * 只要上限小於「欄寬 ÷ 海報比例」，海報就會被夾住、兩側留白——廟方 2026-10-30
 * 反映桌機「怪怪的」就是這個（當時 `max-h-72`＝288，而桌機欄寬 832px 的 3:2 海報
 * 要 555px 高，結果是一張 427px 的小圖飄在中間）。
 *
 * 欄寬是 `max-w-2xl`（672）扣掉各斷點的內距，最寬的一檔是 `sm:px-6` → **624px**。
 * 廟方現有海報最淺的比例是 1525×1031＝1.479，624 ÷ 1.479 ＝ **422px**。
 * 取 27rem（432）留一點餘裕，**任何斷點、任何一張現有海報都夾不到**。
 *
 * 真正會被夾的只有直式海報（853×1280），那是刻意的：不夾它在桌機會高到 912px，
 * 一則就佔滿整個螢幕，而公佈欄與祈福活動都是要一路往下看完的清單。
 *
 * **改欄寬（`max-w-2xl`）就要回來重算這個數字。**
 */
export const POSTER_LIST_MAX_H = 'max-h-[27rem]';

interface Props {
  src: string;
  /**
   * 預設空字串＝裝飾性。**多數情況就該是空的**：海報通常緊接在標題上下、
   * 同一顆鈕裡，給了 alt 會被螢幕閱讀器把同一句話念兩次。
   * 圖片搜尋要的 alt 由 scripts/prerender.js 寫進圖片 sitemap，不靠這裡。
   */
  alt?: string;
  /** 高度上限的 Tailwind class，例如 `max-h-72`、`max-h-[36rem]` */
  maxH: string;
  className?: string;
}

const PosterImage: React.FC<Props> = ({ src, alt = '', maxH, className = '' }) => {
  const [ratio, setRatio] = useState(1.5);
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight || 1.5)}
      style={{ aspectRatio: String(ratio) }}
      className={`block w-full h-auto object-contain ${maxH} ${className}`}
    />
  );
};

export default PosterImage;
