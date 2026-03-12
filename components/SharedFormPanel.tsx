import React, { useState } from 'react';
import { RefreshCw, Plus, Trash2, CheckCircle2, Users, X } from 'lucide-react';
import BirthDatePicker from './BirthDatePicker';
import {
  SharedSessionRecord, SharedEntryData,
  LampServiceConfig, ProfileData, ZodiacSign, ConsultationType, BlessingEventRecord,
} from '../types';

const newId = () => Math.random().toString(36).slice(2, 10);

interface LocalEntry {
  id:          string;
  name:        string;
  phone:       string;
  birthDate:   string;
  zodiac?:     ZodiacSign;
  gender:      string;
  address:     string;
  serviceId:   string;  // lamp
  packageId:   string;  // blessing
  bookingType: string;  // booking
  notes:       string;
  _bKey:       number;
}

const emptyEntry = (): LocalEntry => ({
  id: newId(), name: '', phone: '', birthDate: '', zodiac: undefined,
  gender: '', address: '', serviceId: '', packageId: '', bookingType: '', notes: '', _bKey: 0,
});

interface SharedFormPanelProps {
  session:       SharedSessionRecord;
  isCreator:     boolean;
  lampConfigs:   LampServiceConfig[];
  blessingEvent: BlessingEventRecord | null; // 祈福活動（包含 packages）
  memberProfile: ProfileData | null;
  onAddEntries:  (entries: Omit<SharedEntryData, 'sessionId'>[]) => Promise<void>;
  onSubmitAll:   () => Promise<void>;
  onRefresh:     () => Promise<void>;
  submitStatus:  'idle' | 'loading' | 'success' | 'error';
}

