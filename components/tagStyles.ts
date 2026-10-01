/**
 * 前台小標籤（膠囊狀的分類／狀態標記）的統一配色
 *
 * ── 為什麼要集中 ──
 * 標籤散在公佈欄、歲時節令、祈福活動、會員中心四個地方，各寫各的之後跑出了
 * sky／emerald／orange／blue／purple 這些 Tailwind 的預設色——全站是廟紅＋金
 * （temple-red #7C5C1E、temple-gold #C49820），那幾個顏色一放上去就像別的網站
 * （廟方 2026-10-01：「標籤顏色，還是要維持一致風格」）。
 * 新增標籤時從這裡挑一個，不要自己配色。
 *
 * ── 四種分類色怎麼分得開 ──
 * 只有兩個色相可用，所以用「色相 × 填法」組合出四種：
 *   金填、褐填、金填加描邊、褐實心
 * 這樣在同一份清單裡掃過去仍然分得出類別，而整體還是同一套配色。
 *
 * ── 狀態色刻意用灰 ──
 * 「已結束／已過期／已關閉」是失效的狀態，不屬於品牌色的範圍；灰色是中性的，
 * 而且在一排金褐標籤裡「褪色」的觀感正好對應它的語意。
 */

/** 分類標籤：金填。最常見的那一類用它（聖誕節令、點燈） */
export const TAG_GOLD = 'bg-temple-gold/25 text-[#5C4310]';
/** 分類標籤：褐填 */
export const TAG_BROWN = 'bg-temple-red/10 text-temple-red';
/** 分類標籤：金填加描邊。與 TAG_GOLD 同色相但看得出差別 */
export const TAG_GOLD_OUTLINE = 'bg-temple-gold/10 text-[#7C5C1E] border border-temple-gold/50';
/** 分類標籤：褐實心白字。整份清單裡最強的那一個，給少數、重要的項目 */
export const TAG_SOLID = 'bg-temple-red text-white';

/** 狀態：進行中／待處理（需要留意但還沒完成） */
export const TAG_STATE_OPEN = 'bg-temple-gold/20 text-[#5C4310] border border-temple-gold/40';
/** 狀態：已完成／已送出 */
export const TAG_STATE_DONE = 'bg-temple-red/10 text-temple-red border border-temple-red/25';
/** 狀態：已結束／已過期／已關閉／已取消 */
export const TAG_STATE_OVER = 'bg-gray-100 text-gray-600 border border-gray-200';
