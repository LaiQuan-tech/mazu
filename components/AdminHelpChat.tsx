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
  /** 「找 某某」：跳到那一頁並把搜尋框帶好 */
  onFind: (key: string, q: string) => void;
}
/** local：在瀏覽器裡就處理掉的那一來一回（找人），**不送進後端、也不放進之後送給 AI 的對話歷史** */
interface Msg { role: 'user' | 'assistant'; content: string; local?: boolean; find?: string }

/**
 * 「找 李沛玲」「查 0912345678」：在這裡就攔下來，不問 AI（2026-11-18 廟方要小幫手找得到信眾與會員，
 * 但當初選了「只教操作」——免費版 Gemini 會拿輸入改進模型，信眾姓名電話不能送過去）。
 * 只給「去哪一頁搜尋」的按鈕，顯示的就是那兩頁本來就看得到的資料，不多開放任何東西。
 * 「怎麼找」「如何查」這種是問操作，照常交給小幫手回答。
 */
const findTarget = (text: string): string | null => {
  const t = text.trim();
  if (/怎麼|如何|怎樣|[?？]/.test(t)) return null;
  const m = t.match(/^(?:幫我)?(?:找|查詢|查|搜尋|搜)(?:一下)?\s*[:：]?\s*(.{1,30})$/);
  if (m) return m[1].replace(/(這個人|的資料|資料)$/, '').trim() || null;
  // 只打一串電話也當成找人
  if (/^[0-9\-\s]{6,15}$/.test(t)) return t.replace(/[\s-]/g, '');
  return null;
};

const STARTERS = [
  '找 某位信眾（打「找」加姓名或電話）',
  '信眾匯款了，要怎麼標記已收款？',
  '信眾在 LINE 說要報名，怎麼幫他報？',
  '怎麼新增一場問事？',
  '左邊選單的紅色數字是什麼意思？',
  '怎麼寄提醒給還沒匯款的人？',
  '怎麼新增一個祈福活動？',
];

const AdminHelpChat: React.FC<Props> = ({ pages, onGo, onFind }) => {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy, open]);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    const who = findTarget(text);
    if (who) {
      setInput('');
      setMsgs([...msgs, { role: 'user', content: text, local: true },
        { role: 'assistant', content: `要找「${who}」，選要在哪一頁搜尋：`, local: true, find: who }]);
      return;
    }
    const next: Msg[] = [...msgs, { role: 'user', content: text }];
    setMsgs(next); setInput(''); setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch('/api/admin-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        // 找人的那幾則不送：名字電話只留在這台電腦的畫面上
        body: JSON.stringify({ messages: next.filter(m => !m.local).map(({ role, content }) => ({ role, content })) }),
      });
      const j = await r.json().catch(() => ({}));
      setMsgs([...next, { role: 'assistant', content: j.reply || j.error || '小幫手暫時沒有回應，請稍後再試。' }]);
    } catch {
      setMsgs([...next, { role: 'assistant', content: '連不上小幫手，請確認網路後再試一次。' }]);
    } finally { setBusy(false); }
  };

  const inputRef = useRef<HTMLInputElement>(null);
  /** 「找 某位信眾」那一題不是真的問題：把「找 」放進輸入框讓他接著打名字 */
  const pick = (q: string) => {
    if (q.startsWith('找 某位')) { setInput('找 '); setTimeout(() => inputRef.current?.focus(), 0); return; }
    ask(q);
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
                  <button key={q} type="button" onClick={() => pick(q)}
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
                {m.find && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {pages.filter(p => p.key === 'roster' || p.key === 'members').map(p => (
                      <button key={p.key} type="button" onClick={() => { onFind(p.key, m.find!); setOpen(false); }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-temple-red text-white text-xs font-semibold hover:bg-[#5C4310]">
                        在{p.label}搜尋<ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    ))}
                    {!pages.some(p => p.key === 'roster' || p.key === 'members') && (
                      <span className="text-xs text-gray-500">你的帳號看不到信眾資訊與會員資訊，請洽管理員。</span>
                    )}
                  </div>
                )}
                {m.role === 'assistant' && !m.find && linksIn(m.content).length > 0 && (
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
            {/* 回答完照樣給常見問題（2026-11-18 廟方：「回答完，還是要顯示預設問題」）；問過的不再列 */}
            {!busy && msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant' && (() => {
              const asked = new Set(msgs.filter(m => m.role === 'user').map(m => m.content));
              // 六題都問過了就整組再列一次，不要讓這一區突然消失
              const left = STARTERS.filter(q => !asked.has(q));
              const rest = left.length > 0 ? left : STARTERS;
              return (
                <div className="pt-1 space-y-1.5">
                  <p className="text-xs text-gray-400">還想問：</p>
                  {rest.map(q => (
                    <button key={q} type="button" onClick={() => pick(q)}
                      className="block w-full text-left px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 hover:border-temple-red hover:text-temple-red">
                      {q}
                    </button>
                  ))}
                </div>
              );
            })()}
            {busy && <p className="text-gray-400 text-xs">小幫手正在想…</p>}
            <div ref={endRef} />
          </div>

          <form onSubmit={e => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 px-3 py-3 border-t border-gray-100">
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} maxLength={500}
              placeholder="問操作，或打「找 姓名／電話」"
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
