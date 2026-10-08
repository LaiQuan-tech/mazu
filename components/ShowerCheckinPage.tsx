/**
 * 洗澡車打卡 /shower/checkin
 *
 * 給**現場志工**用的，不是給香客的。
 *
 * ── 為什麼沒有密碼也沒有鑰匙 ──
 * 第一版做成每台車一把 32 字元的鑰匙（`?k=…`），安全性夠，但代價全落在最不該付的人
 * 身上：廟方要進 SQL 或後台才拿得到連結、志工每台車一條不同的網址、連結在 LINE 群組
 * 被轉傳一次整套就失去意義。廟方 2026-10-08 判斷「打卡連結不會公開」，改成一條共用網址。
 * **這是權衡過的決定不是疏漏**：位置被亂填的後果是香客白跑一趟，不涉及個資與金流，
 * 拿它換「志工開了就能按」是划算的。代價寫在頁面上那條警示裡。
 *
 * ── 這一頁的現場條件 ──
 * 一隻手拿手機、另一隻手在收東西；天黑；訊號可能只有一格；車剛停好要趕快讓香客知道。
 * 所以流程壓到最短：**開連結 → 按一顆大按鈕 → 送出**。
 *   車子選過一次就記在這支手機上（`localStorage`），之後開啟直接按。只有一台車時不必選。
 *   地標與備註都是選填——有座標就導得到，硬性要求填字只會讓人放棄打卡。
 *   GPS 抓不到時不是死路：可以只填地標文字送出。
 *   送出後把「香客現在會看到什麼」照抄一遍，志工才知道自己填的東西對不對。
 *
 * ── 為什麼不自動送出 ──
 * 一進頁面就抓 GPS 並送出，看起來更快，但車還在移動時志工只是先把頁面打開，
 * 那樣會記下一個錯的位置。按鈕按下去的那一刻才是「車停好了」。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, Send, CheckCircle2, AlertCircle, LocateFixed, Lock } from 'lucide-react';
import { getShowerLocations, showerCheckin } from '../services/supabase';
import { ShowerTruckLocation } from '../types';

type GeoState =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'ok'; lat: number; lng: number; accuracy: number }
  | { kind: 'fail'; reason: string };

/** 記住這支手機上次打哪一台車。志工整趟進香都顧同一台，不該每次重選 */
const LAST_TRUCK_KEY = 'shower_last_truck';

const inputClass =
  'w-full px-4 py-3 border border-gray-300 rounded-xl text-base text-gray-800 outline-none focus:border-temple-red';

/** 定位失敗的原因要講得出「接下來怎麼辦」，只寫「定位失敗」等於沒說 */
const geoMessage = (e: GeolocationPositionError): string => {
  if (e.code === e.PERMISSION_DENIED) return '您拒絕了定位權限。可以改用下方的「目前地點」欄位填地名。';
  if (e.code === e.POSITION_UNAVAILABLE) return '目前抓不到衛星訊號（常見於室內或山區）。可以改填地名。';
  return '定位逾時，請再試一次，或改填地名。';
};

const readLastTruck = (): string => {
  try { return localStorage.getItem(LAST_TRUCK_KEY) ?? ''; } catch { return ''; }
};
const rememberTruck = (id: string): void => {
  try { localStorage.setItem(LAST_TRUCK_KEY, id); } catch { /* 無痕模式；記不住只是下次要再選一次 */ }
};

