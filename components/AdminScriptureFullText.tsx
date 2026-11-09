import React, { useEffect, useMemo, useState } from 'react';
import { Save, RefreshCw, AlertCircle, ChevronDown, ExternalLink } from 'lucide-react';
import { getScriptureFullText, saveScriptureFullText } from '../services/supabase';
import { scripturePhrases, fullTextFromVerses, formatFourPerLine } from '../services/scriptureText';
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
 * **句長檢查**：全文頁是四欄的格子，字級是照「一句三字＋句號」算的（見 ScriptureFullText）。
 * 長短不一的句子在手機上會把某一欄撐寬、整排擠出畫面，所以不是三個字的句子要列出來提醒。
 * 只提醒、不擋存檔——經文本身若真的有那樣的句子，以經文為準。
 */

const ScriptureFullTextEditor: React.FC<{ verses: ScriptureVerseRecord[] }> = ({ verses }) => {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fromVerses = useMemo(() => formatFourPerLine(fullTextFromVerses(verses)), [verses]);

  useEffect(() => {
    getScriptureFullText().then(v => { setSaved(v); setText(v ? formatFourPerLine(v) : ''); });
  }, []);

  // 沒存過、經文又已經載入：用 136 段接起來的內容當起點
  useEffect(() => {
    if (saved === '' && !text && fromVerses) setText(fromVerses);
  }, [saved, fromVerses, text]);

  const phrases = useMemo(() => scripturePhrases(text), [text]);
  /** 不是「三字＋句號」的句子（去掉標點後不是 3 個字） */
  const odd = useMemo(
    () => phrases.map((p, i) => ({ p, i })).filter(({ p }) => p.replace(/[。，、；！？]/g, '').length !== 3),
    [phrases],
  );
  const changed = saved !== null && text.trim() !== formatFourPerLine(saved || fullTextFromVerses(verses)).trim();

  const save = async () => {
    if (phrases.length === 0) { setMsg({ ok: false, text: '全文不能是空的。' }); return; }
    setSaving(true);
    setMsg(null);
    try {
      const clean = formatFourPerLine(text);
      await saveScriptureFullText(clean);
      setSaved(clean);
      setText(clean);
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
              : saved ? `已另存全文，共 ${scripturePhrases(saved).length} 句`
              : '尚未另存。全文頁目前是由下面 136 段的經文接起來的'}
          </p>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && saved !== null && (
        <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
          <div className="text-sm text-gray-600 space-y-1">
            <p>這裡是全文頁（<a href="/scripture/full" target="_blank" rel="noopener noreferrer" className="text-temple-red hover:underline inline-flex items-center gap-0.5">/scripture/full<ExternalLink className="w-3 h-3" /></a>）顯示的經文。換行與空白不影響顯示，前台一律四句一行排好。</p>
            <p className="text-amber-700">全文與下面 136 段是分開的兩份：這裡改了錯字，解說頁那一段不會跟著改，需要的話兩邊都要改。</p>
          </div>

          <textarea
            aria-label="天上聖母經全文"
            value={text}
            onChange={e => { setText(e.target.value); setMsg(null); }}
            rows={18}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base leading-loose tracking-wider text-gray-800 outline-none focus:border-temple-red font-serif"
          />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>共 {phrases.length} 句・約 {Math.ceil(phrases.length / 4)} 行</span>
            {odd.length === 0
              ? <span className="text-green-700">每一句都是三個字</span>
              : <span className="text-amber-700">有 {odd.length} 句不是三個字，手機上可能會排不整齊</span>}
          </div>
          {odd.length > 0 && (
            <ul className="text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-3 space-y-0.5 max-h-40 overflow-y-auto">
              {odd.slice(0, 30).map(({ p, i }) => <li key={i}>第 {i + 1} 句：{p}</li>)}
              {odd.length > 30 && <li>⋯還有 {odd.length - 30} 句</li>}
            </ul>
          )}

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
