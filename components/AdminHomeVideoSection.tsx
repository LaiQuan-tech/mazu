import React, { useEffect, useState } from 'react';
import { Save, RefreshCw, AlertCircle, Video } from 'lucide-react';
import {
  getHomeVideo, saveHomeVideo, parseYouTubeId, fetchYouTubeInfo, uploadHomeVideoCover,
  homeVideoCover, DEFAULT_HOME_VIDEO,
} from '../services/supabase';
import { HomeVideo } from '../types';
import VideoFacade from './VideoFacade';

/**
 * 後台「多媒體管理」的首頁影片區塊（2026-11-09）。
 *
 * 在這之前首頁那支影片寫死在 App.tsx，換一支要工程師改程式、跑腳本產封面、
 * 再把檔名加進 HERO_FILES。現在廟方貼一個 YouTube 連結按儲存就好：
 * 標題與頻道名從 oEmbed 自動帶入，封面在存檔那一刻抓進我們自己的 site-images
 * （信眾載首頁時不向 Google 要任何東西，見 VideoFacade 的檔頭）。
 *
 * **刻意沒有「隱藏影片」的開關**：Hero 底部收邊的顏色（App.tsx 的 `HERO_FADE_RGB`）
 * 是對著影片區的米色調的，影片區一拿掉下一區就變成白底的公佈欄，交界會多一條色帶——
 * 那正是廟方 2026-10-25 回報過的「切到很突兀」。要能關，得讓收邊色跟著變，那是另一件事。
 *
 * 用「填完按儲存」而不是逐欄自動存：連結、大標、拍攝者是一組，改到一半就寫進資料庫，
 * 首頁會短暫出現新影片配舊大標（同基本資料那一頁的理由）。
 */

const inputClass =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-temple-red';

const linkOf = (id: string) => `https://youtu.be/${id}`;

