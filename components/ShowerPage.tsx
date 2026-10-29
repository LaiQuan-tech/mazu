/**
 * 17 沐浴車位置查詢 /shower
 *
 * 進香沿線的免費沐浴服務，主辦單位是臺中市媽祖聖沐慈善協會（2026-10-16 取得授權使用品牌與
 * 文案）。對外一律稱「沐浴車」，不要寫回「洗澡車」。
 *
 * **對外的文案一律不要寫「和聖壇提供／協助架設這一頁」**（廟方 2026-10-20：
 * 「之前只是暫時放和聖壇」）。這一頁現在有自己的網域 17bath.org，掛在和聖壇的
 * 網域底下只是過渡；署名權從頭到尾都是協會的。
 * 和聖壇那邊的 `public/llms.txt` 仍然寫著「主辦是協會不是和聖壇」——那是消歧義，
 * 不是署名，要留著（不然 AI 會把這台車算成宮廟的服務）。
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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, RefreshCw, ShowerHead, AlertCircle, ArrowRight } from 'lucide-react';
import { getShowerLocations } from '../services/supabase';
import { heroSrc } from '../services/assetUrl';
import { formatShowerNote } from '../services/showerNote';
import showerFaq from '../content/shower-faq.json';
import showerVideos from '../content/shower-videos.json';
import { FacebookIcon } from './SocialLinks';
import VideoFacade from './VideoFacade';
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
 * 廟方 2026-10-16 提供（臺中市媽祖聖沐慈善協會，已取得授權；這個功能日後會獨立成
 * 自己的站，所以文案不散在 JSX 裡、集中成一份常數，搬家時整塊帶走就好）。
 * **一個字都不要自己編**：服務內容、服務對象這種事寫錯，香客會照著跑一趟。
 */
