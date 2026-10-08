/**
 * 進香洗澡車位置查詢 /shower
 *
 * 白沙屯媽祖進香沒有固定路線，洗澡車停在哪只有現場的人知道。志工用專屬連結打卡，
 * 香客在這一頁看「現在在哪裡」並直接導航過去。
 *
 * ── 使用情境決定了每一個取捨 ──
 * 香客走了一整天、天色暗、手機剩一格訊號、年紀偏大。所以：
 *   **一屏之內要看到答案**：地名、多久前更新、一顆大的導航按鈕，其餘一律往後排。
 *   **字要大**：地名用 20px 以上，不是一般內文的 14px。
 *   **自己會更新**：停在這一頁的人不會想到要下拉重新整理，每 60 秒自己抓一次。
 *   **不裝地圖**：嵌一張互動地圖要多載幾百 KB，而香客要的是「帶我去」不是「看地圖」——
 *     直接把他丟進他手機裡已經裝好的 Google 地圖導航。
 *
 * ── 「多久前」比「幾點幾分」重要 ──
 * 車會移動，所以香客真正要判斷的是「這個位置還可信嗎」。顯示「12 分鐘前」他立刻知道，
 * 顯示「18:42」他還要自己算。超過兩小時另外加一句提醒，因為那時位置很可能已經過期。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, Navigation, RefreshCw, ShowerHead, AlertCircle } from 'lucide-react';
import { getShowerLocations } from '../services/supabase';
import { ShowerTruckLocation } from '../types';

/** 位置超過這麼久就提醒香客可能已經移動 */
const STALE_MINUTES = 120;

/** 「12 分鐘前」。超過一天就直接給日期——那種資料已經沒有參考價值，講天數反而清楚 */
const agoLabel = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '剛剛';
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  return new Date(iso).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
};

/**
 * 導航網址。有座標就用座標（最準），只有地標就讓 Google 去搜那個地名。
 * 用 dir/?api=1 不是 maps/search：香客要的是「開始導航」，不是先看到一個圖釘。
 */
const navUrl = (t: ShowerTruckLocation): string => {
  const dest = t.lat !== undefined && t.lng !== undefined
    ? `${t.lat},${t.lng}`
    : (t.place ?? '');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
};

const TruckCard: React.FC<{ truck: ShowerTruckLocation }> = ({ truck }) => {
  const has = !!truck.checkedAt;
  const stale = has && Date.now() - new Date(truck.checkedAt!).getTime() > STALE_MINUTES * 60000;

  return (
    <li className="rounded-2xl border-2 border-temple-gold/40 bg-white px-5 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-serif text-lg font-bold text-temple-dark flex items-center gap-2">
          <ShowerHead className="w-5 h-5 text-temple-gold" aria-hidden="true" />
          {truck.name}
        </h2>
        {has && (
          <span className={`shrink-0 text-sm ${stale ? 'text-gray-500' : 'text-temple-red font-medium'}`}>
            {agoLabel(truck.checkedAt!)}更新
          </span>
        )}
      </div>

      {!has ? (
        <p className="text-gray-500">今日尚未回報位置，請稍後再查看。</p>
      ) : (
        <>
          {/* 地名是這一頁的主角，字級拉到 20–24px——香客多半在昏暗的戶外看手機 */}
          <p className="flex items-start gap-2 text-xl sm:text-2xl font-medium text-temple-dark leading-snug">
            <MapPin className="w-6 h-6 text-temple-red shrink-0 mt-1" aria-hidden="true" />
            <span>{truck.place || '（現場座標，請按導航）'}</span>
          </p>
          {truck.note && <p className="text-gray-600 mt-2 leading-relaxed">{truck.note}</p>}

          {stale && (
            <p className="mt-3 flex items-start gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              這個位置超過 {Math.floor(STALE_MINUTES / 60)} 小時沒有更新，洗澡車可能已經移動。
            </p>
          )}

          {/* 整條攤開的大按鈕：走累了的人用拇指點，不要做成一顆小藥丸 */}
          <a
            href={navUrl(truck)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-temple-red text-white text-lg font-bold hover:bg-[#5C4310] transition-colors"
          >
            <Navigation className="w-5 h-5" aria-hidden="true" />
            開啟導航
          </a>
        </>
      )}
    </li>
  );
};

const ShowerPage: React.FC = () => {
  const [trucks, setTrucks] = useState<ShowerTruckLocation[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number>(0);

  const load = useCallback(async () => {
    setRefreshing(true);
    try { setTrucks(await getShowerLocations()); setUpdatedAt(Date.now()); }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 停在這一頁的人不會想到要下拉重新整理，自己每 60 秒抓一次。
  // 分頁切到背景時瀏覽器本來就會節流，不另外處理可見性。
  useEffect(() => {
    const id = window.setInterval(load, 60000);
    return () => window.clearInterval(id);
  }, [load]);

  // 「多久前」要自己走動，不然停在畫面上永遠寫著「剛剛」
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick(n => n + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-temple-bg">
      <main className="max-w-xl mx-auto px-4 py-10 sm:py-14">
        <header className="text-center mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-temple-dark">進香洗澡車</h1>
          <div className="flex items-center justify-center gap-3 mt-3 mb-4" aria-hidden="true">
            <span className="w-12 h-px bg-temple-gold/70" />
            <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
            <span className="w-12 h-px bg-temple-gold/70" />
          </div>
          <p className="text-gray-600 leading-relaxed">
            免費提供隨香香客盥洗。位置由現場志工回報，車會隨隊伍移動，出發前請再確認一次。
          </p>
        </header>

        {trucks === null ? (
          <p className="text-center py-16 text-gray-400">載入中…</p>
        ) : trucks.length === 0 ? (
          <div className="text-center py-16">
            <ShowerHead className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
            <p className="text-gray-500 text-lg">目前沒有洗澡車在服務</p>
            <p className="text-gray-400 text-sm mt-2">進香期間才會開放，敬請期待。</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {trucks.map(t => <TruckCard key={t.id} truck={t} />)}
          </ul>
        )}

        {/* 自動更新是背景行為，仍要給一顆手動的——香客會想確認「它真的有在更新嗎」 */}
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={load}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-temple-gold/50 text-temple-dark hover:bg-temple-gold/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            重新整理
          </button>
          {updatedAt > 0 && (
            <p className="text-xs text-gray-400 mt-3">
              本頁每分鐘自動更新一次　最後查詢 {new Date(updatedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        <p className="mt-10 text-center text-sm text-gray-400">台北古亭和聖壇</p>
      </main>
    </div>
  );
};

export default ShowerPage;
