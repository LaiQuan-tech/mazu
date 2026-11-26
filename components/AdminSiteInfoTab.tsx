import React, { useCallback, useEffect, useState } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { getSiteInfo, saveSiteInfo, requestRepublish, DEFAULT_SITE_INFO } from '../services/supabase';
import { SiteInfo } from '../types';

/**
 * 後台「基本資料」：地址、電話、開放時間
 *
 * 這三項原本散在六個地方各寫一份，改一次要記得六個都動——漏一個就是網站
 * 自己跟自己說不一樣的話（實際發生過：網站寫 22:30、首頁問答寫 22:00）。
 * 改成一處設定、多處讀取之後，那種分岔不會再發生。
 *
 * 這一頁刻意用「填完按儲存」而不是逐欄自動存：地址與時間是一組互相關聯的
 * 資料，改到一半就寫進資料庫，前台會短暫顯示不完整的組合。
 */

const inputClass =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 outline-none focus:border-temple-red';

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
);

const AdminSiteInfoTab: React.FC = () => {
  const [form, setForm] = useState<SiteInfo>(DEFAULT_SITE_INFO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [republish, setRepublish] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [republishMsg, setRepublishMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setForm(await getSiteInfo());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k: keyof SiteInfo) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    // 時間必須是 HH:MM：結構化資料的 opens/closes 要機器讀得懂，
    // 廟方打成「6點」或全形冒號，Google 會整組忽略而且不會有任何錯誤訊息
    const timeOk = /^\d{2}:\d{2}$/;
    if (!timeOk.test(form.hoursOpen) || !timeOk.test(form.hoursClose)) {
      alert('開放時間請填 24 小時制的 HH:MM，例如 06:00 與 23:00。');
      return;
    }
    setSaving(true);
    try {
      await saveSiteInfo(form);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch { alert('儲存失敗，請重新整理後再試'); }
    finally { setSaving(false); }
  };

  const doRepublish = async () => {
    if (!window.confirm('要重新發布網站嗎？約 1–2 分鐘完成，期間網站照常運作。')) return;
    setRepublish('sending'); setRepublishMsg('');
    try { await requestRepublish(); setRepublish('sent'); }
    catch (e) { setRepublish('error'); setRepublishMsg(e instanceof Error ? e.message : String(e)); }
  };

  if (loading) return <p className="text-gray-400 text-sm">載入中…</p>;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">基本資料</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          地址、電話、開放時間。這裡改一次，網站上所有顯示這些資訊的地方會一起更新——
          頁尾、隱私政策，以及送給 Google 的資料。
        </p>
      </div>

      <div className="space-y-5 bg-white border border-gray-200 rounded-xl p-5">
        <Field label="完整地址" hint="顯示給信眾看的那一行，例如頁尾與隱私政策。">
          <input value={form.address} onChange={set('address')} className={inputClass} />
        </Field>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">地址拆解</p>
          <p className="text-xs text-gray-400 mb-3">
            給 Google 與地圖服務讀的格式，必須拆開才認得。內容要與上面那行一致。
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="郵遞區號"><input value={form.postalCode} onChange={set('postalCode')} className={inputClass} /></Field>
            <Field label="縣市"><input value={form.region} onChange={set('region')} className={inputClass} /></Field>
            <Field label="鄉鎮市區"><input value={form.locality} onChange={set('locality')} className={inputClass} /></Field>
            <Field label="街道"><input value={form.street} onChange={set('street')} className={inputClass} /></Field>
          </div>
        </div>

        <Field label="聯絡電話" hint="手機版會做成可直接撥號的連結。">
          <input value={form.phone} onChange={set('phone')} className={inputClass} />
        </Field>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">開放時間</p>
          <p className="text-xs text-gray-400 mb-3">
            24 小時制，格式 HH:MM。這組數字會直接送給 Google，格式不對它會整組忽略。
          </p>
          <div className="flex items-center gap-3">
            <input value={form.hoursOpen} onChange={set('hoursOpen')} placeholder="06:00"
              className={`${inputClass} w-28 text-center font-mono`} />
            <span className="text-gray-400">至</span>
            <input value={form.hoursClose} onChange={set('hoursClose')} placeholder="23:00"
              className={`${inputClass} w-28 text-center font-mono`} />
            <span className="text-sm text-gray-500">每日</span>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="button" onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-temple-red text-white text-sm font-medium hover:bg-[#5C4310] disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? '儲存中…' : '儲存'}
          </button>
          {saved && <span className="text-sm text-green-600">已儲存，網站上立刻生效。</span>}
        </div>
      </div>

      {/*
        與常見問題同一套：畫面與結構化資料是執行期讀資料庫，存檔就變；
        給不執行 JS 的 AI 助理看的靜態檔要重新建置才會換。
      */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-1">讓 AI 助理讀到最新內容</h3>
        <p className="text-sm text-gray-500 mb-4 leading-relaxed">
          上面存檔後，<strong>信眾與 Google 立刻就看得到，不必按這顆按鈕</strong>。<br />
          只有 ChatGPT、Claude 這類 AI 助理讀的是上次發布時的存檔版本。
          想讓它們也讀到最新的地址與時間，按一下重新發布，約 1–2 分鐘完成。
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={doRepublish} disabled={republish === 'sending'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-temple-red/40 text-temple-red text-sm font-medium hover:bg-temple-red/5 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${republish === 'sending' ? 'animate-spin' : ''}`} />
            {republish === 'sending' ? '發布中…' : '重新發布'}
          </button>
          {republish === 'sent' && <span className="text-sm text-green-600">已送出，約 1–2 分鐘後生效。</span>}
          {republish === 'error' && <span className="text-sm text-red-600">發布失敗：{republishMsg}</span>}
        </div>
      </div>
    </div>
  );
};

export default AdminSiteInfoTab;
