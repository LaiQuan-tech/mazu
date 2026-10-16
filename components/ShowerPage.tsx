/**
 * 17 沐浴車位置查詢 /shower
 *
 * 進香沿線的免費沐浴服務，主辦單位是台中媽祖聖沐慈善協會（2026-10-16 取得授權使用品牌與
 * 文案），和聖壇提供的是這一頁位置查詢。對外一律稱「沐浴車」，不要寫回「洗澡車」。
 *
 * 進香沒有固定路線，車停在哪只有現場的人知道。志工用專屬連結打卡，
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
import { heroSrc } from '../services/assetUrl';
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

/**
 * ── 品牌與文案集中在這裡 ──
 * 廟方 2026-10-16 提供（台中媽祖聖沐慈善協會，已取得授權；這個功能日後會獨立成
 * 自己的站，所以文案不散在 JSX 裡、集中成一份常數，搬家時整塊帶走就好）。
 * **一個字都不要自己編**：服務內容、服務對象這種事寫錯，香客會照著跑一趟。
 */
const BRAND = {
  name: '17 沐浴車',
  org: '台中媽祖聖沐慈善協會',
  tagline: '關懷每位香客，從沐浴開始。',
  /** 橫幅底下那一句，講的是「這一頁現在能幫你什麼」，不是品牌故事 */
  lead: '免費提供隨香香燈腳盥洗。位置由現場志工回報，車會隨隊伍移動，出發前請再確認一次。',
};

/** 品牌故事。排在即時位置**之後**——理由見檔頭「一屏之內要看到答案」 */
const SECTIONS: { no: string; title: string; sub?: string; paras: string[] }[] = [
  {
    no: '01', title: '團隊介紹', sub: '一份善心，十七份力量',
    paras: [
      '17沐浴車的起心動念，來自一份單純而真誠的善念。在媽祖進香的路上，我們看見一雙雙走了數十公里的腳，也看見香燈腳一路上的汗水與疲憊。',
      '因此，我們希望為辛苦走在進香路上的香燈腳，提供一個可以好好洗澡的地方，讓他們洗去一身汗水與疲憊，也讓這份關懷真正落實在需要的地方。',
      '於是，一個人的發心，慢慢凝聚成十七人的同行。由 17 位企業家共同響應公益，投入資源、共同打造 17 沐浴車，將企業家的善念化為實際行動，陪伴媽祖進香的每一段路程。',
      '一台車，承載的不只是沐浴設備，更是十七份願意付出的心。',
    ],
  },
  {
    no: '02', title: '服務介紹', sub: '讓辛苦走在進香路上的人，好好洗一個澡',
    paras: [
      '長途進香，是一段充滿信念的旅程。一步一步走過的，是虔誠，也是汗水、疲憊與堅持。',
      '17沐浴車配合媽祖進香活動，為辛苦走在進香路上的香燈腳，提供免費沐浴服務。讓大家在長途進香的過程中，能夠洗去一身汗水，洗去一路的疲憊，換上乾淨的衣物，再繼續接下來的行程。',
      '進香路途漫長，對香燈腳而言，洗澡是一件日常而重要的事情。因此，我們將沐浴服務帶到進香路上，依活動需求提供服務，讓辛苦走了一整天的香燈腳，可以好好洗個澡，整理自己，再繼續完成這一趟虔誠的旅程。',
      '洗去汗水，洗去疲憊。對我們而言，沐浴是一項服務；對辛苦走了一整天的香燈腳而言，卻是一份實實在在的關懷。',
    ],
  },
  {
    no: '03', title: '服務對象',
    paras: ['主要服務參與媽祖進香活動的香燈腳、進香信眾、隨香人員與進香志工，依各項進香活動的服務安排，提供公益沐浴服務。'],
  },
  {
    no: '04', title: '我們的初心',
    paras: [
      '因為看見，所以關心。因為關心，所以付諸行動。',
      '從一個人的善念，到十七位企業董事長共同響應，17沐浴車希望將這份心意，化為進香路上一項實際而溫暖的服務。讓辛苦走在路上的香燈腳，洗去一身汗水與疲憊，帶著舒服的身體繼續前行。',
    ],
  },
];

/**
 * 橫幅。照廟方給的海報風格：暖色夕照、桃紅、泡泡。
 *
 * **刻意做矮不做滿版**（手機約 190px）：這一頁的核心原則是「一屏之內要看到答案」
 * ——香客走了一整天、天色暗，他要的是「車在哪」。一張漂亮但把位置推出畫面的
 * 主視覺，正好違背這一頁存在的理由。品牌故事排在位置之後。
 *
 * 泡泡是 SVG 畫的，不是圖檔：這一頁要在訊號一格的山區載入。
 */
