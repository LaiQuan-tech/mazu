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
import { SharedServiceType } from '../types';

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
