/**
 * 後台名單上的「LINE：美玲」小標籤（2026-11-27 廟方：「讓我們知道他在 LINE 的名稱，方便聯絡」）。
 *
 * 資料是信眾在報名完成頁按「用 LINE 完成確認」、傳了確認碼之後由 api/line.ts 記下的
 * （supabase/migrations/line_links.sql）。綁的是那幾筆報名本身，所以同一次送出的家人
 * 每一列都會出現同一個名字——那就是這幾筆要聯絡的 LINE。
 *
 * 整個後台共用一份，AdminDashboard 每次重新整理時呼叫 `reloadLineNames()`。
 * 表還沒建（SQL 沒跑）就安靜地什麼都不顯示。
 */
import React, { useSyncExternalStore } from 'react';
import { supabase } from '../services/supabase';

interface LineLink { name: string; at: string }
let links = new Map<string, LineLink>();
const listeners = new Set<() => void>();

/**
 * 兩個來源：
 * - line_links：報名完成頁用 LINE 確認過的那幾筆，key 是「表:id」。
 * - 用 LINE 登入的會員：登入時 LINE 給的名稱（RPC get_member_line_names，限管理員），key 是「member:<user_id>」。
 * 任一支失敗（SQL 沒跑）就少那一半，不影響另一半。
 */
export const reloadLineNames = async (): Promise<void> => {
  const [lk, mb] = await Promise.all([
    supabase.from('line_links').select('source_table,source_id,line_name,linked_at'),
    supabase.rpc('get_member_line_names').then(r => r, () => ({ data: null, error: true })),
  ]);
  const m = new Map<string, LineLink>();
  if (!mb.error) for (const r of (mb.data ?? []) as { user_id: string; line_name: string | null }[]) {
    if (r.line_name) m.set(`member:${r.user_id}`, { name: r.line_name, at: '' });
  }
  if (!lk.error) for (const r of lk.data ?? []) m.set(`${r.source_table}:${r.source_id}`, { name: r.line_name || '（未提供名稱）', at: r.linked_at });
  links = m;
  listeners.forEach(f => f());
};

const useLinks = () => useSyncExternalStore(f => { listeners.add(f); return () => listeners.delete(f); }, () => links);

/** 法會報名在 blessing_registrations（2026-11-24 起），還沒搬的舊資料在 fahui_registrations：兩個都找 */
export const LineName: React.FC<{ table: string; id: string; className?: string }> = ({ table, id, className }) => {
  const all = useLinks();
  const hit = all.get(`${table}:${id}`)
    ?? (table === 'blessing_registrations' ? all.get(`fahui_registrations:${id}`) : undefined);
  if (!hit) return null;
  const d = new Date(hit.at);
  return (
    <span title={`${d.getMonth() + 1}/${d.getDate()} 用 LINE 確認了報名，可在 LINE 官方帳號後台用這個名稱找到他`}
      className={`inline-flex items-center text-xs bg-[#06C755]/10 text-[#047a35] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${className ?? ''}`}>
      LINE：{hit.name}
    </span>
  );
};

/**
 * 一個人（會員、名冊上的一列）可能有好幾個來源：會員帳號、他自己報的那幾筆。
 * 收齊不重複的名稱一起顯示。**親友那幾筆不要傳進來**：家人報名時確認的是報名人的 LINE，
 * 掛到被報名的兒女身上會讓廟方以為那是兒女的 LINE。
 */
export const LineNameOf: React.FC<{ refs: string[]; className?: string }> = ({ refs, className }) => {
  const all = useLinks();
  const names = [...new Set(refs.map(k => all.get(k)?.name
    ?? (k.startsWith('blessing_registrations:') ? all.get(k.replace('blessing_registrations:', 'fahui_registrations:'))?.name : undefined))
    .filter((x): x is string => !!x))];
  if (names.length === 0) return null;
  return (
    <span title="此人的 LINE 名稱（用 LINE 登入，或報名後用 LINE 確認過），可在 LINE 官方帳號後台用這個名稱找到他"
      className={`inline-flex items-center text-[11px] bg-[#06C755]/10 text-[#047a35] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${className ?? ''}`}>
      LINE：{names.join('、')}
    </span>
  );
};
