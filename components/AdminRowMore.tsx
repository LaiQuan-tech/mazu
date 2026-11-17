import React, { useCallback, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/*
 * 後台表格在手機上（1023px 以下，admin-table 變成卡片時）把次要欄位收起來。
 *
 * 用法：
 *   const rows = useOpenRows();
 *   <tr className={rows.isOpen(id) ? 'admin-open' : ''}>
 *     <td data-label="姓名">…</td>                      ← 第一眼要看的，照舊
 *     <td data-label="地址" data-more>…</td>            ← 次要欄位，手機收起
 *     <RowMoreCell open={rows.isOpen(id)} onToggle={() => rows.toggle(id)} hint="地址、備註" />
 *   </tr>
 *
 * 只影響手機卡片。桌機的欄位一格都沒少——應收管理那張廟方 2026-10-30 明確要八欄全開，
 * 信眾資訊的桌機欄位則由它自己的「更多欄位」開關管。收折的規則在 index.css 的 admin-table 那段。
 *
 * 開關那一格桌機上是 display:none，所以不必在表頭補一個 th，欄位不會錯位。
 */
export function useOpenRows() {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = useCallback((id: string) => {
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const isOpen = useCallback((id: string) => open.has(id), [open]);
  return { isOpen, toggle };
}

export function RowMoreCell({ open, onToggle, hint }: { open: boolean; onToggle: () => void; hint?: string }) {
  return (
    <td className="admin-more-toggle">
      <button
        type="button"
        // 很多表格整列點下去是開信眾資料視窗，這顆鈕不能把點擊傳上去
        onClick={e => { e.stopPropagation(); onToggle(); }}
        aria-expanded={open}
        className="w-full flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-temple-red border-t border-dashed border-gray-200"
      >
        {open ? '收合' : `更多資料${hint ? `（${hint}）` : ''}`}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
    </td>
  );
}
