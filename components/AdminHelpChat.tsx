import React, { useEffect, useRef, useState } from 'react';
import { MessageCircleQuestion, X, Send, ArrowRight } from 'lucide-react';
import { supabase } from '../services/supabase';

/**
 * 後台的操作小幫手（2026-11-18 廟方：「在後台做一個聊天機器人，來協助後台人員操作」）。
 *
 * **只教操作、看不到任何報名資料**（廟方同日選的，理由見 api/admin-help.ts）。
 * 回答裡提到哪一頁，就在下面給一顆「前往 XX」直接跳過去——工作人員要的是去做，不是讀完再自己找。
 * 跳頁只給這個角色看得到的頁（`pages` 由 AdminDashboard 依 ROLE_ALLOWED_TABS 傳進來）。
 */
interface Props {
  pages: { key: string; label: string }[];
  onGo: (key: string) => void;
}
interface Msg { role: 'user' | 'assistant'; content: string }

const STARTERS = [
  '信眾匯款了，要怎麼標記已收款？',
  '信眾在 LINE 說要報名，怎麼幫他報？',
  '怎麼新增一場問事？',
  '左邊選單的紅色數字是什麼意思？',
  '怎麼寄提醒給還沒匯款的人？',
  '怎麼新增一個祈福活動？',
];

const AdminHelpChat: React.FC<Props> = ({ pages, onGo }) => {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy, open]);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: text }];
    setMsgs(next); setInput(''); setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch('/api/admin-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify({ messages: next }),
      });
      const j = await r.json().catch(() => ({}));
      setMsgs([...next, { role: 'assistant', content: j.reply || j.error || '小幫手暫時沒有回應，請稍後再試。' }]);
    } catch {
      setMsgs([...next, { role: 'assistant', content: '連不上小幫手，請確認網路後再試一次。' }]);
    } finally { setBusy(false); }
  };

  /** 回答裡出現「點燈管理」這種頁名，就給一顆前往鈕（最多三顆，照出現順序） */
  const linksIn = (text: string) =>
    pages
      .map(p => ({ ...p, at: text.indexOf(p.label) }))
      .filter(p => p.at >= 0)
      .sort((a, b) => a.at - b.at)
      .slice(0, 3);

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-temple-red text-white shadow-lg hover:bg-[#5C4310] transition-colors">
          <MessageCircleQuestion className="w-5 h-5" aria-hidden="true" />
          <span className="text-sm font-semibold">操作小幫手</span>
        </button>
      )}
      {open && (
        <div role="dialog" aria-label="後台操作小幫手"
          className="fixed z-50 bottom-0 right-0 sm:bottom-5 sm:right-5 w-full sm:w-[380px] h-[80vh] sm:h-[560px] bg-white sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <MessageCircleQuestion className="w-5 h-5 text-temple-red" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-800 text-sm">後台操作小幫手</p>
              <p className="text-[11px] text-gray-400">教你怎麼操作；看不到報名資料，請勿輸入信眾個資</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="關閉"
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
            {msgs.length === 0 && (
              <div className="space-y-2">
                <p className="text-gray-500">想做什麼？直接問，或點下面的常見問題：</p>
                {STARTERS.map(q => (
                  <button key={q} type="button" onClick={() => ask(q)}
                    className="block w-full text-left px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:border-temple-red hover:text-temple-red">
                    {q}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
                <div className={`max-w-[90%] px-3 py-2 rounded-xl whitespace-pre-line leading-relaxed ${
                  m.role === 'user' ? 'bg-temple-red text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {m.content}
                </div>
                {m.role === 'assistant' && linksIn(m.content).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {linksIn(m.content).map(p => (
                      <button key={p.key} type="button" onClick={() => { onGo(p.key); setOpen(false); }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-temple-red text-white text-xs font-semibold hover:bg-[#5C4310]">
                        前往{p.label}<ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && <p className="text-gray-400 text-xs">小幫手正在想…</p>}
            <div ref={endRef} />
          </div>

          <form onSubmit={e => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 px-3 py-3 border-t border-gray-100">
            <input value={input} onChange={e => setInput(e.target.value)} maxLength={500}
              placeholder="例如：怎麼幫信眾代為報名點燈？"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
            <button type="submit" disabled={busy || !input.trim()} aria-label="送出"
              className="p-2.5 rounded-lg bg-temple-red text-white disabled:opacity-40"><Send className="w-4 h-4" /></button>
          </form>
        </div>
      )}
    </>
  );
};

export default AdminHelpChat;