const BRAND = {
  name: '17 沐浴車',
  org: '臺中市媽祖聖沐慈善協會',
  tagline: '關懷每位香客，從沐浴開始。',
  /**
   * **協會自己的** LINE 官方帳號（`@822oawqk`，廟方 2026-10-16 提供）。
   * 不要跟和聖壇那個搞混——那是 `lin.ee/lj0gLqR`／`@725utjch`，寫在 CLAUDE.md 裡，
   * 全站的浮動鈕與導覽列圖示用的都是它。這一支只出現在 /shower。
   */
  line: 'https://lin.ee/SUoSKti',
  /**
   * 協會的臉書粉專「17沐浴車一起來沐浴」（廟方 2026-10-20 提供）。
   *
   * 用 `profile.php?id=` 這個穩定形式，不用他給的 `facebook.com/share/xxx`
   * 分享短連結——那種是臨時的、會換；也不用 `/people/<中文名>/<id>/` 那個，
   * 網址裡一長串 URL-encode 的中文，貼在哪裡都難看而且一樣會跟著改名變動。
   */
  facebook: 'https://www.facebook.com/profile.php?id=61574029464178',
  /** 志工招募報名表（Google 表單，廟方 2026-10-17 提供） */
  volunteerForm: 'https://forms.gle/P46M9nt7Dzh4125z6',
  /** 愛心捐贈表單（Google 表單「17沐浴車愛心捐贈」，廟方 2026-10-24 提供）。
   *  **收款的是協會不是和聖壇**——這一頁掛在兩個網域上，文案與 aria-label
   *  都要指名協會，不然在 heshengtan.tw/shower 上會被當成宮廟在募款。 */
  donateForm: 'https://forms.gle/ZVwrpyRLzKnMmWcaA',
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
 * 只給四項。做成完整的目錄就得橫向捲，而橫向捲的選單等於把後面幾項藏起來。
 * 2026-10-17 把「服務對象」換成「志工報名」：前者就在「關於我們」底下兩段、
 * 捲一下就看得到，後者在整頁最後面、沒有任何地方指得到它。兩個標籤都是四個字，
 * 換了寬度不變（量過：四項共 306px、藥丸可用 343px，第五項放不下）。
 *
 * **捲動一律 instant**：開了「減少動態效果」的裝置會把平滑捲動**整個取消**，
 * 不是變快（全站規則，見 CLAUDE.md）。而本站信眾以長者居多、那個設定開著的
 * 比例不低——用 smooth 等於他們按了完全沒反應。
 */
// 四個標籤一律四個字（廟方 2026-10-20：「可以統一都四個字嗎」）。
// 字數一致，四顆膠囊的寬度才一樣，橫排看起來才是一列整齊的目錄而不是長短不一的字串。
// 「相關影片」要與區塊標題 <h2> 同字，目錄寫一個名字、跳過去看到另一個名字，
// 人會以為自己按錯了（同 CLAUDE.md 那條「叫得出按鈕真正的名字」）。
const MENU: { id: string; label: string }[] = [
  { id: 'shower-now',       label: '車在哪裡' },
  { id: 'shower-01',        label: '關於我們' },
  { id: 'shower-videos',    label: '相關影片' },
  { id: 'shower-volunteer', label: '志工報名' },
];

/** 量不到 sticky 高度時的保底值（四個標籤排一列時就是這麼高） */
const MENU_OFFSET = 72;

const SectionMenu: React.FC = () => {
  const barRef = useRef<HTMLDivElement>(null);

  const jump = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    // **偏移量用量的不要寫死**：標籤統一成四個字之後，320px 的窄螢幕放不下一列、
    // 會折成兩列，選單就比寫死的 72 高，跳過去時區塊標題會被蓋住。
    const offset = (barRef.current?.getBoundingClientRect().height ?? MENU_OFFSET) + 8;
    const y = window.scrollY + el.getBoundingClientRect().top - offset;
    window.scrollTo({ top: Math.max(0, y), behavior: 'instant' as ScrollBehavior });
  };

  return (
    // 外層要滿版、底色與頁面同色：只放一顆浮起來的藥丸的話，黏住之後它上方那
    // 一道縫會露出正在捲過去的半行字，看起來像畫面壞掉。`-mx-4` 抵銷 main 的內距。
    <div ref={barRef} className="sticky top-0 z-20 mt-8 -mx-4 px-4 pt-3 pb-2 bg-temple-bg">
      <nav
        aria-label="這一頁的內容"
        // `flex-wrap` ＋ 每顆 `whitespace-nowrap`：放得下就一列，放不下整顆換到第二列。
        // 少了 nowrap，窄螢幕上是**標籤自己從中間斷開**（「車在／哪裡」），
        // 那比折成兩列難看得多，而且第一眼看不出是版面問題還是字打錯。
        className="flex flex-wrap items-center justify-center gap-1 rounded-full
          border border-[#D6246B]/20 bg-white px-2 py-1.5 shadow-sm"
      >
        {MENU.map(m => (
          <a
            key={m.id}
            href={`#${m.id}`}
            onClick={e => jump(e, m.id)}
            // 窄螢幕的左右內距小一號。四個四字標籤加 `nowrap` 之後自然寬度是 332px，
            // 而 375px 的手機只有 327px 可用——差這 5px 就會折成「三個＋一個」那種
            // 更難看的兩列。縮成 px-2 之後是 300px，360px 的機子也排得下；
            // 真的放不下（320px）才折成整齊的兩列兩顆。
            className="whitespace-nowrap px-2 sm:px-3 py-1.5 rounded-full text-sm text-temple-dark hover:bg-[#FDF2F6] hover:text-[#B01350] transition-colors"
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
 * 四支播放器自動載入等於替每個只是來查車在哪的人付掉幾 MB 的流量。
 * 網域用 `youtube-nocookie`：沒按播放之前不該有人被記上一筆。
 *
 * **封面用影片自己的圖**（廟方 2026-10-16 指定）。
 *
 * **標題放在圖的下面，不要壓在圖上**（2026-10-20 影片變多時改的）。
 * 兩支影片時壓在圖上沒問題，多幾支就壞了，而且壞在兩個地方：
 *   1. 新聞台的縮圖**自己就有跑馬燈與下標**，我們再壓一行上去是兩層字疊在一起；
 *   2. 標題一長就換行，文字往上長到卡片中央，直接**撞上播放鍵**
 *      （實測 715px 寬時卡片只有 149px 高，兩行標題的頂端正好落在圓鈕上）。
 * 改到圖下面之後兩個問題都不存在，而且**每張卡都有標題、底線對得齊**；
 * 片名已經印在圖上的那兩支（十七道光、情暖花蓮）照樣給一行——
 * 縮圖上的字是美術設計，下面那行是清單的標籤，兩者不是同一件事。
 *
 * 封面**存在自己的 public/**（`shower-video-<id>.webp`）不是直接連 i.ytimg.com：
 * 沒按播放之前不必向 Google 發一次請求，而且圖多大、壓多少由我們自己決定。
 * 代價是上傳者換了預覽圖這邊不會跟著變，重跑 `scripts/build-shower-covers.js` 即可
 * （加影片也跑那一支，用法在檔頭；直式要抓 `oardefault` 才不會有黑邊，它有處理）。
 *
 * 標題照上傳者寫的，只在數字與中文之間補了空白（與全站「17 沐浴車」的寫法一致）。
 * 幾個例外（標籤當標題、檔名當標題）的理由寫在各自那一筆的 `note` 裡。
 *
 * ── 清單在 `content/shower-videos.json`，不在這個檔案裡 ──
 * `scripts/prerender.js` 也要用它來同步 `llms-bath.txt`（不執行 JS 的 AI 檢索器
 * 只讀得到那一份）。抄成兩份的話，加一支影片就會有一邊忘了改——
 * 同 `content/shower-faq.json` 的理由。
 */
const VIDEOS: {
  id: string;
  title: string;
  /** 直式（9:16 的 YouTube Shorts）。橫式的一律不填 */
  portrait?: boolean;
  /** 外部媒體的報導要標出是哪一台，自己拍的不填 */
  source?: string;
  /** 為什麼這樣寫標題、為什麼移除某一支——理由跟著資料走，不另外放 */
  note?: string;
}[] = showerVideos;

const VideoCard: React.FC<{
  id: string; title: string; portrait?: boolean; source?: string;
}> = ({ id, title, portrait, source }) => (
    <figure className={portrait ? 'max-w-[260px] sm:max-w-[288px] mx-auto' : undefined}>
      {/* facade 的機制（長寬比框／封面／播放鈕／按下去才載 iframe）抽到 VideoFacade
          共用，首頁那一支用的是同一支；這一頁自己的只剩粉色與下面那段圖說。
          **直式一定要給寬度上限**（上面那層 figure）：9:16 攤滿手機的欄寬就是 667px 高、
          比一個螢幕還長，香客得滑過一整屏才看得到下一支。260 大約就是手機握在手上的樣子。 */}
      <VideoFacade
        id={id}
        title={title}
        cover={`shower-video-${id}`}
        portrait={portrait}
        accent={{ box: 'bg-[#B01350]', btn: 'bg-[#FDFBF7]', icon: 'text-[#B01350]' }}
      />
      {/* 標題在圖的下面不壓在圖上（理由見 VIDEOS 上面那段）。
          媒體名稱排在片名之上、小一號：它是出處不是標題，
          但兩則新聞的片名一模一樣，沒有它就分不出哪一台。 */}
      <figcaption className="mt-2 px-1 text-center">
        {source && (
          <span className="block text-xs text-[#B01350] tracking-wide">{source}</span>
        )}
        <span className="block font-serif text-sm sm:text-base font-bold text-temple-dark leading-snug">
          {title}
        </span>
      </figcaption>
    </figure>
);

/**
 * 志工招募（廟方 2026-10-17 提供橫幅與 Google 表單）。
 *
 * **位置在常見問題之後、頁尾之前**，不在前面：這一頁的第一屏是給「車停在哪」
 * 的，而會想報名志工的人，是讀完四段故事、看完影片之後才被打動的。
 * 擺在上面只會擋住查位置的人，而且對還不知道這是什麼的人喊「來當志工」沒有用。
 * （原本這裡寫的是「在『信念』那一塊之後」，那一塊 2026-10-24 已依廟方要求移除。）
 *
 * **圖上已經有「志工招募」四個字**，所以不另外加標題（同影片封面那條）；
 * 但圖本身看不出可以按，所以底下補一行「我要報名」當作可點的提示。
 * 連結整塊包起來，手指按哪裡都會進表單。
 *
 * 表單在 Google，所以開新分頁並在 aria-label 裡講明白——
 * 正要離開這個網站這件事，應該讓人事先知道。
 */
const VolunteerBanner: React.FC = () => (
  <a
    href={BRAND.volunteerForm}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="志工招募：替媽祖服務每一位香燈腳。開啟 Google 報名表單（另開新分頁）"
    id="shower-volunteer"
    className="group block mt-12 scroll-mt-20 rounded-2xl overflow-hidden border border-[#D6246B]/20 hover:border-[#D6246B]/50 transition-colors"
  >
    <picture>
      <source srcSet={heroSrc('shower-volunteer.webp')} type="image/webp" />
      <img
        src={heroSrc('shower-volunteer.jpg')}
        alt=""
        width={2000}
        height={667}
        loading="lazy"
        className="block w-full h-auto"
      />
    </picture>
    <span className="flex items-center justify-center gap-2 bg-[#B01350] px-4 py-3 text-white font-bold group-hover:bg-[#8E0F41] transition-colors">
      我要報名
      <ArrowRight className="w-4 h-4" aria-hidden="true" />
    </span>
  </a>
);

/**
 * 愛心捐贈（廟方 2026-10-24 提供表單與按鈕圖）。
 *
 * **就是一顆按鈕，沒有卡片、沒有標題、沒有說明文字**（廟方 2026-10-24：
 * 「換這個按鈕就好，不要做成 banner 不用有其他文字說明」）。
 * 中間做過一版「白卡＋標題＋一句說明＋按鈕圖」，廟方看了之後要的是單純一顆鈕。
 *
 * **圖是去背的（真的 alpha，四成像素全透明），所以直接壓在米色頁面上就好**——
 * 不要替它加底色或卡片，加了反而會在圓角藥丸外圍框出一塊方的底。
 * 產圖時也**不可以 flatten**：壓成白底就會在米色頁面上出現一塊白方塊。
 *
 * 寬度收在 `max-w-sm`（384px）並置中：它是一顆按鈕不是橫幅，攤到整欄寬就會
 * 變成第二張海報，跟上面志工那張打架。
 * 圖是 861x290（2026-10-27 廟方換過一張，左邊多了一尊人物，長寬比從 3.25 變 2.97，
 * 所以同寬之下比舊的高一點點）。顯示最寬 384，861 夠兩倍有餘。
 *
 * **畫面上一個字都沒有，但 aria-label 要講滿**：讀屏軟體與 SEO 只看得到它，
 * 而「捐給誰」「會離開這個網站」是按下去之前該知道的事。
 * 這一頁同時掛在 heshengtan.tw 與 17bath.org 上，所以要指名協會，
 * 不然在宮廟的網域上會被當成宮廟在募款。
 *
 * 檔名要列進 `vite.config.ts` 的 `HERO_FILES`，換圖時網址才會跟著變。
 */
const DonationBanner: React.FC = () => (
  <div className="mt-8 flex justify-center">
    <a
      href={BRAND.donateForm}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`我要捐款：愛心捐贈給${BRAND.org}。開啟 Google 表單（另開新分頁）`}
      id="shower-donate"
      className="block w-full max-w-sm scroll-mt-20 transition-transform hover:scale-[1.03] active:scale-[0.99]"
    >
      <picture>
        <source srcSet={heroSrc('shower-donate.webp')} type="image/webp" />
        <img
          src={heroSrc('shower-donate.png')}
          alt=""
          width={861}
          height={290}
          loading="lazy"
          className="block w-full h-auto"
        />
      </picture>
    </a>
  </div>
);

/**
 * 最上面的主辦單位（廟方 2026-10-16：「網頁最上面也放一次」）。
 *
 * 海報上本來就印著協會名，但那是圖、字很小、而且用的是「台中」的舊寫法。
 * 這一行用的是立案全名，而且是文字——讀得到、選得起來、搜尋引擎也看得見。
 *
 * **字級刻意比頁尾那行小**：這一頁的第一屏要留給「車在哪」與導航鈕，
 * 每多一行就逼近一次 375×667 的下緣。目前量到導航鈕底邊 641 < 667。
 * 頁尾那行是收尾、可以大；這一行是報頭，講清楚「這是誰辦的」就夠了。
 *
 * 不設 `whitespace-nowrap`：11 個字在 18px 下約 198px，343px 的版面綽綽有餘，
 * 但使用者把系統字級開到兩倍時寧可讓它折行，也不要衝出畫面外。
 */
const Masthead: React.FC = () => (
  <p className="mb-4 px-2 text-center font-serif text-lg sm:text-xl font-bold tracking-wide text-[#B01350]">
    {BRAND.org}
  </p>
);

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
      <main className="max-w-xl mx-auto px-4 pt-6 pb-10 sm:pt-10 sm:pb-14">
        <Masthead />
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
            <h2 className="font-serif text-xl font-bold text-temple-dark">相關影片</h2>
          </div>
          <div className="mt-3 pl-1 border-l-2 border-[#D6246B]/25">
            <p className="pl-4 text-gray-700 leading-relaxed">影片放在 YouTube，按下播放才會開始載入。</p>
          </div>
          {/*
            四支影片：三支橫式、一支直式，**一列一支**。

            排成兩欄試過，不行：整頁是 `max-w-xl`（576px）的單欄版面——這一頁是做給
            在進香路上、拿著手機的香客看的——所以兩欄在**任何**螢幕上都只有 264px 寬，
            按下播放之後就是一個 264px 的 YouTube 播放器，控制列擠成一團。
            欄寬永遠長不大，兩欄就永遠換不到好處，只省掉桌機的捲動（而那是最不缺的）。

            直式的靠**寬度上限**收，不要靠裁切：塞進 `aspect-video` 用 object-cover
            會把 9:16 裁到剩中間一條，那正是公佈欄海報那次被廟方退回的做法。
            上限寫在 `VideoCard` 的 figure 上，置中之後比橫式窄一截——
            它本來就是手機拍的側錄，不該是這一區裡最大的一塊。
          */}
          <div className="mt-4 space-y-5">
            {VIDEOS.map(v => <VideoCard key={v.id} {...v} />)}
          </div>
        </section>

        {/*
          常見問題（2026-10-20 補，為了 AI 檢索）。
          **內容只有一份**：`content/shower-faq.json`，這裡與 `scripts/prerender.js`
          （FAQPage 結構化資料＋noscript 純文字）讀的是同一個檔。各寫一份的話，
          哪天改了答案就會變成畫面講一套、給爬蟲的標記講另一套。
          **而且 FAQPage 的規則就是「標記的內容使用者要看得到」**——
          只放進 noscript、畫面上沒有，那個標記本身就是違規的（同首頁 FAQ 那條）。
          用原生 `<details>`：收起來不佔版面，點一下就開，不必自己寫狀態。
        */}
        <section id="shower-faq" className="mt-12 scroll-mt-20">
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-2xl font-bold text-[#D6246B]/35 leading-none">06</span>
            <h2 className="font-serif text-xl font-bold text-temple-dark">常見問題</h2>
          </div>
          <div className="mt-4 space-y-2">
            {showerFaq.map(f => (
              <details
                key={f.q}
                className="group rounded-2xl border border-[#D6246B]/20 bg-white px-4 py-3"
              >
                <summary className="cursor-pointer list-none font-bold text-temple-dark flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rotate-45 bg-[#D6246B]/60 shrink-0" aria-hidden="true" />
                  <span>{f.q}</span>
                </summary>
                <p className="mt-2 pl-4 text-gray-700 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 這裡原本有一塊「信念」（一個人發心，十七人同行／關懷每位香客，從沐浴開始），
            廟方 2026-10-24 要求移除。三句話在這一頁本來就各有出處：前兩句是
            01 團隊介紹那段的濃縮，最後一句印在最上面那張海報上，所以拿掉沒有
            任何資訊消失。`BRAND.tagline` 仍用在海報的 alt，不要跟著刪。 */}
        <VolunteerBanner />
        <DonationBanner />

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

          {/* 協會的 LINE。擺在協會名稱正下方，「加入誰的好友」才不會有疑義——
              這一頁掛在和聖壇的網域上，放在別處會被當成和聖壇的帳號。
              圖是 LINE 官方提供的那張，但存自己的 public/：少一次對 scdn.line-apps.com
              的連線，而且那邊哪天換網址也不會變成一塊破圖。
              連結的名字寫在 aria-label，img 的 alt 留空——圖上那三個字是「加入好友」，
              讀屏軟體只念這三個字等於沒講加誰的。 */}
          {/* LINE 與臉書並排。**兩顆都走協會自己的帳號**——這一頁掛在和聖壇的
              網域上，社群連結放在協會名稱正下方才不會被誤會成和聖壇的。
              臉書用站上現成的 FacebookIcon（SocialLinks 只相依 React 與 types，
              不會把別的東西拖進這個 chunk），不要再畫一顆一模一樣的。 */}
          <div className="mt-5 flex items-center justify-center gap-3">
          <a
            href={BRAND.line}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`加入${BRAND.org} LINE 官方帳號`}
            className="inline-block px-2 py-2 hover:opacity-85 transition-opacity"
          >
            <img
              src={heroSrc('line-add-friend.png')}
              alt=""
              width={116}
              height={36}
              loading="lazy"
              className="block h-9 w-auto"
            />
          </a>

          {/* 臉書做成與 LINE 鈕同高（36px）的圓形，兩顆並排時重量才一致。
              點擊區 44x44，長者的拇指按得準（WCAG 的 24px 只是下限）。 */}
          <a
            href={BRAND.facebook}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${BRAND.org}臉書粉絲專頁`}
            className="inline-flex items-center justify-center w-11 h-11 rounded-full text-white hover:opacity-85 transition-opacity"
            style={{ background: '#1877F2' }}
          >
            <FacebookIcon className="w-5 h-5" />
          </a>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ShowerPage;