const SharedFormPanel: React.FC<SharedFormPanelProps> = ({
  session, isCreator, lampConfigs, blessingEvent, memberProfile,
  onAddEntries, onSubmitAll, onRefresh, submitStatus,
}) => {
  const [localEntries, setLocalEntries] = useState<LocalEntry[]>([emptyEntry()]);
  const [addStatus, setAddStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [refreshing, setRefreshing] = useState(false);

  const serviceType = session.serviceType;

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const handleAddEntries = async () => {
    const invalid = localEntries.find(e => !e.name.trim());
    if (invalid) { alert('請填寫每位人員的姓名'); return; }
    if (serviceType === 'lamp' && localEntries.some(e => !e.serviceId)) {
      alert('請為每位人員選擇燈種'); return;
    }
    if (serviceType === 'blessing' && blessingEvent && blessingEvent.packages.length > 0 && localEntries.some(e => !e.packageId)) {
      alert('請為每位人員選擇護持方案'); return;
    }
    if (serviceType === 'booking' && localEntries.some(e => !e.bookingType)) {
      alert('請為每位人員選擇諮詢類別'); return;
    }
    setAddStatus('loading');
    try {
      await onAddEntries(localEntries.map(e => ({
        name:        e.name.trim(),
        phone:       e.phone   || memberProfile?.phone || undefined,
        birthDate:   e.birthDate || undefined,
        zodiac:      e.zodiac  || undefined,
        gender:      e.gender  || undefined,
        address:     e.address || undefined,
        serviceId:   e.serviceId  || undefined,
        packageId:   e.packageId  || undefined,
        bookingType: e.bookingType || undefined,
        notes:       e.notes   || undefined,
      })));
      setLocalEntries([emptyEntry()]);
      setAddStatus('success');
      setTimeout(() => setAddStatus('idle'), 5000);
    } catch {
      setAddStatus('error');
    }
  };

  // ── 服務標題 ──
  const serviceLabel =
    serviceType === 'lamp'     ? '點燈' :
    serviceType === 'blessing' ? `祈福・${session.config.eventTitle ?? ''}` :
                                 `問事・${session.config.bookingDate ?? ''} ${session.config.bookingTime === 'evening' ? '晚上' : ''}`;

  if (session.status === 'submitted') {
    return (
      <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-400">
        <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-green-400" />
        此共享報名表已由召集人送出，不再接受新增。
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border-2 border-temple-red/30 bg-white overflow-hidden shadow-sm">
      {/* 頂部 Banner */}
      <div className="bg-temple-red px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Users className="w-4 h-4" />
          <span className="font-semibold text-sm">共享報名表</span>
          <span className="text-white/70 text-xs ml-1">{serviceLabel}</span>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="text-white/80 hover:text-white transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* ── 已加入名單 ── */}
        {session.entries.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">已有 {session.entries.length} 人加入</p>
            <div className="flex flex-wrap gap-2">
              {session.entries.map(e => {
                const lampName = serviceType === 'lamp' && e.serviceId
                  ? lampConfigs.find(c => c.id === e.serviceId)?.name : undefined;
                const pkgName = serviceType === 'blessing' && e.packageId && blessingEvent
                  ? blessingEvent.packages.find(p => p.id === e.packageId)?.name : undefined;
                return (
                  <span key={e.id}
                    className="inline-flex items-center gap-1 bg-temple-red/5 border border-temple-red/20 rounded-full px-3 py-1 text-xs text-gray-700">
                    {e.name}
                    {e.zodiac && <span className="text-gray-400">· {e.zodiac}年</span>}
                    {lampName  && <span className="text-gray-400">· {lampName}</span>}
                    {pkgName   && <span className="text-gray-400">· {pkgName}</span>}
                    {serviceType === 'booking' && e.bookingType && <span className="text-gray-400">· {e.bookingType}</span>}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 輸入表單 ── */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-3">新增您的資料</p>
          <div className="space-y-3">
            {localEntries.map((entry, idx) => (
              <div key={entry.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">第 {idx + 1} 位</span>
                  {localEntries.length > 1 && (
                    <button type="button"
                      onClick={() => setLocalEntries(prev => prev.filter(x => x.id !== entry.id))}
                      className="text-gray-400 hover:text-red-500 transition-colors p-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">姓名 *</label>
                    <input value={entry.name}
                      onChange={e => setLocalEntries(prev => prev.map(x => x.id === entry.id ? { ...x, name: e.target.value } : x))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" placeholder="姓名" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">電話（選填）</label>
                    <input value={entry.phone}
                      onChange={e => setLocalEntries(prev => prev.map(x => x.id === entry.id ? { ...x, phone: e.target.value } : x))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" placeholder={memberProfile?.phone || '留空同召集人'} />
                  </div>
                </div>

                {/* lamp：燈種 */}
                {serviceType === 'lamp' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">燈種 *</label>
                    <select value={entry.serviceId}
                      onChange={e => setLocalEntries(prev => prev.map(x => x.id === entry.id ? { ...x, serviceId: e.target.value } : x))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red">
                      <option value="">請選擇燈種</option>
                      {lampConfigs.filter(c => c.isActive).map(c => (
                        <option key={c.id} value={c.id}>{c.name}　NT${c.fee.toLocaleString()} / 年</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* blessing：護持方案（有方案時才顯示） */}
                {serviceType === 'blessing' && blessingEvent && blessingEvent.packages.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">護持方案 *</label>
                    <select value={entry.packageId}
                      onChange={e => setLocalEntries(prev => prev.map(x => x.id === entry.id ? { ...x, packageId: e.target.value } : x))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red">
                      <option value="">請選擇方案</option>
                      {blessingEvent.packages.map(pkg => (
                        <option key={pkg.id} value={pkg.id}>{pkg.name}　NT${pkg.fee.toLocaleString()}{pkg.description ? `　${pkg.description}` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* blessing：性別 */}
                {serviceType === 'blessing' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">性別</label>
                    <select value={entry.gender}
                      onChange={e => setLocalEntries(prev => prev.map(x => x.id === entry.id ? { ...x, gender: e.target.value } : x))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red">
                      <option value="">不指定</option>
                      {['信士', '信女', '小兒（16歲以下）', '小女兒（16歲以下）'].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                )}

                {/* booking：諮詢類別 */}
                {serviceType === 'booking' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">諮詢類別 *</label>
                    <select value={entry.bookingType}
                      onChange={e => setLocalEntries(prev => prev.map(x => x.id === entry.id ? { ...x, bookingType: e.target.value } : x))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red">
                      <option value="">請選擇類別</option>
                      {Object.values(ConsultationType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                )}

                {/* 生日 */}
                <BirthDatePicker
                  key={`shared-${entry.id}-${entry._bKey}`}
                  birthDate={entry.birthDate}
                  zodiac={entry.zodiac}
                  onChange={(birthDate, zodiac) => setLocalEntries(prev => prev.map(x => x.id === entry.id ? { ...x, birthDate, zodiac } : x))}
                />
                {/* 生肖 */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">生肖（自動帶入，可手動修改）</label>
                  <select value={entry.zodiac || ''}
                    onChange={e => setLocalEntries(prev => prev.map(x => x.id === entry.id ? { ...x, zodiac: e.target.value as ZodiacSign || undefined } : x))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red">
                    <option value="">請選擇</option>
                    {Object.values(ZodiacSign).map(z => <option key={z} value={z}>{z}年</option>)}
                  </select>
                </div>
                {/* 地址 */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">居住地址</label>
                  <input value={entry.address}
                    onChange={e => setLocalEntries(prev => prev.map(x => x.id === entry.id ? { ...x, address: e.target.value } : x))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-temple-red" placeholder="居住地址（選填）" />
                </div>
              </div>
            ))}
          </div>

          {/* 新增人員按鈕 */}
          <button type="button"
            onClick={() => setLocalEntries(prev => [...prev, emptyEntry()])}
            className="w-full mt-2 py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-400 hover:border-temple-red hover:text-temple-red transition-colors flex items-center justify-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> 新增一人
          </button>
        </div>

        {/* ── 狀態提示 ── */}
        {addStatus === 'success' && (
          <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 rounded-xl px-4 py-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            您的資料已加入，感謝！召集人確認後將統一送出。
          </div>
        )}
        {addStatus === 'error' && (
          <p className="text-red-500 text-xs">加入失敗，請稍後再試。</p>
        )}
        {submitStatus === 'success' && (
          <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 rounded-xl px-4 py-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            全部報名已送出！
          </div>
        )}
        {submitStatus === 'error' && (
          <p className="text-red-500 text-xs">送出失敗，請稍後再試。</p>
        )}

        {/* ── 操作按鈕 ── */}
        <div className="space-y-2">
          <button type="button" onClick={handleAddEntries} disabled={addStatus === 'loading'}
            className="w-full py-2.5 bg-temple-red text-white rounded-xl text-sm font-semibold hover:bg-temple-red/90 transition-colors disabled:opacity-60">
            {addStatus === 'loading' ? '加入中…' : `加入報名表（${localEntries.length} 人）`}
          </button>
          {isCreator && session.entries.length > 0 && (
            <button type="button" onClick={onSubmitAll}
              disabled={submitStatus === 'loading' || submitStatus === 'success'}
              className="w-full py-2.5 border-2 border-temple-red text-temple-red rounded-xl text-sm font-semibold hover:bg-temple-red/5 transition-colors disabled:opacity-60">
              {submitStatus === 'loading' ? '送出中…' : `確認送出全部（共 ${session.entries.length} 人）`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SharedFormPanel;
