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
import { MapPin, Navigation, RefreshCw, ShowerHead, AlertCircle, Play } from 'lucide-react';
import { getShowerLocations } from '../services/supabase';
import { heroSrc } from '../services/assetUrl';
import { formatShowerNote } from '../services/showerNote';
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
/**
 * 這一頁的目錄（廟方 2026-10-16：「影片放太下面了，還是做一個簡單的 menu」）。
 *
 * **不放在最上面**：這一頁的第一屏要留給「車在哪」與那顆導航鈕，塞一排目錄
 * 進去，在 375×667 的手機上就會把導航鈕推出畫面——那是整頁存在的理由。
 * 改成**接在位置卡片底下並 sticky**：一開始不佔第一屏，往下捲之後它黏在頂端
 * 一直都在，要跳到影片隨時一下。
 *
 * 只給四項。做成完整的六項目錄就得橫向捲，而橫向捲的選單等於把後面幾項藏起來。
 *
 * **捲動一律 instant**：開了「減少動態效果」的裝置會把平滑捲動**整個取消**，
 * 不是變快（全站規則，見 CLAUDE.md）。而本站信眾以長者居多、那個設定開著的
 * 比例不低——用 smooth 等於他們按了完全沒反應。
 */
const MENU: { id: string; label: string }[] = [
  { id: 'shower-now',    label: '車在哪' },
  { id: 'shower-01',     label: '關於我們' },
  { id: 'shower-03',     label: '服務對象' },
  { id: 'shower-videos', label: '影片' },
];

/** sticky 的高度加一點餘裕，跳過去時標題不會被選單蓋住 */
const MENU_OFFSET = 72;

const SectionMenu: React.FC = () => {
  const jump = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const y = window.scrollY + el.getBoundingClientRect().top - MENU_OFFSET;
    window.scrollTo({ top: Math.max(0, y), behavior: 'instant' as ScrollBehavior });
  };

  return (
    // 外層要滿版、底色與頁面同色：只放一顆浮起來的藥丸的話，黏住之後它上方那
    // 一道縫會露出正在捲過去的半行字，看起來像畫面壞掉。`-mx-4` 抵銷 main 的內距。
    <div className="sticky top-0 z-20 mt-8 -mx-4 px-4 pt-3 pb-2 bg-temple-bg">
      <nav
        aria-label="這一頁的內容"
        className="flex items-center justify-center gap-1 rounded-full
          border border-[#D6246B]/20 bg-white px-2 py-1.5 shadow-sm"
      >
        {MENU.map(m => (
          <a
            key={m.id}
            href={`#${m.id}`}
            onClick={e => jump(e, m.id)}
            className="px-3 py-1.5 rounded-full text-sm text-temple-dark hover:bg-[#FDF2F6] hover:text-[#B01350] transition-colors"
          >
            {m.label}
          </a>
        ))}
      </nav>
    </div>
  );
};

/**
 * 影片（2026-10-16 廟方提供兩支 YouTube 連結）。
 *
 * **預設只畫封面，按下去才載入播放器**（facade）。YouTube 的 iframe 一掛上去就是
 * 一兆位元組等級的 JS 與一批 cookie，而這一頁的人常常是在進香路上、一格訊號——
 * 兩支播放器自動載入等於替每個只是來查車在哪的人付掉幾 MB 的流量。
 * 網域用 `youtube-nocookie`：沒按播放之前不該有人被記上一筆。
 *
 * **封面用 YouTube 原本的預覽圖**（廟方 2026-10-16 指定）。兩支的預覽圖都是
 * 同一張協會海報、也就是這一頁最上面那張 banner，所以**標題一定要壓在封面上**
 * ——不寫的話畫面上是三張一模一樣的圖，分不出哪一支是哪一支。
 *
 * 封面**存在自己的 public/**（`shower-video-<id>.webp`）不是直接連 i.ytimg.com：
 * 沒按播放之前不必向 Google 發一次請求，而且圖多大、壓多少由我們自己決定。
 * 代價是上傳者換了預覽圖這邊不會跟著變，重跑一次壓縮即可。
 *
 * 標題照上傳者寫的，只在數字與中文之間補了空白（與全站「17 沐浴車」的寫法一致）。
 */
const VIDEOS: { id: string; title: string }[] = [
  { id: 'vCdQNnOVxTk', title: '17 沐浴車　吳至民理事長' },
  { id: '6t5GIuezgpA', title: '17 道光' },
];

