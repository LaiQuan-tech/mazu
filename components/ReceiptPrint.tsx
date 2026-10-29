/**
 * 收據列印版面——一式三聯，合併在一張 A4。
 *
 * ── 為什麼是一張 A4 切三等份 ──
 * 廟方 2026-10-30：「一式三聯，信眾收執（含感謝狀）、財務憑證、存根，
 * 最好能合併在一張 A4 內，這樣只要印一張 A4 就好。」
 * 傳統是複寫紙一式三聯，換成雷射印表機之後複寫做不到，所以改成同一張紙印三份、
 * 中間裁切線剪開。A4 直式 297mm 切三等份＝每聯 99mm。
 *
 * ── 三聯的內容完全相同，只有聯別不同 ──
 * 這是刻意的。三聯本來就是同一張單的三份複寫，內容不一樣就不是複寫了。
 * 差別只有右下角那一行（收執聯／財務憑證聯／存根聯）。
 *
 * ── 金額同時印國字大寫與阿拉伯數字 ──
 * 阿拉伯數字可以被改（1,200 加一筆變 11,200），國字大寫不行。
 * 紙本收據同時印兩種就是為了這件事，所以**兩個都要印、不能只印一個**。
 * 大寫由 `amountToChinese()` 從同一個數字算出來，不是另外輸入的——
 * 兩個欄位各自輸入就是兩個可以寫錯而且無法交叉驗證的地方。
 *
 * ── 作廢的收據也印得出來，但要蓋滿「作廢」 ──
 * 財務查帳時會需要調閱作廢的那一張。印得出來但一眼看得出不能用。
 *
 * ── 列印怎麼只印這一張 ──
 * 沿用傳票那一套：index.html 的 `@media print` 把畫面其他東西藏起來，
 * 只留 `.receipt-print-root`。不另開視窗——另開會失去樣式，而且會被彈出視窗封鎖擋掉。
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ReceiptRecord, receiptTotal, amountToChinese, rocDateParts } from '../services/receipts';

export interface ReceiptTempleInfo {
  /** 宮廟名稱，印在抬頭 */
  name: string;
  /** 感謝詞，例如「聖母之心，以仁為道，以和為貴，誠摯感謝。」 */
  thanksText: string;
  /** 寺廟登記證字號 */
  certNo: string;
  address: string;
  phone: string;
  taxId: string;
  /** 底部簽章欄的頭銜，兩個 */
  signTitles: [string, string];
}

const COPIES: Array<{ key: string; label: string }> = [
  { key: 'a', label: '第一聯：收執聯（信眾收執）' },
  { key: 'b', label: '第二聯：財務憑證聯' },
  { key: 'c', label: '第三聯：存根聯' },
];

const ReceiptCopy: React.FC<{
  r: ReceiptRecord; temple: ReceiptTempleInfo; copyLabel: string; last: boolean;
}> = ({ r, temple, copyLabel, last }) => {
  const total = receiptTotal(r.items);
  const d = rocDateParts(r.issuedAt);
  const voided = r.status === 'void';

  return (
    <div className={`rc-copy${last ? '' : ' rc-cut'}`}>
      {voided && <div className="rc-void-mark">作　廢</div>}

      <div className="rc-head">
        <div className="rc-temple">{temple.name}</div>
        <div className="rc-title">感　謝　狀</div>
        <div className="rc-no">收據編號　<span className="rc-no-v">{r.receiptNo}</span></div>
      </div>

      <div className="rc-body">
        <table className="rc-table">
          <tbody>
            <tr>
              <td className="rc-l">中華民國</td>
              <td className="rc-v" colSpan={3}>
                {d.year} 年　{d.month} 月　{d.day} 日
                <span className="rc-time">{d.time}</span>
              </td>
            </tr>
            <tr>
              <td className="rc-l">捐獻大德</td>
              <td className="rc-v rc-big" colSpan={3}>{r.title}</td>
            </tr>
            <tr>
              <td className="rc-l">項目</td>
              <td className="rc-v" colSpan={3}>
                {/* 合開時每個項目各自列出金額：收據上只寫「油香」而收 1,800 元，
                    信眾看不出那 1,800 是怎麼來的 */}
                {r.items.length > 1
                  ? r.items.map(i => `${i.label} $${i.amount.toLocaleString()}`).join('　')
                  : (r.items[0]?.label ?? '')}
              </td>
            </tr>
            <tr>
              <td className="rc-l">電話</td>
              <td className="rc-v" colSpan={3}>{r.phone || ''}</td>
            </tr>
            <tr>
              <td className="rc-l">地址</td>
              <td className="rc-v" colSpan={3}>{r.address || ''}</td>
            </tr>
            <tr>
              <td className="rc-l">金額</td>
              <td className="rc-v rc-big">{amountToChinese(total)}</td>
              <td className="rc-v rc-nt">NT $</td>
              <td className="rc-v rc-amt">{total.toLocaleString()}-</td>
            </tr>
            <tr>
              <td className="rc-l">附註</td>
              <td className="rc-v rc-foot" colSpan={3}>
                <div>{temple.thanksText}</div>
                <div>寺廟登記證：{temple.certNo}</div>
                <div>地址：{temple.address}</div>
                <div>電話：{temple.phone}　統一編號：{temple.taxId}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 右側備註欄：照紙本的版面，整高一欄 */}
        <div className="rc-memo">
          <div className="rc-memo-h">備註</div>
          <div className="rc-memo-b">{r.note || ''}</div>
        </div>
      </div>

      <div className="rc-sign">
        <span>{temple.signTitles[0]}　　　　</span>
        <span>{temple.signTitles[1]}　　　　</span>
        <span>經手人　{r.createdByName || ''}</span>
        <span className="rc-copy-label">{copyLabel}</span>
      </div>
    </div>
  );
};