const AdminHomeVideoSection: React.FC = () => {
  const [saved, setSaved] = useState<HomeVideo | null>(null);
  const [form, setForm] = useState<HomeVideo>(DEFAULT_HOME_VIDEO);
  const [link, setLink] = useState('');
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  useEffect(() => {
    getHomeVideo().then(v => { setSaved(v); setForm(v); setLink(linkOf(v.id)); });
  }, []);

  const parsedId = parseYouTubeId(link);
  const changed = !!saved && (
    parsedId !== saved.id || form.heading !== saved.heading
    || form.title !== saved.title || form.author !== saved.author
  );

  // 換成另一支影片時，標題與拍攝者一定是上一支的，直接用 oEmbed 的值蓋過去
  const onLinkChange = async (value: string) => {
    setLink(value);
    setMsg(null);
    const id = parseYouTubeId(value);
    if (!id || id === form.id) return;
    setForm(f => ({ ...f, id, title: '', author: '', coverPath: '' }));
    setLooking(true);
    const info = await fetchYouTubeInfo(id);
    setLooking(false);
    if (info) setForm(f => (f.id === id ? { ...f, title: info.title, author: info.author } : f));
    else setMsg({ kind: 'warn', text: '讀不到這支影片的資訊（可能是私人影片或已刪除）。標題與拍攝者請自行填寫。' });
  };

  const save = async () => {
    if (!saved || !parsedId) return;
    if (!form.heading.trim()) { setMsg({ kind: 'error', text: '請填寫區塊大標。' }); return; }
    setSaving(true);
    setMsg(null);
    try {
      let coverPath = parsedId === saved.id ? saved.coverPath : '';
      let coverFailed = false;
      // 保底那一支的封面在 public/ 裡，不必抓；其他影片沒有封面就抓一張
      if (!coverPath && parsedId !== DEFAULT_HOME_VIDEO.id) {
        coverPath = (await uploadHomeVideoCover(parsedId)) ?? '';
        coverFailed = !coverPath;
      }
      const next: HomeVideo = { ...form, id: parsedId, coverPath };
      await saveHomeVideo(next);
      setSaved(next);
      setForm(next);
      setMsg(coverFailed
        ? { kind: 'warn', text: '已儲存，但封面圖沒抓下來，首頁暫時直接顯示 YouTube 的預覽圖。過一會兒再按一次儲存即可。' }
        : { kind: 'ok', text: '已儲存，首頁重新整理就會看到。' });
    } catch {
      setMsg({ kind: 'error', text: '儲存失敗，請重新整理後再試。' });
    } finally {
      setSaving(false);
    }
  };

  // 預覽跟著表單走：貼上新連結就看得到新影片，存檔前先確認貼對了
  const preview: HomeVideo | null = parsedId ? { ...form, id: parsedId } : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-gray-100">
        <h4 className="font-semibold text-gray-800">首頁影片</h4>
        <p className="text-xs text-gray-400 mt-0.5">首頁「影像紀錄」區塊的 YouTube 影片。貼上影片連結，標題與拍攝者會自動帶入。</p>
      </div>
      {!saved ? (
        <div className="p-6 text-sm text-gray-400 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> 讀取中...
        </div>
      ) : (
        <div className="p-6 grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">預覽</p>
            {preview ? (
              <>
                {/* key：換影片時把播放器收回封面，不然會停在上一支的 iframe */}
                <VideoFacade
                  key={preview.id}
                  id={preview.id}
                  title={preview.title || preview.heading}
                  {...homeVideoCover(preview.id === saved.id ? { ...preview, coverPath: saved.coverPath } : preview)}
                  accent={{ box: 'bg-temple-red', btn: 'bg-[#FDFBF7]', icon: 'text-[#6B4A14]' }}
                />
                <p className="mt-2 text-center text-sm font-serif font-bold text-temple-dark">{form.heading || '（尚未填大標）'}</p>
                {form.author && <p className="text-center text-xs text-gray-500">影片：{form.author}</p>}
              </>
            ) : (
              <div className="aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400">
                <Video className="w-8 h-8 mb-2 opacity-40" />
                <span className="text-sm">貼上 YouTube 連結後顯示</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="hv-link" className="block text-sm font-medium text-gray-700 mb-1">YouTube 連結</label>
              <input id="hv-link" className={inputClass} value={link} onChange={e => onLinkChange(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…" inputMode="url" />
              <p className={`text-xs mt-1 ${link && !parsedId ? 'text-red-600' : 'text-gray-400'}`}>
                {link && !parsedId ? '看不出是哪一支影片，請貼 YouTube 的影片網址。'
                  : looking ? '正在讀取影片資訊...' : '一般影片、Shorts、youtu.be 短網址都可以。'}
              </p>
            </div>
            <div>
              <label htmlFor="hv-heading" className="block text-sm font-medium text-gray-700 mb-1">區塊大標</label>
              <input id="hv-heading" className={inputClass} value={form.heading}
                onChange={e => setForm(f => ({ ...f, heading: e.target.value }))} placeholder="例如：2025 進香回顧" />
              <p className="text-xs text-gray-400 mt-1">首頁影片上方的大字，寫「這是哪一年、什麼事」。換影片時記得一起改。</p>
            </div>
            <div>
              <label htmlFor="hv-author" className="block text-sm font-medium text-gray-700 mb-1">拍攝者</label>
              <input id="hv-author" className={inputClass} value={form.author}
                onChange={e => setForm(f => ({ ...f, author: e.target.value }))} placeholder="例如：拾九影像創作" />
              <p className="text-xs text-gray-400 mt-1">印在影片下方「影片：○○」。不是本壇自己拍的請標出來；留空就不顯示。</p>
            </div>
            <div>
              <label htmlFor="hv-title" className="block text-sm font-medium text-gray-700 mb-1">影片標題</label>
              <input id="hv-title" className={inputClass} value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              <p className="text-xs text-gray-400 mt-1">畫面上不顯示，給視障者的讀屏軟體念。自動帶入即可。</p>
            </div>

            {msg && (
              <div role={msg.kind === 'error' ? 'alert' : 'status'}
                className={`px-4 py-3 rounded-xl text-sm flex items-start gap-2 ${
                  msg.kind === 'ok' ? 'bg-green-50 text-green-700'
                  : msg.kind === 'warn' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> {msg.text}
              </div>
            )}

            <button onClick={save} disabled={saving || looking || !parsedId || !changed}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-temple-red text-white rounded-xl text-sm font-medium hover:bg-[#5C1A04] transition-colors disabled:opacity-50">
              {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> 儲存中...</> : <><Save className="w-4 h-4" /> 儲存</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHomeVideoSection;
