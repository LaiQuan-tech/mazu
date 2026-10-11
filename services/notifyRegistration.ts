/**
 * 報名成功後通知廟方信箱
 *
 * 工作人員還沒有習慣每天開後台（廟方 2026-10-11），所以每一筆報名都推一封信到
 * 他們本來就會看的 Gmail。真正寄信的是 `api/notify-registration.ts`，
 * 這裡只負責「報名寫進去了，去看一下第 N 筆」。
 *
 * ── 一筆訂單只寄一封 ──
 * 一次報好幾個人（家人一起點燈、揪團）在本站是常態，那在廟方眼中是**同一筆訂單**
 * （廟方 2026-10-12）。一人一封會讓一團五個人變成五封信，重點反而被自己洗掉。
 * 所以 id 收 **單一 id 或一整批**：多人的送出路徑先不寄，收齊之後整批寄一封。
 *
 * ── 三條規則，違反任何一條都會讓報名流程變差 ──
 * 1. **不 await**：信眾按下送出之後等的是「報名成功」畫面，不是等一封信寄完。
 * 2. **不丟例外**：通知失敗絕對不可以讓報名看起來失敗。所有錯誤吞掉只留 console。
 * 3. **只送 id 不送內容**：內容由後端自己回資料庫撈。前端送內容等於把那支端點
 *    變成「誰都能叫它寄任意文字」的垃圾信發射器。
 *
 * 本機開發沒有 Vercel 函式（vite dev 不跑 `api/`），所以這支一定會 404——
 * 那是正常的，不要為了消掉它而把呼叫拿掉。
 */

/** 會通知的表。與 api/notify-registration.ts 的白名單一致，改一邊要改兩邊 */
export type NotifyTable =
  | 'bookings'
  | 'lamp_registrations'
  | 'blessing_registrations'
  | 'fahui_registrations'
  | 'volunteer_registrations'
  | 'donations';

export const notifyRegistration = (table: NotifyTable, id: string | string[]): void => {
  const ids = (Array.isArray(id) ? id : [id]).filter(Boolean);
  if (ids.length === 0 || typeof fetch !== 'function') return;
  // keepalive：信眾送出後常常立刻關掉分頁或跳走，沒有這個旗標請求會被瀏覽器取消
  fetch('/api/notify-registration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, id: ids.length === 1 ? ids[0] : ids }),
    keepalive: true,
  }).catch(() => { /* 見檔頭規則 2 */ });
};
