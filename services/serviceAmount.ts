/**
 * 「這一筆報名值多少錢」——後台所有金額的單一來源
 *
 * ── 為什麼要抽出來 ──
 * 應收管理（ReceivablesTab）、流量來源（TrafficTab）與寄給信眾的確認信，
 * 本來各自算一次。CLAUDE.md 早就寫著「不要另立一套，兩頁對不起來就沒人信」，
 * 但那只是口頭約定——三份複製品裡有兩份同時漏掉同一件事（見下），
 * 而且漏了三個月沒有人發現，因為它不會報錯，只會安靜地算出 0。
 *
 * ── 2026-10-16 修掉的那個 bug ──
 * 祈福的金額原本是 `(packageFee || 0) + 加購`，**完全沒有讀活動本身的 `fee`**。
 * 而本壇的祈福活動**一個都沒有設方案**（天赦日 300、飛昇之日 600、太子寶燈 600
 * 都是直接填在活動的 `fee` 欄），所以 `packageFee` 永遠是 null、金額永遠是 0。
 * `BlessingEventData.fee` 的註解本來就寫著「無方案時的統一費用」，只是沒人讀它。
 * 症狀：應收管理與流量來源把每一筆祈福都算成 NT$0；廟方 2026-10-16 是從
 * 「LINE 通知信眾的金額是 0 元」才發現的——**那是這個數字第一次被拿給信眾看**。
 */
import type {
  BlessingEventRecord, BlessingRegistrationRecord,
  LampRegistrationRecord, LampServiceConfig,
} from '../types';

/**
 * 點燈：金額不在報名紀錄上，要去 `lamp_service_configs` 對。
 * 對不到就回 0——那表示燈種被刪了，寧可顯示 0 也不要猜一個數字。
 */
export const lampAmount = (
  reg: Pick<LampRegistrationRecord, 'serviceId'>,
  configs: LampServiceConfig[],
): number => configs.find(c => c.id === reg.serviceId)?.fee || 0;

/**
 * 祈福：**方案費優先，沒有方案才用活動本身的統一費用**，再加上所有加購。
 *
 * 兩段都不可以省：
 *   有方案的活動，每個方案各有價錢，`fee` 可能被設成 0（見欄位註解）；
 *   沒有方案的活動，價錢只存在 `fee` 裡。
 * 加購的 `fee` 存的就是信眾自填的實際金額（隨喜品項也一樣）。
 */
export const blessingAmount = (
  reg: Pick<BlessingRegistrationRecord, 'eventId' | 'packageFee' | 'selectedAddons'>,
  events: Pick<BlessingEventRecord, 'id' | 'fee'>[],
): number => {
  const base = reg.packageFee ?? events.find(e => e.id === reg.eventId)?.fee ?? 0;
  const addons = (reg.selectedAddons ?? []).reduce((sum, a) => sum + (Number(a.fee) || 0), 0);
  return (Number(base) || 0) + addons;
};