const ShowerCheckinPage: React.FC = () => {
  const [trucks, setTrucks] = useState<ShowerTruckLocation[] | null>(null);
  const [truckId, setTruckId] = useState('');
  const [geo, setGeo] = useState<GeoState>({ kind: 'idle' });
  const [place, setPlace] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ name: string; at: number; place: string } | null>(null);
  const [error, setError] = useState('');

  /** 一進頁面就先抓位置（不送出）：按下按鈕時座標通常已經到手，少等好幾秒 */
  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeo({ kind: 'fail', reason: '這支手機的瀏覽器不支援定位，請改填地名。' });
      return;
    }
    setGeo({ kind: 'locating' });
    navigator.geolocation.getCurrentPosition(
      p => setGeo({ kind: 'ok', lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      e => setGeo({ kind: 'fail', reason: geoMessage(e) }),
      // enableHighAccuracy：戶外要的就是 GPS 精度；15 秒夠久又不會讓人以為當掉
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    locate();
    getShowerLocations().then(list => {
      setTrucks(list);
      // 只有一台就直接選好；有多台就沿用這支手機上次選的（還在清單上才算）
      const last = readLastTruck();
      if (list.length === 1) setTruckId(list[0].id);
      else if (last && list.some(t => t.id === last)) setTruckId(last);
    }).catch(() => setTrucks([]));
  }, [locate]);

  const canSend = !!truckId && (geo.kind === 'ok' || place.trim().length > 0);

  const submit = async () => {
    if (!canSend || sending) return;
    setSending(true);
    setError('');
    try {
      const name = await showerCheckin(truckId, {
        lat: geo.kind === 'ok' ? geo.lat : undefined,
        lng: geo.kind === 'ok' ? geo.lng : undefined,
        place: place.trim() || undefined,
        note: note.trim() || undefined,
      });
      // null＝這台車被停用或已刪除。跟網路錯誤是兩回事，給的指示也不一樣
      if (!name) {
        setError('這台洗澡車已停用，請向廟方確認。');
        return;
      }
      rememberTruck(truckId);
      setDone({ name, at: Date.now(), place: place.trim() });
      setNote('');
    } catch {
      setError('送出失敗，可能是訊號不穩。請確認網路後再按一次。');
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-temple-bg">
        <main className="max-w-md mx-auto px-4 py-12 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-9 h-9 text-green-600" aria-hidden="true" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-temple-dark mb-2">{done.name} 位置已更新</h1>
          <p className="text-gray-500 mb-6">
            {new Date(done.at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} 送出
          </p>

          {/* 把香客看到的結果照抄一遍：志工當場就能發現「我地名打錯了」 */}
          <div className="text-left rounded-2xl border-2 border-temple-gold/40 bg-white px-5 py-4 mb-6">
            <p className="text-xs text-gray-400 mb-2">香客現在會看到</p>
            <p className="text-lg font-medium text-temple-dark flex items-start gap-2">
              <MapPin className="w-5 h-5 text-temple-red shrink-0 mt-1" aria-hidden="true" />
              <span>{done.place || '（現場座標，按導航即可抵達）'}</span>
            </p>
            {geo.kind === 'ok' && (
              <p className="text-xs text-gray-400 mt-2">
                座標 {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => { setDone(null); locate(); }}
            className="w-full px-6 py-4 rounded-xl bg-temple-red text-white text-lg font-bold hover:bg-[#5C4310] transition-colors"
          >
            車又移動了，再打一次卡
          </button>
          <a href="/shower" className="block mt-4 text-sm text-temple-red hover:underline py-2">
            看香客查詢的畫面 →
          </a>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-temple-bg">
      <main className="max-w-md mx-auto px-4 py-8">
        <header className="text-center mb-5">
          <h1 className="font-serif text-2xl font-bold text-temple-dark">洗澡車打卡</h1>
          <p className="text-gray-500 text-sm mt-2">車停好之後按一下，香客那邊立刻就會更新。</p>
        </header>

        {/* 沒有密碼保護是刻意的取捨（見檔頭），所以這條警示是這個設計的一部分，不是裝飾。
            放在最上面、整年都在——志工每次打卡都會看到，轉傳前才會想一下 */}
        <p className="flex items-start gap-2 rounded-xl bg-temple-gold/15 border border-temple-gold/40 px-4 py-3 mb-5 text-sm text-[#5C4310] leading-relaxed">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <strong>這是工作人員專用的網址，請勿公開張貼或轉傳給香客。</strong>
            任何拿到這條網址的人都能更改洗澡車的位置。
          </span>
        </p>

        {/* 車輛選擇。只有一台時不顯示——少一個要操作的東西就是快一點 */}
        {trucks && trucks.length > 1 && (
          <label className="block mb-4">
            <span className="block text-sm font-medium text-gray-700 mb-1">這是哪一台車 *</span>
            <select
              value={truckId}
              onChange={e => { setTruckId(e.target.value); rememberTruck(e.target.value); }}
              className={inputClass}
            >
              <option value="">請選擇…</option>
              {trucks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <span className="block text-xs text-gray-400 mt-1">選過一次之後，這支手機會記住。</span>
          </label>
        )}
        {trucks && trucks.length === 1 && (
          <p className="mb-4 text-sm text-gray-600">
            車輛：<strong className="text-temple-dark">{trucks[0].name}</strong>
          </p>
        )}
        {trucks && trucks.length === 0 && (
          <p role="alert" className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm">
            目前沒有啟用中的洗澡車，請向廟方確認後台是否已新增。
          </p>
        )}

        {/* 定位狀態單獨一塊：志工要先看到「抓到了沒」再決定要不要補填地名 */}
        <div className="rounded-2xl border-2 border-temple-gold/40 bg-white px-5 py-4 mb-5">
          {geo.kind === 'locating' && (
            <p className="flex items-center gap-2 text-gray-600">
              <LocateFixed className="w-5 h-5 animate-pulse text-temple-gold" aria-hidden="true" />
              定位中…
            </p>
          )}
          {geo.kind === 'ok' && (
            <>
              <p className="flex items-center gap-2 text-temple-dark font-medium">
                <LocateFixed className="w-5 h-5 text-temple-red" aria-hidden="true" />
                已取得目前位置
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}　誤差約 {Math.round(geo.accuracy)} 公尺
              </p>
            </>
          )}
          {(geo.kind === 'fail' || geo.kind === 'idle') && (
            <p className="flex items-start gap-2 text-gray-600 text-sm" role={geo.kind === 'fail' ? 'alert' : undefined}>
              <AlertCircle className="w-5 h-5 shrink-0 text-gray-400" aria-hidden="true" />
              {geo.kind === 'fail' ? geo.reason : '尚未取得位置'}
            </p>
          )}
          <button
            type="button"
            onClick={locate}
            disabled={geo.kind === 'locating'}
            className="mt-3 text-sm font-medium text-temple-red hover:underline disabled:opacity-40 py-1"
          >
            重新定位
          </button>
        </div>

        <label className="block mb-4">
          <span className="block text-sm font-medium text-gray-700 mb-1">
            目前地點{geo.kind === 'ok' ? '（選填，建議填）' : ' *'}
          </span>
          <input
            value={place}
            onChange={e => setPlace(e.target.value)}
            placeholder="例：通霄鎮文昌祖廟旁停車場"
            className={inputClass}
          />
          <span className="block text-xs text-gray-400 mt-1">
            香客看到的就是這一行。沒有定位時一定要填。
          </span>
        </label>

        <label className="block mb-6">
          <span className="block text-sm font-medium text-gray-700 mb-1">備註（選填）</span>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="例：供應到今晚 23:00"
            className={inputClass}
          />
        </label>

        {error && (
          <p role="alert" className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!canSend || sending}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-5 rounded-xl bg-temple-red text-white text-xl font-bold hover:bg-[#5C4310] transition-colors disabled:bg-gray-300"
        >
          <Send className="w-5 h-5" aria-hidden="true" />
          {sending ? '送出中…' : '我在這裡'}
        </button>
        {!canSend && trucks !== null && trucks.length > 0 && (
          <p className="text-center text-sm text-gray-500 mt-3">
            {!truckId ? '請先選擇這是哪一台車。' : '請等待定位完成，或先填寫上方的「目前地點」。'}
          </p>
        )}
      </main>
    </div>
  );
};

export default ShowerCheckinPage;
