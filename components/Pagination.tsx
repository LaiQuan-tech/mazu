import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * 分頁（最新活動 /bulletins 與祈福活動 /blessing 共用，2026-10-30 廟方：
 * 「這二頁，如活動多時，要有分頁」）。
 *
 * ── 為什麼這兩頁特別需要 ──
 * 同一天海報才從縮圖改成**攤開在卡片上**，一則就佔掉 229px（手機）到 411px（桌機）。
 * 公告是只進不出的——辦過的法會不會刪，一年後就是三四十則、一頁要滑一萬多像素。
 * 廟方「活動多時」指的就是這個。
 *
 * ── 給長輩用的分頁長這樣 ──
 * **數字鈕要大、要有邊框**：浮在底色上的純文字數字在長輩手上根本看不出可以按。
 * 一律 44px 見方（全站觸控目標的下限），並且**上一頁／下一頁要有字不能只有箭頭**。
 * 最後再補一行「第 N 頁，共 M 頁」——那排數字如果被省略號截過，光看數字鈕
 * 是看不出總共有幾頁的。
 *
 * ── 省略號 ──
 * 頁數多的時候只顯示「第一頁、目前這頁的前後各一頁、最後一頁」。
 * 不這樣做的話二十頁就是二十顆鈕、在手機上折成四五行，比不分頁還難用。
 */

/** 一頁幾則。兩頁共用同一個值——同一個站裡兩種翻頁節奏會讓人以為是兩個網站 */
export const PAGE_SIZE = 6;

/** 目前這頁要顯示哪幾筆 */
export const pageSlice = <T,>(items: T[], page: number): T[] =>
  items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

/** 總共幾頁（0 筆也算 1 頁，呼叫端才不必到處防 0） */
export const pageCountOf = (total: number): number => Math.max(1, Math.ceil(total / PAGE_SIZE));

/**
 * 要顯示哪些頁碼。`-1` 代表省略號。
 * 永遠含第一頁與最後一頁，中間取目前這頁的前後各一頁。
 */
const pageNumbers = (page: number, count: number): number[] => {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const keep = new Set([0, count - 1, page, page - 1, page + 1]);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    if (keep.has(i)) out.push(i);
    else if (out[out.length - 1] !== -1) out.push(-1);
  }
  return out;
};

const BTN = 'min-w-[44px] h-11 px-3 inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors';

const Pagination: React.FC<{
  /** 0 起算 */
  page: number;
  count: number;
  onChange: (page: number) => void;
  /** 念給螢幕閱讀器聽的東西名稱，例如「公告」「祈福活動」 */
  label: string;
}> = ({ page, count, onChange, label }) => {
  // 只有一頁就整個不出現——一排按不動的鈕只是多一樣要讀的東西
  if (count <= 1) return null;

  const go = (p: number) => { if (p >= 0 && p < count && p !== page) onChange(p); };

  return (
    <nav aria-label={`${label}分頁`} className="mt-10">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page === 0}
          className={`tap ${BTN} border border-temple-gold/50 text-temple-dark hover:bg-temple-gold/10 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed`}
        >
          <ChevronLeft className="w-4 h-4 -ml-1" aria-hidden="true" />上一頁
        </button>

        {pageNumbers(page, count).map((n, i) =>
          n === -1 ? (
            <span key={`gap-${i}`} className="px-1 text-gray-400 select-none" aria-hidden="true">…</span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => go(n)}
              aria-label={`第 ${n + 1} 頁`}
              aria-current={n === page ? 'page' : undefined}
              className={`tap ${BTN} ${
                n === page
                  ? 'bg-temple-red text-white shadow-sm'
                  : 'border border-temple-gold/50 text-temple-dark hover:bg-temple-gold/10'
              }`}
            >
              {n + 1}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page === count - 1}
          className={`tap ${BTN} border border-temple-gold/50 text-temple-dark hover:bg-temple-gold/10 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed`}
        >
          下一頁<ChevronRight className="w-4 h-4 -mr-1" aria-hidden="true" />
        </button>
      </div>

      {/* 數字被省略號截過時，光看鈕是不知道總共有幾頁的 */}
      <p className="text-center text-sm text-gray-500 mt-3">第 {page + 1} 頁，共 {count} 頁</p>
    </nav>
  );
};

export default Pagination;
