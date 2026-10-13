/**
 * 廟方在後台按下「已確認」之後，通知信眾一聲
 *
 * ── 這支只負責攢與送，信的內容由後端自己去資料庫撈 ──
 * 同 notifyRegistration 的理由：前端只送 `{ table, id }`。
 * 差別在**這封信是寄給信眾的**，所以 `api/notify-confirm.ts` 要求管理員身分
 * ——公開的話，猜中任何一筆報名的 UUID 就能對那個人寄信。
 *
 * ── 為什麼要攢一下再送（BATCH_MS）──
 * 廟方 2026-10-12 定的規則：「揪團是像同一筆訂單。只要最後通知一次即可。」
 * 一家五口一起點燈是同一筆訂單，但後台的狀態是**每一列一顆下拉選單**，
 * 廟方會連著點五次。每點一次就寄一封，信眾會收到五封幾乎一樣的信。
 * 所以這裡把連續幾次確認攢在一起，停手幾秒後一次送出，後端再依收件信箱分組寄一封。
 *
 * 計時器**每次有新的 id 就重新開始**：廟方是一列一列慢慢點的，
 * 固定視窗會在他點到第三列時就把前兩列送出去。
 *
 * ── 離開頁面前一定要補送（flush）──
 * 攢在記憶體裡的東西，分頁一關就沒了，而廟方很可能點完最後一列就關掉後台。
 * 所以 `pagehide`／`visibilitychange` 時立刻送，並且帶 `keepalive: true`
 * ——這樣請求能活過頁面卸載。**不能用 `navigator.sendBeacon`**：它設不了
 * Authorization 標頭，而這支端點要驗管理員身分。
 *
 * ── 三條不可違反的規則（同 notifyRegistration）──
 * 不 `await`（廟方等的是列表更新，不是等信寄完）、不丟例外（通知失敗不可以讓
 * 「改狀態」看起來失敗）、沒設定好就安靜跳過。
 */

import { supabase } from './supabase';

/** 可以寄確認信的表，要與 api/notify-confirm.ts 的白名單一致 */
export type ConfirmTable =
  | 'bookings'
  | 'lamp_registrations'
  | 'blessing_registrations'
  | 'donations'
  | 'fahui_registrations';

/**
 * 停手多久才送出。
 * 6 秒是「廟方點下一列的間隔」與「等太久會被關掉分頁」之間的取捨
 * ——關掉分頁本來就有 flush 接著，所以寧可偏長一點，讓同一團確實併成一封。
 */
const BATCH_MS = 6000;

/** 一批最多幾筆，與後端的 MAX_IDS 一致。超過的留在佇列裡下一批送 */
const MAX_IDS = 50;

/** 表 → 待送的 id。用 Set 自動去重（廟方把同一列改來改去只會送一次） */
const pending = new Map<ConfirmTable, Set<string>>();
let timer: ReturnType<typeof setTimeout> | undefined;
/** 事件只掛一次。模組層級而不是每次呼叫都掛，否則點十列就有十個監聽器 */
let listenersBound = false;

/**
 * 先備好的 access token。
 * **不能等到 flush 才去拿**：flush 最重要的一條路徑是 `pagehide`，那一刻
 * `await supabase.auth.getSession()` 還沒回來頁面可能就被拆掉了，請求根本沒送出。
 * 改成排入佇列時就先拿（那時有的是時間），flush 直接同步發 fetch。
 */
let cachedToken = '';

const refreshToken = (): void => {
  supabase.auth.getSession()
    .then(({ data }) => { cachedToken = data.session?.access_token ?? ''; })
    .catch(() => { /* 拿不到就維持原值，postBatch 會再試一次 */ });
};

const post = async (table: ConfirmTable, ids: string[], needToken: boolean): Promise<void> => {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (needToken) {
      let token = cachedToken;
      if (!token) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token ?? '';
        cachedToken = token;
      }
      // 沒有 token 就寄不了（那支要管理員身分）。安靜跳過——改狀態本身已經成功了
      if (!token) return;
      headers.Authorization = `Bearer ${token}`;
    }
    await fetch('/api/notify-confirm', {
      method: 'POST', headers,
      body: JSON.stringify({ table, id: ids }),
      keepalive: true,
    });
  } catch {
    /* 通知失敗不可以影響送出流程與後台操作 */
  }
};

/** 把攢著的全部送出。離開頁面前與計時器到點時都會走這裡 */
export const flushConfirmEmails = (): void => {
  if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
  if (pending.size === 0) return;
  const batches: [ConfirmTable, string[]][] = [];
  pending.forEach((set, table) => {
    const ids = [...set];
    while (ids.length > 0) batches.push([table, ids.splice(0, MAX_IDS)]);
  });
  pending.clear();
  // 刻意不 await：呼叫端是 UI 事件處理函式
  batches.forEach(([table, ids]) => { void post(table, ids, true); });
};

const bindListeners = (): void => {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;
  // pagehide 比 beforeunload 可靠（iOS Safari 常常不發 beforeunload）
  window.addEventListener('pagehide', flushConfirmEmails);
  // 切到別的分頁也算「可能不會再回來」，先送出去比較保險
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushConfirmEmails();
  });
};

/**
 * 排一筆確認信。廟方把某一列改成「已確認」時呼叫。
 *
 * **不檢查這筆有沒有信箱、是不是寄過了**——那兩件事後端才知道
 * （信箱可能要拿電話去對會員帳號，`confirm_sent_at` 也在資料庫裡）。
 * 前端自己判斷等於把同一套規則寫兩份，遲早對不起來。
 */
export const queueConfirmEmail = (table: ConfirmTable, id: string): void => {
  if (!id) return;
  bindListeners();
  refreshToken();   // 每次都更新：token 會過期，而兩次確認之間可能隔很久
  const set = pending.get(table) ?? new Set<string>();
  set.add(id);
  pending.set(table, set);
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(flushConfirmEmails, BATCH_MS);
};

/**
 * 隨喜捐獻的感謝信：**送出成功當下就寄，不等廟方確認**（廟方 2026-10-13
 * 「捐獻，直接寄感謝信」）。
 *
 * 與上面那條路的三個差別：
 *  1. **不攢**。它不是「廟方一列一列按」而是「一次送出一整批」，id 本來就收齊了。
 *  2. **不帶 token**。寄的人就是捐款人本人，他沒有也不該有管理員身分
 *     （端點那邊靠「建立未滿十分鐘」＋ confirm_sent_at 擋濫用）。
 *  3. **不 await**。捐款人等的是「捐獻成功」畫面，不是等信寄完。
 *
 * 多筆捐獻一次送出會併成一封信（端點依收件信箱分組），同廟方對通知信的要求。
 */
export const sendDonationThanks = (ids: string[]): void => {
  const clean = ids.filter(Boolean);
  if (clean.length === 0) return;
  void post('donations', clean, false);
};
