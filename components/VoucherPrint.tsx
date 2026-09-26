/**
 * 傳票列印版面——把資料庫裡的一個數字排回廟方紙本的金額格子。
 *
 * ── 為什麼格子只出現在這裡 ──
 * 「佰萬／拾萬／萬／仟／佰／拾／元」是紙本防竄改的作法：每格一個數字，事後加不上去。
 * 那是**版面**不是資料。資料庫只存一個整數，要印成傳票時才由 `digitCells()` 拆開。
 * 這樣版面與廟方原本的表一模一樣，但資料永遠只有一份、不會自相矛盾。
 *
 * ── 簽章欄留白 ──
 * 廟方決定第一階段不做系統簽核（後台目前只有兩個帳號，四關簽核沒有人可以簽），
 * 所以總幹事／執行長／會計／財務四格是**印出來手簽**的。
 *
 * ── 列印怎麼只印這一張 ──
 * 用 index.html 的 `@media print` 規則把畫面其他東西都藏起來，只留 `.voucher-print-root`。
 * 不另開視窗：另開視窗會失去樣式，而且會被瀏覽器的彈出視窗封鎖擋掉。
 */
import React, { useEffect } from 'react';
import { AccountingAccount, VoucherRecord, voucherTotal } from '../types';

/** 單頭合計用七格（佰萬起），明細用六格（拾萬起）——與廟方那張表一致 */
const HEAD_UNITS = ['佰萬', '拾萬', '萬', '仟', '佰', '拾', '元'];
const ITEM_UNITS = ['拾萬', '萬', '仟', '佰', '拾', '元'];

/**
 * 把金額拆進格子，靠右對齊、前面補空白。
 * 超出格數時回傳 null，由呼叫端改印純數字——寧可版面不完美，也不要靜默把
 * 一百萬印成十萬（截斷金額是財務文件最不能犯的錯）。
 */
const digitCells = (amount: number, cols: number): string[] | null => {
  const s = String(Math.max(0, Math.round(amount)));
  if (s.length > cols) return null;
  return [...Array(cols - s.length).fill(''), ...s.split('')];
};

const Cells: React.FC<{ amount: number; units: string[] }> = ({ amount, units }) => {
  const cells = digitCells(amount, units.length);
  if (!cells) {
    return <td colSpan={units.length} className="vp-cell vp-num">{amount.toLocaleString()}</td>;
  }
  return <>{cells.map((d, i) => <td key={i} className="vp-cell vp-digit">{d}</td>)}</>;
};

interface Props {
  voucher: VoucherRecord;
  accounts: AccountingAccount[];
  onDone: () => void;
}

const VoucherPrint: React.FC<Props> = ({ voucher, accounts, onDone }) => {
  const total = voucherTotal(voucher.items);
  const accountOf = (id: string | null) => {
    const a = accounts.find(x => x.id === id);
    return a ? `${a.code} ${a.name}` : '';
  };
  const d = new Date(voucher.voucherDate || Date.now());
  const kinds = new Set(voucher.attachments.map(a => a.kind));

  // 掛上就印，印完（或取消）就把畫面收回去
  useEffect(() => {
    const after = () => onDone();
    window.addEventListener('afterprint', after);
    const t = setTimeout(() => window.print(), 80);   // 等一次 paint，否則會印到空白
    return () => { window.removeEventListener('afterprint', after); clearTimeout(t); };
  }, [onDone]);

  return (
    <div className="voucher-print-root">
      <h1 className="vp-title">
        和聖壇　{voucher.direction === 'expense' ? '支出傳票' : '收入傳票'}
      </h1>

      <table className="vp-table">
        <tbody>
          <tr>
            <th className="vp-cell vp-label">建立時間</th>
            <td className="vp-cell" colSpan={2}>{d.getFullYear()} 年</td>
            <td className="vp-cell" colSpan={2}>{d.getMonth() + 1} 月</td>
            <td className="vp-cell" colSpan={2}>{d.getDate()} 日</td>
            <th className="vp-cell vp-label">單號</th>
            <td className="vp-cell" colSpan={3}>{voucher.voucherNo}</td>
          </tr>
          <tr>
            <th className="vp-cell vp-label" rowSpan={2}>合計金額</th>
            {HEAD_UNITS.map(u => <th key={u} className="vp-cell vp-unit">{u}</th>)}
            <th className="vp-cell vp-label" colSpan={3}>附件</th>
          </tr>
          <tr>
            <Cells amount={total} units={HEAD_UNITS} />
            {['支出傳票', '發票', '收據'].map(k => (
              <td key={k} className="vp-cell vp-check">
                {kinds.has(k as any) ? '■' : '□'} {k}
              </td>
            ))}
          </tr>
          <tr>
            <th className="vp-cell vp-label" rowSpan={2}>簽名／蓋章</th>
            {['總幹事', '執行長', '會計', '財務'].map(r => (
              <th key={r} className="vp-cell vp-label" colSpan={r === '財務' ? 3 : 2}>{r}</th>
            ))}
          </tr>
          <tr>
            {['總幹事', '執行長', '會計', '財務'].map(r => (
              <td key={r} className="vp-cell vp-sign" colSpan={r === '財務' ? 3 : 2} />
            ))}
          </tr>
        </tbody>
      </table>

      <p className="vp-section">{voucher.direction === 'expense' ? '支出' : '收入'}傳票清單</p>

      <table className="vp-table">
        <thead>
          <tr>
            <th className="vp-cell vp-label">編號</th>
            <th className="vp-cell vp-label">會計科目</th>
            <th className="vp-cell vp-label">摘要</th>
            <th className="vp-cell vp-label" colSpan={ITEM_UNITS.length}>金額</th>
            <th className="vp-cell vp-label">申請人</th>
            <th className="vp-cell vp-label">附件</th>
          </tr>
          <tr>
            <th className="vp-cell" /><th className="vp-cell" /><th className="vp-cell" />
            {ITEM_UNITS.map(u => <th key={u} className="vp-cell vp-unit">{u}</th>)}
            <th className="vp-cell" /><th className="vp-cell" />
          </tr>
        </thead>
        <tbody>
          {voucher.items.map((it, i) => (
            <tr key={it.id || i}>
              <td className="vp-cell vp-num">{i + 1}</td>
              <td className="vp-cell">{accountOf(it.accountId)}</td>
              <td className="vp-cell">{it.summary}</td>
              <Cells amount={it.amount} units={ITEM_UNITS} />
              <td className="vp-cell">{it.applicant}</td>
              <td className="vp-cell vp-num">
                {voucher.attachments.filter(a => a.itemId === it.id).length || ''}
              </td>
            </tr>
          ))}
          {/* 留幾列空白：紙本習慣上要有位置手寫補登 */}
          {Array.from({ length: Math.max(0, 5 - voucher.items.length) }).map((_, i) => (
            <tr key={`blank-${i}`}>
              {Array.from({ length: 3 + ITEM_UNITS.length + 2 }).map((__, j) => (
                <td key={j} className="vp-cell vp-sign" />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {voucher.summary && <p className="vp-note">摘要：{voucher.summary}</p>}
      {voucher.note && <p className="vp-note">備註：{voucher.note}</p>}
      {voucher.status === 'void' && <p className="vp-void">本張憑證已作廢</p>}
    </div>
  );
};

export default VoucherPrint;
