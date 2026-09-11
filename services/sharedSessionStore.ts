/**
 * 主揪建立過哪些共享報名表——只記在這台瀏覽器
 *
 * ── 為什麼需要這個 ──
 * 原本只有 `shared_creator_<id>` 這個布林旗標，用來判斷「現在看的這張表是不是我開的」。
 * 但那要先知道 id 才問得出來，而 id 只存在網址列的 ?share= 裡：主揪只要關掉分頁、
 * 或點一下導覽列跳到別頁，整張還沒送出的表就再也找不回來（廟方 2026-09-10 回報
 * 「整張訂單都不見」）。所以另外存一份清單，讓前台能主動把未送出的表撈出來提醒。
 *
 * ── 為什麼不存到資料庫 ──
 * 共享場次採 capability 模式：知道 UUID 就能讀寫，沒有「擁有者」這個欄位（見
 * services/supabase.ts 的說明）。要記「誰開的」就得先有帳號，但揪團刻意不要求登入。
 * 存在瀏覽器是這個設計下唯一誠實的做法——換手機就找不到，這一點要讓主揪知道，
 * 所以建立時的分享視窗會提示把連結存起來。
 *
 * ── 清單只增不減會爆 ──
 * 送出後移除、超過保留上限時砍最舊的。過期的（連結 7 天到期）在讀取時濾掉。
 */
import { SharedServiceType, SharedSessionRecord } from '../types';
import { deleteSharedSession } from './supabase';

/** 各服務的獨立頁路徑。回到某張表時要帶著走（三種服務各自獨立成頁） */
export const SERVICE_PATH: Record<SharedServiceType, string> = {
  lamp: '/lamps', blessing: '/blessing', booking: '/booking',
};

export const SHARED_LABEL: Record<SharedServiceType, string> = {
  lamp: '點燈', blessing: '祈福活動', booking: '問事',
};

/**
 * 主揪主動刪除一張共享報名表——先警示，再刪，回傳是否真的刪了。
 *
 * 集中在這裡是因為兩個入口都要用（服務頁的面板、會員中心的紀錄），警示文字
 * 只能有一份。警示要寫明兩件無法復原的事：名單會跟著沒、分享出去的連結會失效。
 * 用 confirm() 與通訊錄刪聯絡人同一個做法。
 *
 * RLS 擋下的 DELETE 是靜默 0 列不會報錯（不是本人、或沒有擁有者的舊場次），
 * deleteSharedSession 會讀回列數，這裡依情況分兩種說明。
 */
export const confirmAndDeleteSharedSession = async (session: SharedSessionRecord): Promise<boolean> => {
  const n = session.entries.length;
  const ok = window.confirm(
    '確定要刪除這張揪團報名表嗎？\n\n' +
    (n > 0 ? `已加入的 ${n} 位親友資料會一起刪除，無法復原。\n` : '') +
    '分享出去的連結會失效，親友再點會看到「找不到這張報名表」。',
  );
  if (!ok) return false;
  try {
    const deleted = await deleteSharedSession(session.id);
    if (!deleted) {
      alert(session.createdBy
        ? '只有建立這張報名表的人可以刪除。'
        : '這張是舊版建立的報名表，沒有紀錄建立者，無法手動刪除，會在到期後自動失效。');
      return false;
    }
    forgetMyShared(session.id);
    return true;
  } catch {
    alert('刪除失敗，請稍後再試。');
    return false;
  }
};

const KEY = 'shared_sessions_mine';
/** 一個人不會同時開很多張；留 20 筆足夠，也避免 localStorage 無限長大 */
const MAX_KEPT = 20;

export interface MySharedSession {
  id: string;
  serviceType: SharedServiceType;
  /** 建立時的頁面路徑，回去時要帶著（三種服務各自獨立成頁） */
  path: string;
  createdAt: string;
}

const read = (): MySharedSession[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(x => x && typeof x.id === 'string') : [];
  } catch {
    // 內容壞掉（手動改過、舊格式）不該讓整頁掛掉，當成沒有就好
    return [];
  }
};

const write = (list: MySharedSession[]): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_KEPT)));
  } catch {
    // 無痕模式或容量滿了會丟例外。記不住只是少了提醒，不影響報名本身
  }
};

/** 建立共享場次後呼叫。同一個 id 重複記只會更新，不會長出兩筆 */
export const rememberMyShared = (s: MySharedSession): void => {
  write([s, ...read().filter(x => x.id !== s.id)]);
};

/** 送出後或主揪自己關掉時呼叫 */
export const forgetMyShared = (id: string): void => {
  write(read().filter(x => x.id !== id));
  try { localStorage.removeItem(`shared_creator_${id}`); } catch { /* 同上 */ }
};

/** 這台瀏覽器開過的表，新的在前 */
export const listMyShared = (): MySharedSession[] => read();

/** 這張表是不是我開的。沿用舊的 per-id 旗標，讓這次改動前就存在的場次仍然認得出來 */
export const isMyShared = (id: string): boolean => {
  try {
    if (localStorage.getItem(`shared_creator_${id}`) === 'true') return true;
  } catch { /* 讀不到就往下用清單判斷 */ }
  return read().some(x => x.id === id);
};
