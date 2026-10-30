import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

/**
 * 官網右下／左下的 AI 客服（2026-10-30 廟方要求）。
 *
 * ── 位置：第三格，接在 LINE 上面 ──
 * 浮動鈕的規則見 CLAUDE.md：同一邊、同樣大小、上下疊放，間距 12px，
 * **手機與桌機都在右下**（2026-10-30 廟方把桌機從左下換到右下，「比較符合使用者習慣」）；
 * 回頂鈕永遠在最底下那一格，LINE 在它出現時往上讓位。
 * 這一顆就是再往上一格，所以也要跟著 `toTopShown` 移動——
 * 兩顆共用同一個條件，不然會出現「中間空一格」的狀態。
 *   手機：96 → 164 → 232（56px 鈕 ＋ 12px 間距）
 *   桌機：32 → 108 → 184（64px 鈕 ＋ 12px 間距）
 *
 * ── 配色照 BackToTop 那條：深底實心＋米色描邊 ──
 * 它會飄過米色頁面與深色頁尾兩種底，**單一顏色顧不了兩邊**（只給 temple-red
 * 在頁尾實測 2.32:1，等於看不見）。不要為了好看把描邊拿掉。
 *
 * ── 知識庫是建置時的快照 ──
 * 後端讀 `/ai-kb.txt`（llms.txt ＋ 各頁 noscript，建置時產生）。
 * 所以**廟方改完地址或價格要按後台的「重新發布」**，機器人才會跟上。
 *
 * ── 本機看不到效果 ──
 * `vite dev` 不跑 `api/`，所以這支在本機一定拿到 404，畫面會顯示「暫時無法回應」。
 * 那是正常的，同 notify-registration 那幾支。
 */

/** `mode` 決定這則回答要怎麼框：整理過的、官網原文、還是一條固定的說明 */
type Mode = 'ai' | 'search' | 'rule' | 'none';
interface Msg { role: 'user' | 'assistant'; content: string; mode?: Mode }

/** 搜尋回來的是**原文**不是整理過的答案，要講明白——不然信眾會以為那是我們寫給他的回覆 */
const MODE_NOTE: Partial<Record<Mode, string>> = {
  search: '我在官網找到這一段：',
};

/**
 * 把網址變成可以點的連結。**不用 dangerouslySetInnerHTML**（全站原則）：
 * 切成陣列自己渲染，後台與知識庫的內容永遠是文字，沒有注入的可能。
 * 長輩不會自己複製網址貼到瀏覽器，不可點等於那一行白寫。
 */
const linkify = (text: string): React.ReactNode[] =>
  text.split(/(https?:\/\/[^\s，。、）)]+)/g).map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all">{part}</a>
      : <React.Fragment key={i}>{part}</React.Fragment>);

/**
 * 空畫面給幾個起手式：長輩不一定知道可以問什麼，給一片空白等於沒人會用。
 *
 * **第三題放「在哪裡／怎麼過去」而不是點燈價錢**（2026-10-30 廟方：「這比點燈更重要」）。
 * 點燈的價錢在點燈服務頁一眼就看得到，而「怎麼過去」是人站在捷運站時才會問的，
 * 那一刻他手上只有手機。
 *
 * **字要與常見問題第一題一模一樣**：知識庫是官網內容的快照，問句與來源同字
 * 命中率最高（反例記在 CLAUDE.md：「天上聖母經在哪裡可以讀？」曾經被答成壇址）。
 */
const STARTERS = [
  '開放時間是幾點到幾點？',
  '要怎麼預約問事？',
  '和聖壇在哪裡？怎麼過去？',
  '天上聖母經在哪裡可以讀？',
];

/**
 * 第 N 格的位置。**傳「下面有幾顆鈕」而不是傳「回頂鈕出現了沒」**：
 * LINE 那顆在後台把社群清空時會整個消失（CLAUDE.md 記過這件事），
 * 只看回頂鈕的話那時中間就空一格，而畫面上看起來只是「位置怪」、不會報錯。
 */
const SLOT = [
  'bottom-24 sm:bottom-8',                 // 下面沒有別的鈕
  'bottom-[164px] sm:bottom-[108px]',      // 下面一顆
  'bottom-[232px] sm:bottom-[184px]',      // 下面兩顆
];

