/**
 * 報名完成頁的「加入和聖壇 LINE 好友，完成報名確認」（2026-11-27 廟方：
 * 「報名後常常沒辦法聯絡信眾，報名完就請他加 LINE 好友，並讓我們知道他在 LINE 的名稱」）。
 *
 * 按鈕打開 LINE 的官方帳號對話框，訊息欄已經帶好「報名確認 K7Q2MX」，信眾按傳送就好。
 * api/line.ts 收到後用確認碼對到這次送出的那幾筆，記下他的 LINE 名稱；
 * 之後的確認、匯款、感謝狀通知就推得到他（見 supabase/migrations/line_links.sql）。
 *
 * - 拿不到確認碼（LINE 權杖沒設、SQL 沒跑、網路）就整張不顯示：完成頁的其他東西照常，
 *   不能因為這張卡讓人以為報名失敗。
 * - 無法強迫加好友（LINE 不允許），所以做成完成頁最先看到的那一步。
 * - 桌機按了會開 LINE 桌機版或顯示 QR code；兩者都不行時，下面那行碼可以自己打。
 */
import React, { useEffect, useRef, useState } from 'react';

export type LineLinkTable = 'bookings' | 'lamp_registrations' | 'blessing_registrations' | 'donations' | 'fahui_registrations';

const LineLinkCard: React.FC<{ table: LineLinkTable; ids: string[]; className?: string }> = ({ table, ids, className }) => {
  const [got, setGot] = useState<{ code: string; basicId: string } | null>(null);
  const asked = useRef('');

  useEffect(() => {
    const key = `${table}:${ids.join(',')}`;
    // StrictMode 開發時 effect 會跑兩次，不要發兩組碼
    if (ids.length === 0 || asked.current === key) return;
    asked.current = key;
    fetch('/api/line', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'code', table, ids }),
    })
      .then(r => r.json())
      .then(j => { if (j?.ok && j.code && j.basicId) setGot({ code: j.code, basicId: j.basicId }); })
      .catch(() => { /* 拿不到就不顯示 */ });
  }, [table, ids]);

  if (!got) return null;
  const text = `報名確認 ${got.code}`;
  // basicId 的 @ 不要編碼：LINE 官方文件的寫法就是 /oaMessage/@xxxx/，編成 %40 有的版本認不得
  const href = `https://line.me/R/oaMessage/${got.basicId.replace(/[^@A-Za-z0-9_.-]/g, '')}/?${encodeURIComponent(text)}`;
  return (
    <div className={`mx-auto max-w-sm rounded-xl border-2 border-[#06C755]/50 bg-[#06C755]/[0.06] p-5 text-center ${className ?? ''}`}>
      <p className="text-base font-bold text-gray-900 mb-1">加入和聖壇 LINE 好友，完成報名確認</p>
      <p className="text-sm text-gray-600 mb-4 leading-relaxed">
        按下按鈕會打開 LINE，加好友後直接按「傳送」。之後的確認、匯款與感謝狀通知都會用 LINE 傳給您，有問題也能直接留言。
      </p>
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-lg bg-[#06C755] text-white text-base font-bold hover:bg-[#05B04B] transition-colors">
        用 LINE 完成確認
      </a>
      <p className="mt-3 text-xs text-gray-500">
        打不開的話，請在和聖壇 LINE（{got.basicId}）傳：<span className="font-mono font-semibold text-gray-700 select-all">{text}</span>
      </p>
    </div>
  );
};

export default LineLinkCard;
