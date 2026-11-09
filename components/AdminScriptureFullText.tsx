import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Save, RefreshCw, AlertCircle, ChevronDown, ExternalLink } from 'lucide-react';
import { getScriptureFullText, saveScriptureFullText } from '../services/supabase';
import { countPhrases, fullTextFromVerses } from '../services/scriptureText';
import { ScriptureVerseRecord } from '../types';

/**
 * 後台「天上聖母經」最上面的全文編輯（2026-11-09 廟方：「後台要一個天上聖母經全文的編輯處」）。
 *
 * 全文與下面那 136 段是**兩份**：段落是為了配插圖切的、不是經文本身的分段，
 * 全文要能照經書原樣修，不必去拆成 136 段一段一段改。代價是兩邊會各自獨立——
 * 這裡改了錯字，下面那段不會跟著改，所以畫面上要講清楚。
 *
 * 還沒存過時，編輯框先放「由 136 段接起來」的內容（那就是全文頁現在顯示的），
 * 廟方從那裡開始修，不必從零打起。
 *
 * **存的就是打的樣子，換行與空白一個都不動**（同日廟方：「換行與空白會影響顯示」）。
 * 第一版存檔時會把文字重排成四句一行，廟方貼進完整經本（有「爐香讚」「淨心神咒」這種
 * 標題）之後，標題全黏進下一句、原本的換行也救不回來。排版規則見 `services/scriptureText.ts`。
 * 原本那個「不是三字的句子」提醒一併拿掉：經本本來就有長短句，那是四欄格子才需要的檢查。
 */

const ScriptureFullTextEditor: React.FC<{ verses: ScriptureVerseRecord[] }> = ({ verses }) => {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fromVerses = useMemo(() => fullTextFromVerses(verses), [verses]);

  useEffect(() => {
    getScriptureFullText().then(v => { setSaved(v); setText(v); });
  }, []);

  // 沒存過、經文又已經載入：用 136 段接起來的內容當起點。**只帶一次**——
  // 不然廟方把框清空想重打，它會立刻又被填回去
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || saved !== '' || !fromVerses) return;
    prefilled.current = true;
    setText(fromVerses);
  }, [saved, fromVerses]);

  const phraseCount = useMemo(() => countPhrases(text), [text]);
  const lineCount = useMemo(() => text.split('\n').filter(l => l.trim()).length, [text]);
  const changed = saved !== null && text !== (saved || fromVerses);

  const save = async () => {
    if (!text.trim()) { setMsg({ ok: false, text: '全文不能是空的。' }); return; }
    setSaving(true);
    setMsg(null);
    try {
      await saveScriptureFullText(text);
      const stored = await getScriptureFullText();   // 讀回來比對，確定存進去的就是畫面上這一份
      setSaved(stored);
      setText(stored);
      setMsg({ ok: true, text: '已儲存，全文頁重新整理就會看到。給搜尋引擎看的版本要按「基本資料」頁的「重新發布」才會更新。' });
    } catch {
      setMsg({ ok: false, text: '儲存失敗，請重新整理後再試。' });
    } finally {
      setSaving(false);
    }
  };

  const resetFromVerses = () => {
    if (!confirm('要用下面 136 段的經文重新組成全文嗎？\n編輯框裡現在的內容會被換掉（按儲存之前都還沒生效）。')) return;
    setText(fromVerses);
    setMsg(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-gray-50 transition-colors">
        <div>
          <h4 className="font-semibold text-gray-800">全文（誦讀版）</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {saved === null ? '讀取中...'
              : saved ? `已另存全文，共 ${countPhrases(saved)} 句`
              : '尚未另存。全文頁目前是由下面 136 段的經文接起來的'}
          </p>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && saved !== null && (
        <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
          <div className="text-sm text-gray-600 space-y-1">
            <p>這裡是全文頁（<a href="/scripture/full" target="_blank" rel="noopener noreferrer" className="text-temple-red hover:underline inline-flex items-center gap-0.5">/scripture/full<ExternalLink className="w-3 h-3" /></a>）顯示的經文。<strong className="font-medium text-gray-800">怎麼換行、怎麼空格，前台就照樣顯示</strong>；空一行就是段落之間的空白。一行太長時手機上會自動折行，但只在句號之間折，不會把一句切開。</p>
            <p className="text-amber-700">全文與下面 136 段是分開的兩份：這裡改了錯字，解說頁那一段不會跟著改，需要的話兩邊都要改。</p>
          </div>

          <textarea
            aria-label="天上聖母經全文"
            value={text}
            onChange={e => { setText(e.target.value); setMsg(null); }}
            rows={18}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base leading-loose tracking-wider text-gray-800 outline-none focus:border-temple-red font-serif"
          />

          <p className="text-sm text-gray-500">共 {lineCount} 行・{phraseCount} 句</p>

          {msg && (
            <div role={msg.ok ? 'status' : 'alert'}
              className={`px-4 py-3 rounded-xl text-sm flex items-start gap-2 ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> {msg.text}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={save} disabled={saving || (!changed && !!saved)}
              className="flex items-center gap-2 px-5 py-2.5 bg-temple-red text-white rounded-xl text-sm font-medium hover:bg-[#5C1A04] transition-colors disabled:opacity-50">
              {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> 儲存中...</> : <><Save className="w-4 h-4" /> 儲存全文</>}
            </button>
            <button type="button" onClick={resetFromVerses}
              className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
              用 136 段重新組成
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScriptureFullTextEditor;