/**
 * 列印，並把「另存為 PDF」的預設檔名改成收據編號（廟方 2026-10-30）。
 *
 * **瀏覽器的 PDF 檔名就是 `document.title`**，沒有別的 API 可以指定。
 * 所以列印前換掉、印完還原。
 *
 * 還原綁在 `afterprint` 而不是 `print()` 回來的那一刻：`window.print()`
 * 在多數瀏覽器是同步阻塞的，但這件事沒有保證——真的非同步時，在 print()
 * 之後立刻還原會讓對話框抓到舊標題，檔名又變回網站名稱。
 */
export const printReceipt = (receiptNo: string): void => {
  const prev = document.title;
  document.title = `收據 ${receiptNo}`;
  const restore = () => {
    document.title = prev;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
};

const ReceiptPrint: React.FC<{
  /** 一張或多張。**多張時一張一頁**，每一頁自己是完整的一式三聯。 */
  receipt: ReceiptRecord | ReceiptRecord[];
  temple: ReceiptTempleInfo;
  /** 畫完一次之後自動開列印對話框。補印時由呼叫端控制。 */
  autoPrint?: boolean;
  /** 在螢幕上也顯示（預覽用）。列印版面沒有別的方法可以驗證。 */
  screen?: boolean;
  onDone?: () => void;
}> = ({ receipt, temple, autoPrint = true, screen = false, onDone }) => {
  const list = Array.isArray(receipt) ? receipt : [receipt];
  /** 檔名：一張就是那個號，多張講頭尾（`收據 115-00001～115-00004`） */
  const fileLabel = list.length === 1
    ? list[0].receiptNo
    : `${list[0]?.receiptNo ?? ''}～${list[list.length - 1]?.receiptNo ?? ''}`;

  useEffect(() => {
    if (!autoPrint || list.length === 0) return;
    // 等一次 paint，否則會印到空白（同 VoucherPrint）
    const t = setTimeout(() => { printReceipt(fileLabel); onDone?.(); }, 80);
    return () => clearTimeout(t);
  }, [autoPrint, onDone, fileLabel, list.length]);

  const content = (
    <div className={`receipt-print-root${screen ? ' rc-screen' : ''}`}>
      {list.map((rec, n) => (
        /* 一張收據一頁。最後一張不加分頁，否則會多印一張空白 */
        <div key={rec.id} className={`rc-sheet${n < list.length - 1 ? ' rc-sheet-break' : ''}`}>
          {COPIES.map((c, i) => (
            <ReceiptCopy key={c.key} r={rec} temple={temple}
              copyLabel={c.label} last={i === COPIES.length - 1} />
          ))}
        </div>
      ))}
    </div>
  );

  /**
   * **列印時 portal 到 `document.body`**，不要留在 React 樹裡。
   * 留在裡面的話，要藏掉後台就只能用 `visibility: hidden`——那只是看不見，
   * 版面高度還在，於是印出來會多出十幾張空白（廟方 2026-10-30 實測 21 頁）。
   * Portal 出去之後就能直接 `#root { display: none }`，版面乾淨。
   *
   * 螢幕預覽不 portal：那一份要留在頁面流裡才看得到位置。
   */
  return screen ? content : createPortal(content, document.body);
};

export default ReceiptPrint;