/**
 * Banner 用協會提供的原圖，不是自己畫的——品牌識別（毛筆字、粉紅、志工照）
 * 是協會的資產，重畫一張只會變成「很像但不是」。
 *
 * 圖裡已經有「17 沐浴車」五個大字，所以 h1 用 sr-only：畫面上不重複講一次，
 * 但搜尋引擎與讀屏軟體仍讀得到。alt 寫的是圖的內容，不是標題的複寫。
 *
 * aspect-[1448/1086] 先把高度卡住，圖還沒載完時底下的位置卡片不會往下跳
 * （這一頁的人常常在 1 格訊號下開，圖會比文字晚很久）。
 */
const Banner: React.FC = () => (
  <div className="relative overflow-hidden rounded-3xl mb-8 bg-[#B01350]/10 aspect-[1448/1086]">
    <h1 className="sr-only">{BRAND.name}｜{BRAND.org}</h1>
    <picture>
      <source srcSet={heroSrc('shower-banner.webp')} type="image/webp" />
      <img
        src={heroSrc('shower-banner.jpg')}
        alt={`${BRAND.name}——${BRAND.org}的志工在進香沿線提供免費沐浴服務。${BRAND.tagline}`}
        width={1448}
        height={1086}
        fetchPriority="high"
        className="w-full h-full object-cover block"
      />
    </picture>
  </div>
);

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
              這個位置超過 {Math.floor(STALE_MINUTES / 60)} 小時沒有更新，沐浴車可能已經移動。
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
        <Banner />
        {/* 橫幅底下只放「這一頁現在能幫你什麼」。品牌故事在位置之後 */}
        <p className="text-gray-600 leading-relaxed text-center mb-8">{BRAND.lead}</p>

        {trucks === null ? (
          <p className="text-center py-16 text-gray-400">載入中…</p>
        ) : trucks.length === 0 ? (
          <div className="text-center py-16">
            <ShowerHead className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
            <p className="text-gray-500 text-lg">目前沒有沐浴車在服務</p>
            <p className="text-gray-400 text-sm mt-2">配合進香活動開放，敬請期待。</p>
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

        {/* ── 品牌故事 ──
            排在即時位置之後：走了一整天的香燈腳要的是「車在哪」，不是先讀四段文章。
            進香期之外沒有車可查，這幾段才是這一頁的內容——所以兩種情境都成立。 */}
        <div className="mt-14 space-y-10">
          {SECTIONS.map(sec => (
            <section key={sec.no}>
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-2xl font-bold text-[#D6246B]/35 leading-none">{sec.no}</span>
                <div>
                  <h2 className="font-serif text-xl font-bold text-temple-dark">{sec.title}</h2>
                  {sec.sub && <p className="text-sm text-[#B01350] mt-0.5">{sec.sub}</p>}
                </div>
              </div>
              <div className="mt-3 pl-1 border-l-2 border-[#D6246B]/25 space-y-3">
                {sec.paras.map((t, i) => (
                  <p key={i} className="pl-4 text-gray-700 leading-relaxed">{t}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* 信念那句自己一塊，與上面的敘述拉開——它是整個服務的總結，不是第五段文章 */}
        <div className="mt-12 rounded-2xl bg-[#FDF2F6] border border-[#D6246B]/20 px-6 py-7 text-center">
          <p className="text-temple-dark leading-loose">
            一個人發心，十七人同行。<br />
            十七份善心，匯聚成一台愛心沐浴車。
          </p>
          <p className="mt-3 font-serif text-lg font-bold text-[#B01350]">{BRAND.tagline}</p>
        </div>

        {/* 這一頁大多是掃 QR 或點別人轉傳的連結進來的，沒有導覽列。
            留一個回首頁的出口給想知道「這是誰做的」的人，順便給搜尋引擎一條內部連結 */}
        <p className="mt-10 text-center text-sm text-gray-400">
          {BRAND.org}
          <span className="mx-2 text-gray-300">・</span>
          位置查詢由
          <a href="/" className="underline decoration-gray-300 underline-offset-2 hover:text-temple-red">台北古亭和聖壇</a>
          提供
        </p>
      </main>
    </div>
  );
};

export default ShowerPage;
