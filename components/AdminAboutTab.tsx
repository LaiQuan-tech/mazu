import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical, Plus, Trash2, Eye, EyeOff, ImagePlus, X, Bold, Link2, ChevronUp, ChevronDown, Check } from 'lucide-react';
import {
  getAboutSections, createAboutSection, updateAboutSection, deleteAboutSection,
  reorderAboutSections, uploadAboutImage, getSiteImagePublicUrl,
  getAboutFacts, saveAboutFacts, DEFAULT_ABOUT_FACTS,
} from '../services/supabase';
import { AboutFacts, AboutSection, SectionPage } from '../types';

/**
 * 後台「關於我們」內容管理
 *
 * 一張卡片 = 前台的一個圖文段落。順序用拖拉調整，放開才寫回資料庫。
 * 文字欄位一律「離開焦點才存」——每打一個字就送出會把資料庫打爆，
 * 也會讓游標在儲存重繪時亂跳。開關與照片則是立即存，因為那是一次性的動作。
 */

/** 內文支援的標記，與前台 StoryPage 的解析規則一一對應 */
const MARKUP_HINT = '空一行＝新的一段　**粗體**　[顯示文字](網址)';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-temple-red';

/** 在 textarea 的選取範圍前後包上標記，沒選取就插入範例並選中中間的字 */
const wrapSelection = (
  el: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder: string,
): { value: string; selStart: number; selEnd: number } => {
  const { selectionStart: s, selectionEnd: e, value } = el;
  const chosen = value.slice(s, e) || placeholder;
  const next = value.slice(0, s) + before + chosen + after + value.slice(e);
  return { value: next, selStart: s + before.length, selEnd: s + before.length + chosen.length };
};

