import React from 'react';
import { Landmark } from 'lucide-react';

/**
 * 匯款資訊區塊。
 *
 * **全站有兩個帳戶，而且絕對不可以混用**——這支元件存在的理由就是這件事。
 * 原本帳號是寫死在 App.tsx 的 BankInfoBox 裡的，誰要用就 `<BankInfoBox />`，
 * 於是「用哪一個帳戶」這個決定被藏在元件內部，看呼叫端完全看不出來。
 * 遷址的帳號 2026-10-23 放回來時，那種寫法只要有人順手在遷址頁打一個
 * `<BankInfoBox />`，信眾就會把遷址的錢匯進一般捐獻的帳戶。
 *
 * 所以 `account` 是**必填**、沒有預設值：每個呼叫端都得指名
 * `BANK_GENERAL` 或 `BANK_RELOCATION`，寫錯的時候看 diff 就看得出來。
 *
 * **抽成獨立檔案不是順手整理**：RelocationPage 是懶載入的，若從 App.tsx
 * 反向 import 就是循環相依（同 BulletinBody 那條教訓）。
 *
 * 帳號目前寫死在這裡。`notify_features_2026_10.sql` 有把匯款帳號搬進
 * `site_settings` 的規劃，但那支 migration 還沒跑；真的搬過去時這兩個常數
 * 就改成保底值。
 */
export interface BankAccount {
  /** 區塊標題。兩個帳戶的標題刻意不同，信眾一眼就知道自己在看哪一個 */
  label:   string;
  bank:    string;
  code:    string;
  branch:  string;
  account: string;
  holder:  string;
  /** 匯款完成後要做什麼。兩邊的流程不一樣，所以跟著帳戶走不另外傳 */
  tip:     string;
}

/** 一般捐獻與各項報名（問事／點燈／祈福／法會）用這個。 */
export const BANK_GENERAL: BankAccount = {
  label:   '匯款資訊',
  bank:    '中國信託銀行',
  code:    '822',
  branch:  '大安分行',
  account: '6025-4035-6010',
  holder:  '王順文',
  tip:     '匯款完成後請於備註填寫後五碼，收到款項即完成登記！',
};

/**
 * 遷址募資**專款**。廟方 2026-10-23 提供，文字照他們給的原話。
 *
 * 這一組 2026-09-12 曾經整個撤下（當時廟方說要等協會成立、專款帳戶設好），
 * 現在是廟方自己重新給的同一組，不是我從 git 歷史翻回來的——
 * **下次再撤下又放回來時一樣要跟廟方重新確認**，專款帳戶不保證是同一個。
 */
export const BANK_RELOCATION: BankAccount = {
  label:   '遷址募資專屬匯款帳號',
  bank:    '第一銀行',
  code:    '007',
  branch:  '古亭分行',
  account: '171-68-143732',
  holder:  '王順文',
  tip:     '匯款完成後請提供「帳號後五碼」與「姓名」，方便我們確認您的遷址護持供養。',
};

const BankInfoBox: React.FC<{ account: BankAccount; tip?: string }> = ({ account, tip }) => (
  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm space-y-0.5">
    <p className="font-bold text-amber-800 mb-1 flex items-center gap-1.5">
      <Landmark className="w-4 h-4" aria-hidden="true" />{account.label}
    </p>
    <p className="text-amber-900">銀行：{account.bank}　代碼 <span className="font-semibold">{account.code}</span></p>
    <p className="text-amber-900">分行：{account.branch}</p>
    <p className="text-amber-900">帳號：<span className="font-semibold tracking-wider">{account.account}</span></p>
    <p className="text-amber-900">戶名：{account.holder}</p>
    <p className="text-amber-700 text-xs mt-1">{tip ?? account.tip}</p>
  </div>
);

export default BankInfoBox;