const ChatWidget: React.FC<{ below: number; hidden: boolean }> = ({ below, hidden }) => {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 新訊息進來就捲到底。**用 instant 不用 smooth**：開了「減少動態效果」的裝置
  // 會把 smooth 整個取消而不是變快（CLAUDE.md 記過兩次），那等於永遠看不到新回答。
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'instant' as ScrollBehavior });
  }, [msgs, busy]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Esc 關閉。面板是覆蓋層，鍵盤使用者要有出口
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setErr('');
    setDraft('');
    const next: Msg[] = [...msgs, { role: 'user', content: q }];
    setMsgs(next);
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // 只送對話本身，**不送任何會員資料或身分** —— 這支端點是公開的
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; reply?: string; error?: string; mode?: Mode };
      if (!res.ok || !data.ok || !data.reply) {
        setErr(data.error || '客服暫時無法回應，請稍後再試，或用 LINE 詢問。');
        return;
      }
      setMsgs([...next, { role: 'assistant', content: data.reply, mode: data.mode }]);
    } catch {
      setErr('連線失敗，請檢查網路後再試一次。');
    } finally {
      setBusy(false);
    }
  };

  if (hidden) return null;

  const pos = SLOT[Math.min(below, SLOT.length - 1)];

  return (
    <>
      {/* 浮動鈕。面板開著時收起來——面板自己有關閉鈕，留著會疊在面板上 */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="線上詢問：和聖壇 AI 客服"
          title="線上詢問"
          className={`tap fixed z-[60] w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-temple-red text-white shadow-2xl
            ring-2 ring-[#F0E9CE]/70 flex items-center justify-center hover:bg-[#5C4310] hover:scale-110
            transition-all duration-500 right-4 sm:right-8 ${pos}`}
        >
          <MessageCircle className="w-7 h-7 sm:w-8 sm:h-8" aria-hidden="true" />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="和聖壇 AI 客服"
          className="fixed z-[70] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl
            ring-1 ring-temple-gold/40
            inset-x-3 bottom-24 top-20
            sm:inset-x-auto sm:top-auto sm:right-8 sm:bottom-8 sm:w-[380px] sm:h-[560px]"
        >
          {/* 標頭 */}
          <div className="shrink-0 flex items-center justify-between gap-2 bg-temple-red px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="font-serif font-bold leading-tight">和聖壇 線上詢問</p>
              <p className="text-[11px] text-white/80 leading-tight">AI 助理．依官網內容回答</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="關閉"
              className="tap shrink-0 w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* 對話 */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-temple-bg" role="log" aria-live="polite">
            {msgs.length === 0 && (
              <div>
                {/* **「請勿輸入個人資料」這句不是客套。** 問答會送到外部的 AI 服務，
                    而免費方案的條款通常允許供應商拿內容去改進產品。程式這邊只送對話本身
                    （不帶任何會員資料、不帶身分），但信眾自己打進去的字我們攔不住——
                    長輩很可能直接打上自己的姓名、電話與生辰來問。講在他開始打字之前，
                    才是這句話唯一有用的時機。 */}
                <p className="text-sm text-gray-600 leading-relaxed mb-3">
                  您好，這裡可以詢問和聖壇的服務、神尊、法會與天上聖母經。
                  答案都來自官網內容，實際以網站公告為準。
                  <span className="block mt-1.5 text-temple-red">
                    請勿輸入姓名、電話、生辰等個人資料。要報名或查紀錄請用 LINE 或會員中心。
                  </span>
                </p>
                <div className="flex flex-col gap-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="tap text-left text-sm px-3 py-2 rounded-lg bg-white border border-temple-gold/40
                        text-temple-red hover:bg-temple-gold/10 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className="max-w-[85%]">
                  {m.role === 'assistant' && MODE_NOTE[m.mode ?? 'ai'] && (
                    <p className="text-xs text-gray-500 mb-1">{MODE_NOTE[m.mode ?? 'ai']}</p>
                  )}
                  <p className={`whitespace-pre-wrap text-sm leading-relaxed px-3.5 py-2.5 rounded-2xl ${
                    m.role === 'user'
                      ? 'bg-temple-red text-white rounded-br-sm'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                  }`}>
                    {m.role === 'assistant' ? linkify(m.content) : m.content}
                  </p>
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <p className="text-sm text-gray-500 px-3.5 py-2.5 rounded-2xl bg-white border border-gray-200">
                  正在查詢⋯
                </p>
              </div>
            )}

            {/* role="alert" 才會被螢幕閱讀器念出來（CLAUDE.md 無障礙那節） */}
            {err && (
              <p role="alert" className="text-sm text-temple-red bg-temple-gold/15 border border-temple-gold/40 rounded-lg px-3 py-2">
                {err}
              </p>
            )}
          </div>

          {/* 輸入 */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(draft); }}
            className="shrink-0 flex items-center gap-2 border-t border-gray-200 bg-white px-3 py-2.5"
          >
            <label htmlFor="chat-input" className="sr-only">您的問題</label>
            <input
              id="chat-input"
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              placeholder="請輸入您的問題"
              className="flex-1 min-w-0 px-3 py-2 text-base rounded-lg border border-gray-300
                focus:border-temple-gold focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label="送出問題"
              className="tap shrink-0 w-10 h-10 rounded-lg bg-temple-red text-white flex items-center justify-center
                disabled:opacity-40 hover:bg-[#5C4310] transition-colors"
            >
              <Send className="w-5 h-5" aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