interface SectionCardProps {
  section: AboutSection;
  index: number;
  total: number;
  busy: boolean;
  onPatch: (patch: Partial<AboutSection>) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  /** 手機用的搬移。觸控裝置不會觸發 HTML5 拖拉事件。 */
  onMove: (dir: -1 | 1) => void;
  dragging: boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({
  section, index, total, busy, onPatch, onDelete, onDragStart, onDragEnter, onDragEnd, onMove, dragging,
}) => {
  const [heading, setHeading] = useState(section.heading);
  const [body, setBody] = useState(section.body);
  const [caption, setCaption] = useState(section.caption);
  const [uploading, setUploading] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // 外部資料變動（例如重新整理）時同步回輸入框
  useEffect(() => { setHeading(section.heading); }, [section.heading]);
  useEffect(() => { setBody(section.body); }, [section.body]);
  useEffect(() => { setCaption(section.caption); }, [section.caption]);

  const applyMarkup = (before: string, after: string, placeholder: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const { value, selStart, selEnd } = wrapSelection(el, before, after, placeholder);
    setBody(value);
    onPatch({ body: value });
    // 等 React 把新值寫進 DOM 再還原選取，否則選取範圍會被覆蓋掉
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(selStart, selEnd); });
  };

  const pickImage = async (file: File) => {
    setUploading(true);
    try {
      const path = await uploadAboutImage(file);   // 內含自動壓縮
      onPatch({ imagePath: path });
    } catch { alert('照片上傳失敗，請再試一次'); }
    finally { setUploading(false); }
  };

  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={e => e.preventDefault()}
      className={`bg-white rounded-lg border p-4 transition-shadow ${
        dragging ? 'border-temple-red shadow-lg opacity-60' : 'border-gray-200 shadow-sm'
      } ${section.isVisible ? '' : 'bg-gray-50'}`}
    >
      <div className="flex items-start gap-3">
        {/* 只有握把可拖：整張卡可拖的話，選取文字就會變成拖曳 */}
        <button
          type="button"
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          title="拖曳調整順序"
          aria-label={`第 ${index + 1} 段，共 ${total} 段，拖曳調整順序`}
          className="mt-1 p-1 text-gray-400 hover:text-temple-red cursor-grab active:cursor-grabbing shrink-0 hidden lg:block"
        >
          <GripVertical className="w-5 h-5" />
        </button>

        {/* 手機改用上下鍵：HTML5 的 drag 事件在觸控裝置不會觸發 */}
        <div className="flex flex-col lg:hidden shrink-0 text-gray-400 -ml-1">
          <button type="button" onClick={() => onMove(-1)} disabled={busy || index === 0}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
            aria-label={`把第 ${index + 1} 段上移`}>
            <ChevronUp className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={busy || index === total - 1}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
            aria-label={`把第 ${index + 1} 段下移`}>
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 shrink-0">第 {index + 1} 段</span>
            <input
              value={heading}
              placeholder="小節標題（可留空）"
              onChange={e => setHeading(e.target.value)}
              onBlur={() => { if (heading !== section.heading) onPatch({ heading }); }}
              className={`${inputClass} font-bold`}
            />
          </div>

          <div>
            <div className="flex items-center gap-1 mb-1">
              <button type="button" onClick={() => applyMarkup('**', '**', '粗體字')}
                className="px-2 py-1 rounded border border-gray-300 text-gray-600 hover:border-temple-red hover:text-temple-red" title="粗體">
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => applyMarkup('[', '](https://)', '連結文字')}
                className="px-2 py-1 rounded border border-gray-300 text-gray-600 hover:border-temple-red hover:text-temple-red" title="插入連結">
                <Link2 className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-gray-400 ml-1">{MARKUP_HINT}</span>
            </div>
            <textarea
              ref={bodyRef}
              value={body}
              rows={6}
              placeholder="這一段的內文。空一行就是新的一段。"
              onChange={e => setBody(e.target.value)}
              onBlur={() => { if (body !== section.body) onPatch({ body }); }}
              className={`${inputClass} leading-relaxed resize-y`}
            />
          </div>

          <div className="flex flex-wrap items-start gap-3">
            {section.imagePath ? (
              <div className="relative">
                <img src={getSiteImagePublicUrl(section.imagePath)} alt=""
                  className="w-40 h-28 object-cover rounded border border-gray-200" />
                <button type="button" onClick={() => onPatch({ imagePath: null })}
                  title="移除照片"
                  className="absolute -top-2 -right-2 bg-white border border-gray-300 rounded-full p-1 text-gray-500 hover:text-red-600 shadow">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="w-40 h-28 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded text-gray-400 hover:border-temple-red hover:text-temple-red cursor-pointer text-xs">
                <ImagePlus className="w-5 h-5" />
                {uploading ? '上傳中…' : '加照片'}
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = ''; }} />
              </label>
            )}
            <div className="flex-1 min-w-[12rem]">
              <input
                value={caption}
                placeholder="照片說明（可留空）"
                onChange={e => setCaption(e.target.value)}
                onBlur={() => { if (caption !== section.caption) onPatch({ caption }); }}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-400">照片會自動壓縮，直接傳手機原圖即可</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <button type="button" disabled={busy}
            onClick={() => onPatch({ isVisible: !section.isVisible })}
            title={section.isVisible ? '目前顯示中，點一下隱藏' : '目前隱藏，點一下顯示'}
            className={`p-2 rounded border ${section.isVisible
              ? 'border-green-300 text-green-600 hover:bg-green-50'
              : 'border-gray-300 text-gray-400 hover:bg-gray-50'}`}>
            {section.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button type="button" disabled={busy} onClick={onDelete} title="刪除這一段"
            className="p-2 rounded border border-gray-300 text-gray-400 hover:border-red-400 hover:text-red-600">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * 段落編輯器。「關於我們」與「遷址捐款」的段落結構相同，用 page 分流同一套介面。
 * children 讓各頁接上自己專屬的區塊（關於我們接數字卡、遷址捐款接方案表格）。
 */
interface AdminSectionsTabProps {
  page?: SectionPage;
  title?: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}

const AdminAboutTab = ({
  page = 'about',
  title = '關於我們',
  description = <>這裡的段落會顯示在「關於我們」完整頁；<strong>第一個顯示中的段落</strong>同時是首頁的摘要。</>,
  children,
}: AdminSectionsTabProps) => {
  const [sections, setSections] = useState<AboutSection[]>([]);
  const [facts, setFacts] = useState<AboutFacts>(DEFAULT_ABOUT_FACTS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dragFrom = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, f] = await Promise.all([getAboutSections(true, page), getAboutFacts()]);
      setSections(rows);
      setFacts(f);
      setError('');
    } catch (e) {
      console.error(e);
      setError('讀取失敗。若尚未執行 about_sections.sql，請先到 Supabase 執行該檔。');
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, p: Partial<AboutSection>) => {
    setSections(prev => prev.map(s => (s.id === id ? { ...s, ...p } : s)));   // 先動畫面，操作才跟手
    setBusy(true);
    try { await updateAboutSection(id, p); }
    catch { alert('儲存失敗，請重新整理後再試'); await load(); }
    finally { setBusy(false); }
  };

  const addSection = async () => {
    setBusy(true);
    try {
      const sortOrder = sections.length;
      const id = await createAboutSection({ page, sortOrder, heading: '', body: '', imagePath: null, caption: '', isVisible: true });
      setSections(prev => [...prev, { id, page, sortOrder, heading: '', body: '', imagePath: null, caption: '', isVisible: true }]);
    } catch { alert('新增失敗'); }
    finally { setBusy(false); }
  };

  const removeSection = async (id: string) => {
    if (!window.confirm('確定刪除這一段？刪除後無法復原。')) return;
    setBusy(true);
    try { await deleteAboutSection(id); setSections(prev => prev.filter(s => s.id !== id)); }
    catch { alert('刪除失敗'); }
    finally { setBusy(false); }
  };

  // 拖曳中只重排畫面，放開才寫資料庫——每經過一張卡就送一次請求太浪費
  const onDragEnter = (to: number) => {
    const from = dragFrom.current;
    if (from === null || from === to) return;
    setSections(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    dragFrom.current = to;
  };

  const saveOrder = async (list: AboutSection[]) => {
    setBusy(true);
    try { await reorderAboutSections(list.map(s => s.id)); }
    catch { alert('順序儲存失敗'); await load(); }
    finally { setBusy(false); }
  };

  const onDragEnd = async () => {
    dragFrom.current = null;
    await saveOrder(sections);
  };

  // 手機的上下鍵：搬一格就直接寫回（不像拖曳有「放開」這個時機點）
  const moveSection = async (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSections(next);
    await saveOrder(next);
  };

  /**
   * 數字卡是「點到別處才存」（onBlur），**所以一定要有存檔的回饋**。
   * 2026-10-13 廟方以為改好了、其實沒存進去——打完字沒有任何提示，
   * 看起來跟存好了一模一樣，前台當然沒變。
   */
  const [factsSaved, setFactsSaved] = useState(false);
  const saveFacts = async (next: AboutFacts) => {
    setFacts(next);
    try {
      await saveAboutFacts(next);
      setFactsSaved(true);
      window.setTimeout(() => setFactsSaved(false), 2500);
    } catch { alert('數字卡儲存失敗'); }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">{title}</h2>
        <p className="text-sm text-gray-500">{description}</p>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-gray-400 text-sm">載入中…</p>}

      {!loading && (
        <>
          <div className="space-y-4">
            {sections.map((s, i) => (
              <SectionCard
                key={s.id}
                section={s}
                index={i}
                total={sections.length}
                busy={busy}
                dragging={dragFrom.current === i}
                onPatch={p => patch(s.id, p)}
                onDelete={() => removeSection(s.id)}
                onDragStart={() => { dragFrom.current = i; }}
                onDragEnter={() => onDragEnter(i)}
                onDragEnd={onDragEnd}
                onMove={dir => moveSection(i, dir)}
              />
            ))}
            {sections.length === 0 && (
              <p className="text-gray-400 text-sm py-8 text-center border border-dashed border-gray-300 rounded-lg">
                還沒有任何段落，按下方「新增段落」開始。
              </p>
            )}
          </div>

          <button type="button" onClick={addSection} disabled={busy}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-temple-red text-white text-sm font-medium hover:bg-[#5C1A04] disabled:opacity-50">
            <Plus className="w-4 h-4" /> 新增段落
          </button>

          {children}

          {page === 'about' && (
          <div className="mt-10 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
              首頁數字卡
              {factsSaved && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                  <Check className="w-3 h-3" aria-hidden="true" />已儲存
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              顯示在首頁「關於我們」右下方的兩個數字。
              <span className="text-gray-400">　改完請點一下欄位外面，看到「已儲存」才算存進去。</span>
            </p>
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
              {([
                ['fact1Value', 'fact1Label', '第一張'],
                ['fact2Value', 'fact2Label', '第二張'],
              ] as const).map(([vKey, lKey, title]) => (
                <div key={vKey} className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-2">{title}</p>
                  <input value={facts[vKey]} placeholder="數字，例如 1986"
                    onChange={e => setFacts(f => ({ ...f, [vKey]: e.target.value }))}
                    onBlur={() => saveFacts(facts)}
                    className={`${inputClass} mb-2 font-bold`} />
                  <input value={facts[lKey]} placeholder="說明，例如 建壇年份"
                    onChange={e => setFacts(f => ({ ...f, [lKey]: e.target.value }))}
                    onBlur={() => saveFacts(facts)}
                    className={inputClass} />
                </div>
              ))}
            </div>
          </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminAboutTab;