const VideoCard: React.FC<{ id: string; title: string }> = ({ id, title }) => {
  const [playing, setPlaying] = useState(false);

  // aspect-video 兩種狀態共用，換成播放器時版面不會跳
  return (
    <div className="relative overflow-hidden rounded-2xl aspect-video bg-[#B01350]">
      {playing ? (
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`播放影片：${title}`}
          className="group absolute inset-0 w-full h-full"
        >
          <picture>
            <source srcSet={heroSrc(`shower-video-${id}.webp`)} type="image/webp" />
            <img
              src={heroSrc(`shower-video-${id}.jpg`)}
              alt=""
              width={640}
              height={360}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </picture>
          {/* 標題壓在照片上一定要有底，不然淺色的天空那一帶白字就不見了 */}
          <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 to-transparent" aria-hidden="true" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-white/95 flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110">
              <Play className="w-7 h-7 text-[#B01350] translate-x-0.5" fill="currentColor" aria-hidden="true" />
            </span>
          </span>
          <span className="absolute inset-x-0 bottom-0 px-4 pb-3 text-white font-serif text-base sm:text-lg font-bold text-center">
            {title}
          </span>
        </button>
      )}
    </div>
  );
};

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
  // 志工多半只打了「22:00」，補成完整的句子香客才知道那是什麼意思
  const noteText = formatShowerNote(truck.note);

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
          {noteText && <p className="text-gray-600 mt-2 leading-relaxed">{noteText}</p>}

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

        <div id="shower-now" className="scroll-mt-20">
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

        </div>

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

        <SectionMenu />

        {/* ── 品牌故事 ──
            排在即時位置之後：走了一整天的香燈腳要的是「車在哪」，不是先讀四段文章。
            進香期之外沒有車可查，這幾段才是這一頁的內容——所以兩種情境都成立。 */}
        <div className="mt-14 space-y-10">
          {SECTIONS.map(sec => (
            <section key={sec.no} id={`shower-${sec.no}`} className="scroll-mt-20">
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

        {/* 影片。編號接著協會那四段走，排版才對得齊；01–04 是協會給的文案，這一段是我們加的 */}
        <section id="shower-videos" className="mt-10 scroll-mt-20">
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-2xl font-bold text-[#D6246B]/35 leading-none">05</span>
            <h2 className="font-serif text-xl font-bold text-temple-dark">影片</h2>
          </div>
          <div className="mt-3 pl-1 border-l-2 border-[#D6246B]/25">
            <p className="pl-4 text-gray-700 leading-relaxed">影片放在 YouTube，按下播放才會開始載入。</p>
          </div>
          <div className="mt-4 space-y-4">
            {VIDEOS.map(v => <VideoCard key={v.id} id={v.id} title={v.title} />)}
          </div>
        </section>

        {/* 信念那句自己一塊，與上面的敘述拉開——它是整個服務的總結，不是第五段文章 */}
        <div className="mt-12 rounded-2xl bg-[#FDF2F6] border border-[#D6246B]/20 px-6 py-7 text-center">
          <p className="text-temple-dark leading-loose">
            一個人發心，十七人同行。<br />
            十七份善心，匯聚成一台愛心沐浴車。
          </p>
          <p className="mt-3 font-serif text-lg font-bold text-[#B01350]">{BRAND.tagline}</p>
        </div>

        {/* 收尾只留主辦單位，而且要大、要置中（廟方 2026-10-16）。
            這一頁是協會的服務，和聖壇做的只是查詢頁——署名權是協會的。
            原本那行「位置查詢由台北古亭和聖壇提供」依廟方指示移除，
            連帶拿掉的是這一頁唯一一條回首頁的出口（掃 QR 進來的人沒有導覽列）。 */}
        <div className="mt-14 text-center">
          <span className="inline-flex items-center gap-3" aria-hidden="true">
            <span className="w-10 h-px bg-[#D6246B]/40" />
            <span className="w-2 h-2 rotate-45 bg-[#D6246B]/60 inline-block" />
            <span className="w-10 h-px bg-[#D6246B]/40" />
          </span>
          <p className="mt-4 font-serif text-2xl sm:text-3xl font-bold text-[#B01350] tracking-wide">
            {BRAND.org}
          </p>
        </div>
      </main>
    </div>
  );
};

export default ShowerPage;
