import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Calendar, ClipboardList, Trash2,
  Clock,
  MapPin,
  Phone,
  Menu,
  X,
  ScrollText,
  Flame,
  HeartHandshake,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Settings,
  Lock,
  Eye,
  EyeOff,
  Megaphone,
  Pin,
  ChevronDown,
  ChevronUp,
  UserPlus,
  User as UserIcon,
  BookUser,
  Plus,
  Sparkles,
  Share2,
  Copy,
  CheckCircle,
  ShoppingBag,
  Wrench,
  BookOpen,
  Landmark,
  LoaderCircle
} from 'lucide-react';

const LineIcon = ({ className }: { className?: string }) => (
  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/LINE_logo.svg/330px-LINE_logo.svg.png" alt="LINE" className={className} style={{ objectFit: 'contain' }} />
);

import { AboutSection, AboutFacts, RelocationHome, AdminRole, SocialSettings, BlessingAddon, BlessingEventRecord, BlessingRegistrationData, BlessingRegistrationRecord, BookingData, BookingSessionRecord, BulletinCategory, BulletinRecord, ConsultationType, DeityRecord, DonationData, DonationType, HallRecord, HeroSlideRecord, LampRegistrationData, LampServiceConfig, MemberContact, ProfileData, RepairProject, SharedEntryData, SharedServiceType, SharedSessionConfig, SharedSessionRecord, SiteInfo, ZodiacSign } from './types';
import { rememberMyShared, forgetMyShared, listMyShared, isMyShared, MySharedSession } from './services/sharedSessionStore';
import { heroSrc } from './services/assetUrl';
import PatternMedallion from './components/PatternMedallion';
import { submitBooking, submitDonation, getBulletins, getSiteImages, getSiteImagePublicUrl, getDeities, getDeityHalls, getHeroSlides, getLampServiceConfigs, submitLampRegistration, getMemberContacts, getProfile, getBlessingEvents, getBlessingEventStats, createBlessingRegistration, createSharedSession, getSharedSession, getMySharedSessions, deleteSharedSession, addSharedEntry, markSharedSessionSubmitted, autoSaveContactsForMember, getRepairProjects, getRepairProjectTotals, trackLineClick, getSocialSettings, DEFAULT_SOCIAL, getAboutSections, getAboutFacts, DEFAULT_ABOUT_FACTS, getRelocationHome, getBookingSessions, getBookingCountsBySession, getFaqItems, getDonationTypes, getSiteInfo, DEFAULT_SITE_INFO, supabase } from './services/supabase';
import SharedFormPanel from './components/SharedFormPanel';
import Analytics from './components/Analytics';
import BirthDatePicker from './components/BirthDatePicker';
import SilkSheen from './components/SilkSheen';
import IncenseSmoke from './components/IncenseSmoke';
import AboutPage from './components/AboutPage';
import { renderInline, splitParagraphs } from './components/StoryPage';
import RelocationPage from './components/RelocationPage';
import { visibleSocials } from './components/SocialLinks';
import { openLine, setLineUrl, getLineUrl, trackLine } from './services/lineLink';
import { withKeptParams } from './services/attribution';
import faqContent from './content/faq.json';
import { useScrollMotion } from './hooks/useScrollMotion';

// 大型功能按需要才下載：後台含 Excel 套件，若跟首頁一起打包會讓每位訪客先載入用不到的程式。
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const ScripturePage = lazy(() => import('./components/ScripturePage'));
const MemberPortal = lazy(() => import('./components/MemberPortal'));
const FahuiRegistration = lazy(() => import('./components/FahuiRegistration'));
const VolunteerRegistration = lazy(() => import('./components/VolunteerRegistration'));
const CalendarPage = lazy(() => import('./components/CalendarPage'));

const PageLoading = () => (
  <div className="min-h-[100svh] bg-[#F5F0E8] flex items-center justify-center" role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-3 text-[#7C5C1E]">
      <LoaderCircle className="w-7 h-7 animate-spin" aria-hidden="true" />
      <span className="text-sm font-medium">頁面載入中</span>
    </div>
  </div>
);

// ── 工具函式 ────────────────────────────────────────────────────────────────────

// LINE 網址與導流統計改放 services/lineLink.ts，讓報名表那些獨立元件也共用同一份
// （它們原本各自寫死網址，既不計入統計、後台改網址也不會跟著換）

/** 共用匯款資訊區塊 */
const BankInfoBox: React.FC<{ tip?: string }> = ({ tip }) => (
  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm space-y-0.5">
    <p className="font-bold text-amber-800 mb-1 flex items-center gap-1.5"><Landmark className="w-4 h-4" aria-hidden="true" />匯款資訊</p>
    <p className="text-amber-900">銀行：中國信託銀行　代碼 <span className="font-semibold">822</span></p>
    <p className="text-amber-900">分行：大安分行</p>
    <p className="text-amber-900">帳號：<span className="font-semibold tracking-wider">6025-4035-6010</span></p>
    <p className="text-amber-900">戶名：王順文</p>
    <p className="text-amber-700 text-xs mt-1">
      {tip ?? '匯款完成後請於備註填寫後五碼，收到款項即完成登記！'}
    </p>
  </div>
);

// ── 多人報名用本地型別 ──────────────────────────────────────────────────────────
const newId = () => Math.random().toString(36).slice(2, 10);

/** 依序送出多筆，回傳成功筆數；中途失敗即停止（避免 Promise.all 部分成功後重送造成重複報名） */
async function submitSequentially<T>(items: T[], send: (item: T) => Promise<unknown>): Promise<number> {
  let ok = 0;
  for (const item of items) {
    try { await send(item); ok += 1; }
    catch (err) { console.error(err); break; }
  }
  return ok;
}
const RELATION_OPTIONS = ['本人', '父母親', '兒女', '手足', '親戚', '朋友', '師長'] as const;
// 揪團（共享報名場次）：建立場次 → 拿 ?share=<id> 連結 → 親友各自填 → 一起送出。
// 支援點燈／祈福／問事，連結 7 天到期。2026-09-09 普渡報名結束後開啟。
//
// **要再停用時，記得這個旗標是「會被部署」的**：main 上的值就是正式站的值，
// 廟方按後台「重新發布」會觸發 Deploy Hook 從 git 重建。所以未驗過的改動要留在
// 分支上，不要先在 main 翻成 true（CLAUDE.md 部署紀律第 0 條，這類事故發生過兩次）。
const ENABLE_GROUP_BOOKING = true;

// ── 頁面路由 ─────────────────────────────────────────────────────────────────
// 四項服務各自獨立成頁（有自己的網址、可單獨分享、瀏覽器上一頁可返回），
// 其餘內容仍是首頁上的區塊，靠捲動抵達。
type SitePage = 'home' | 'booking' | 'lamps' | 'blessing' | 'repair' | 'about' | 'relocation' | 'deitiesAll' | 'calendar';

const PAGE_PATHS: Record<Exclude<SitePage, 'home'>, string> = {
  booking: '/booking',
  lamps: '/lamps',
  blessing: '/blessing',
  repair: '/repair',
  // about 是首頁「關於我們」區塊的完整版，入口在該區塊的「更多」按鈕，
  // 導覽列的「關於我們」仍然捲到首頁區塊，不換頁
  about: '/about',
  relocation: '/relocation',
  // 祀奉神尊的完整版。首頁區塊只放前幾尊，按「看全部神尊」換到這一頁——
  // 舊版是在首頁一次展開四尊、再四尊，尊數一多整個首頁被神尊灌爆，
  // 而且捲很久也回不到別的區塊。導覽列的「祀奉神尊」仍然捲到首頁區塊，不換頁。
  deitiesAll: '/deities',
  // 歲時祭曆：神明聖誕（deity_feasts，每年重複的農曆日）＋壇務活動（blessing_events）
  calendar: '/calendar',
};

/**
 * 神尊修復暫時對外隱藏（廟方要求）。改回 true 就整個恢復，不必再動別的地方。
 *
 * 為什麼連路由一起關掉、而不是只拿掉導覽列的連結：
 * `/repair` 上面有捐獻表單，只藏連結的話，舊連結或搜尋結果進來的人照樣能送出捐獻。
 * 這裡讓 `/repair` 直接當成首頁處理，等於前端完全沒有這一頁。
 * 後台的「神尊修復」分頁不受影響，資料與既有捐獻紀錄都還在。
 */
const ENABLE_REPAIR = false;

/**
 * 公佈欄（首頁「最新活動」區塊）。
 *
 * 這個旗標同時控制四個地方，開關一次到位：導覽列項目、首頁區塊本身、
 * 捲動高亮的 pairs、以及祈福活動頁那顆「查看最新公告」。
 *
 * 上一輪隱藏時 pairs 那一項是被「直接刪掉」而不是跟著旗標走，所以旗標翻回 true
 * 導覽列雖然出現「最新活動」，捲過去卻不會高亮。現在四處都由這個旗標控制，
 * 改 false 會一起收掉，改 true 會一起回來。
 *
 * 後台的「公佈欄管理」不受影響——不論開關，內容都照樣可以維護。
 */
const ENABLE_BULLETIN = true;

/**
 * 公告的兩種標籤。**全站只有這兩個常數，不要在渲染處另寫顏色。**
 *
 * 原本分類是「一類一個 Tailwind 預設色」（gray/blue/orange/purple/yellow-100），
 * 其中預設的 gray-100 是 #F3F4F6，疊在卡片的 temple-bg #F5F0E8 上幾乎同色——
 * 廟方回報「分類顯示是白色，很不明顯」。而且那五個色跟本站的金／褐／米完全無關，
 * 正是 CLAUDE.md 說的「不要各寫各的顏色」。
 *
 * 改成單一霧金：分類名稱本身已經寫在標籤上，上方又有篩選鈕，
 * 顏色再去編碼一次沒有增加資訊，只是讓版面變花。
 * 層級靠「實心 vs 霧面」拉開，不靠色相：
 *   置頂 = 實心褐（與篩選鈕選中態同一種處理），置頂本來就是要被看見
 *   分類 = 霧金描邊，安靜地待著
 * 對比都量過（見 CLAUDE.md），不要把霧金的透明度往下調。
 */
/**
 * Hero 底部收邊要淡進的顏色 ＝ **Hero 下一個區塊的底色**。
 * 兩者不一致，交界就是兩塊平色相接、看起來像被切了一刀（廟方回報過：
 * 當時收邊淡進米色 #F5F0E8，而下面的公佈欄是 bg-white，中間就多一條白邊）。
 * 曲線做得再順都救不了這個，因為問題不在漸層在配色。
 * 公佈欄關掉時，接在 Hero 後面的是「關於我們」（bg-temple-bg）。
 * 動到區塊順序或它們的底色時，這裡要一起改。
 */
const HERO_FADE_RGB = ENABLE_BULLETIN
  ? '255 255 255'   // #bulletin 的 bg-white
  : '245 240 232';  // #about 的 bg-temple-bg

const TAG_PINNED = 'bg-temple-red text-white';
const TAG_CATEGORY = 'bg-temple-gold/15 text-temple-red border border-temple-gold/30';

/**
 * 歲時祭曆（/calendar）。2026-09-09 上線，廟方確認完 28 筆聖誕日期後開啟。
 *
 * 這個旗標要與另外兩個地方一起開關，少一個就會不一致：
 *   1. `scripts/prerender.js` 的 ROUTES 裡 /calendar 那筆的 enabled  ← sitemap 也由它產生
 *   2. `vercel.json` 的 `/calendar → /calendar.html` rewrite，必須排在萬用規則之前
 *   （NAV_MORE 的項目會自動跟著這個旗標出現，不必另外改）
 *
 * **關掉時刻意不擋網址**：只從導覽列與搜尋引擎移除，直接輸入 /calendar 仍然打得開。
 * 廟方要一邊在後台建資料、一邊開前台確認換算對不對，照 ENABLE_REPAIR 那樣讓網址
 * 跳回首頁就沒辦法預覽了。沒有連結指過去、也不在 sitemap 裡，信眾不會走到。
 *
 * **開啟前先確認資料庫有 is_visible = true 的資料**，否則信眾會看到
 * 「歲時祭曆尚未建立」。這與預渲染無關：prerender 只產生 meta 與 noscript 說明的
 * 靜態殼（見 dist/calendar.html），列表是執行期才向 Supabase 抓的，所以資料開啟
 * 後前台立刻就有，不必重新建置。
 */
const ENABLE_CALENDAR = true;

const stripSlash = (p: string): string => p.replace(/\/+$/, '') || '/';

const pageFromPath = (): SitePage => {
  if (typeof window === 'undefined') return 'home';
  const path = stripSlash(window.location.pathname);
  if (!ENABLE_REPAIR && path === stripSlash(PAGE_PATHS.repair)) return 'home';
  const hit = (Object.keys(PAGE_PATHS) as Array<Exclude<SitePage, 'home'>>)
    .find(key => stripSlash(PAGE_PATHS[key]) === path);
  return hit ?? 'home';
};

// ── 導覽列 ───────────────────────────────────────────────────────────────────
// 主要項目直接列出，其餘收進「更多」下拉，避免導覽列過長。
// kind='section' 的 id 對應首頁上的 <section id="…">，kind='page' 的 id 是獨立分頁。
interface NavItem {
  id: string;
  label: string;
  kind: 'section' | 'page';
}

/**
 * 常見問題的**保底內容**。正式來源是資料庫 `faq_items`（後台「常見問題」分頁可編輯）；
 * 資料表還沒建、或 Supabase 讀取失敗時才會用到這一份，前台不會開天窗。
 *
 * 這份 JSON 同時是 `scripts/prerender.js` 的保底：建置時它會先去資料庫抓，
 * 抓不到才用這裡的內容產生 `<noscript>` 純文字。
 */
const FAQ_FALLBACK: { q: string; a: string }[] = faqContent.items;

/**
 * 把會員資料補進表單卡片。**只補空欄位**——使用者已經填過或改過的一律不動。
 *
 * 沒有任何欄位被補時回傳「原本那個物件」而不是複本：
 * setState 拿到同一個參考就不會觸發重新渲染，避免打字打到一半被無謂地重繪。
 *
 * 泛型寫成 function 宣告而不是箭頭函式：本專案的 TSX 對泛型箭頭函式推導失敗（參數會變 unknown）。
 */
function fillEmptyFields<T extends Record<string, unknown>>(entry: T, defaults: Record<string, unknown>): T {
  let changed = false;
  const next: Record<string, unknown> = { ...entry };
  for (const key of Object.keys(defaults)) {
    const value = defaults[key];
    if (value && !next[key]) { next[key] = value; changed = true; }
  }
  return changed ? (next as T) : entry;
}

const NAV_PRIMARY: NavItem[] = [
  { id: 'home', label: '首頁', kind: 'section' },
  // 最新活動由 ENABLE_BULLETIN 控制；關閉時不出現在導覽列（桌機與手機選單共用這份資料）
  ...(ENABLE_BULLETIN ? [{ id: 'bulletin', label: '最新活動', kind: 'section' } as NavItem] : []),

  { id: 'about', label: '關於我們', kind: 'section' },
  { id: 'deities', label: '祀奉神尊', kind: 'section' },
  { id: 'relocation', label: '遷址捐款', kind: 'page' },
  { id: 'booking', label: '預約問事', kind: 'page' },
  { id: 'lamps', label: '祈福點燈', kind: 'page' },
];

// 祀奉神尊一次展開的數量。設 4 是為了對齊 lg:grid-cols-4，每按一次剛好補滿一列
/**
 * 神尊卡片。首頁區塊與 /deities 完整頁共用同一份，改樣式只要改這裡。
 *
 * 只做進場（逐張錯開），**不要加視差**。曾經給單數欄 30px 的視差做高低錯落，
 * 結果捲動時四張卡上緣會差到 18px，廟方看到的是「牌卡沒有排整齊」——
 * 整齊的網格比錯落的動態重要。
 * 卡片高度靠 grid 的 stretch ＋ 內層 h-full 撐成等高，不要拿掉 h-full。
 */
const DeityCard: React.FC<{ deity: DeityRecord; index: number }> = ({ deity, index }) => (
  <div className={`sr sr-up ${['', 'sr-d1', 'sr-d2', 'sr-d3'][index % 4]}`}>
    <div className="h-full bg-temple-bg rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow border border-temple-gold/20 group">
      {/* 直式 3:4：神尊立像是直的，原本固定高 192px 的橫幅會把頭冠與衣袍下擺切掉。
          與神尊修復卡片、後台縮圖同一個比例，後台看到的裁切結果就是這裡的樣子。 */}
      <div className="aspect-[3/4] bg-gradient-to-br from-temple-red/10 to-temple-gold/10 flex items-center justify-center overflow-hidden">
        {deity.imagePath ? (
          <img src={getSiteImagePublicUrl(deity.imagePath)} alt={deity.name} loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="text-center">
            <Flame className="w-16 h-16 text-temple-gold/60 mx-auto mb-2" />
          </div>
        )}
      </div>
      {/* 名號置中、介紹靠左：介紹是多行敘述，置中的多行文字每行起點都不同，讀起來很吃力 */}
      <div className="p-6">
        <h4 className="text-xl font-bold text-temple-dark font-serif mb-1 text-center">{deity.name}</h4>
        {deity.title && <p className="text-temple-red text-sm font-medium mb-3 text-center">{deity.title}</p>}
        {/* line-clamp-6：卡片一行約 16 字，六行約 96 字，確保 60 字的介紹一定完整顯示。
            這是上限不是固定高度，短介紹仍然只佔它需要的行數。 */}
        <p className="text-gray-600 text-sm leading-relaxed line-clamp-6">{deity.description}</p>
      </div>
    </div>
  </div>
);

const DEITY_PAGE = 4;

/** 各服務的獨立頁路徑。回到某張未送出的表時要帶著走 */
const SERVICE_PATH: Record<SharedServiceType, string> = {
  lamp: '/lamps', blessing: '/blessing', booking: '/booking',
};

const SHARED_LABEL: Record<SharedServiceType, string> = {
  lamp: '點燈', blessing: '祈福活動', booking: '問事',
};

/**
 * 「您有未送出的揪團報名表」提示卡
 *
 * ── 為什麼需要 ──
 * 共享場次沒有擁有者欄位（capability 模式），主揪的身分只記在自己的瀏覽器；
 * 而場次 id 原本只存在網址列的 ?share= 裡。主揪一關分頁或點一下導覽列，
 * 整張還沒送出的表就再也找不回來（廟方 2026-09-10 回報「整張訂單都不見」）。
 * 清單改存 localStorage 後（見 services/sharedSessionStore.ts），這張卡負責把它撈回來。
 *
 * ── 為什麼做得這麼顯眼 ──
 * 廟方明講「需要很明顯，不然會找不到」。所以放在表單正上方、用實心底色與
 * 醒目的邊框，而不是一行淡淡的文字連結。人數也寫出來——「已有 3 人加入」
 * 比「有一張未完成的表」更能讓人想起這件事還沒做完。
 */
/**
 * 親友點到已失效的揪團連結時的提示。
 * 沒有這個的話，?share= 指到不存在的表只會靜靜顯示一般頁面，親友會以為網站壞了
 * 或自己按錯，然後打電話問主揪。講清楚「這張表已經不在了」比什麼都不說好。
 */
const SharedMissingNotice: React.FC = () => (
  <div role="alert" className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4">
    <p className="font-serif text-lg font-bold text-temple-dark mb-1">找不到這張揪團報名表</p>
    <p className="text-sm text-gray-700 leading-relaxed">
      可能是發起人已經刪除，或是連結超過七天已失效。請向邀請您的親友確認，或直接在下方自行登記。
    </p>
  </div>
);

const PendingSharedCard: React.FC<{
  rows: { meta: MySharedSession; session: SharedSessionRecord }[];
  onOpen: (meta: MySharedSession) => void;
  onDelete: (session: SharedSessionRecord) => void;
}> = ({ rows, onOpen, onDelete }) => (
  <div className="mb-6 rounded-2xl border-2 border-temple-gold bg-temple-gold/10 p-5">
    <p className="font-serif text-lg font-bold text-temple-dark mb-1">
      您有 {rows.length} 張還沒送出的揪團報名表
    </p>
    <p className="text-sm text-gray-600 mb-4">
      親友填好之後要由您按下「送出」才會成立，廟方在那之前不會收到。
    </p>
    <div className="space-y-2">
      {rows.map(({ meta, session }) => (
        // 整列原本是一顆按鈕；要放第二個動作（刪除）就得拆成 div，否則 button 不能包 button
        <div
          key={meta.id}
          className="w-full rounded-xl bg-white border border-temple-gold/40 px-4 py-3 flex items-center justify-between gap-3"
        >
          <button type="button" onClick={() => onOpen(meta)} className="min-w-0 flex-1 text-left group">
            <span className="block font-medium text-temple-dark group-hover:text-temple-red transition-colors">
              {SHARED_LABEL[session.serviceType]}
              {session.config.eventTitle ? `・${session.config.eventTitle}` : ''}
            </span>
            <span className="block text-xs text-gray-500 mt-0.5">
              {session.entries.length > 0 ? `已有 ${session.entries.length} 人加入` : '還沒有人填寫'}
              　建立於 {session.createdAt.slice(0, 10)}
            </span>
          </button>
          <button type="button" onClick={() => onOpen(meta)} className="shrink-0 text-sm font-medium text-temple-red">繼續 →</button>
          {/* 刪除做小、做淡，跟「繼續」拉開距離——長輩的手指按不準，破壞性動作不能挨著主要動作 */}
          <button type="button" onClick={() => onDelete(session)} aria-label="刪除這張揪團報名表"
            className="shrink-0 ml-2 p-2 text-gray-300 hover:text-red-600 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  </div>
);

// 法會收件期間：根路徑以報名表取代官網首頁。主官網上線時改成 false 即可。
const FAHUI_LANDING = true;

/**
 * 法會是否還在收件。控制**站上邀請報名的入口**——首頁 Hero 的行動按鈕、
 * 祈福活動頁的橫幅按鈕。與 FAHUI_LANDING 是兩回事：那個管的是「根路徑要不要
 * 顯示報名表」，這個管的是「要不要主動邀人來報名」。
 *
 * 2026-09-10 關閉：普渡報名 9/06 截止、法會 9/13 舉行。截止後仍留著按鈕，
 * 信眾點下去只會看到「本次法會報名已截止」——邀請一個必然落空的點擊，
 * 比沒有按鈕更糟。橫幅本身保留，法會還沒辦，日期資訊對信眾仍然有用。
 */
const FAHUI_SIGNUP_OPEN = false;

/**
 * 正式官網的網域。**在這些網域上，根路徑一律顯示官網首頁，不會被報名表蓋掉。**
 *
 * 為什麼要分兩邊：早期的法會宣傳連結發的是 machu-five.vercel.app（Vercel 預設網域），
 * 那個網址必須維持「一點進來就是報名表」，舊連結才不會壞；而 heshengtan.tw 是正式官網，
 * 根路徑點進來要看到首頁。同一份程式、兩種行為，差別只在網域。
 *
 * **對外一律用 heshengtan.tw**（廟方 2026-09-02 明確要求）：machu-five 是測試網域，
 * 不要再出現在 og:url、結構化資料或任何新發出去的連結。官網的報名網址是
 * `/fahui`（見 FAHUI_PATH），那是現在唯一該對外宣傳的位置。
 *
 * 用「官網網域清單」而不是「報名網域清單」的理由：漏列的情況要往安全的一邊倒。
 * 新的預覽部署（machu-xxxx.vercel.app）沒列到就維持報名表，跟宣傳連結一致；
 * 反過來寫的話，漏列會讓宣傳連結變成官網首頁，報名入口就消失了。
 * 收件結束後把 FAHUI_LANDING 改 false，這份清單就自動失效，不必再回來清。
 */
const OFFICIAL_HOSTS = ['heshengtan.tw', 'www.heshengtan.tw'];
const isOfficialHost = (): boolean =>
  typeof window !== 'undefined' && OFFICIAL_HOSTS.includes(window.location.hostname);

// Hero 輪播照片：已撤下把空間讓給特效。後台照片管理與資料照常運作，
// 要恢復輪播時改成 true，並把 Hero 的背景區塊改回輪播 <img>。
const HERO_SLIDESHOW = false;

/**
 * Hero 的三尊神尊。
 *
 * ── 身分（**這裡弄錯過三次，改之前先讀完**）──
 *   左前＝濟公活佛、中後＝天上聖母三媽（主神）、右前＝天上聖母二媽。
 *   **三媽是本壇主神，橘袍黑面；二媽是黃袍金冠。**
 *   檔名 hero-jigong／hero-sanma／hero-erma 與 alt 都照這個對應，
 *   index.html 的 preload 指向 hero-sanma（主神）。
 *
 *   判定依據是**廟方自己的檔名**：`~/Downloads/神明正照/三媽.jpg` 就是橘袍黑面那尊，
 *   2026-09-02 廟方給的正面照 `神明正照 (1)/天上二聖母.png` 是黃袍、
 *   `五師父.png` 是濟公。
 *
 *   已知的資料衝突（**要動身分之前先跟廟方確認，不要自己推**）：
 *   舊那批 `神明正照/二媽.jpg` 是「紅袍藍龍紋」那尊，不是黃袍；新舊兩批對「二媽」
 *   的指認不一致。現行採用新那批＋廟方 2026-09-02 的口頭指認。
 *
 *   想快速確認誰是誰：取袍身下半部的色相中位數，
 *   **三媽約 21°（橘）、二媽約 45°（黃）**。濟公約 27°，跟三媽接近，
 *   所以這招只用來分辨兩尊媽祖，不要拿來跟濟公比。
 *
 *   為什麼要寫這麼白：2026-09-01 的「正名」把兩尊媽祖對調過一次，
 *   2026-09-02 我又照著錯的方向對調第二次（誤讀了廟方的敘述），同一天才修回來。
 *   **只看檔名不看圖，就會再錯一次；只看圖不問廟方，一樣會錯。**
 *
 * ── 構圖：主神在後、二媽與濟公在她面前（廟方 2026-09-02 給了合成圖）──
 *   三媽最高最大，但**疊在最底層（z-1）**——她的身體被前面兩尊擋住，只露出頭與冠帽。
 *   前面兩尊的臉大致齊高（濟公 z-2、二媽 z-3，兩者不互相重疊，先後無所謂）。
 *   高度比 57 : 98 : 76（濟公 : 三媽 : 二媽）是從廟方那張合成圖量出來的。
 *
 *   drop 是每尊往畫面下方沉多少，決定臉的高度：
 *     臉在畫面上的高度 = 圖高 ×（1 − 臉在圖中的相對位置）− drop
 *   **換照片就要重量「臉在圖中的相對位置」再解一次 drop**，沿用舊值必定跑掉。
 *   實測值（臉中心佔圖高的比例）：濟公 0.24、三媽 0.28、二媽 0.35。
 *   量法：把圖畫成每 5% 一條的網格再目視讀刻度。用顏色規則自動找會失敗，
 *   三媽是黑面，她的手與軀幹跟臉同色，程式會抓到胸口去。
 *
 * ── 驗收依據是「彼此不蓋到頭」，而且要用實際像素判定 ──
 *   注意這一版**身體本來就會被蓋住**（那正是要的效果），只有頭不行。
 *   每尊的頭部（含冠帽）由 alpha 輪廓剖面算出：由上往下找寬度首次超過
 *   最大寬 55% 的那一列當肩線，肩線以上就是頭。實測占圖高：
 *     濟公 30.3%、三媽 34.4%、二媽 26.9%。
 *   判定要取「上層那尊的不透明像素 ∩ 下層那尊頭部的不透明像素」。
 *   只用頭部矩形會誤判——矩形四角本來就是透明的。
 *   2026-09-02 實測：1280×800 是 0.00／0.00／0.36%，375×812 是 0.00／0.00／0.22%
 *   （那個零點幾是二媽的冠帽尖端擦到三媽頭部範圍的邊緣，肉眼看不出來）。
 *
 * ── 單位規則 ──
 *   **同一個斷點內所有尺寸必須用同一種單位**，混用畫面比例一變就散掉。
 *   手機（未加 sm: 的那組）用 vw、桌機（sm:）用 vh。
 *   手機用 vw 是因為痛點是「三尊要貼齊左右兩邊」：用 vh 算出來的總寬
 *   只有在某個螢幕比例下剛好等於螢幕寬，換一支比較寬的手機兩邊就空一塊。
 *
 *   **但手機那組也要包一層 `min(A vw, A×0.529 vh)`（八個值一起改）。**
 *   stage 是 `h-[121vw] max-h-[64vh]`：畫面偏矮偏寬時（高寬比 < 1.89，例如
 *   瀏覽器網址列吃掉高度之後）`max-h` 會把 stage 壓短，但神尊是純 vw、不跟著縮，
 *   最高的那尊就被切頭——**被切的正好是主神**（廟方回報，實測 479×816 時
 *   三媽的冠帽被切掉 19px）。
 *   係數 0.529 = 64/121，也就是 stage 的上限與基準高的比值；用它換算之後，
 *   `max-h` 一生效整組等比縮小，神尊與 stage 的比例維持不變。
 *   實測 479×816／393×660／360×640／430×932／375×812 五種比例，主神頂被裁都是 0。
 *
 *   桌機那組每個 vh 都包一層 `min(A vh, A×1.10 vw)`（**1.10 這個比例八個值要一起改**）。
 *   為什麼需要：平板直立（iPad 第十代 820×1180）時螢幕又高又窄，純 vh 會讓整組寬過畫面，
 *   最左邊的濟公被切掉。加上 vw 上限之後，高瘦畫面自動改由寬度決定尺寸，三個高度與
 *   兩個重疊量同步縮放，構圖不變。
 *   判定門檻是長寬比 1/1.10 ≈ 0.909：比這寬（一般桌機、筆電、平板橫放）走 vh，
 *   **桌機完全不受影響**；比這窄（平板直立）走 vw。
 *   係數之前是 0.79，那是配「三尊並排、總寬 121vh」算的；改成前後疊之後整組只剩
 *   約 80vh 寬，係數可以放寬回 1.10。實測 820×1180 組寬 717px、1024×1366 組寬 895px，
 *   兩個都塞得下。
 *
 * ── 其他 ──
 *   `sm:max-w-none`：原本的 `sm:max-w-[44/52/60vw]` 是防呆上限，但三個加起來是 156vw，
 *   在窄螢幕上三個同時觸頂，反而變成「寬度被撐開」的元凶。高度改用 min() 之後
 *   寬度自然受限於畫面寬，這層上限沒有必要，留著只會壞事。
 *   負邊距寫成 `mb-[calc(...*-1)]` 而不是 `-mb-[...]`：Tailwind 對後者會產出
 *   `margin-bottom: -calc(...)`，那是無效的 CSS。
 *   陣列留空則整區不渲染，版面不會出現空洞。
 *
 *   已知未修：平板直立（820×1180）時 Hero 左欄的「報名普渡法會」按鈕會被擠出畫面左緣。
 *   那是既有問題，成因是 stage 掛 shrink-0、左欄是 flex-1，按鈕又是 whitespace-nowrap。
 *   要修得把 Hero 的兩欄斷點從 sm 提到 lg，讓平板直立沿用手機的上下堆疊版型。
 */
/**
 * 神尊圖網址加上內容版本戳記（雜湊由 vite.config.ts 在建置時算好注入）。
 * public/ 的檔案 Vite 不會加指紋，檔名永遠一樣——換照片時若沿用同一個網址，
 * 沒老實照 must-revalidate 做的那一層就會餵舊圖給信眾。2026-09-02 踩過：
 * 畫面上同時出現舊的二媽與新的三媽，而那兩版剛好是同一尊，看起來像兩尊並排。
 * index.html 的 preload 由 vite.config.ts 的 plugin 補上同一個版號，兩邊要一致。
 */

/**
 * Hero 底圖版本（內部比稿用）。
 *
 * 正式站一律金箔牆；網址加 `?hero=blue` 才換成藍金流體畫。廟方 2026-09-09 要求
 * 兩版並存以便比較，但**不是把新版上線**——所以預設值就是現況，沒有任何連結指過去、
 * 不在 sitemap、也不影響 SEO（query string 不會產生新的可索引網址）。
 * 比的是真正的首頁：三尊、導覽列、香煙、按鈕全都在，不是靜態截圖。
 *
 * 決定要換的時候，把 DEFAULT_HERO 改成 'blue' 即可；連帶要處理的是
 * index.html 的 preload、還有 og-hero.jpg（那張是用金箔底算出來的，見 build-og-hero.js）。
 */
const HERO_VARIANTS = {
  // tone 見 SilkSheen：gold＝金屬反光、flat＝完全不反光（流體畫沒有緞面光澤）
  gold: { file: 'hero-gold.jpg', tone: 'gold' as const },
  blue: { file: 'hero-blue.jpg', tone: 'flat' as const },
};
const DEFAULT_HERO: keyof typeof HERO_VARIANTS = 'gold';
const HERO = (() => {
  if (typeof window === 'undefined') return HERO_VARIANTS[DEFAULT_HERO];
  const v = new URLSearchParams(window.location.search).get('hero');
  return v && v in HERO_VARIANTS ? HERO_VARIANTS[v as keyof typeof HERO_VARIANTS] : HERO_VARIANTS[DEFAULT_HERO];
})();

/** 後台沒設定「關於我們」照片時的保底圖 */
const ABOUT_IMAGE_FALLBACK = '/picture/Introduction 1.jpg';

const HERO_DEITIES: Array<{ src: string; fallback: string; name: string; size: string; drop: string; gap?: string; layer: string; priority?: boolean }> = [
  // 左前：濟公活佛。臉最低，疊在三媽之前
  { src: heroSrc('hero-jigong.webp'), fallback: heroSrc('hero-jigong.png'), name: '濟公活佛',
    size: 'h-[min(74vw,39.14vh)] max-w-[72vw] land:h-[min(57vh,62.7vw)] land:max-w-none',
    drop: 'mb-[calc(min(8vw,4.23vh)*-1)] land:mb-[calc(min(6vh,6.6vw)*-1)]', layer: 'z-[2]' },
  // 中後：天上聖母三媽，本壇主神。最高最大，但**疊在最底層**——廟方要的構圖是
  // 「二媽與濟公在三媽面前」，她的身體被前面兩尊擋住，只露出頭與冠帽。
  // 優先權與 index.html 的 preload 都給她（兩邊不一致等於預載了不是主角的那張）
  { src: heroSrc('hero-sanma.webp'), fallback: heroSrc('hero-sanma.png'), name: '天上聖母三媽',
    size: 'h-[min(128vw,67.70vh)] max-w-[88vw] land:h-[min(98vh,107.8vw)] land:max-w-none',
    drop: 'mb-[calc(min(15vw,7.93vh)*-1)] land:mb-[calc(min(12vh,13.2vw)*-1)]',
    gap: 'ml-[calc(min(24vw,12.69vh)*-1)] land:ml-[calc(min(18vh,19.8vw)*-1)]', layer: 'z-[1]', priority: true },
  // 右前：天上聖母二媽（黃袍金冠）。臉與濟公大致齊高，兩尊一起框住後面的主神
  { src: heroSrc('hero-erma.webp'), fallback: heroSrc('hero-erma.png'), name: '天上聖母二媽',
    size: 'h-[min(99vw,52.36vh)] max-w-[76vw] land:h-[min(76vh,83.6vw)] land:max-w-none',
    drop: 'mb-[calc(min(15vw,7.93vh)*-1)] land:mb-[calc(min(12vh,13.2vw)*-1)]',
    gap: 'ml-[calc(min(31vw,16.40vh)*-1)] land:ml-[calc(min(24vh,26.4vw)*-1)]', layer: 'z-[3]' },
];

// 志工報名有自己的網址 /volunteer：可單獨分享，瀏覽器上一頁也能正確返回。
// 放模組層級是因為 useState 的初始值會在元件內的 const 宣告之前就呼叫到它。
/**
 * 法會報名表在**官網**上的網址。
 *
 * 為什麼需要：報名表本來只在非官方網域（machu-five.vercel.app）的根路徑顯示，
 * 所以宣傳連結、og:url 都只能發那個測試網址。廟方要求對外一律用 heshengtan.tw，
 * 於是給報名表一個自己的路徑——這樣官網就自給自足，不必再對外露出測試網域。
 * 不動原本「非官方網域根路徑也顯示報名表」的行為，舊的分享連結才不會壞。
 */
const FAHUI_PATH = '/fahui';
const isFahuiUrl = (): boolean =>
  typeof window !== 'undefined' && stripSlash(window.location.pathname) === FAHUI_PATH;

/**
 * 天上聖母經的網址。經文與註解是要分享出去讓人讀的內容，
 * 沒有網址就只能靠「進站→開選單→點一下」，貼不到 LINE 上。
 */
const SCRIPTURE_PATH = '/scripture';
const isScriptureUrl = (): boolean =>
  typeof window !== 'undefined' && stripSlash(window.location.pathname) === SCRIPTURE_PATH;

/**
 * 志工報名是否還收件。普渡法會（9/13）的志工已募足，廟方 2026-09-02 決定停止收件。
 *
 * 關掉時會同時處理兩個地方，缺一不可：
 *   1. 法會報名成功頁的「我要報名志工」入口 —— 不傳 onVolunteer 進去，按鈕整個不出現。
 *      留著按鈕卻進到截止畫面，等於讓信眾白填一輪期待（CLAUDE.md 記過「按了沒反應」那類問題）。
 *   2. /volunteer 這個網址 —— 已經分享出去的連結還是會有人點，所以不是擋掉而是
 *      改顯示截止說明，讓人知道發生什麼事、還能怎麼聯絡。
 *
 * 工作人員要預覽表單：網址加 ?preview=1（與法會報名表同一個慣例）。
 * 下一場法會要重新收件時改回 true 即可，表單與後台名單都原封不動。
 */
const VOLUNTEER_OPEN = false;

const VOLUNTEER_PATH = '/volunteer';
const isVolunteerUrl = (): boolean =>
  typeof window !== 'undefined'
  && (stripSlash(window.location.pathname) === VOLUNTEER_PATH
    || new URLSearchParams(window.location.search).has('volunteer'));

const NAV_MORE: NavItem[] = [
  // 行事曆放最上面：它是「常看的參考資料」，性質與其他幾項不同。
  // 桌機頂層那一列已經沒有空間（1024px 時用掉 949px、可用 945px），只能放下拉。
  // 由 ENABLE_CALENDAR 控制；關閉時整個項目不出現（桌機下拉與手機選單共用這份資料）
  ...(ENABLE_CALENDAR ? [{ id: 'calendar', label: '歲時祭曆', kind: 'page' } as NavItem] : []),
  { id: 'blessing', label: '祈福活動', kind: 'page' },
  // 神尊修復由 ENABLE_REPAIR 控制；關閉時整個項目不出現在導覽列（桌機下拉與手機選單共用這份資料）
  ...(ENABLE_REPAIR ? [{ id: 'repair', label: '神尊修復', kind: 'page' } as NavItem] : []),
  { id: 'donation', label: '隨喜捐獻', kind: 'section' },
  { id: 'faq', label: '常見問題', kind: 'section' },
];

interface LampPersonEntry {
  id: string;
  serviceId: string;
  name: string;
  gender?: string;
  birthDate: string;
  zodiac?: ZodiacSign;
  address: string;
  contactLabel?: string;
  _bKey?: number; // 通訊錄選取後遞增，強制 BirthDatePicker 重新初始化
}
interface BookingPersonEntry {
  id: string;
  name: string;
  gender?: string;
  birthDate: string;
  zodiac?: ZodiacSign;
  address: string;
  contactLabel?: string;
  type: ConsultationType;
  notes?: string;
  _bKey?: number;
}
interface DonationPersonEntry {
  id: string;
  name: string;
  gender?: string;
  address: string;
  contactLabel?: string;
  amount: number;
  type: DonationType;
  repairProjectId?: string;   // 指定修復神尊的 id（選填）
}
interface BlessingPersonEntry {
  id: string;
  name: string;
  birthDate: string;
  zodiac?: ZodiacSign;
  gender: string;
  address: string;
  contactLabel?: string;
  _bKey?: number;
  packageId?: string;              // 所選方案 ID（有多方案時）
  selectedAddonIds?: string[];     // 固定品項勾選的 addon.id 清單
  voluntaryFees?: Record<string, number>; // voluntary addon.id → 自填金額
  claimedOfferingIds?: string[];   // 認領的供品 offering.id 清單
}

// 水墨筆刷分隔線元件

const App: React.FC = () => {
  // ?admin=1 → 顯示正常首頁並自動跳出管理員登入（上線前報名表蓋住首頁時的後台入口）
  const adminEntry = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('admin');
  // /volunteer 或 ?volunteer=1 → 直接開志工報名（可單獨分享的網址）
  const volunteerEntry = typeof window !== 'undefined'
    && (window.location.pathname.replace(/\/+$/, '') === '/volunteer'
      || new URLSearchParams(window.location.search).has('volunteer'));
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showScripture, setShowScripture] = useState(isScriptureUrl);
  const [page, setPage] = useState<SitePage>(pageFromPath);
  // 全站的進場與視差引擎（掛一次，掃全document）。元素只要掛 .sr / .sr-figure / .sr-counter
  useScrollMotion();
  // 從分頁點首頁區塊時，要先切回首頁、等區塊掛上 DOM 才捲得到；用這個暫存待捲目標
  const pendingScrollRef = useRef<string | null>(null);
  // 點導覽後的平滑捲動期間，暫時停掉捲動高亮（值是解鎖時間戳）。
  // 不鎖的話：捲動途中會依序掃過中間每個區塊，高亮一路亂跳；
  // 更糟的是平滑捲動被觸控板碰一下就會停在半路，最後一次捲動事件就把高亮定在上一個區塊。
  const navLockRef = useRef(0);
  // 直接輸入 /blessing 這類網址進來時，導覽要亮在該分頁上，不能固定從 'home' 起算
  const [activeSection, setActiveSection] = useState<string>(pageFromPath);
  const [isScrolled, setIsScrolled] = useState(false);
  // 捲過 Hero 沒有？LINE 浮動鈕在 Hero 停留期間先收起來，不擋住三尊神明與宮壇名。
  const [pastHero, setPastHero] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [donationStatus, setDonationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showAdmin, setShowAdmin] = useState(false);
  // 法會收件期間顯示報名表的兩個入口：
  //   (1) /fahui —— 官網自己的報名網址，對外宣傳一律用這個（見 FAHUI_PATH）
  //   (2) 非官方網域的根路徑 —— 舊的分享連結還在流傳，維持原樣不要動
  // 服務分頁（/booking 等）有自己的網址，不受此影響——否則上一頁／下一頁會被報名表吃掉。
  // 正式官網網域（heshengtan.tw）的**根路徑**一律顯示官網首頁，見 OFFICIAL_HOSTS。
  // 初始值與 popstate 共用這一個函式；分開寫過會導致按上一頁被報名表吃掉。
  const shouldShowFahui = (): boolean =>
    FAHUI_LANDING && !adminEntry && !isVolunteerUrl() && !isScriptureUrl()
    && (isFahuiUrl() || (!isOfficialHost() && pageFromPath() === 'home'));
  const [showFahui, setShowFahui] = useState(shouldShowFahui);
  const [showVolunteer, setShowVolunteer] = useState(volunteerEntry);

  // 分頁標題跟著畫面換。兩個理由：
  // (1) 一份 index.html 服務兩個網域，靜態 <title> 只能有一個（現在是法會版，
  //     因為宣傳連結分享到 LINE 時要看到報名的標題），但官網進來看到的是首頁；
  // (2) 各分頁有自己的預渲染 HTML 與標題（scripts/prerender.js），
  //     React 接手後若不跟著換，使用者的分頁標題會被蓋成同一個。
  // **這裡的文案要與 scripts/prerender.js 的 ROUTES 一致**，否則爬蟲看到的和人看到的會不一樣。
  // 注意：這只影響瀏覽器分頁。分享預覽是爬蟲讀靜態 HTML、不跑 JS，由 og:title 決定。
  useEffect(() => {
    const titles: Record<SitePage, string> = {
      home:       '台北古亭和聖壇｜問事、祈福點燈與法會服務',
      about:      '關於和聖壇｜台北古亭媽祖廟的沿革與壇務',
      booking:    '預約問事｜台北古亭和聖壇',
      lamps:      '祈福點燈｜太歲祈安燈・光明前程祈福燈・財利燈・本命神明燈',
      blessing:   '祈福法會報名｜台北古亭和聖壇',
      relocation: '遷址捐款｜護持和聖壇道場遷址',
      repair:     '神尊修復｜台北古亭和聖壇',
      deitiesAll: '祀奉神尊｜台北古亭和聖壇的神尊介紹',
      calendar:   '歲時祭曆｜神明聖誕與壇務活動｜台北古亭和聖壇',
    };
    // 聖母經與志工報名各有網址但不是 PAGE_PATHS 的一員，要各自給標題——
    // 不給的話分享 /scripture 出去，分頁上顯示的會是法會報名的標題。
    document.title = showScripture
      ? '天上聖母經｜經文、註解與故事｜台北古亭和聖壇'
      : showVolunteer
      ? '志工報名｜台北古亭和聖壇'
      : showFahui
      ? '和聖壇法會線上報名｜太上慈悲普渡禮懺法會'
      : titles[page];
  }, [showScripture, showVolunteer, showFahui, page]);
  const [volunteerPrefill, setVolunteerPrefill] = useState<{ name: string; phone: string; address: string; birthDate: string; zodiac: string; lineId: string } | undefined>(undefined);
  const [adminRole, setAdminRole] = useState<AdminRole>('admin');
  const [showLoginModal, setShowLoginModal] = useState(adminEntry);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const openVolunteer =(prefill?: { name: string; phone: string; address: string; birthDate: string; zodiac: string; lineId: string }) => {
    setVolunteerPrefill(prefill);
    setShowVolunteer(true);
    window.scrollTo({ top: 0 });
    if (!isVolunteerUrl()) window.history.pushState({ volunteer: true }, '', withKeptParams(VOLUNTEER_PATH));
  };

  const closeVolunteer = () => {
    setShowVolunteer(false);
    // 這裡要連 volunteer 一起拿掉：isVolunteerUrl() 認得 `?volunteer`，
    // 只換路徑而留著這個參數，等於根本沒關掉。
    if (isVolunteerUrl()) window.history.pushState({}, '', withKeptParams('/', ['volunteer']));
  };

  /**
   * 從法會報名表回到官網首頁。
   *
   * 報名表沒有自己的網址（`showFahui` 是 state 不是路由），所以除了關掉它，
   * 還要用 goToPage 把網址推回 `/`——否則在 `/blessing` 點橫幅進來的人按下返回後，
   * 網址還停在 `/blessing`，重新整理又會回到那一頁。
   *
   * 按瀏覽器上一頁會回到報名表（popstate 會重新跑 `shouldShowFahui()`），
   * 這是刻意的：上一頁本來就該回到剛才看的東西。
   */
  /**
   * 開啟聖母經，並把網址推成 /scripture。
   * 不推網址就沒得分享，而且重新整理會掉回首頁。
   */
  const openScripture = () => {
    if (typeof window !== 'undefined' && stripSlash(window.location.pathname) !== SCRIPTURE_PATH) {
      window.history.pushState({}, '', withKeptParams(SCRIPTURE_PATH));
    }
    setShowScripture(true);
  };

  /** 從聖母經返回。與 closeFahui 同樣要把網址推回 `/`，否則重新整理又回到經文。 */
  const closeScripture = () => {
    setShowScripture(false);
    goToPage('home');
  };

  /**
   * 開啟報名表，並把網址推成 /fahui。
   * 不推網址的話報名表就沒有可分享的位置，重新整理也會掉回首頁。
   */
  const openFahui = () => {
    if (typeof window !== 'undefined' && stripSlash(window.location.pathname) !== FAHUI_PATH) {
      window.history.pushState({}, '', withKeptParams(FAHUI_PATH));
    }
    setShowFahui(true);
  };

  const closeFahui = () => {
    setShowFahui(false);
    goToPage('home');
  };

  useEffect(() => {
    const onPop = () => {
      const vol = isVolunteerUrl();
      setShowVolunteer(vol);
      setShowScripture(isScriptureUrl());
      setShowFahui(shouldShowFahui());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [adminEntry]);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [bulletins, setBulletins] = useState<BulletinRecord[]>([]);
  const [bulletinFilter, setBulletinFilter] = useState<string>('all');
  const [expandedBulletin, setExpandedBulletin] = useState<string | null>(null);
  const HERO_FALLBACK = 'https://images.unsplash.com/photo-1542045938-4e8c18731c39?q=80&w=2070&auto=format&fit=crop';
  const [heroSlides, setHeroSlides] = useState<HeroSlideRecord[]>([]);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const heroIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  /**
   * 「關於我們」照片。**初始值刻意留空**：填 '/picture/Introduction 1.jpg' 的話，
   * React 第一次就把它畫出來、瀏覽器立刻下載 419KB，接著資料庫的值回來又換掉 src——
   * 那張圖從來不會出現在畫面上，卻每次進首頁都下載一次（實測 2026-09-10）。
   * 空字串時改畫同尺寸的佔位塊，版面不會跳動。
   */
  const [aboutImageUrl, setAboutImageUrl] = useState('');
  // 首頁摘要取後台第一個顯示中的段落；還沒載入或沒資料時用下面寫死的保底文案
  const [aboutLead, setAboutLead] = useState<AboutSection | null>(null);
  // 首頁遷址捐款區塊＝後台「遷址捐款」第一個顯示中的段落
  const [relocationLead, setRelocationLead] = useState<AboutSection | null>(null);
  // 首頁摘要可在後台單獨寫；留空則退回 /relocation 的第一段
  const [relocationHome, setRelocationHome] = useState<RelocationHome>({ heading: '', body: '' });
  const [aboutFacts, setAboutFacts] = useState<AboutFacts>(DEFAULT_ABOUT_FACTS);
  const [deities, setDeities] = useState<DeityRecord[]>([]);
  const [deityHalls, setDeityHalls] = useState<HallRecord[]>([]);
  const [selectedHall, setSelectedHall] = useState<string | null>(null);
  // 祀奉神尊：先顯示一批，按「更多」再展開一批
  const [deityShown, setDeityShown] = useState(DEITY_PAGE);
  const [lampConfigs, setLampConfigs] = useState<LampServiceConfig[]>([]);
  // ── 點燈多人 ──
  const [lampPersons, setLampPersons] = useState<LampPersonEntry[]>([{ id: newId(), serviceId: '', name: '', birthDate: '', zodiac: undefined, address: '', contactLabel: '本人' }]);
  const [lampNotes, setLampNotes] = useState('');
  const [lampStatus, setLampStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [member, setMember] = useState<User | null>(null);
  const [memberProfile, setMemberProfile] = useState<ProfileData | null>(null);
  /** 常見問題。先用保底內容渲染，資料庫回來再換掉——避免首屏空一塊 */
  const [faqItems, setFaqItems] = useState<{ q: string; a: string }[]>(FAQ_FALLBACK);
  /**
   * 捐款類別。後台可增刪改（donation_types），這裡先用 `DonationType` 列舉當保底，
   * 資料表沒建或讀取失敗時前台仍有選項可選，不會變成空的下拉。
   * 「神尊修復」永遠排除：那一項走神尊修復專頁、金額綁定專案。
   */
  const [donationTypes, setDonationTypes] = useState<string[]>(
    Object.values(DonationType).filter(t => t !== DonationType.REPAIR)
  );

  /**
   * 網站基本資料（地址／電話／開放時間）。後台「基本資料」分頁可改。
   * 先用保底值渲染，資料庫回來再換——首屏不會出現空白的地址與電話。
   */
  const [siteInfo, setSiteInfo] = useState<SiteInfo>(DEFAULT_SITE_INFO);
  /** 電話的 tel: 連結要純數字，顯示用的字串可能帶連字號 */
  const telHref = `tel:${siteInfo.phone.replace(/[^\d+]/g, '')}`;
  const [showMemberPortal, setShowMemberPortal] = useState(false);
  const [memberPortalPendingPhone, setMemberPortalPendingPhone] = useState('');
  const [memberContacts, setMemberContacts] = useState<MemberContact[]>([]);
  const [showContactPicker, setShowContactPicker] = useState<{ form: 'lamp' | 'booking' | 'donation' | 'blessing' | 'repair'; personId: string } | null>(null);
  // ── 祈福活動 ──
  const [blessingEvents, setBlessingEvents] = useState<BlessingEventRecord[]>([]);
  const [blessingModal, setBlessingModal] = useState<BlessingEventRecord | null>(null);
  const [blessingPersons, setBlessingPersons] = useState<BlessingPersonEntry[]>([{ id: newId(), name: '', birthDate: '', zodiac: undefined, gender: '', address: '', contactLabel: '本人' }]);
  const [blessingNotes, setBlessingNotes] = useState('');
  const [blessingStatus, setBlessingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // ── 共享報名表 ──
  const [sharedSession,      setSharedSession]      = useState<SharedSessionRecord | null>(null);
  /** 網址帶 ?share= 但那張表已不存在（主揪刪了或已到期），要提示親友而不是靜靜顯示一般頁面 */
  const [sharedMissing,      setSharedMissing]      = useState(false);
  const [isCreator,          setIsCreator]           = useState(false);
  /**
   * 這台瀏覽器開過、但**還沒送出**的共享報名表。
   * 主揪關掉分頁就找不回來是廟方回報的問題，所以進站時主動撈出來提醒。
   * 只留 status === 'open' 且未過期的；讀不到（被刪掉、過期）就從清單移除。
   */
  const [myPending, setMyPending] = useState<{ meta: MySharedSession; session: SharedSessionRecord }[]>([]);
  const [showShareModal,     setShowShareModal]      = useState(false);
  const [creatingShare,      setCreatingShare]       = useState(false);
  const [sharedSubmitStatus, setSharedSubmitStatus]  = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [urlCopied,          setUrlCopied]           = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) {
        setLoginError('帳號或密碼錯誤，請再試一次。');
      } else {
        // 僅 admin_profiles 內有設定的帳號才能進後台；查無權限即登出拒絕
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from('admin_profiles')
          .select('role')
          .eq('user_id', user?.id)
          .maybeSingle();
        if (!profile) {
          await supabase.auth.signOut();
          setLoginError('此帳號無後台管理權限。');
        } else {
          setAdminRole(profile.role as AdminRole);
          setShowAdmin(true);
          setShowLoginModal(false);
          setLoginEmail('');
          setLoginPassword('');
        }
      }
    } catch {
      setLoginError('登入失敗，請稍後再試。');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCloseLoginModal = () => {
    setShowLoginModal(false);
    setLoginEmail('');
    setLoginPassword('');
    setLoginError('');
    setShowPassword(false);
  };

  // ── 問事多人 ──
  const [bookingPersons, setBookingPersons] = useState<BookingPersonEntry[]>([{ id: newId(), name: '', birthDate: '', zodiac: undefined, address: '', type: ConsultationType.CAREER, contactLabel: '本人' }]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [bookingSessions, setBookingSessions] = useState<BookingSessionRecord[]>([]);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});

  // ── 捐獻多人 ──
  const [donationPersons, setDonationPersons] = useState<DonationPersonEntry[]>([{ id: newId(), name: '', gender: '', address: '', amount: 0, type: DonationType.GENERAL, contactLabel: '本人' }]);
  const [donationNotes, setDonationNotes] = useState('');
  const [repairProjects, setRepairProjects] = useState<RepairProject[]>([]);
  const [social, setSocial] = useState<SocialSettings>(DEFAULT_SOCIAL);
  const [repairProjectTotals, setRepairProjectTotals] = useState<Record<string, number>>({});
  // 神尊超過十尊：改為「先顯示一批＋顯示更多」，不用數字分頁。
  // 數字分頁在募款情境是負面的——第二頁以後的神尊幾乎不會被看到。
  const [repairShown, setRepairShown] = useState(6);
  const REPAIR_PAGE_SIZE = 6;
  const [repairSelectedProj, setRepairSelectedProj] = useState<RepairProject | null>(null);
  const [repairName, setRepairName] = useState('');
  const [repairAmount, setRepairAmount] = useState(0);
  const [repairNotes, setRepairNotes] = useState('');
  const [repairFormStatus, setRepairFormStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  // ── 訪客（未登入）電話 ──
  const [guestPhone, setGuestPhone] = useState('');

  /**
   * 首頁輪播的自動換頁計時器。
   * 輪播照片已從 Hero 撤下（空間留給特效），所以這裡直接不啟動——
   * 否則會每 5 秒觸發一次沒有人看的 state 更新，白白重繪整個首頁。
   * 資料與後台照片管理都保留，要恢復輪播時把 return 拿掉即可。
   */
  const startHeroInterval = (totalSlides: number) => {
    if (heroIntervalRef.current) clearInterval(heroIntervalRef.current);
    if (!HERO_SLIDESHOW) return;
    if (totalSlides <= 1) return;
    heroIntervalRef.current = setInterval(() => {
      setHeroSlideIndex(prev => (prev + 1) % totalSlides);
    }, 5000);
  };

  /** 回傳是否成功，讓 loadMemberDataOnce 判斷這次去重要不要保留 */
  const loadMemberContacts = async (): Promise<boolean> => {
    try {
      const contacts = await getMemberContacts();
      setMemberContacts(contacts);
      return true;
    } catch {
      setMemberContacts([]);
      return false;
    }
  };

  const loadMemberProfile = async (): Promise<boolean> => {
    try {
      const p = await getProfile();
      setMemberProfile(p);
      return true;
    } catch {
      setMemberProfile(null);
      return false;
    }
  };

  /**
   * 已經替哪一位會員載過通訊錄與個人資料。
   *
   * 登入狀態下開首頁會重複抓三次（實測 2026-09-10：member_contacts ×3、
   * member_profiles ×3）——getSession() 抓一次，onAuthStateChange 訂閱時
   * 立刻送出的 INITIAL_SESSION 再抓一次，之後的事件又一次。三個各自進行的
   * 請求除了浪費，回應順序不保證，後到的舊資料會蓋掉新的。
   * 兩個入口都保留（拿掉任一個都會在某些時序下漏載），改成用這個 ref 去重。
   * 送出報名後那幾處是刻意要重抓的，直接呼叫 loadMemberContacts()，不走這裡。
   */
  const memberDataLoadedFor = React.useRef<string | null>(null);
  const loadMemberDataOnce = async (userId: string | undefined): Promise<void> => {
    if (!userId || memberDataLoadedFor.current === userId) return;
    memberDataLoadedFor.current = userId;
    const ok = await Promise.all([loadMemberContacts(), loadMemberProfile()]);
    // 失敗就把記號清掉：去重之後只會嘗試一次，網路瞬斷若不放行，
    // 會員的通訊錄會一直是空的直到重新登入。另一個入口稍後還會再試一次。
    if (!ok.every(Boolean) && memberDataLoadedFor.current === userId) {
      memberDataLoadedFor.current = null;
    }
  };

  const handleOpenContactPicker = (form: 'lamp' | 'booking' | 'donation' | 'blessing' | 'repair', personId: string) => {
    if (!member) { setShowMemberPortal(true); return; }
    const hasProfile = !!(memberProfile && memberProfile.name);
    if (!hasProfile && memberContacts.length === 0) { alert('請先至會員中心填寫個人資料或新增聯絡人'); return; }
    setShowContactPicker({ form, personId });
  };

  useEffect(() => {
    // 常見問題：讀不到就沿用保底內容，不寫 console.error（表還沒建對訪客不是錯誤）
    getFaqItems()
      .then(rows => { if (rows.length) setFaqItems(rows.map(r => ({ q: r.question, a: r.answer }))); })
      .catch(() => {});
    getDonationTypes()
      .then(rows => { if (rows.length) setDonationTypes(rows.map(r => r.name)); })
      .catch(() => {});
    getSiteInfo().then(setSiteInfo).catch(() => {});
    getBulletins().then(setBulletins).catch(console.error);
    getDeities().then(all => setDeities(all.filter(d => d.isVisible !== false))).catch(console.error);
    getDeityHalls().then(setDeityHalls).catch(console.error);
    getLampServiceConfigs(true).then(setLampConfigs).catch(console.error);
    getBlessingEvents(true).then(setBlessingEvents).catch(console.error);
    // 社群帳號：後台可改，留空的平台前台不顯示
    getSocialSettings().then(s => { setSocial(s); setLineUrl(s.lineUrl); }).catch(console.error);
    Promise.all([getRepairProjects(), getRepairProjectTotals()])
      .then(([projects, totals]) => {
        setRepairProjects(projects.filter(p => p.isActive));
        setRepairProjectTotals(totals);
      }).catch(console.error);
    getSiteImages().then(images => {
      const about = images.find(img => img.sectionKey === 'about');
      // 後台沒設定或讀取失敗才退回本地保底圖，不要一開始就先載一張準備被換掉的
      setAboutImageUrl(about ? getSiteImagePublicUrl(about.storagePath) : ABOUT_IMAGE_FALLBACK);
    }).catch(e => { console.error(e); setAboutImageUrl(ABOUT_IMAGE_FALLBACK); });
    // 首頁「關於我們」摘要＝後台第一個顯示中的段落，與 /about 同一份資料，改一次兩邊同步
    getAboutSections().then(rows => setAboutLead(rows[0] ?? null))
      .catch(e => console.warn('讀取關於我們段落失敗，首頁改用保底文案:', e));
    getAboutFacts().then(setAboutFacts).catch(() => {});
    getAboutSections(false, 'relocation').then(rows => setRelocationLead(rows[0] ?? null))
      .catch(e => console.warn('讀取遷址段落失敗:', e));
    getRelocationHome().then(setRelocationHome).catch(() => {});
    getHeroSlides().then(slides => {
      setHeroSlides(slides);
      startHeroInterval(slides.length);
    }).catch(console.error);

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setMember(u);
      loadMemberDataOnce(u?.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setMember(session?.user ?? null);
      // setTimeout 脫離 onAuthStateChange callback：內部會再呼叫 auth.getUser()，
      // 在 callback 內同步呼叫有 supabase-js 已知的 auth lock 死鎖風險
      if (session?.user) { setTimeout(() => loadMemberDataOnce(session.user.id), 0); }
      else { memberDataLoadedFor.current = null; setMemberContacts([]); setMemberProfile(null); }
    });

    // ── 我開的、還沒送出的共享報名表 ──
    // 主要來源是帳號（get_my_shared_sessions）——這正是主揪要登入的理由，
    // 換一台裝置也查得回來。localStorage 只是補漏：2026-09-10 改為必須登入
    // 之前開的場次沒有 created_by，只能靠瀏覽器記號找回，否則會變成孤兒。
    if (ENABLE_GROUP_BOOKING) {
      (async () => {
        const byAccount = await getMySharedSessions().catch(() => []);
        const seen = new Set(byAccount.map(x => x.id));
        const legacy = await Promise.all(
          listMyShared().filter(m => !seen.has(m.id)).map(async meta => {
            const session = await getSharedSession(meta.id).catch(() => null);
            // 讀不到（被刪）、已送出、或已過期，就從清單清掉不再提醒
            if (!session || session.status !== 'open') { forgetMyShared(meta.id); return null; }
            return { meta, session };
          })
        );
        const fromAccount = byAccount.map(session => ({
          meta: { id: session.id, serviceType: session.serviceType, path: SERVICE_PATH[session.serviceType], createdAt: session.createdAt },
          session,
        }));
        setMyPending([...fromAccount, ...legacy.filter((r): r is { meta: MySharedSession; session: SharedSessionRecord } => r !== null)]);
      })();
    }

    // ── 共享報名表 URL 偵測 ──
    const shareId = new URLSearchParams(window.location.search).get('share');
    if (shareId) {
      getSharedSession(shareId).then(async session => {
        if (!session) {
          // 連結指到的表已不存在（主揪刪了、或 7 天到期被清）。原本這裡靜靜 return，
          // 親友點連結看到的是一般頁面，會以為網站壞了或自己按錯。要講清楚。
          setSharedMissing(true);
          return;
        }
        setSharedSession(session);
        // 主揪身分優先看帳號。這裡直接問 auth 而不是讀 member 狀態：
        // 這支 effect 與 getSession() 是兩個各自進行的非同步流程，
        // 讀 member 會賽跑——主揪自己開連結時常常還是 null，就被當成被揪的人。
        const { data: { user } } = await supabase.auth.getUser();
        // createdBy 為 null 的是這次改動之前的舊場次，那時只有瀏覽器記號可查，
        // 退回去用它，否則舊表會變成誰都不是主揪、永遠送不出去。
        setIsCreator(
          session.createdBy ? session.createdBy === user?.id : isMyShared(shareId)
        );
        // 共享報名連結：三種服務都已獨立成頁，直接切過去（不再用捲動）
        const target: SitePage =
          session.serviceType === 'lamp' ? 'lamps' :
          session.serviceType === 'blessing' ? 'blessing' : 'booking';
        setPage(target);
        setActiveSection(target);
      });
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
      // Hero 是滿版高度，捲過七成就算離開了——等捲滿一整屏才顯示會慢半拍。
      setPastHero(window.scrollY > window.innerHeight * 0.7);
      // 只有首頁需要捲動高亮；在獨立分頁時導覽亮的是該分頁本身，不該被捲動改掉
      if (pageFromPath() !== 'home') return;
      // 使用者剛點了導覽：平滑捲動還在飛，先不要讓捲動高亮插手（見 navLockRef）
      if (performance.now() < navLockRef.current) return;
      // 由下往上找第一個「已經捲進來」的區塊。四項服務已移出首頁，這裡只剩首頁上的區塊。
      // 判定線用視窗高度的比例而不是固定 120px：section 的 scroll-margin-top 是 80px，
      // 捲到定位時區塊頂端就落在 80，跟 120 只差 40——平滑捲動少捲 41px（觸控板碰一下、
      // 或圖片載入把版面往下推）高亮就會退回上一個區塊。這正是「點祀奉神尊卻亮關於我們」的成因。
      const line = Math.max(120, Math.min(window.innerHeight * 0.35, 300));
      // relocation-intro／services 是首頁區塊：前者對應導覽的「遷址捐款」，
      // 後者沒有對應項目，就讓高亮停在「遷址捐款」直到捲進隨喜捐獻。
      // 由下往上排，取第一個已捲過判定線的區塊，所以順序必須與頁面由下而上一致。
      // bulletin 夾在 about 與 home 之間（頁面上它在 hero 之下、關於我們之上）。
      const pairs: [string, string][] = [
        ['faq', 'faq'], ['donation', 'donation'], ['relocation-intro', 'relocation'], ['deities', 'deities'],
        ['about', 'about'],
        ...(ENABLE_BULLETIN ? [['bulletin', 'bulletin'] as [string, string]] : []),
        ['home', 'home'],
      ];
      for (const [id, navId] of pairs) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) {
          setActiveSection(navId);
          return;
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    // 先跑一次：重新整理時瀏覽器會還原捲動位置，只掛監聽的話要等使用者再捲一下，
    // 導覽列與 LINE 浮動鈕會停在「還在最頂端」的狀態。
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (heroIntervalRef.current) clearInterval(heroIntervalRef.current);
      subscription.unsubscribe();
    };
  }, []);

  /**
   * 會員本人的預填值。四個表單共用，各自取自己有的欄位
   * （捐獻沒有生日／生肖，所以不能一律整包塞，會混進表單型別沒有的欄位）。
   */
  const selfDefaults = {
    name:      memberProfile?.name ?? '',
    gender:    memberProfile?.gender ?? '',
    address:   memberProfile?.address ?? '',
  };
  const selfWithBirth = {
    ...selfDefaults,
    birthDate: memberProfile?.birthDate ?? '',
    zodiac:    memberProfile?.zodiac,
  };

  /**
   * 會員資料載入後自動帶入，讓已登入的人不必每次重打自己的姓名生日地址。
   *
   * 兩層規則：
   *   1. 標記為「本人」的那張卡片 → 姓名、生日、生肖、性別、地址全部帶入；
   *   2. 其他人的卡片（父母親、兒女…）→ 只帶地址。姓名生日當然是別人的，不能亂填，
   *      但地址多半同戶，帶入省事；這是原本就有的行為，保留。
   * 兩層都只補「還沒填的欄位」，使用者改過的一律不動。
   *
   * 依賴整個 memberProfile 而不是單一欄位：會員在會員中心補填資料後要能立刻反映。
   */
  useEffect(() => {
    const prof = memberProfile;
    if (!prof) return;
    const addr = prof.address;
    const fillOthers = <T extends { address: string }>(e: T): T => (addr && !e.address ? { ...e, address: addr } : e);
    const isSelf = (label?: string): boolean => label === '本人';

    /**
     * 有生日欄位的卡片：帶入之後要遞增 `_bKey`。
     * BirthDatePicker 的年／月／日是自己的內部狀態，只在掛載時從 value 初始化一次；
     * 光改 birthDate 字串它不會跟著動，畫面上三個下拉會停在空值（實測過）。
     * key 帶著 `_bKey` 所以遞增等於強制重新掛載——通訊錄選取走的也是這條路。
     */
    const fillSelfCard = <T extends { birthDate: string; _bKey?: number }>(e: T): T => {
      const next = fillEmptyFields(e, selfWithBirth);
      if (next === e) return e;
      return next.birthDate !== e.birthDate ? { ...next, _bKey: (e._bKey ?? 0) + 1 } : next;
    };

    setLampPersons(prev => prev.map(e => isSelf(e.contactLabel) ? fillSelfCard(e) : fillOthers(e)));
    setBookingPersons(prev => prev.map(e => isSelf(e.contactLabel) ? fillSelfCard(e) : fillOthers(e)));
    setBlessingPersons(prev => prev.map(e => isSelf(e.contactLabel) ? fillSelfCard(e) : fillOthers(e)));
    setDonationPersons(prev => prev.map(e => isSelf(e.contactLabel) ? fillEmptyFields(e, selfDefaults) : fillOthers(e)));
    // 神尊修復只有一個姓名欄位，沒有卡片結構
    setRepairName(prev => prev || (prof.name ?? ''));
  }, [memberProfile]);

  /**
   * 捐款類別載入後，把卡片上「已經不存在的類別」校正成第一項。
   * 會發生的情境：預設值來自 `DonationType` 列舉，而廟方在後台把那個類別改名了——
   * 不校正的話送出的會是一個下拉裡根本沒有的字串。
   */
  useEffect(() => {
    if (donationTypes.length === 0) return;
    setDonationPersons(prev => {
      let changed = false;
      const next = prev.map(p => {
        if (donationTypes.includes(p.type)) return p;
        changed = true;
        return { ...p, type: donationTypes[0] as DonationType };
      });
      return changed ? next : prev;
    });
  }, [donationTypes]);

  /**
   * 常見問題的 FAQPage 結構化資料，在**執行期**依當下的內容重新產生。
   *
   * 為什麼不留給預渲染就好：FAQ 改成後台可編輯之後，`scripts/prerender.js` 產出的那份
   * 是建置當下的快照，廟方一改就過期。Google 會執行 JavaScript，所以由這裡覆蓋之後
   * **它看到的標記與畫面上的問答永遠一致**——標記與內容對不上正是 FAQPage 最容易踩的雷。
   *
   * 兩個必須遵守的細節：
   *  (1) 先移除預渲染留下的那份，否則同一頁會有兩個 FAQPage 節點；
   *  (2) **只有首頁才掛**。分頁上看不到問答區塊，掛了就是「標記的內容使用者看不到」。
   *      換頁時要主動清掉，SPA 不會自己重載 <head>。
   */
  useEffect(() => {
    const ID = 'faq-jsonld';
    const onHome = page === 'home' && !showFahui;

    // 預渲染注入的那份沒有 id，用內容認出來
    document.querySelectorAll('script[type="application/ld+json"]').forEach(el => {
      if (el.id !== ID && /"FAQPage"/.test(el.textContent ?? '')) el.remove();
    });

    const existing = document.getElementById(ID);
    if (!onHome || faqItems.length === 0) { existing?.remove(); return; }

    const el = (existing as HTMLScriptElement | null) ?? (() => {
      const node = document.createElement('script');
      node.type = 'application/ld+json';
      node.id = ID;
      document.head.appendChild(node);
      return node;
    })();
    el.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': 'https://heshengtan.tw/#faq',
      inLanguage: 'zh-TW',
      mainEntity: faqItems.map(item => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    }, null, 2);
  }, [faqItems, page, showFahui]);

  /**
   * 用後台的基本資料覆寫 index.html 裡那個 PlaceOfWorship 節點的
   * 電話、地址與開放時間。
   *
   * 為什麼要在執行期做：那段 JSON-LD 是靜態寫在 HTML 裡的，廟方在後台改了時間，
   * 它不會跟著變——Google 拿到的就會是舊資料，而且畫面上寫著新時間，兩邊打架。
   * Google 會執行 JavaScript，所以覆寫之後它讀到的一定是最新的。
   *
   * 只改這三個欄位、不整包換掉：那個節點還有 hasOfferCatalog、sameAs、
   * foundingDate 等等，整包重寫等於要在這裡維護第二份完整定義。
   */
  useEffect(() => {
    const node = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .find(el => /"PlaceOfWorship"/.test(el.textContent ?? ''));
    if (!node) return;
    try {
      const data = JSON.parse(node.textContent ?? '{}');
      const graph = Array.isArray(data['@graph']) ? data['@graph'] : [data];
      const temple = graph.find((n: Record<string, unknown>) => {
        const t = n['@type'];
        return Array.isArray(t) ? t.includes('PlaceOfWorship') : t === 'PlaceOfWorship';
      });
      if (!temple) return;
      // 電話轉國際格式：只把開頭的 0 換成 +886-，保留原本的連字號分組。
      // 全部去掉會變成 +886-953945349 這種不上不下的格式，人和機器都不好讀。
      temple.telephone = siteInfo.phone.replace(/^0/, '+886-');
      temple.address = {
        '@type': 'PostalAddress',
        streetAddress: siteInfo.street,
        addressLocality: siteInfo.locality,
        addressRegion: siteInfo.region,
        postalCode: siteInfo.postalCode,
        addressCountry: 'TW',
      };
      temple.openingHoursSpecification = {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: siteInfo.hoursOpen,
        closes: siteInfo.hoursClose,
      };
      node.textContent = JSON.stringify(data, null, 2);
    } catch { /* 靜態那份壞掉的話就別再動它，至少保留原內容 */ }
  }, [siteInfo]);

  // ── 問事場次 ──
  useEffect(() => {
    getBookingSessions(true).then(setBookingSessions).catch(() => {});
    getBookingCountsBySession().then(setSessionCounts).catch(() => {});
  }, []);

  const filteredBulletins = bulletinFilter === 'all'
    ? bulletins
    : bulletins.filter(b => b.category === bulletinFilter);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  /** 會員已登入但尚未填聯絡電話時，擋下送出並導引補填（避免電話存成空字串、廟方無法聯絡） */
  const requireMemberPhone = (): boolean => {
    if (member && !memberProfile?.phone) {
      alert('請先至會員中心填寫聯絡電話，以便廟方與您聯繫。');
      setShowMemberPortal(true);
      return false;
    }
    return true;
  };

  /** 部分成功時：保留未成功名單、提示使用者勿重複填寫已成功者 */
  const alertPartialFailure = (ok: number) => {
    alert(`前 ${ok} 位已成功送出，其後的資料送出失敗。已為您保留尚未成功的名單，請確認網路後再按一次送出（已成功者請勿重複填寫）。`);
  };

  // ── 點燈送出（批次） ──
  const handleLampSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = lampPersons.find(p => !p.serviceId || !p.name.trim());
    if (invalid) { alert('請填寫所有人員的服務項目與姓名。'); return; }
    if (!requireMemberPhone()) return;
    setLampStatus('loading');
    const ok = await submitSequentially(lampPersons, (p: LampPersonEntry) => submitLampRegistration({
      serviceId: p.serviceId, name: p.name, phone: member ? (memberProfile?.phone ?? '') : guestPhone, gender: p.gender || undefined, birthDate: p.birthDate, zodiac: p.zodiac, address: p.address || undefined, contactLabel: p.contactLabel, notes: lampNotes,
    }));
    if (ok < lampPersons.length) {
      if (ok > 0) { setLampPersons(prev => prev.slice(ok)); alertPartialFailure(ok); }
      setLampStatus('error');
      return;
    }
    if (member) {
      autoSaveContactsForMember(lampPersons, memberProfile?.phone ?? '', new Set(memberContacts.map(c => c.name)))
        .then(() => loadMemberContacts()).catch(() => {});
    }
    setLampStatus('success');
    setLampPersons([{ id: newId(), serviceId: '', ...selfWithBirth, contactLabel: '本人' }]);
    setLampNotes('');
  };

  // ── 問事送出（批次） ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId) { alert('請選擇問事場次。'); return; }
    const selectedSession = bookingSessions.find(s => s.id === selectedSessionId);
    if (!selectedSession) { alert('場次不存在，請重新選擇。'); return; }
    if (!requireMemberPhone()) return;
    // 送出前重抓一次即時名額，降低超賣機率
    const freshCounts = await getBookingCountsBySession().catch(() => sessionCounts);
    setSessionCounts(freshCounts);
    const sessionRemaining = selectedSession.maxSlots - (freshCounts[selectedSessionId] || 0);
    if (bookingPersons.length > sessionRemaining) { alert(`此場次剩餘 ${Math.max(0, sessionRemaining)} 位，您共填寫 ${bookingPersons.length} 人，請減少人數或選擇其他場次。`); return; }
    setBookingStatus('loading');
    const ok = await submitSequentially(bookingPersons, (p: BookingPersonEntry) => submitBooking({
      name: p.name, phone: member ? (memberProfile?.phone ?? '') : guestPhone, gender: p.gender || undefined, birthDate: p.birthDate, zodiac: p.zodiac, address: p.address || undefined, contactLabel: p.contactLabel,
      bookingDate: selectedSession.sessionDate, bookingTime: selectedSession.sessionTime, sessionId: selectedSessionId, type: p.type, notes: p.notes || undefined,
    }));
    // 無論成敗都刷新名額顯示
    getBookingCountsBySession().then(setSessionCounts).catch(() => {});
    if (ok < bookingPersons.length) {
      if (ok > 0) { setBookingPersons(prev => prev.slice(ok)); alertPartialFailure(ok); }
      setBookingStatus('error');
      return;
    }
    if (member) {
      autoSaveContactsForMember(bookingPersons, memberProfile?.phone ?? '', new Set(memberContacts.map(c => c.name)))
        .then(() => loadMemberContacts()).catch(() => {});
    }
    setBookingStatus('success');
    setBookingPersons([{ id: newId(), ...selfWithBirth, type: ConsultationType.CAREER, contactLabel: '本人' }]);
  };

  // ── 捐獻送出（批次） ──
  const handleDonationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = donationPersons.find(p => !p.name.trim() || p.amount <= 0);
    if (invalid) { alert('請填寫所有人員的姓名與捐款金額。'); return; }
    if (!requireMemberPhone()) return;
    setDonationStatus('loading');
    const ok = await submitSequentially(donationPersons, (p: DonationPersonEntry) => {
      const proj = repairProjects.find(r => r.id === p.repairProjectId);
      return submitDonation({
        name: p.name, phone: member ? (memberProfile?.phone ?? '') : guestPhone,
        gender: p.gender || undefined, address: p.address || undefined,
        contactLabel: p.contactLabel, amount: p.amount, type: p.type, notes: donationNotes,
        repairProjectId:   proj?.id,
        repairProjectName: proj?.name,
      });
    });
    if (ok < donationPersons.length) {
      if (ok > 0) { setDonationPersons(prev => prev.slice(ok)); alertPartialFailure(ok); }
      setDonationStatus('error');
      return;
    }
    setDonationStatus('success');
    setDonationPersons([{ id: newId(), ...selfDefaults, amount: 0, type: DonationType.GENERAL, contactLabel: '本人' }]);
    setDonationNotes('');
  };

  // ── 祈福送出 ──
  const handleBlessingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blessingModal) return;
    const invalid = blessingPersons.find(p => !p.name.trim());
    if (invalid) { alert('請填寫所有人員的姓名'); return; }
    const hasPackages = blessingModal.packages && blessingModal.packages.length > 0;
    if (hasPackages && blessingPersons.some(p => !p.packageId)) {
      alert('請為每位報名者選擇護持方案');
      return;
    }
    if (!requireMemberPhone()) return;
    setBlessingStatus('loading');
    // 加購金額已包含在報名記錄的 selected_addons 內，後台應收管理會直接計算；
    // 不再另寫一筆捐獻記錄，避免同一筆金額重複入帳。
    const ok = await submitSequentially(blessingPersons, (p: BlessingPersonEntry) => {
      const pkg = hasPackages ? blessingModal.packages.find(pk => pk.id === p.packageId) : undefined;
      const eventAddons = blessingModal.addons || [];
      const selectedAddons: BlessingAddon[] = [
        // 固定品項：勾選即加入
        ...eventAddons.filter(a => !a.voluntary && (p.selectedAddonIds || []).includes(a.id)),
        // 隨喜品項：有金額（≥1）才加入，fee 用自填值
        ...eventAddons
          .filter(a => a.voluntary && (p.voluntaryFees?.[a.id] ?? 0) >= 1)
          .map(a => ({ ...a, fee: p.voluntaryFees![a.id] })),
      ];
      const claimedOfferings = (blessingModal.offerings || [])
        .filter(o => (p.claimedOfferingIds || []).includes(o.id))
        .map(o => ({ id: o.id, name: o.name }));
      return createBlessingRegistration({
        eventId: blessingModal.id,
        name: p.name.trim(),
        phone: member ? (memberProfile?.phone ?? '') : guestPhone,
        birthDate: p.birthDate || undefined,
        zodiac: p.zodiac,
        gender: p.gender || undefined,
        address: p.address || undefined,
        notes: blessingNotes || undefined,
        packageName: pkg?.name,
        packageFee:  pkg?.fee,
        selectedAddons:   selectedAddons.length   > 0 ? selectedAddons   : undefined,
        claimedOfferings: claimedOfferings.length > 0 ? claimedOfferings : undefined,
      } as BlessingRegistrationData);
    });
    if (ok < blessingPersons.length) {
      if (ok > 0) { setBlessingPersons(prev => prev.slice(ok)); alertPartialFailure(ok); }
      setBlessingStatus('error');
      return;
    }
    if (member) {
      autoSaveContactsForMember(blessingPersons, memberProfile?.phone ?? '', new Set(memberContacts.map(c => c.name)))
        .then(() => loadMemberContacts()).catch(() => {});
    }
    setBlessingStatus('success');
    setBlessingPersons([{ id: newId(), ...selfWithBirth, contactLabel: '本人' }]);
    setBlessingNotes('');
  };

  const [eventStats, setEventStats] = useState<{ packageCounts: Record<string, number>; offeringCounts: Record<string, number> }>({ packageCounts: {}, offeringCounts: {} });

  const openBlessingModal = (event: BlessingEventRecord) => {
    setBlessingModal(event);
    setBlessingPersons([{ id: newId(), ...selfWithBirth, contactLabel: '本人' }]);
    setBlessingNotes('');
    setBlessingStatus('idle');
    // 抓取此活動的報名統計（只有數字、不含個資），用於計算方案／供品剩餘名額
    getBlessingEventStats(event.id).then(setEventStats).catch(() => setEventStats({ packageCounts: {}, offeringCounts: {} }));
  };

  /**
   * 平滑捲到某個元素，並在捲動期間鎖住捲動高亮。
   * 鎖的長度依距離估算（Chrome 的平滑捲動距離越遠花越久），寧可多鎖一點：
   * 鎖太短會讓中途的捲動事件把高亮改掉，鎖太長只是高亮晚幾百毫秒才跟著使用者的捲動走。
   */
  const smoothScrollToEl = (el: HTMLElement) => {
    const dist = Math.abs(el.getBoundingClientRect().top);
    navLockRef.current = performance.now() + Math.min(1400, 500 + dist * 0.25);
    el.scrollIntoView({ behavior: 'smooth' });
  };

  /** 切換到獨立分頁（預約問事／祈福點燈／祈福活動／神尊修復），或回首頁 */
  const goToPage = (target: SitePage) => {
    setPage(target);
    setActiveSection(target === 'home' ? 'home' : target);
    setIsMenuOpen(false);
    setMoreOpen(false);
    // 換頁要直接跳到頂端。CSS 設了 scroll-behavior: smooth，不指定 instant 的話
    // 會變成「內容已經換成新頁、畫面才慢慢滑上去」，而且滑動途中的捲動事件
    // 會把導覽高亮改掉（見 navLockRef）。
    navLockRef.current = performance.now() + 500;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    const path = target === 'home' ? '/' : PAGE_PATHS[target];
    if (stripSlash(window.location.pathname) !== stripSlash(path)) {
      // withKeptParams 會保留 ?share= / ?preview=1 / ?admin=1，只洗掉 utm_*。
      // 原本推的是純路徑，所以揪團連結進站後點一下導覽，?share= 就消失了。
      window.history.pushState({ page: target }, '', withKeptParams(path));
    }
  };

  /**
   * 捲到首頁上的某個區塊。若目前在獨立分頁，先切回首頁——
   * 區塊此刻還沒掛上 DOM，所以把目標記在 ref，等 page 變成 home 後的 effect 再捲。
   */
  const scrollToSection = (id: string) => {
    setIsMenuOpen(false);
    setMoreOpen(false);
    if (page !== 'home') {
      pendingScrollRef.current = id;
      goToPage('home');
      setActiveSection(id);
      return;
    }
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) smoothScrollToEl(element);
  };

  /** 導覽項目統一入口：分頁走 goToPage，區塊走 scrollToSection */
  const navTo = (item: NavItem) => {
    if (item.kind === 'page') goToPage(item.id as SitePage);
    else scrollToSection(item.id);
  };

  // 切回首頁後補捲到目標區塊（此時區塊才真的存在）
  useEffect(() => {
    if (page !== 'home' || !pendingScrollRef.current) return;
    const id = pendingScrollRef.current;
    pendingScrollRef.current = null;
    const el = document.getElementById(id);
    if (el) smoothScrollToEl(el);
  }, [page]);

  // 瀏覽器上一頁／下一頁要能在分頁之間正確切換
  useEffect(() => {
    const onPopPage = () => {
      const next = pageFromPath();
      setPage(next);
      setActiveSection(next === 'home' ? 'home' : next);
    };
    window.addEventListener('popstate', onPopPage);
    return () => window.removeEventListener('popstate', onPopPage);
  }, []);

  // ── 共享報名表 handlers ──
  const handleCreateSharedSession = async (type: SharedServiceType) => {
    setCreatingShare(true);
    // 主揪必須是會員：換裝置才找得回未送出的表，也才有「誰開的」可查。
    // 被揪的人不受影響，他們不必登入（見 supabase.ts 的說明）。
    if (!member) { setShowMemberPortal(true); return; }
    try {
      let config: SharedSessionConfig = {};
      if (type === 'blessing' && blessingModal)
        config = { eventId: blessingModal.id, eventTitle: blessingModal.title, fee: blessingModal.fee };
      else if (type === 'booking') {
        const sess = bookingSessions.find(s => s.id === selectedSessionId);
        config = { bookingDate: sess?.sessionDate ?? '', bookingTime: sess?.sessionTime ?? '' };
      }

      const session = await createSharedSession({ serviceType: type, config });
      setSharedSession(session);
      setIsCreator(true);
      localStorage.setItem(`shared_creator_${session.id}`, 'true');
      // 另外記進清單：只有 per-id 旗標的話，主揪一離開這個網址就再也找不到這張表
      rememberMyShared({ id: session.id, serviceType: type, path: window.location.pathname, createdAt: session.createdAt });
      setMyPending(prev => prev.filter(x => x.session.id !== session.id));
      // 從 withKeptParams 起手而不是 location.href：這個網址會停在網址列上，
      // 建立者若直接複製網址列轉傳，會把自己的 utm_* 一起傳給親友，
      // 親友的報名就被算成建立者的來源。（複製鈕給的 sharedSessionUrl 本來就乾淨）
      const url = new URL(withKeptParams(window.location.pathname), window.location.origin);
      url.searchParams.set('share', session.id);
      window.history.pushState({}, '', url.toString());
      setShowShareModal(true);
    } catch { alert('建立共享報名表失敗'); }
    finally { setCreatingShare(false); }
  };

  const handleAddSharedEntries = async (entries: Omit<SharedEntryData, 'sessionId'>[]) => {
    if (!sharedSession) return;
    await Promise.all(entries.map(e => addSharedEntry({ sessionId: sharedSession.id, ...e })));
    const updated = await getSharedSession(sharedSession.id);
    if (updated) setSharedSession(updated);
  };

  const handleSubmitSharedSession = async () => {
    if (!sharedSession || sharedSession.entries.length === 0) return;
    setSharedSubmitStatus('loading');
    try {
      const entries = sharedSession.entries;
      if (sharedSession.serviceType === 'lamp') {
        await Promise.all(entries.map(e => submitLampRegistration({
          serviceId:    e.serviceId ?? '',
          name:         e.name,
          phone:        e.phone ?? memberProfile?.phone ?? '',
          birthDate:    e.birthDate ?? '',
          zodiac:       e.zodiac as ZodiacSign | undefined,
          address:      e.address,
          contactLabel: e.contactLabel,
          notes:        e.notes,
        })));
      } else if (sharedSession.serviceType === 'blessing' && sharedSession.config.eventId) {
        const evt = blessingEvents.find(ev => ev.id === sharedSession.config.eventId);
        await Promise.all(entries.map(e => {
          const pkg = evt?.packages.find(p => p.id === e.packageId);
          return createBlessingRegistration({
            eventId:     sharedSession.config.eventId!,
            name:        e.name,
            phone:       e.phone ?? memberProfile?.phone ?? '',
            birthDate:   e.birthDate,
            zodiac:      e.zodiac as ZodiacSign | undefined,
            gender:      e.gender,
            address:     e.address,
            notes:       e.notes,
            packageName: pkg?.name,
            packageFee:  pkg?.fee,
          });
        }));
      } else if (sharedSession.serviceType === 'booking') {
        await Promise.all(entries.map(e => submitBooking({
          name:        e.name,
          phone:       e.phone ?? memberProfile?.phone ?? '',
          birthDate:   e.birthDate ?? '',
          zodiac:      e.zodiac as ZodiacSign | undefined,
          address:     e.address,
          contactLabel: e.contactLabel,
          bookingDate: sharedSession.config.bookingDate ?? '',
          bookingTime: sharedSession.config.bookingTime ?? '',
          type:        (e.bookingType as any) ?? '',
          notes:       e.notes,
        } as BookingData)));
      }
      await markSharedSessionSubmitted(sharedSession.id);
      forgetMyShared(sharedSession.id);
      setMyPending(prev => prev.filter(x => x.session.id !== sharedSession.id));
      setSharedSubmitStatus('success');
      const updated = await getSharedSession(sharedSession.id);
      if (updated) setSharedSession(updated);
    } catch {
      setSharedSubmitStatus('error');
    }
  };

  /**
   * 被邀請者檢視：開了 ?share= 連結、但不是建立者。
   *
   * 這種人只要「選方案 → 填自己的資料 → 加入」，其餘一律不該看到：
   *   服務介紹與方案行銷卡 —— 主揪早就決定好要辦什麼了，他只是來填名字
   *   主揪自己的登記表   —— **危險**：那張表的「送出登記」會開一筆與揪團無關的
   *                        獨立訂單，被邀請者很容易填錯那一張（廟方 2026-09-10 回報）
   * 實測改前：/lamps?share= 頁高 4221px，共享面板在 1238px，下方 3147px 起是主揪的表。
   */
  /** 這個服務底下、我開過但還沒送出的表。正在看的那一張不用再提醒 */
  const pendingSharedFor = (type: SharedServiceType) =>
    myPending.filter(r => r.session.serviceType === type && r.session.id !== sharedSession?.id);

  /** 回到某張未送出的表。整頁重載而不是改狀態：?share= 的載入流程只在進站時跑一次，
      手動同步狀態容易漏掉某一項（例如 isCreator、頁面切換），重載最不會錯 */
  const openMyShared = (meta: MySharedSession): void => {
    window.location.href = `${meta.path}?share=${meta.id}`;
  };

  /**
   * 主揪主動刪除一張共享報名表（廟方 2026-09-12 要求，原本只能等 7 天到期）。
   *
   * 一定要先警示：名單會跟著沒（ON DELETE CASCADE），而且分享出去的連結會失效——
   * 親友再點會看到「找不到這張報名表」。這兩件事都無法復原，要讓主揪看清楚再按。
   * 用 confirm() 與通訊錄刪聯絡人同一個做法，不另做一個彈窗。
   *
   * 刪完若正在看的就是這一張，整頁重載回沒有 ?share= 的網址——理由同 openMyShared，
   * 手動把 sharedSession／isCreator／網址／清單一項項清掉太容易漏。
   */
  const handleDeleteSharedSession = async (session: SharedSessionRecord): Promise<void> => {
    const n = session.entries.length;
    const ok = window.confirm(
      `確定要刪除這張揪團報名表嗎？\n\n` +
      (n > 0 ? `已加入的 ${n} 位親友資料會一起刪除，無法復原。\n` : '') +
      `分享出去的連結會失效，親友再點會看到「找不到這張報名表」。`
    );
    if (!ok) return;
    try {
      const deleted = await deleteSharedSession(session.id);
      if (!deleted) {
        // RLS 擋下（不是本人、或是沒有擁有者的舊場次）：DELETE 靜默 0 列，不會報錯
        alert(session.createdBy
          ? '只有建立這張報名表的人可以刪除。'
          : '這張是舊版建立的報名表，沒有紀錄建立者，無法手動刪除，會在到期後自動失效。');
        return;
      }
      forgetMyShared(session.id);
      setMyPending(prev => prev.filter(x => x.session.id !== session.id));
      if (sharedSession?.id === session.id) {
        window.location.href = withKeptParams(window.location.pathname, ['share']);
      }
    } catch {
      alert('刪除失敗，請稍後再試。');
    }
  };

  const isSharedGuest = (type: SharedServiceType): boolean =>
    ENABLE_GROUP_BOOKING && !!sharedSession && !isCreator && sharedSession.serviceType === type;

  const sharedSessionUrl = sharedSession
    ? `${window.location.origin}${window.location.pathname}?share=${sharedSession.id}`
    : '';

  // 後台不計入流量分析（那是內部作業，不是訪客行為）
  if (showAdmin) {
    return <Suspense fallback={<PageLoading />}><AdminDashboard onBack={() => setShowAdmin(false)} role={adminRole} /></Suspense>;
  }

  // 導覽列是否浮在深色 Hero 之上：只有首頁最頂端才是。
  // 其他分頁頂端是淺色內容，必須鋪米色底＋深色字才讀得到。
  const navOverHero = page === 'home' && !isScrolled;

  /**
   * 導覽列現在是不是「米色底」的狀態：捲過 Hero 之後是，**手機選單展開時也是**。
   *
   * **底色、文字顏色、品牌淡入一律用這一個判斷，不要各自去看 navOverHero。**
   * 各寫各的就會兜不起來：底色改成「選單展開也上色」而 X 關閉鈕還在看 navOverHero，
   * 結果是米色底配白色 X——實測對比只有 1.24:1，等於按鈕消失（2026-09-02 踩過）。
   * 品牌「和聖壇」同理，不跟著亮出來的話，展開選單時上面那條會是一片空白米色。
   */
  const navSolid = !navOverHero || isMenuOpen;

  // LINE 浮動鈕只在首頁的 Hero 期間收起來；其他分頁沒有 Hero，一進來就顯示。
  const hideLineFloat = page === 'home' && !pastHero;

  // 追蹤用的「目前頁面」。報名表與聖母經現在各有網址（/fahui、/scripture），
  // 但它們是 state 不是 PAGE_PATHS 的一員，所以仍要在這裡明確對應。
  const analyticsPath =
    showScripture ? '/scripture'
    : showVolunteer ? '/volunteer'
    : showFahui ? '/fahui'
    : page === 'home' ? '/'
    : PAGE_PATHS[page];

  if (showScripture) {
    return (<>
      <Analytics path={analyticsPath} />
      <Suspense fallback={<PageLoading />}><ScripturePage onBack={closeScripture} /></Suspense>
    </>);
  }

  if (showVolunteer) {
    return (<>
      <Analytics path={analyticsPath} />
      <Suspense fallback={<PageLoading />}><VolunteerRegistration prefill={volunteerPrefill} onBack={closeVolunteer} open={VOLUNTEER_OPEN} /></Suspense>
    </>);
  }

  if (showFahui) {
    return (<>
      <Analytics path={analyticsPath} />
      <Suspense fallback={<PageLoading />}>
        {/* 停止收件時不傳 onVolunteer，成功頁的「我要報名志工」整顆按鈕就不出現 */}
        <FahuiRegistration onBack={closeFahui} onVolunteer={VOLUNTEER_OPEN ? (contact) => openVolunteer(contact) : undefined} />
      </Suspense>
    </>);
  }

  return (
    <div className="min-h-screen flex flex-col text-temple-dark selection:bg-temple-red selection:text-white">
      <Analytics path={analyticsPath} />
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[200] -translate-y-20 rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#7C5C1E] shadow-xl transition-transform focus:translate-y-0"
      >
        跳至主要內容
      </a>
      {/* Navigation */}
      {/* 導覽列底色用 inline style：本專案的 Tailwind CDN 不會產生 bg-[#F0E9CE] 這種任意色 class
          （實測 computed 是 transparent），原本一直靠 Hero 亮照片才看得清楚。
          Hero 改成深色底後，深棕選單字直接消失，所以在首頁頂端改為淺色字＋透明底，
          捲動後或在其他分頁才鋪米色底。 */}
      <nav
        className={`fixed w-full z-50 transition-all duration-300 border-b ${
          // 首頁頂端不畫下緣細線：標題穿過導覽列高度，有線會從字上橫切過去。
          //
          // **`border-b` 要一直掛著，只換顏色，不要靠加減 class 來決定有沒有線。**
          // Tailwind 的 preflight 把所有元素的預設邊框色設成 gray-200（rgb(229,231,235)）。
          // 若改用切換 `border-b` 的寫法，class 一移除顏色會立刻跳回那個灰白色，
          // 而 `transition-all` 讓寬度花 300ms 從 1px 縮到 0——這 300ms 就是一條很明顯的白線
          // （廟方回報「往下滑導覽列下緣會出現一條白線」）。維持寬度、只讓顏色在
          // 透明與金色之間過渡，就沒有中間狀態可言。
          navSolid ? 'backdrop-blur-md shadow-md border-[#C49820]/50' : 'border-transparent'
        }`}
        // 選單展開時一律給底色：不給的話上面那條（宮壇名＋關閉鈕）還停在透明狀態，
        // 跟下方的米色面板斷成兩截，而且那兩個元素自己也疊在金箔與神尊上。
        style={{ backgroundColor: navSolid ? 'rgba(240, 233, 206, 0.97)' : 'transparent' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex items-center justify-between transition-all duration-300 ${isScrolled ? 'h-16' : 'h-20'}`}>
            {/* Hero 頂端已有直式壇名，所以導覽列先隱藏品牌；往下滑進入米色選單後，
                左側淡入同款宋體「和聖壇」。保留固定寬度能避免淡入時右側選單跳動。 */}
            <button
              type="button"
              onClick={() => navTo({ id: 'home', label: '首頁', kind: 'section' })}
              aria-hidden={!navSolid}
              tabIndex={navSolid ? 0 : -1}
              className={`shrink-0 font-serif font-bold text-xl sm:text-2xl tracking-[0.25em] text-[#3D2800]
                transition-all duration-300 hover:text-[#7C5C1E] focus-visible:text-[#7C5C1E]
                ${navSolid ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
            >
              和聖壇
            </button>

            <div className="hidden lg:flex items-center gap-1">
              {NAV_PRIMARY.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navTo(item)}
                  className={`relative px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 font-serif whitespace-nowrap
                    ${activeSection === item.id
                      ? (navSolid ? 'bg-temple-gold/15 text-temple-red font-semibold' : 'bg-white/15 text-white font-semibold')
                      : (navSolid ? 'text-[#3D2800] hover:bg-[#C49820]/10 hover:text-temple-red' : 'text-white/90 hover:bg-white/10 hover:text-white')}`}
                >
                  {item.label}
                  {activeSection === item.id && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-temple-gold rounded-full" />
                  )}
                </button>
              ))}

              {/* 「更多」收納次要項目。用 onBlur 關閉而非全域監聽：
                  容器有 tabIndex，focus 離開整個群組（含子按鈕）時才收合，
                  點選單內的項目不會因為先失焦而讓 onClick 落空。 */}
              <div
                className="relative"
                tabIndex={-1}
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setMoreOpen(false); }}
              >
                <button
                  onClick={() => setMoreOpen(o => !o)}
                  aria-expanded={moreOpen}
                  aria-haspopup="true"
                  className={`relative flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 font-serif whitespace-nowrap
                    ${NAV_MORE.some(m => m.id === activeSection) || moreOpen
                      ? (navSolid ? 'bg-temple-gold/15 text-temple-red font-semibold' : 'bg-white/15 text-white font-semibold')
                      : (navSolid ? 'text-[#3D2800] hover:bg-[#C49820]/10 hover:text-temple-red' : 'text-white/90 hover:bg-white/10 hover:text-white')}`}
                >
                  更多
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`} />
                </button>
                {moreOpen && (
                  <div className="absolute right-0 top-full mt-2 w-44 bg-[#F0E9CE] rounded-xl shadow-lg border border-[#C49820]/40 py-1.5 overflow-hidden">
                    {/* 天上聖母經放在下拉「最上面」而不是最下面。
                        這是經典內容不是服務項目，廟方要凸顯它；擺在分隔線下方等於
                        被當成附屬品。用金底＋襯線字與下面那些純文字連結區隔開，
                        才不會看起來只是「又一個選項」。
                        **不要沿用「目前所在頁」那組 bg-temple-gold/15 + text-temple-red**：
                        一來金底在這裡本來代表「你在這裡」，語意會打架；二來那組實測只有
                        4.54:1，比旁邊的純文字項目（11.49:1）還難讀——「凸顯」的那一項
                        反而最看不清楚。改用更濃的金底配深字。
                        為什麼不提到最外層那排：實測 1024px 時導覽列已經超出 4px，
                        再加一個項目一定擠爆——要提上去得先拿掉一個現有項目。 */}
                    <button
                      onClick={() => { openScripture(); setMoreOpen(false); }}
                      className="block w-full text-left px-4 py-3 text-sm font-serif font-bold text-[#3D2800] bg-temple-gold/30 border-l-2 border-temple-gold hover:bg-temple-gold/40 transition-colors"
                    >
                      天上聖母經
                    </button>
                    <div className="h-px bg-[#C49820]/30 my-1.5 mx-3" />
                    {NAV_MORE.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => navTo(item)}
                        className={`block w-full text-left px-4 py-2.5 text-sm font-serif transition-colors
                          ${activeSection === item.id
                            ? 'bg-temple-gold/15 text-temple-red font-semibold'
                            : 'text-[#3D2800] hover:bg-[#C49820]/15 hover:text-temple-red'}`}
                      >
                        {item.label}
                      </button>
                    ))}

                  </div>
                )}
              </div>

              {/*
                社群圖示。後台留空的平台不會渲染（visibleSocials），所以這裡的數量
                會隨設定變動——不要假設固定幾個而寫死寬度。
                LINE 雖然左下角已有浮動鈕，仍然列出：那顆在首頁 Hero 期間是隱藏的，
                導覽列這組剛好補上那段空窗。
              */}
              <div className="flex items-center gap-0.5">
                {visibleSocials(social).map(({ key, label, url, Icon }) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={key === 'lineUrl' ? () => trackLine('nav') : undefined}
                    aria-label={label}
                    title={label}
                    className={`p-2 rounded-full transition-colors ${
                      navSolid
                        ? 'text-[#7C5C1E] hover:text-temple-red hover:bg-temple-gold/15'
                        : 'text-white/85 hover:text-white hover:bg-white/15'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                  </a>
                ))}
              </div>

              <div className={`w-px h-6 mx-1 ${navSolid ? 'bg-[#3D2800]/20' : 'bg-white/25'}`} />
              {/*
                會員入口降級成外框鈕。原本是紅底實心的大按鈕，視覺權重高過「預約問事」
                這種真正想推的動作——但它不能拿掉：登入後這裡是「會員中心」，
                裡面有報名紀錄與親友通訊錄，而其他登入入口全部藏在表單內部，
                拿掉的話已註冊的信眾得先假裝要報名才找得到自己的紀錄。
              */}
              <button
                onClick={() => setShowMemberPortal(true)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition-colors ${
                  navSolid
                    ? 'border-temple-gold/70 text-[#7C5C1E] hover:bg-temple-gold/10 hover:border-temple-gold'
                    : 'border-white/40 text-white hover:bg-white/10'
                }`}
              >
                <UserIcon className="w-4 h-4" aria-hidden="true" />
                {member ? '會員中心' : '登入'}
              </button>
            </div>

            <div className="-mr-2 flex lg:hidden">
              <button
                onClick={toggleMenu}
                aria-label={isMenuOpen ? '關閉導覽選單' : '開啟導覽選單'}
                aria-expanded={isMenuOpen}
                aria-controls="mobile-navigation"
                className={`inline-flex items-center justify-center p-2 rounded-full transition-colors ${
                  navSolid ? 'text-temple-red hover:text-temple-dark hover:bg-[#C49820]/10' : 'text-white hover:bg-white/10'
                }`}
              >
                {isMenuOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {/* 展開高度改用 vh 並允許內部捲動：項目增加後實際高度已達 600px，
            原本固定的 max-h-[500px] 會把最後幾項（聖母經、會員登入）裁掉。 */}
        <div id="mobile-navigation" className={`lg:hidden overflow-hidden transition-all duration-300 ${isMenuOpen ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0'}`}>
          {/* 底色用 inline style 而不是 Tailwind class。
              原本寫 `bg-[#F0E9CE]/98`——**那個 class 產不出來**：Tailwind 的不透明度
              級距沒有 98，整條規則被丟掉，面板只剩 backdrop-blur，變成沒有底色的
              純毛玻璃。疊在 Hero 的金箔與神尊上，選單文字幾乎看不見
              （廟方回報「玻璃霧面透明、看不清楚 menu 的內容」）。
              最惡劣的是它不會報錯，class 明明寫著顏色卻完全沒作用。
              **任意色配不透明度時，值必須落在 Tailwind 的級距上**（…90、95、100），
              要用 98 這種數字就得寫 `/[0.98]`，或像這裡直接給 inline style——
              與導覽列本體同一種寫法，兩者顏色也保證一致。 */}
          <div
            className="backdrop-blur-md border-t border-[#C49820]/30 px-4 pt-2 pb-4 space-y-1 max-h-[80vh] overflow-y-auto"
            style={{ backgroundColor: 'rgba(240, 233, 206, 0.97)' }}
          >
            {/*
              社群：對應桌機導覽列右側的位置。放在選單最上方（廟方指定）。
              圖示做成 44px 的方塊（比 WCAG 的 24px 寬鬆）：手機選單是拇指操作，
              而且這幾個圖示彼此相鄰，太小容易點錯隔壁那個。
            */}
            {/* 社群與會員中心同一排（廟方要求）。
                兩者都是「工具」，導覽項目是另一回事——桌機導覽列右上角也是這樣排。

                **用 flex-wrap 而不是硬擠成一排**：4 個 44px 圖示＋間距約 200px、
                會員膠囊約 112px，合計約 320px。375 的手機可用寬 343px 塞得下，
                但 320px 的舊機型會溢出。wrap 讓它塞得下就一排、塞不下自動折兩排，
                不必為了排版把觸控範圍縮小。
                圖示維持 44px（WCAG 最小 24px，這裡放寬到 44）：手機選單是拇指操作，
                而且圖示彼此相鄰，太小容易點錯隔壁那個。

                **整排不要放進「有社群才渲染」的條件式**：後台把社群清空時
                visibleSocials 回傳空陣列，會員入口不能跟著消失；
                這一排至少還有會員鈕，不會變成空的。 */}
            <div className="flex flex-wrap items-center justify-center gap-2 pb-1">
              {visibleSocials(social).map(({ key, label, url, Icon }) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { if (key === 'lineUrl') trackLine('mobile-menu'); setIsMenuOpen(false); }}
                  aria-label={label}
                  className="w-11 h-11 flex items-center justify-center rounded-full text-[#7C5C1E] border border-[#C49820]/40 hover:bg-[#C49820]/15 hover:text-temple-red transition-colors"
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
              {/* 高度對齊 44px 的圖示，同一排才不會高低不齊 */}
              <button
                onClick={() => { setShowMemberPortal(true); setIsMenuOpen(false); }}
                className="h-11 inline-flex items-center gap-2 px-4 rounded-full text-sm font-medium text-[#7C5C1E] border border-temple-gold/60 hover:bg-temple-gold/15 hover:border-temple-gold transition-colors"
              >
                <UserIcon className="w-4 h-4" aria-hidden="true" />
                {member ? '會員中心' : '會員登入'}
              </button>
            </div>
            <div className="h-px bg-[#C49820]/30 my-2 mx-4" />
            {/* 天上聖母經放在選單「最上方」（社群之下、導覽項目之上）。
                這是經典內容不是服務項目，廟方要凸顯它；原本擺在最底下、
                還被 max-h 裁掉過（見上方註解），等於藏起來。
                金底＋左側金條＋襯線字，與下面那排純文字項目明顯分開。 */}
            <button
              onClick={() => { openScripture(); setIsMenuOpen(false); }}
              className="block w-full text-left px-4 py-3.5 rounded-lg text-base font-serif font-bold text-[#3D2800] bg-temple-gold/30 border-l-4 border-temple-gold hover:bg-temple-gold/40 transition-colors"
            >
              天上聖母經
            </button>
            <div className="h-px bg-[#C49820]/30 my-2 mx-4" />
            {NAV_PRIMARY.map((item) => (
              <button
                key={item.id}
                onClick={() => navTo(item)}
                className={`block w-full text-left px-4 py-3 rounded-lg text-base font-medium transition-all duration-200
                  ${activeSection === item.id
                    ? 'bg-temple-gold/15 text-temple-red font-semibold'
                    : 'text-[#3D2800] hover:bg-[#C49820]/10 hover:text-temple-red'}`}
              >
                {item.label}
              </button>
            ))}
            {/* 手機選單本來就是直的、有空間，次要項目用分隔線區隔即可，
                不必再套一層下拉——多一層點擊只是增加操作成本。 */}
            <div className="h-px bg-[#C49820]/30 my-2 mx-4" />
            {NAV_MORE.map((item) => (
              <button
                key={item.id}
                onClick={() => navTo(item)}
                className={`block w-full text-left px-4 py-3 rounded-lg text-base font-medium transition-all duration-200
                  ${activeSection === item.id
                    ? 'bg-temple-gold/15 text-temple-red font-semibold'
                    : 'text-[#3D2800]/80 hover:bg-[#C49820]/10 hover:text-temple-red'}`}
              >
                {item.label}
              </button>
            ))}


          </div>
        </div>
      </nav>

      {/* ── 首頁內容（四項服務已各自獨立成頁，見下方 page === '…' 的區塊）── */}
      {page === 'home' && (<>
      {/* Hero Section */}
      <section id="home" className="hero-scene relative min-h-[100svh] flex items-center justify-center overflow-hidden">
        <span id="main-content" className="sr-only">主要內容</span>
        {/* 背景：由 HERO_VARIANTS 決定（正式站金箔牆，?hero=blue 換藍金流體畫）。
            底圖與翻面層必須像素對齊，所以兩張都交給元件，不在這裡各放一張。
            滿版沒有主體，任何方向裁切都成立，一律置中。
            注意排序：反光層必須在下面那道深色遮罩「之前」，
            否則翻面帶在被壓暗的頂部會比周圍亮，邊界接不起來。
            更早的金色祥雲織錦是 /hero-clouds.jpg（tone="silk"），檔案留著。 */}
        <SilkSheen src={heroSrc(HERO.file)} tone={HERO.tone} className="absolute inset-0 z-0 overflow-hidden" />
        {/* 深色遮罩只壓在「有字的地方」，而且只壓上緣：
            底圖很亮，白色的導覽列與「和聖壇」疊上去對比不足；但整片壓暗就把顏色壓濁了。
            所以上緣壓到能讀（約 30% 高度內收乾淨），中段以下完全不壓——
            按鈕是深藍底金字，本來就是深壓淺，不需要遮罩幫忙。
            這道遮罩兩個底圖共用。藍金版實測 1440×900：最暗 17.6:1，壓在右上白金
            大理石那片的「祈福點燈／更多／登入」5.75:1（AA 要求 4.5:1）。
            換底圖時要重量導覽列最右邊那幾項，別只看整體亮不亮。 */}
        <div
          className="absolute inset-0 z-0"
          style={{
            // 用純黑而不是有色的遮罩來壓暗：帶色的疊上去會把底圖的色相拉走
            // （褐色疊在金上會變橄欖綠），黑色是等比降低三個通道，色相不變。
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.32) 12%, rgba(0,0,0,0.10) 24%, rgba(0,0,0,0) 36%, rgba(0,0,0,0) 100%)',
          }}
        />

        {/* 一炷清香：只有煙、沒有香枝，發射點壓在畫面底緣之下。
            粒子持續生成消散，所以沒有「循環播放」的接縫（作法見元件內的說明）。 */}
        <IncenseSmoke />

        {/* 宮壇名：左上角直式書寫，直接穿過導覽列的高度。
            導覽列左側已清空（無 logo 與全名），首頁頂端又是透明底，所以疊得上去。
            z-20 必須低於導覽列的 z-50：往下捲時導覽列轉成米色不透明，
            標題會自然滑進去被蓋掉；若把標題疊在導覽列之上，捲動時會看到字壓在色塊上。 */}
        <h1
          className="hero-title absolute top-4 sm:top-6 left-5 sm:left-10 z-20 text-white font-serif font-bold
                     text-4xl sm:text-6xl tracking-[0.25em] drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]
                     [writing-mode:vertical-rl] [text-orientation:upright]"
        >
          和聖壇
        </h1>

        {/* Hero 前景：行動按鈕與三尊神明放在同一個 flex 容器裡，讓瀏覽器自己算避讓。
            神明的寬度是由 vh 高度推出來的，用 vw 寫死按鈕位置在平板尺寸會夾在
            兩者之間、兩邊都撞到；交給 flex 就不必猜。
            **切換用 `land:` 而不是 `sm:`**（＝寬度 ≥640px 且視窗是橫的，定義見
            tailwind.config.cjs）。用寬度切會讓所有 iPad 直立的按鈕被推出畫面左緣：
            神明欄寬度由 min(98vh, 107.8vw) 推出，直立時算出來比視窗還寬，而它是
            shrink-0、按鈕欄是 flex-1。實測 820×1180 被裁 144px（按鈕全寬 223px）。
            直排（含所有直立平板）：神明在上、按鈕在下，兩者都水平置中。
                          直排時 items-* 控制的是水平對齊，所以置中要寫 items-center。
            橫排：神明佔右側自然寬度，按鈕落在左側、與宮壇名同一條左邊界（pl-10 對齊
                          標題的 left-10），形成「左上宮壇名 → 左下按鈕 → 右側神明」的三角。
                          橫排時 items-* 變成垂直對齊，改回 items-end 讓神明貼齊底部。
                          LINE 浮動鈕在 Hero 期間收起，所以按鈕可以直接沉到底部，不必再上抬。 */}
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-end items-center land:flex-row land:items-end">
          {/* 直排原本是為了讓「傾斜提示」疊在報名鈕正上方。那顆提示鈕已移除
              （陀螺儀效果 2026-09-02 下架），版面保持不變：只有一個子元素時
              flex-col 的呈現與原本相同，之後要再加東西也還有位置。 */}
          {/* 收件結束時整欄不渲染，而不是渲染一個空的 div——空的 div 仍然吃掉
              sm:flex-1 的那一半寬度，神明會被擠到只剩右半邊。 */}
          {FAHUI_SIGNUP_OPEN && (
            <div className="hero-actions order-2 land:order-none w-full land:w-auto land:flex-1 flex flex-col items-center gap-3 land:items-start pb-8 land:pb-0 land:pl-10 land:mb-16">
              <button
                onClick={openFahui}
                // 配色見 index.html 的 .btn-sutra：龍藏經的磁青底＋泥金字＋雙金界欄。
                // 先前的金底按鈕與 Hero 的金色織錦同色系，等於埋進背景。
                className="hero-primary btn-sutra pointer-events-auto px-10 py-4 font-bold transition-all transform hover:scale-105 flex items-center justify-center gap-2 text-lg tracking-wider whitespace-nowrap"
              >
                <ClipboardList className="w-5 h-5" />
                報名普渡法會
              </button>
            </div>
          )}

          {/* 三尊神明：彼此底部對齊，像同壇並列。陣列順序＝畫面由左到右。
              手機用 order-1 排到按鈕上方；桌機回到 DOM 順序，落在按鈕右側。
              留空陣列則整區不渲染，按鈕會自動回到整個 Hero 的水平中央。 */}
          {HERO_DEITIES.length > 0 && (
            /* 每尊各自往下沉多少寫在 HERO_DEITIES 的 drop，不再由這一層統一控制——
               階梯感就是靠三個不同的沉沒量做出來的。
               桌機沉出去的部分由 Hero 的 overflow-hidden 裁掉；
               手機的神明上方還有按鈕在下面，所以這一層自己 overflow-hidden＋固定高度，
               否則沉下去的部分會壓到報名鈕。 */
            <div className="hero-deity-stage order-1 land:order-none shrink-0 w-full h-[121vw] max-h-[64vh] overflow-hidden land:w-auto land:h-auto land:max-h-none land:overflow-visible flex items-end justify-center land:justify-start land:pr-6 mb-4 land:mb-0">
              <div className="hero-aura" aria-hidden="true" />
              {HERO_DEITIES.slice(0, 3).map((d, i) => (
                // 以「高」為主、「寬」只是防呆上限：神像是直式，高度決定氣勢。
                // 負左邊距讓三尊彼此交疊，像同壇並列而不是三張圖並排。
                // <picture>：WebP 省一半流量，舊 Safari 退回調色盤 PNG，兩者只會下載其中一個。
                <picture
                  key={d.src}
                  className={`hero-deity hero-deity-${i + 1} ${d.drop} ${d.layer} ${d.gap ?? ''}`}
                >
                  <source srcSet={d.src} type="image/webp" />
                  <img
                    src={d.fallback}
                    alt={d.name}
                    // 三尊都在首屏，一律 eager：lazy 會讓後兩尊晚一拍才浮出來，
                    // 看起來像破圖補上去的。只有優先權分高低，讓主角那尊先到。
                    loading="eager"
                    decoding="async"
                    fetchPriority={d.priority ? 'high' : 'auto'}
                    className={`w-auto object-contain object-bottom drop-shadow-2xl ${d.size}`}
                  />
                </picture>
              ))}
            </div>
          )}
        </div>

        {/* Hero 左側的社群圖示列已移除（畫面留給三尊神明）。
            社群連結仍在頁尾，由後台「社群帳號設定」控制。 */}

        {/* 輪播圓點已隨輪播照片一起移除 */}

        {/* 底部的倒三角切角已移除，改成平的收邊：
            用一道極短的漸層讓織錦自然過渡到下一段的米白，不做幾何造型。 */}
        <div
          className="hero-bottom-fade absolute bottom-0 inset-x-0 pointer-events-none"
          style={{ '--hero-fade-rgb': HERO_FADE_RGB } as React.CSSProperties}
        />
      </section>

{/* Bulletin Section (公佈欄)。ENABLE_BULLETIN 關閉時整區不渲染 */}
      {ENABLE_BULLETIN && (
      <section id="bulletin" className="py-20 bg-white relative overflow-hidden">
        {/* 龍在鳳之上——這是首頁 Hero 之後的第一個區塊 */}
        <PatternMedallion motif="dragon" side="r" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="sr sr-up text-center mb-12">
            <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center justify-center gap-3">
              <span className="w-8 h-1 bg-temple-gold" />
              壇務公告
              <span className="w-8 h-1 bg-temple-gold" />
            </h2>
            <h3 className="text-4xl font-bold text-temple-dark font-serif">最新活動</h3>
            <div className="flex items-center justify-center gap-3 mt-3 mb-2">
              <span className="w-12 h-px bg-temple-gold/70" />
              <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
              <span className="w-12 h-px bg-temple-gold/70" />
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {['all', ...Object.values(BulletinCategory)].map((cat) => (
              <button
                key={cat}
                onClick={() => setBulletinFilter(cat)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  bulletinFilter === cat
                    ? 'bg-temple-red text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat === 'all' ? '全部' : cat}
              </button>
            ))}
          </div>

          {/* Bulletin List */}
          {filteredBulletins.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">目前沒有公告</p>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {filteredBulletins.map((bulletin, bi) => (
                // 進場包在外層：卡片本身有 transition-all（Tailwind CDN 排在自訂樣式之後），
                // 直接把 .sr 掛在卡片上會被它的 150ms 覆蓋掉，變成快閃而不是緩緩浮起。
                // 逐張錯開延遲，才有「一張一張進來」的節奏，而不是整列一起閃。
                <div key={bulletin.id} className={`sr sr-up ${['', 'sr-d1', 'sr-d2', 'sr-d3'][Math.min(bi, 3)]}`}>
                <div
                  className={`bg-temple-bg rounded-xl p-6 shadow-sm hover:shadow-md transition-all border-l-4 ${
                    bulletin.isPinned ? 'border-temple-gold' : 'border-temple-red/30'
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={expandedBulletin === bulletin.id}
                    aria-controls={`bulletin-${bulletin.id}`}
                    className="w-full flex items-start justify-between text-left cursor-pointer"
                    onClick={() => setExpandedBulletin(expandedBulletin === bulletin.id ? null : bulletin.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {bulletin.isPinned && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${TAG_PINNED}`}>
                            <Pin className="w-3 h-3" aria-hidden="true" /> 置頂
                          </span>
                        )}
                        <span className={`px-3 py-0.5 rounded-full text-xs font-medium ${TAG_CATEGORY}`}>
                          {bulletin.category}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {new Date(bulletin.createdAt).toLocaleDateString('zh-TW')}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-temple-dark font-serif">{bulletin.title}</h4>
                    </div>
                    {/* 收合時右側放小縮圖，讓有照片的活動一眼看得出來；沒照片就只有箭頭 */}
                    <div className="ml-4 flex items-center gap-3 flex-shrink-0">
                      {bulletin.imageUrl && expandedBulletin !== bulletin.id && (
                        <img
                          src={bulletin.imageUrl}
                          alt=""
                          loading="lazy"
                          className="w-16 h-12 object-cover rounded-lg border border-temple-gold/20"
                        />
                      )}
                      <div className="text-gray-400">
                        {expandedBulletin === bulletin.id ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </button>
                  {expandedBulletin === bulletin.id && (
                    <div id={`bulletin-${bulletin.id}`} className="mt-4 pt-4 border-t border-gray-200">
                      {bulletin.imageUrl && (
                        <img
                          src={bulletin.imageUrl}
                          alt={bulletin.title}
                          loading="lazy"
                          className="w-full max-h-96 object-cover rounded-xl border border-temple-gold/20 mb-4"
                        />
                      )}
                      <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">{bulletin.content}</div>
                      {bulletin.linkedService && (() => {
                        const svcLabel: Record<string, string> = { lamp: '點燈', blessing: '祈福', booking: '問事', donation: '捐獻' };
                        // 點燈／祈福／問事已各自獨立成頁，捐獻仍是首頁上的區塊
                        const svcPage: Record<string, SitePage> = { lamp: 'lamps', blessing: 'blessing', booking: 'booking' };
                        const target = svcPage[bulletin.linkedService!];
                        return (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (target) goToPage(target);
                              else scrollToSection('donation');
                            }}
                            className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-temple-red text-white rounded-lg font-medium hover:bg-[#5C1A04] transition-colors shadow-sm"
                          >
                            前往{svcLabel[bulletin.linkedService!] ?? ''}登記 →
                          </button>
                        );
                      })()}
                    </div>
                  )}
                </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      )}

{/* About Section */}
      <section id="about" className="py-20 bg-temple-bg relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* 三層各司其職，不能疊在同一個元素上：
                外層 .sr 進場（transform 由 CSS 控制）、中層 .sr-figure 視差（transform 由 JS 每次捲動寫入）、
                內層才是照片與金框。兩個 transform 寫在同一層會互相蓋掉，效果只會剩一個。 */}
            <div className="sr sr-left">
              <div className="sr-figure">
                <div className="relative">
                  <div className="absolute -top-4 -left-4 w-full h-full border-4 border-temple-gold rounded-lg z-0"></div>
                  {aboutImageUrl ? (
                    <img
                      src={aboutImageUrl}
                      alt="和聖壇介紹"
                      className="relative z-10 rounded-lg shadow-2xl w-full h-[500px] object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    // 同尺寸佔位：還沒決定要載哪一張時先撐住高度，避免版面跳動
                    <div className="relative z-10 rounded-lg shadow-2xl w-full h-[500px] bg-temple-gold/10" aria-hidden="true" />
                  )}
                </div>
              </div>
            </div>
            {/* 文字欄反向位移：與照片相反方向、較小幅度，兩層的速度差就是視差 */}
            <div className="sr-counter">
              <h2 className="sr sr-up text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center gap-3">
                <span className="w-8 h-1 bg-temple-gold" />
                關於和聖壇
              </h2>
              {/* 標題與內文取自後台「關於我們」第一個顯示中的段落（與 /about 同一份資料）。
                  還沒載入或後台是空的時候，退回下面寫死的保底文案，不會開天窗。 */}
              <h3 className="sr sr-up sr-d1 balance-text text-3xl sm:text-4xl font-bold text-temple-dark mb-2 font-serif leading-snug">
                {aboutLead?.heading || '心中有善不畏苦；家有溫暖路有光。'}
              </h3>
              <div className="sr sr-up sr-d1 flex items-center gap-3 mt-2 mb-6">
                <span className="w-8 h-px bg-temple-gold/70" />
                <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
                <span className="w-20 h-px bg-temple-gold/70" />
              </div>
              <p className="sr sr-up sr-d2 text-gray-600 mb-8 leading-relaxed text-lg">
                {renderInline(
                  splitParagraphs(aboutLead?.body || '')[0]
                  || '和聖壇創立近四十年，秉持著天上聖母傳道的精神。我們深信，心中有善不畏苦；家有溫暖路有光。信仰不止於燒香祈福，更是落實於日常的為人處世。以信仰安頓身心，以善念引領前行，將媽祖的教誨實踐於生活之中，讓慈悲與善念一路延續。'
                )}
              </p>

              <div className="grid grid-cols-2 gap-6">
                {[[aboutFacts.fact1Value, aboutFacts.fact1Label], [aboutFacts.fact2Value, aboutFacts.fact2Label]].map(([value, label], fi) => (
                  <div key={label} className={`sr sr-up ${fi === 0 ? 'sr-d2' : 'sr-d3'} bg-white p-6 rounded-lg shadow-md border-l-4 border-temple-gold`}>
                    <span className="text-4xl font-bold text-temple-red font-serif block mb-2">{value}</span>
                    <span className="text-gray-500">{label}</span>
                  </div>
                ))}
              </div>

              {/* 首頁這段是摘要，完整沿革與照片在 /about */}
              <button
                onClick={() => goToPage('about')}
                className="mt-8 inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-temple-gold/60 text-temple-red hover:bg-temple-gold/10 transition-colors"
              >
                更多
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

{/* Deities Section */}
      <section id="deities" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sr sr-up text-center mb-12">
            <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center justify-center gap-3">
              <span className="w-8 h-1 bg-temple-gold" />
              神尊介紹
              <span className="w-8 h-1 bg-temple-gold" />
            </h2>
            <h3 className="text-4xl font-bold text-temple-dark font-serif">祀奉神尊</h3>
            <div className="flex items-center justify-center gap-3 mt-3 mb-2">
              <span className="w-12 h-px bg-temple-gold/70" />
              <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
              <span className="w-12 h-px bg-temple-gold/70" />
            </div>
          </div>
          {deityHalls.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {/* 切換殿別要把展開數量歸零，否則從 12 尊的殿切到 3 尊的殿，
                  「更多」的剩餘數會算成負值、按鈕該收卻不收 */}
              <button
                onClick={() => { setSelectedHall(null); setDeityShown(DEITY_PAGE); }}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  selectedHall === null
                    ? 'bg-temple-red text-white border-temple-red shadow-md'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-temple-red/50 hover:text-temple-red'
                }`}>
                全部
              </button>
              {deityHalls.map(h => (
                <button key={h.id}
                  onClick={() => { setSelectedHall(h.id); setDeityShown(DEITY_PAGE); }}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    selectedHall === h.id
                      ? 'bg-temple-red text-white border-temple-red shadow-md'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-temple-red/50 hover:text-temple-red'
                  }`}>
                  {h.name}
                </button>
              ))}
            </div>
          )}
          {(() => {
            const filteredDeities = selectedHall
              ? deities.filter(d => d.hallId === selectedHall)
              : deities;
            // 一次只顯示 DEITY_PAGE 尊，按一次「更多」再展開一批（不收合，符合逐步瀏覽的直覺）
            const shownDeities = filteredDeities.slice(0, deityShown);
            const remaining = filteredDeities.length - shownDeities.length;
            return filteredDeities.length > 0 ? (
            <>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {shownDeities.map((deity, di) => (
                // 只做進場（逐張錯開），**不要加視差**。
                // 曾經給單數欄 30px 的視差做高低錯落，結果捲動時四張卡上緣會差到 18px，
                // 廟方看到的是「牌卡沒有排整齊」——整齊的網格比錯落的動態重要。
                // 卡片高度靠 grid 的 stretch ＋ 內層 h-full 撐成等高，不要拿掉 h-full。
                <DeityCard key={deity.id} deity={deity} index={di} />
              ))}
            </div>
            {/*
              「更多」改成換到 /deities 完整頁，不再一次展開四尊。
              舊做法尊數一多就把首頁灌爆，使用者捲很久也回不到別的區塊；
              而且展開的內容沒有自己的網址，分享不出去、Google 也看不到。
            */}
            {remaining > 0 && (
              <div className="text-center mt-10">
                <button
                  onClick={() => goToPage('deitiesAll')}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-full border border-temple-gold/60 text-temple-red font-medium hover:bg-temple-gold/10 hover:border-temple-gold transition-all"
                >
                  看全部神尊
                  <span className="text-sm text-gray-500">（共 {filteredDeities.length} 尊）</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            </>
            ) : (
              <p className="text-center text-gray-400">{deities.length === 0 ? '載入中...' : '此殿尚無神明'}</p>
            );
          })()}
        </div>
      </section>

      {/* ── 遷址捐款（首頁摘要）──
          內容取自後台「遷址捐款」第一個顯示中的段落，與 /relocation 同一份資料。
          版型比照「關於和聖壇」，但不放數字卡——那兩張是關於我們專屬的。
          後台還沒有任何段落時整區不渲染，首頁不會出現空殼。 */}
      {relocationLead && (
      <section id="relocation-intro" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 照片在右、文字在左，與上方「關於和聖壇」左右相反，版面才不會一成不變 */}
          <div className={`grid gap-12 items-center ${relocationLead.imagePath ? 'md:grid-cols-2' : ''}`}>
            {relocationLead.imagePath && (
              // 照片在右，所以從右邊滑入；進場與視差一樣分成兩層（同「關於和聖壇」）
              <div className="sr sr-right md:order-2">
                <div className="sr-figure">
                  <div className="relative">
                    <div className="absolute -top-4 -left-4 w-full h-full border-4 border-temple-gold rounded-lg z-0" aria-hidden="true" />
                    <img
                      src={getSiteImagePublicUrl(relocationLead.imagePath)}
                      alt={relocationLead.heading || '遷址'}
                      loading="lazy"
                      className="relative z-10 rounded-lg shadow-2xl w-full h-[500px] object-cover"
                    />
                  </div>
                </div>
              </div>
            )}
            <div className={`sr-counter ${relocationLead.imagePath ? 'md:order-1' : 'max-w-3xl mx-auto text-center'}`}>
              <h2 className="sr sr-up text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center gap-3">
                <span className="w-8 h-1 bg-temple-gold" />
                護持遷址
              </h2>
              <h3 className="sr sr-up sr-d1 balance-text text-3xl sm:text-4xl font-bold text-temple-dark mb-2 font-serif leading-snug">
                {relocationHome.heading || relocationLead.heading || '遷址捐款'}
              </h3>
              <div className="sr sr-up sr-d1 flex items-center gap-3 mt-2 mb-6">
                <span className="w-8 h-px bg-temple-gold/70" />
                <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
                <span className="w-20 h-px bg-temple-gold/70" />
              </div>
              <p className="sr sr-up sr-d2 text-gray-600 mb-8 leading-relaxed text-lg">
                {renderInline(relocationHome.body || splitParagraphs(relocationLead.body)[0] || '')}
              </p>
              <button
                onClick={() => goToPage('relocation')}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-temple-gold/60 text-temple-red hover:bg-temple-gold/10 transition-colors"
              >
                更多
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Services Section */}
      <section id="services" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="sr sr-up text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center justify-center gap-3">
            <span className="w-8 h-1 bg-temple-gold" />
            宮廟服務
            <span className="w-8 h-1 bg-temple-gold" />
          </h2>
          <h3 className="sr sr-up sr-d1 text-4xl font-bold text-temple-dark mb-2 font-serif">
            祈福保平安，點燈開智慧
          </h3>
          <div className="sr sr-up sr-d1 flex items-center justify-center gap-3 mt-3 mb-12">
            <span className="w-12 h-px bg-temple-gold/70" />
            <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
            <span className="w-12 h-px bg-temple-gold/70" />
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Service 1 —— 只做進場，**不要加視差**。
                曾經給三張卡不同的位移做高低錯落，結果捲動時三欄不齊，看起來像沒對好。
                卡片自己有 hover:-translate-y-2，那是第二個 transform；
                視差若寫在同一層，JS 寫的 inline transform 會把 hover 的位移吃掉。 */}
            <div className="sr sr-up h-full">
            <div className="h-full group bg-temple-bg p-8 rounded-xl shadow-lg transition-all hover:-translate-y-2 hover:shadow-2xl border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-temple-gold text-white text-xs px-2 py-1 font-bold rounded-bl-lg">
                熱門服務
              </div>
              <div className="w-16 h-16 bg-temple-red rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:bg-temple-gold transition-colors">
                <HeartHandshake className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-bold mb-4 font-serif text-temple-dark">問事服務</h4>
              <p className="text-gray-600 mb-6">
                事業、感情、家運遇有瓶頸，誠心向神明請示。本壇提供一對一專人解籤與問事服務。
              </p>
              <button onClick={() => goToPage('booking')} className="text-temple-red font-bold hover:text-temple-gold inline-flex items-center">
                線上預約 <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
            </div>

            {/* Service 2 */}
            <div className="sr sr-up sr-d1 h-full">
            <div className="h-full group bg-temple-bg p-8 rounded-xl shadow-lg transition-all hover:-translate-y-2 hover:shadow-2xl border border-gray-100">
              <div className="w-16 h-16 bg-temple-red rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:bg-temple-gold transition-colors">
                <Flame className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-bold mb-4 font-serif text-temple-dark">光明燈 / 安太歲</h4>
              <p className="text-gray-600 mb-6">
                農曆新年期間，提供太歲祈安燈、光明前程祈福燈、財源廣進財利燈、本命神明祈願燈，祈求流年順遂，元辰光彩。
              </p>
              <button onClick={() => goToPage('lamps')} className="text-temple-red font-bold hover:text-temple-gold inline-flex items-center">
                立即登記 <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
            </div>

            {/* Service 3 */}
            <div className="sr sr-up sr-d2 h-full">
            <div className="h-full group bg-temple-bg p-8 rounded-xl shadow-lg transition-all hover:-translate-y-2 hover:shadow-2xl border border-gray-100">
              <div className="w-16 h-16 bg-temple-red rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:bg-temple-gold transition-colors">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-bold mb-4 font-serif text-temple-dark">祈福法會</h4>
              <p className="text-gray-600 mb-6">
                舉辦各式祈福法會，為信眾消災解厄、增福添壽，並提供個人與闔家平安祈福登記。
              </p>
              <button onClick={() => goToPage('blessing')} className="text-temple-red font-bold hover:text-temple-gold inline-flex items-center">
                立即報名 <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
            </div>
          </div>
        </div>
      </section>
      </>)}

      {/* ── 預約問事（獨立分頁 /booking）── */}
      {page === 'booking' && (
      <div className="pt-20">
      <section id="booking" className="py-20 bg-temple-red relative overflow-hidden text-white">
        {/* 右邊界空 8/10。**這一區是深底**（#7C5C1E）：金色紋樣在這裡是「比底亮」，
            方向與淺底相反，實測亮度差只有淺底的六成，所以要 onDark 提高濃度 */}
        <PatternMedallion motif="dragon" side="r" onDark />
        {/* Pattern Overlay */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#D4854A 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {sharedMissing && page === 'booking' && <SharedMissingNotice />}
          {pendingSharedFor('booking').length > 0 && (
            <div className="max-w-2xl mx-auto">
              <PendingSharedCard rows={pendingSharedFor('booking')} onOpen={openMyShared} onDelete={handleDeleteSharedSession} />
            </div>
          )}
          <div className="text-center mb-12">
            <h2 className="text-temple-gold font-serif text-lg font-bold tracking-widest mb-2 flex items-center justify-center gap-3">
              <span className="w-8 h-1 bg-temple-gold" />
              線上服務
              <span className="w-8 h-1 bg-temple-gold" />
            </h2>
            {!isSharedGuest('booking') && (<>
            <h1 className="text-4xl sm:text-5xl font-bold mb-2 font-serif">
              預約問事表單
            </h1>
            <div className="flex items-center justify-center gap-3 mt-3 mb-4">
              <span className="w-12 h-px bg-temple-gold/60" />
              <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
              <span className="w-12 h-px bg-temple-gold/60" />
            </div>
            {/* 時段不再寫死在這裡：可預約的場次由後台「問事管理」設定，
                下方的場次選擇器直接列出來，寫在文案裡只會兩邊不同步。 */}
            <p className="text-red-100 max-w-2xl mx-auto">
              請填寫下方資料，我們將儘速為您安排問事時間。
            </p>
            {/* 農曆七月的慣例。用金色與較窄的行寬與上一句拉開，
                這是「會影響能不能報名」的資訊，不是補充說明。 */}
            <p className="text-temple-gold font-medium max-w-xl mx-auto mt-3">
              傳統上農曆七月不問事，如有緊急事件，
              {/* 「請聯繫我們」做成 LINE 連結：真的有急事的人不該還要自己捲到頁尾找電話。
                  用 LINE 而不是電話，是因為那是廟方實際在看的管道，而且桌機也能用；
                  導流統計標記成 booking-lunar7，才看得出這一行有沒有真的帶來聯繫。 */}
              <a
                href={getLineUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackLine('booking-lunar7')}
                className="underline underline-offset-4 hover:text-white transition-colors"
              >
                請聯繫我們
              </a>
              ，謝謝
            </p>
            </>)}
          </div>

          {ENABLE_GROUP_BOOKING && sharedSession?.serviceType === 'booking' && (
            <SharedFormPanel
              session={sharedSession} isCreator={isCreator}
              lampConfigs={lampConfigs} blessingEvent={null}
              memberProfile={memberProfile}
              onAddEntries={handleAddSharedEntries}
              onSubmitAll={handleSubmitSharedSession}
              onDelete={() => handleDeleteSharedSession(sharedSession)}
              onRefresh={async () => { const u = await getSharedSession(sharedSession.id); if (u) setSharedSession(u); }}
              submitStatus={sharedSubmitStatus}
            />
          )}
          {/* 主揪自己的預約表。被邀請者要遮掉：那張的送出會開一筆與揪團無關的獨立預約 */}
          {!isSharedGuest('booking') && (
          <div className="bg-white text-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-8 md:p-12">
              {bookingStatus === 'success' ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 mb-2">預約成功！</h4>
                  <p className="text-gray-600 mb-6">
                    感謝您的預約。廟方人員將於收到資料後，<br />透過電話與您確認最終問事時間。
                  </p>
                  {!member && (
                    <div className="mb-6 mx-auto max-w-sm bg-temple-gold/10 border border-temple-gold/40 rounded-xl p-5 text-center">
                      <p className="text-sm font-semibold text-temple-dark mb-1">加入會員，查看您的問事紀錄</p>
                      <p className="text-xs text-gray-500 mb-3">註冊後電話號碼將自動連結本次預約，日後查詢、填表更便利。</p>
                      <button type="button" onClick={() => { setMemberPortalPendingPhone(guestPhone); setShowMemberPortal(true); }}
                        className="px-5 py-2 bg-temple-red text-white text-sm font-medium rounded-lg hover:bg-[#5C1A04] transition-colors">
                        立即加入會員 →
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => setBookingStatus('idle')}
                    className="px-6 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    再預約一筆
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* 人員卡片列表 */}
                  {bookingPersons.map((p, idx) => (
                    <div key={p.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-600">第 {idx + 1} 位問事者</span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => handleOpenContactPicker('booking', p.id)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-temple-gold/20 border border-temple-gold text-temple-dark hover:bg-temple-gold/40 transition-all">
                            <BookUser className="w-3 h-3 text-temple-red" /> 通訊錄
                          </button>
                          {bookingPersons.length > 1 && (
                            <button type="button" onClick={() => setBookingPersons(prev => prev.filter(x => x.id !== p.id))}
                              className="text-gray-400 hover:text-red-500 transition-colors p-0.5">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      {/* 姓名 / 稱謂 / 生日 / 生肖 / 問事項目 */}
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="block text-xs font-medium text-gray-600 mb-1">信眾大名 *</span>
                            <input required type="text"
                            value={p.name}
                            onChange={e => setBookingPersons(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))}
                            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
                          </label>
                          <label className="block">
                            <span className="block text-xs font-medium text-gray-600 mb-1">稱謂 / 關係</span>
                            <select value={p.contactLabel || ''}
                            onChange={e => setBookingPersons(prev => prev.map(x => x.id === p.id ? { ...x, contactLabel: e.target.value } : x))}
                            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none bg-white">
                            <option value="">稱謂 / 關係</option>
                            {RELATION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          </label>
                        </div>
                        {/* 生日選擇器 */}
                        <BirthDatePicker
                          key={`booking-${p.id}-${p._bKey ?? 0}`}
                          birthDate={p.birthDate}
                          zodiac={p.zodiac}
                          onChange={(birthDate, zodiac) => setBookingPersons(prev => prev.map(x => x.id === p.id ? { ...x, birthDate, zodiac } : x))}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="block text-xs font-medium text-gray-600 mb-1">性別</span>
                            <select value={p.gender || ''}
                            onChange={e => setBookingPersons(prev => prev.map(x => x.id === p.id ? { ...x, gender: e.target.value } : x))}
                            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none bg-white">
                            <option value="">性別（選填）</option>
                            {['信士', '信女', '小兒（16歲以下）', '小女兒（16歲以下）'].map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                          </label>
                          <label className="block">
                            <span className="block text-xs font-medium text-gray-600 mb-1">問事類型 *</span>
                            <select required value={p.type}
                            onChange={e => setBookingPersons(prev => prev.map(x => x.id === p.id ? { ...x, type: e.target.value as ConsultationType } : x))}
                            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none bg-white">
                            {Object.values(ConsultationType).map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          </label>
                        </div>
                        <label className="block">
                          <span className="block text-xs font-medium text-gray-600 mb-1">現居地址 *</span>
                          <input required type="text"
                          value={p.address}
                          onChange={e => setBookingPersons(prev => prev.map(x => x.id === p.id ? { ...x, address: e.target.value } : x))}
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
                        </label>
                        <label className="block">
                          <span className="block text-xs font-medium text-gray-600 mb-1">問事內容（選填）</span>
                          <textarea rows={2}
                          value={p.notes || ''}
                          onChange={e => setBookingPersons(prev => prev.map(x => x.id === p.id ? { ...x, notes: e.target.value } : x))}
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none resize-none" />
                        </label>
                      </div>
                    </div>
                  ))}

                  {/* 新增人員 */}
                  <button type="button"
                    onClick={() => setBookingPersons(prev => [...prev, { id: newId(), name: '', birthDate: '', zodiac: undefined, address: memberProfile?.address ?? '', type: ConsultationType.CAREER, contactLabel: '' }])}
                    className="w-full py-2.5 border-2 border-dashed border-temple-gold/50 rounded-xl text-temple-red text-sm font-medium hover:border-temple-gold hover:bg-temple-gold/5 transition-all flex items-center justify-center gap-1.5">
                    <Plus className="w-4 h-4" /> 新增人員
                  </button>

                  {/* 共用：場次選擇 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">選擇問事場次 *</label>
                    {bookingSessions.length === 0 ? (
                      <div className="w-full px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        目前無開放場次，請關注最新公告。
                      </div>
                    ) : (
                      <label className="block">
                        <span className="block text-xs font-medium text-gray-600 mb-1">選擇問事場次 *</span>
                        <select required value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red transition-all outline-none bg-white text-sm">
                        <option value="">請選擇場次...</option>
                        {bookingSessions.map(s => {
                          const remaining = s.maxSlots - (sessionCounts[s.id] || 0);
                          const isFull = remaining <= 0;
                          const d = new Date(s.sessionDate + 'T12:00:00');
                          const days = ['日', '一', '二', '三', '四', '五', '六'];
                          const label = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${days[d.getDay()]}）${s.sessionTime}`;
                          return (
                            <option key={s.id} value={s.id} disabled={isFull}>
                              {label}　{isFull ? '【已額滿】' : `剩餘 ${remaining} 位`}
                            </option>
                          );
                        })}
                      </select>
                      </label>
                    )}
                    {selectedSessionId && (() => {
                      const s = bookingSessions.find(x => x.id === selectedSessionId);
                      if (!s) return null;
                      const remaining = s.maxSlots - (sessionCounts[selectedSessionId] || 0);
                      return (
                        <p className={`text-xs mt-1 flex items-center gap-1 ${remaining <= 3 ? 'text-red-500' : 'text-green-600'}`}>
                          <Clock className="w-3 h-3" /> 此場次尚餘 {remaining} 個名額
                        </p>
                      );
                    })()}
                  </div>

                  {/* 訪客電話（未登入才顯示） */}
                  {!member && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">聯絡電話 *</label>
                      <label className="block">
                        <span className="block text-xs font-medium text-gray-600 mb-1">聯絡電話 *</span>
                        <input required type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)}
                        placeholder="請留下方便聯繫的電話"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red transition-all outline-none" />
                      </label>
                    </div>
                  )}

                  {bookingStatus === 'error' && (
                    <div role="alert" className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" aria-hidden="true" />
                      <span>預約提交失敗，請檢查網路或稍後再試。</span>
                    </div>
                  )}

                  <div className="pt-4">
                    <button type="submit" disabled={bookingStatus === 'loading'}
                      className="w-full py-4 text-lg font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all bg-temple-red text-white hover:bg-[#5C1A04] hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none">
                      <BookOpen className="w-5 h-5" />
                      {bookingStatus === 'loading' ? '送出中...' : `確認送出預約（共 ${bookingPersons.length} 人）`}
                    </button>
                    <p className="text-center text-gray-500 text-sm mt-4">* 提交後即代表同意本宮隱私權政策</p>
                    {ENABLE_GROUP_BOOKING && !sharedSession && (
                      <>
                        <button type="button" onClick={() => handleCreateSharedSession('booking')}
                          disabled={creatingShare || !selectedSessionId}
                          className="w-full py-2.5 mt-3 border-2 border-dashed border-temple-red/30 text-temple-red/60 rounded-lg text-sm hover:border-temple-red hover:text-temple-red transition-colors flex items-center justify-center gap-2 disabled:opacity-40">
                          <Share2 className="w-4 h-4" /> 建立共享報名表（揪團）
                        </button>
                        {/* 主揪要有帳號才找得回未送出的表；被揪的人不必登入 */}
                        {!member && <p className="mt-1.5 text-xs text-gray-400 text-center">揪團需登入會員，被您邀請的親友則不需要</p>}
                        {!selectedSessionId && (
                          <p className="text-center text-xs text-gray-400 mt-1.5">
                            ※ 請先選擇場次，才能建立揪團報名表
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
          )}
        </div>
      </section>
      </div>
      )}

      {/* ── 祈福點燈（獨立分頁 /lamps）── */}
      {page === 'lamps' && (
      <div className="pt-20">
      <section id="lamps" className="py-20 bg-temple-bg relative overflow-hidden">
        {/* 右邊界空 5/10、左邊 4/10 */}
        <PatternMedallion motif="phoenix" side="r" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* 未送出的揪團提示放在**整個區塊最上面**。放在表單上方實測是 1238px，
              手機得先滑過四張行銷卡才看得到，等於沒提醒（廟方要求「要很明顯」）。 */}
          {sharedMissing && page === 'lamps' && <SharedMissingNotice />}
          {pendingSharedFor('lamp').length > 0 && (
            <div className="max-w-2xl mx-auto">
              <PendingSharedCard rows={pendingSharedFor('lamp')} onOpen={openMyShared} onDelete={handleDeleteSharedSession} />
            </div>
          )}
          {/* Header。被邀請者用精簡版：他是被找來填一筆資料的，不需要整套服務介紹 */}
          <div className={`text-center ${isSharedGuest('lamp') ? 'mb-8' : 'mb-14'}`}>
            <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center justify-center gap-3">
              <span className="w-8 h-1 bg-temple-gold" />
              點燈服務
              <span className="w-8 h-1 bg-temple-gold" />
            </h2>
            {!isSharedGuest('lamp') && (
              <>
                <h1 className="text-4xl sm:text-5xl font-bold text-temple-dark mb-2 font-serif">
                  祈福點燈，光明護佑
                </h1>
                <div className="flex items-center justify-center gap-3 mt-3 mb-4">
                  <span className="w-12 h-px bg-temple-gold/70" />
                  <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
                  <span className="w-12 h-px bg-temple-gold/70" />
                </div>
                <p className="text-gray-500 max-w-xl mx-auto">
                  為本人或家人點燃平安燈，祈求諸事順遂、光明護佑。歡迎線上登記，廟方人員將與您確認細節。
                </p>
              </>
            )}
          </div>

          {/* Service Cards。被邀請者不顯示：方案在共享面板的下拉裡就選得到，
              這幾張是給還在考慮要不要點燈的人看的行銷卡 */}
          {!isSharedGuest('lamp') && (lampConfigs.length > 0 ? (

            <div className={`grid gap-6 mb-16 ${lampConfigs.length <= 2 ? 'md:grid-cols-2 max-w-2xl mx-auto' : lampConfigs.length === 3 ? 'md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
              {lampConfigs.map(cfg => (
                <div key={cfg.id} className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 flex flex-col items-center text-center hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
                  {cfg.imageUrl
                    ? <img src={cfg.imageUrl} alt={cfg.name} className="w-20 h-20 object-cover rounded-2xl border border-gray-100 mb-4 shadow-sm" />
                    : <div className="w-14 h-14 bg-temple-red/10 rounded-full flex items-center justify-center mb-4">
                        <Flame className="w-7 h-7 text-temple-red" />
                      </div>
                  }
                  <h4 className="text-xl font-bold text-temple-dark font-serif mb-2">{cfg.name}</h4>
                  <p className="text-gray-500 text-sm leading-relaxed mb-4 flex-1">{cfg.description}</p>
                  <div className="mt-auto">
                    <span className="text-2xl font-bold text-temple-red">NT$ {cfg.fee.toLocaleString()}</span>
                    <span className="text-gray-400 text-sm ml-1">/ 年</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 mb-16 py-8">
              <Flame className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>點燈服務資訊載入中...</p>
            </div>
          ))}

          {/* Registration Form */}
          <div className="max-w-2xl mx-auto">
            {ENABLE_GROUP_BOOKING && sharedSession?.serviceType === 'lamp' && (
              <SharedFormPanel
                session={sharedSession} isCreator={isCreator}
                lampConfigs={lampConfigs} blessingEvent={null}
                memberProfile={memberProfile}
                onAddEntries={handleAddSharedEntries}
                onSubmitAll={handleSubmitSharedSession}
                onDelete={() => handleDeleteSharedSession(sharedSession)}
                onRefresh={async () => { const u = await getSharedSession(sharedSession.id); if (u) setSharedSession(u); }}
                submitStatus={sharedSubmitStatus}
              />
            )}
            {/* 主揪自己的登記表。**被邀請者一定要遮掉**：這張表的「送出登記」會開一筆
                與揪團無關的獨立訂單，而它就長在共享面板正下方，很容易填錯那一張。 */}
            {!isSharedGuest('lamp') && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              <div className="bg-temple-red px-8 py-5">
                <h4 className="text-xl font-bold text-white font-serif flex items-center gap-2">
                  <Flame className="w-5 h-5 text-temple-gold" />
                  線上登記點燈
                </h4>
                <p className="text-red-100 text-sm mt-1">填妥資料後送出，廟方人員將主動聯繫確認。</p>
              </div>
              <div className="p-8">
                {lampStatus === 'success' ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h5 className="text-xl font-bold text-gray-800 mb-2">登記成功！</h5>
                    <p className="text-gray-500 mb-6">感謝您的登記，廟方人員將盡快與您聯繫確認。</p>
                    {!member && (
                      <div className="mb-6 mx-auto max-w-xs bg-temple-gold/10 border border-temple-gold/40 rounded-xl p-4 text-center">
                        <p className="text-sm font-semibold text-temple-dark mb-1">成為和聖壇會員</p>
                        <p className="text-xs text-gray-500 mb-3">加入會員，下次填表更快速，還能管理點燈通訊錄！</p>
                        <button type="button" onClick={() => setShowMemberPortal(true)}
                          className="px-4 py-2 bg-temple-red text-white text-xs font-medium rounded-lg hover:bg-[#5C1A04] transition-colors">
                          立即加入會員
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => setLampStatus('idle')}
                      className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      再登記一筆
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleLampSubmit} className="space-y-4">
                    {/* 人員卡片列表 */}
                    {lampPersons.map((p, idx) => (
                      <div key={p.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-600">第 {idx + 1} 位燈主</span>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => handleOpenContactPicker('lamp', p.id)}
                              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-temple-gold/20 border border-temple-gold text-temple-dark hover:bg-temple-gold/40 transition-all">
                              <BookUser className="w-3 h-3 text-temple-red" /> 通訊錄
                            </button>
                            {lampPersons.length > 1 && (
                              <button type="button" onClick={() => setLampPersons(prev => prev.filter(x => x.id !== p.id))}
                                className="text-gray-400 hover:text-red-500 transition-colors p-0.5">
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        {/* 燈別 */}
                        <label className="block">
                          <span className="block text-xs font-medium text-gray-600 mb-1">點燈項目 *</span>
                          <select required value={p.serviceId}
                          onChange={e => setLampPersons(prev => prev.map(x => x.id === p.id ? { ...x, serviceId: e.target.value } : x))}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none bg-white">
                          <option value="">請選擇服務項目 *</option>
                          {lampConfigs.map(cfg => (
                            <option key={cfg.id} value={cfg.id}>{cfg.name}　NT$ {cfg.fee.toLocaleString()} / 年</option>
                          ))}
                        </select>
                        </label>
                        {/* 姓名 + 稱謂 */}
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="block text-xs font-medium text-gray-600 mb-1">信眾大名 *</span>
                            <input required type="text"
                            value={p.name}
                            onChange={e => setLampPersons(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
                          </label>
                          <label className="block">
                            <span className="block text-xs font-medium text-gray-600 mb-1">稱謂 / 關係</span>
                            <select value={p.contactLabel || ''}
                            onChange={e => setLampPersons(prev => prev.map(x => x.id === p.id ? { ...x, contactLabel: e.target.value } : x))}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none bg-white">
                            <option value="">稱謂 / 關係</option>
                            {RELATION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          </label>
                        </div>
                        {/* 生日選擇器 */}
                        <BirthDatePicker
                          key={`lamp-${p.id}-${p._bKey ?? 0}`}
                          birthDate={p.birthDate}
                          zodiac={p.zodiac}
                          onChange={(birthDate, zodiac) => setLampPersons(prev => prev.map(x => x.id === p.id ? { ...x, birthDate, zodiac } : x))}
                        />
                        {/* 性別 */}
                        <div>
                          <label className="block">
                            <span className="block text-xs font-medium text-gray-600 mb-1">性別</span>
                            <select value={p.gender || ''}
                            onChange={e => setLampPersons(prev => prev.map(x => x.id === p.id ? { ...x, gender: e.target.value } : x))}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none bg-white">
                            <option value="">性別（選填）</option>
                            {['信士', '信女', '小兒（16歲以下）', '小女兒（16歲以下）'].map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                          </label>
                        </div>
                        <label className="block">
                          <span className="block text-xs font-medium text-gray-600 mb-1">現居地址 *</span>
                          <input required type="text"
                          value={p.address}
                          onChange={e => setLampPersons(prev => prev.map(x => x.id === p.id ? { ...x, address: e.target.value } : x))}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
                        </label>
                      </div>
                    ))}

                    {/* 新增人員 */}
                    <button type="button"
                      onClick={() => setLampPersons(prev => [...prev, { id: newId(), serviceId: '', name: '', birthDate: '', zodiac: undefined, address: memberProfile?.address ?? '', contactLabel: '' }])}
                      className="w-full py-2.5 border-2 border-dashed border-temple-gold/40 text-temple-red/70 rounded-xl text-sm hover:border-temple-gold hover:text-temple-red hover:bg-temple-gold/5 transition-all flex items-center justify-center gap-1.5">
                      <Plus className="w-4 h-4" /> 新增人員
                    </button>

                    {/* 訪客電話（未登入才顯示） */}
                    {!member && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">聯絡電話 *</label>
                        <label className="block">
                          <span className="block text-xs font-medium text-gray-600 mb-1">聯絡電話 *</span>
                          <input required type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)}
                          placeholder="請留下方便聯繫的電話"
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
                        </label>
                      </div>
                    )}

                    {/* 匯款資訊 */}
                    <BankInfoBox />

                    {/* 備註（共用） */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">備註 / 匯款帳號後五碼</label>
                      <label className="block">
                        <span className="block text-xs font-medium text-gray-600 mb-1">匯款帳號後五碼（選填）</span>
                        <input value={lampNotes} onChange={e => setLampNotes(e.target.value)}
                        placeholder="完成匯款後請填寫帳號後五碼，以利核對"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
                      </label>
                    </div>

                    {lampStatus === 'error' && (
                      <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-3 rounded-lg">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        登記失敗，請稍後再試或直接與廟方聯繫。
                      </div>
                    )}

                    <button type="submit" disabled={lampStatus === 'loading'}
                      className="w-full py-3.5 bg-temple-red text-white font-bold rounded-lg hover:bg-[#5C1A04] active:scale-95 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                      <Flame className="w-4 h-4" />
                      {lampStatus === 'loading' ? '送出中...' : `送出登記（共 ${lampPersons.length} 人）`}
                    </button>
                    {ENABLE_GROUP_BOOKING && !sharedSession && (<>
                      <button type="button" onClick={() => handleCreateSharedSession('lamp')}
                        disabled={creatingShare}
                        className="w-full py-2.5 mt-2 border-2 border-dashed border-temple-red/30 text-temple-red/60 rounded-lg text-sm hover:border-temple-red hover:text-temple-red transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                        <Share2 className="w-4 h-4" /> 建立共享報名表（揪團）
                      </button>
                      {/* 主揪要有帳號才找得回未送出的表；被揪的人不必登入 */}
                      {!member && <p className="mt-1.5 text-xs text-gray-400 text-center">揪團需登入會員，被您邀請的親友則不需要</p>}
                    </>)}
                  </form>
                )}
              </div>
            </div>
            )}
          </div>
        </div>
      </section>
      </div>
      )}

      {/* ── 祈福活動（獨立分頁 /blessing）── */}
      {page === 'blessing' && (
      <div className="pt-20">
      <section id="blessing" className="py-20 bg-white relative overflow-hidden">
        {/* 左右邊界都空 7/10，取右側與 /lamps 一致 */}
        <PatternMedallion motif="phoenix" side="r" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {sharedMissing && page === 'blessing' && <SharedMissingNotice />}
          {pendingSharedFor('blessing').length > 0 && (
            <div className="max-w-2xl mx-auto">
              <PendingSharedCard rows={pendingSharedFor('blessing')} onOpen={openMyShared} onDelete={handleDeleteSharedSession} />
            </div>
          )}
          <div className="text-center mb-12">
            <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center justify-center gap-3">
              <span className="w-8 h-1 bg-temple-gold" />
              神明庇佑
              <span className="w-8 h-1 bg-temple-gold" />
            </h2>
            {!isSharedGuest('blessing') && (<>
            <h1 className="text-4xl sm:text-5xl font-bold text-temple-dark mb-2 font-serif">祈福活動</h1>
            <div className="flex items-center justify-center gap-3 mt-3 mb-4">
              <span className="w-12 h-px bg-temple-gold/70" />
              <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
              <span className="w-12 h-px bg-temple-gold/70" />
            </div>
            <p className="text-gray-500 max-w-xl mx-auto">
              法會、進香、祭典等各式祈福活動，誠摯邀請善男信女共同參與，祈求神明護佑平安吉祥。
            </p>
            </>)}
          </div>

          {/* 普渡橫幅與活動列表。被邀請者不顯示：主揪已經替他選好要參加哪一場，
              共享面板裡就寫著場次名稱，這一整段只會把面板推到很下面 */}
          {!isSharedGuest('blessing') && (<>
          {/* 中元普渡法會報名 Banner */}
          <div className="mb-8 bg-gradient-to-br from-amber-800 to-amber-950 rounded-2xl overflow-hidden shadow-lg">
            <div className="px-6 py-6 sm:flex sm:items-center sm:justify-between gap-4">
              <div className="text-white mb-4 sm:mb-0">
                <p className="text-amber-300 text-xs tracking-widest mb-1">丙午年度・護國佑民</p>
                <h4 className="text-2xl font-bold font-serif mb-1">太上慈悲普渡禮懺法會</h4>
                <p className="text-amber-200 text-sm">國曆 9/13（日）｜截止報名：9/06</p>
                <p className="text-amber-300 text-xs mt-1">超渡祖先・解冤親債・贊普・地基主等 7 種項目</p>
              </div>
              {/* 收件結束後不留按鈕：點下去只會看到「本次法會報名已截止」。
                  改成一行狀態文字，橫幅本身保留——法會還沒辦，日期對信眾仍然有用。 */}
              {FAHUI_SIGNUP_OPEN ? (
                <button
                  onClick={openFahui}
                  className="w-full sm:w-auto shrink-0 px-7 py-3.5 bg-white text-amber-800 font-bold rounded-xl hover:bg-amber-50 active:scale-95 transition-all shadow-md text-sm"
                >
                  立即線上報名 →
                </button>
              ) : (
                <p className="w-full sm:w-auto shrink-0 px-7 py-3.5 rounded-xl bg-white/10 border border-white/25 text-amber-100 text-sm text-center">
                  線上報名已截止
                </p>
              )}
            </div>
          </div>

          {blessingEvents.length === 0 ? (
            <div className="text-center text-gray-400 py-12 text-sm space-y-2">
              <p>目前暫無其他祈福活動</p>
              {/* 公佈欄關閉時不要留這顆——它會捲到一個不存在的區塊，等於按了沒反應 */}
              {ENABLE_BULLETIN && (
                <button onClick={() => scrollToSection('bulletin')}
                  className="text-temple-red text-xs font-medium hover:underline flex items-center gap-1 mx-auto py-2">
                  查看最新公告 →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {blessingEvents.map(ev => {
                const now = new Date();
                const deadlinePassed = ev.registrationDeadline ? new Date(ev.registrationDeadline) < now : false;
                const daysLeft = ev.registrationDeadline
                  ? Math.ceil((new Date(ev.registrationDeadline).getTime() - now.getTime()) / 86400000)
                  : null;
                return (
                  <div key={ev.id} className="bg-white rounded-2xl border border-temple-gold/30 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-6">
                      <div className="flex flex-wrap items-start gap-4">
                        {ev.imageUrl
                          ? <img src={ev.imageUrl} alt={ev.title} className="w-16 h-16 object-cover rounded-xl border border-gray-100 shrink-0 shadow-sm" />
                          : <div className="w-12 h-12 bg-temple-red/10 rounded-full flex items-center justify-center shrink-0">
                              <span className="text-2xl">🙏</span>
                            </div>
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h4 className="text-xl font-bold text-temple-dark font-serif">{ev.title}</h4>
                            <span className="text-xs bg-temple-red/10 text-temple-red px-2.5 py-1 rounded-full font-medium">{ev.eventType}</span>
                            {deadlinePassed && <span className="text-xs bg-gray-100 text-gray-400 px-2.5 py-1 rounded-full">報名已截止</span>}
                            {!deadlinePassed && daysLeft !== null && daysLeft <= 7 && daysLeft > 0 && (
                              <span className="text-xs bg-orange-100 text-orange-600 px-2.5 py-1 rounded-full">剩 {daysLeft} 天截止</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500 mb-3">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-temple-gold" />
                              {ev.startDate === ev.endDate ? ev.startDate : `${ev.startDate} ～ ${ev.endDate}`}
                            </span>
                            {ev.packages && ev.packages.length > 0 ? (
                              <span className="flex items-center gap-1.5">
                                <span className="text-temple-gold">$</span>
                                {ev.packages.length} 個方案・起 NT${Math.min(...ev.packages.map(p => p.fee)).toLocaleString()}
                              </span>
                            ) : ev.fee > 0 && (
                              <span className="flex items-center gap-1.5">
                                <span className="text-temple-gold">$</span>費用 NT${ev.fee.toLocaleString()}
                              </span>
                            )}
                            {ev.registrationDeadline && !deadlinePassed && (
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-temple-gold" />
                                報名截至 {new Date(ev.registrationDeadline).toLocaleDateString('zh-TW')}
                              </span>
                            )}
                          </div>
                          {ev.description && <p className="text-sm text-gray-500 leading-relaxed">{ev.description}</p>}
                        </div>
                        <button
                          onClick={() => openBlessingModal(ev)}
                          disabled={deadlinePassed}
                          className="shrink-0 px-5 py-2.5 bg-temple-red text-white text-sm font-semibold rounded-xl hover:bg-temple-red/90 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          {deadlinePassed ? '已截止' : '我要報名'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </>)}
        </div>

        {/* ── 共享報名 Panel（祈福）── */}
        {ENABLE_GROUP_BOOKING && sharedSession?.serviceType === 'blessing' && (
          <div className="max-w-2xl mx-auto px-4 mt-6">
            <SharedFormPanel
              session={sharedSession} isCreator={isCreator}
              lampConfigs={lampConfigs}
              blessingEvent={blessingEvents.find(ev => ev.id === sharedSession.config.eventId) ?? null}
              memberProfile={memberProfile}
              onAddEntries={handleAddSharedEntries}
              onSubmitAll={handleSubmitSharedSession}
              onDelete={() => handleDeleteSharedSession(sharedSession)}
              onRefresh={async () => { const u = await getSharedSession(sharedSession.id); if (u) setSharedSession(u); }}
              submitStatus={sharedSubmitStatus}
            />
          </div>
        )}

        {/* ── 祈福報名 Modal ── */}
        {blessingModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setBlessingModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg font-serif">{blessingModal.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{blessingModal.startDate === blessingModal.endDate ? blessingModal.startDate : `${blessingModal.startDate} ～ ${blessingModal.endDate}`}</p>
                </div>
                <button onClick={() => setBlessingModal(null)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
              </div>

              <div className="px-6 py-5">
                {blessingStatus === 'success' ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">報名成功！</h4>
                    <p className="text-gray-500 text-sm mb-2">感謝您的報名，廟方將與您確認相關細節。</p>
                    <p className="text-gray-400 text-xs mb-4">共 {blessingPersons.length} 人</p>
                    {!member && (
                      <div className="mb-4 mx-auto max-w-xs bg-temple-gold/10 border border-temple-gold/40 rounded-xl p-4 text-center">
                        <p className="text-sm font-semibold text-temple-dark mb-1">成為和聖壇會員</p>
                        <p className="text-xs text-gray-500 mb-3">加入會員，下次填表更快速，還能管理親友通訊錄！</p>
                        <button type="button" onClick={() => { setBlessingModal(null); setShowMemberPortal(true); }}
                          className="px-4 py-2 bg-temple-red text-white text-xs font-medium rounded-lg hover:bg-[#5C1A04] transition-colors">
                          立即加入會員
                        </button>
                      </div>
                    )}
                    <button onClick={() => setBlessingModal(null)} className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">關閉</button>
                  </div>
                ) : (
                  <form onSubmit={handleBlessingSubmit} className="space-y-4">
                    {/* 人員卡片列表 */}
                    {blessingPersons.map((p, idx) => (
                      <div key={p.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-600">
                            第 {idx + 1} 位報名者{p.contactLabel ? <span className="ml-1.5 text-xs text-temple-red font-normal bg-temple-red/10 px-1.5 py-0.5 rounded-full">{p.contactLabel}</span> : null}
                          </span>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => handleOpenContactPicker('blessing', p.id)}
                              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-temple-gold/20 border border-temple-gold text-temple-dark hover:bg-temple-gold/40 transition-all">
                              <BookUser className="w-3 h-3 text-temple-red" /> 通訊錄
                            </button>
                            {blessingPersons.length > 1 && (
                              <button type="button" onClick={() => setBlessingPersons(prev => prev.filter(x => x.id !== p.id))}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">姓名 *</label>
                            <label className="block">
                              <span className="block text-xs font-medium text-gray-600 mb-1">姓名 *</span>
                              <input required value={p.name} onChange={e => setBlessingPersons(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
                            </label>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">性別</label>
                            <label className="block">
                              <span className="block text-xs font-medium text-gray-600 mb-1">性別</span>
                              <select value={p.gender} onChange={e => setBlessingPersons(prev => prev.map(x => x.id === p.id ? { ...x, gender: e.target.value } : x))}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none bg-white">
                              <option value="">不指定</option>
                              {['信士', '信女', '小兒（16歲以下）', '小女兒（16歲以下）'].map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            </label>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">稱謂 / 關係</label>
                            <label className="block">
                              <span className="block text-xs font-medium text-gray-600 mb-1">稱謂 / 關係</span>
                              <select value={p.contactLabel || ''}
                              onChange={e => setBlessingPersons(prev => prev.map(x => x.id === p.id ? { ...x, contactLabel: e.target.value } : x))}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none bg-white">
                              <option value="">請選擇稱謂 / 關係</option>
                              {RELATION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            </label>
                          </div>
                        </div>
                        {/* 護持方案（有多方案時才顯示） */}
                        {blessingModal.packages && blessingModal.packages.length > 0 && (() => {
                          // 各方案已報名人數（來自統計 RPC）
                          const pkgCount = eventStats.packageCounts;
                          return (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1.5">護持方案 *</label>
                              <div className="space-y-1.5">
                                {blessingModal.packages.map(pkg => {
                                  const claimed = pkgCount[pkg.name] || 0;
                                  const remaining = pkg.totalQty ? pkg.totalQty - claimed : null;
                                  const isFull = remaining !== null && remaining <= 0;
                                  const isSelected = p.packageId === pkg.id;
                                  return (
                                    <label key={pkg.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                                      isFull ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50'
                                      : isSelected ? 'border-temple-red bg-temple-red/5'
                                      : 'border-gray-200 hover:border-temple-red/40 bg-white'
                                    }`}>
                                      <input type="radio" name={`pkg-${p.id}`} required
                                        disabled={isFull}
                                        checked={isSelected}
                                        onChange={() => !isFull && setBlessingPersons(prev => prev.map(x => x.id === p.id ? { ...x, packageId: pkg.id } : x))}
                                        className="accent-temple-red w-4 h-4 shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium text-gray-800">{pkg.name}</span>
                                        {pkg.description && <span className="text-xs text-gray-400 ml-1.5">{pkg.description}</span>}
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className="text-sm font-semibold text-temple-red">NT${pkg.fee.toLocaleString()}</p>
                                        {remaining !== null && (
                                          <p className={`text-[11px] ${isFull ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                                            {isFull ? '名額已滿' : `剩 ${remaining} 名`}
                                          </p>
                                        )}
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                        {/* 加購項目（有設定時才顯示） */}
                        {blessingModal.addons && blessingModal.addons.length > 0 && (() => {
                          const fixedAddons = blessingModal.addons.filter(a => !a.voluntary);
                          const voluntaryAddons = blessingModal.addons.filter(a => a.voluntary);
                          const pkg = blessingModal.packages?.find(pk => pk.id === p.packageId);
                          const pkgFee = pkg?.fee ?? (blessingModal.packages?.length ? 0 : (blessingModal.fee ?? 0));
                          const fixedTotal = fixedAddons
                            .filter(a => (p.selectedAddonIds || []).includes(a.id))
                            .reduce((s, a) => s + a.fee, 0);
                          const volTotal = voluntaryAddons
                            .reduce((s, a) => s + (p.voluntaryFees?.[a.id] || 0), 0);
                          const total = pkgFee + fixedTotal + volTotal;
                          return (
                            <div className="border border-temple-gold/30 rounded-xl p-3 bg-temple-bg/30">
                              <p className="text-xs font-semibold text-temple-dark mb-2 flex items-center gap-1.5">
                                <ShoppingBag className="w-3.5 h-3.5" /> 加購項目（可多選）
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {/* 固定費用品項：勾選框 */}
                                {fixedAddons.map(addon => (
                                  <label key={addon.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 cursor-pointer hover:border-temple-gold/60 hover:bg-temple-gold/5 transition-all">
                                    <input type="checkbox" className="accent-temple-red w-4 h-4"
                                      checked={(p.selectedAddonIds || []).includes(addon.id)}
                                      onChange={e => setBlessingPersons(prev => prev.map(x => x.id === p.id ? {
                                        ...x,
                                        selectedAddonIds: e.target.checked
                                          ? [...(x.selectedAddonIds || []), addon.id]
                                          : (x.selectedAddonIds || []).filter(id => id !== addon.id)
                                      } : x))} />
                                    <span className="text-sm text-gray-700 flex-1">{addon.name}</span>
                                    <span className="text-xs font-semibold text-temple-red">NT${addon.fee.toLocaleString()}</span>
                                  </label>
                                ))}
                                {/* 隨喜品項：直接顯示金額輸入 */}
                                {voluntaryAddons.map(addon => (
                                  <div key={addon.id} className="flex items-center gap-2 p-2 rounded-lg border border-green-200 bg-green-50/40 sm:col-span-2">
                                    <HeartHandshake className="w-4 h-4 text-green-600 shrink-0" />
                                    <span className="text-sm text-gray-700 flex-1">{addon.name}</span>
                                    <span className="text-xs text-gray-500 font-medium shrink-0">NT$</span>
                                    <label className="block">
                                      <span className="block text-xs font-medium text-gray-600 mb-1">金額（選填）</span>
                                      <input type="number" min="1"
                                      value={p.voluntaryFees?.[addon.id] || ''}
                                      onChange={e => setBlessingPersons(prev => prev.map(x => x.id === p.id ? {
                                        ...x,
                                        voluntaryFees: { ...(x.voluntaryFees || {}), [addon.id]: e.target.value ? Number(e.target.value) : 0 }
                                      } : x))}
                                      className="w-full w-28 px-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-temple-gold" />
                                    </label>
                                  </div>
                                ))}
                              </div>
                              {/* 小計 */}
                              {total > 0 && (
                                <p className="text-right text-xs font-semibold text-temple-red mt-2">
                                  小計 NT${total.toLocaleString()}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                        {/* 供品名額認領（有設定時才顯示） */}
                        {blessingModal.offerings && blessingModal.offerings.length > 0 && (() => {
                          // 每個供品實際已認領數（來自統計 RPC）
                          const offeringClaimedMap = eventStats.offeringCounts;
                          return (
                            <div className="border border-orange-300/60 rounded-xl p-3 bg-orange-50/40">
                              <p className="text-xs font-semibold text-orange-800 mb-2 flex items-center gap-1.5">
                                🕯 法會供品認領（限量，先到先得）
                              </p>
                              <div className="space-y-1.5">
                                {blessingModal.offerings.map(off => {
                                  const dbClaimed = offeringClaimedMap[off.id] || 0;
                                  const remaining = off.totalQty - dbClaimed;
                                  const isFull = remaining <= 0;
                                  const isChecked = (p.claimedOfferingIds || []).includes(off.id);
                                  return (
                                    <label key={off.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all select-none ${
                                      isFull && !isChecked ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50'
                                      : isChecked ? 'border-orange-400 bg-orange-100/60 cursor-pointer'
                                      : 'border-gray-200 bg-white hover:border-orange-300 cursor-pointer'
                                    }`}>
                                      <input type="checkbox"
                                        disabled={isFull && !isChecked}
                                        checked={isChecked}
                                        onChange={e => setBlessingPersons(prev => prev.map(x => x.id === p.id ? {
                                          ...x,
                                          claimedOfferingIds: e.target.checked
                                            ? [...(x.claimedOfferingIds || []), off.id]
                                            : (x.claimedOfferingIds || []).filter(id => id !== off.id)
                                        } : x))}
                                        className="accent-orange-500 w-4 h-4 shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-sm text-gray-800 font-medium">{off.name}</span>
                                        {off.description && <span className="text-xs text-gray-400 ml-1.5">{off.description}</span>}
                                      </div>
                                      <div className="shrink-0 text-right">
                                        {off.fee && off.fee > 0
                                          ? <span className="text-xs font-semibold text-orange-700">NT${off.fee.toLocaleString()}</span>
                                          : <span className="text-xs text-gray-400">免費認領</span>}
                                        <div className={`text-[11px] mt-0.5 ${isFull ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                                          {isFull ? '已全數認領' : `剩餘 ${remaining} 份`}
                                        </div>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                        {/* 生日選擇器 */}
                        <BirthDatePicker
                          key={`blessing-${p.id}-${p._bKey ?? 0}`}
                          birthDate={p.birthDate}
                          zodiac={p.zodiac}
                          onChange={(birthDate, zodiac) => setBlessingPersons(prev => prev.map(x => x.id === p.id ? { ...x, birthDate, zodiac } : x))}
                        />
                        <label className="block">
                          <span className="block text-xs font-medium text-gray-600 mb-1">現居地址（選填）</span>
                          <input value={p.address} onChange={e => setBlessingPersons(prev => prev.map(x => x.id === p.id ? { ...x, address: e.target.value } : x))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
                        </label>
                      </div>
                    ))}

                    {/* 新增報名者 */}
                    <button type="button"
                      onClick={() => setBlessingPersons(prev => [...prev, { id: newId(), name: '', birthDate: '', zodiac: undefined, gender: '', address: memberProfile?.address ?? '', contactLabel: '' }])}
                      className="w-full py-2.5 border-2 border-dashed border-temple-gold/40 rounded-xl text-sm text-temple-red hover:border-temple-gold hover:bg-temple-gold/5 transition-all flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> 新增報名者
                    </button>

                    {/* 訪客電話（未登入才顯示） */}
                    {!member && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">聯絡電話 *</label>
                        <label className="block">
                          <span className="block text-xs font-medium text-gray-600 mb-1">聯絡電話 *</span>
                          <input required type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)}
                          placeholder="請留下方便聯繫的電話"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" />
                        </label>
                      </div>
                    )}

                    {/* 匯款資訊 */}
                    <BankInfoBox />

                    {/* 備註（共用） */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">備註 / 匯款帳號後五碼</label>
                      <label className="block">
                        <span className="block text-xs font-medium text-gray-600 mb-1">匯款帳號後五碼（選填）</span>
                        <input value={blessingNotes} onChange={e => setBlessingNotes(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red outline-none" placeholder="完成匯款後請填寫帳號後五碼，以利核對" />
                      </label>
                    </div>

                    {blessingStatus === 'error' && (
                      <div role="alert" className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-3 rounded-lg">
                        <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                        送出失敗，請稍後再試。
                      </div>
                    )}
                    <button type="submit" disabled={blessingStatus === 'loading'}
                      className="w-full py-3 bg-temple-red text-white font-bold rounded-lg hover:bg-[#5C1A04] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                      {blessingStatus === 'loading' ? '送出中...' : `確認報名（共 ${blessingPersons.length} 人）`}
                    </button>
                    {ENABLE_GROUP_BOOKING && !sharedSession && (<>
                      <button type="button" onClick={() => handleCreateSharedSession('blessing')}
                        disabled={creatingShare}
                        className="w-full py-2.5 mt-2 border-2 border-dashed border-temple-red/30 text-temple-red/60 rounded-lg text-sm hover:border-temple-red hover:text-temple-red transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                        <Share2 className="w-4 h-4" /> 建立共享報名表（揪團）
                      </button>
                      {/* 主揪要有帳號才找得回未送出的表；被揪的人不必登入 */}
                      {!member && <p className="mt-1.5 text-xs text-gray-400 text-center">揪團需登入會員，被您邀請的親友則不需要</p>}
                    </>)}
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
      </div>
      )}

      {/* ── 關於我們完整版（獨立分頁 /about）──
          入口是首頁「關於我們」區塊的「更多」按鈕；導覽列的「關於我們」仍捲到首頁區塊 */}
      {page === 'about' && <AboutPage onBack={() => goToPage('home')} />}

      {/* ── 歲時祭曆（獨立分頁 /calendar）──
          入口在導覽列的「更多」下拉最上方。聖誕來自 deity_feasts（存農曆規則，
          每年換算），壇務活動來自 blessing_events（存確定的國曆日） */}
      {page === 'calendar' && (
        <Suspense fallback={<PageLoading />}><CalendarPage onBack={() => goToPage('home')} /></Suspense>
      )}

      {/* ── 遷址捐款（獨立分頁 /relocation）──
          入口在導覽列的「更多」下拉 */}
      {page === 'relocation' && <RelocationPage onBack={() => goToPage('home')} />}

      {/* ── 祀奉神尊（獨立分頁 /deities）──
          首頁區塊只放前 DEITY_PAGE 尊，這裡列出全部。殿別篩選與首頁共用
          selectedHall，所以從首頁篩了某一殿再點進來，篩選會延續。 */}
      {page === 'deitiesAll' && (
      <div className="pt-20">
        <section className="py-16 sm:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 sr sr-up">
              <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center justify-center gap-3">
                <span className="w-8 h-1 bg-temple-gold" />
                神尊介紹
                <span className="w-8 h-1 bg-temple-gold" />
              </h2>
              <h1 className="text-4xl sm:text-5xl font-bold text-temple-dark font-serif">祀奉神尊</h1>
              <div className="flex items-center justify-center gap-3 mt-3 mb-4">
                <span className="w-12 h-px bg-temple-gold/70" />
                <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
                <span className="w-12 h-px bg-temple-gold/70" />
              </div>
              <p className="text-gray-600 max-w-2xl mx-auto">
                和聖壇奉祀的諸位神尊，誠邀諸善信大德一同參拜。
              </p>
            </div>

            {deityHalls.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-10">
                <button
                  onClick={() => setSelectedHall(null)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedHall === null
                      ? 'bg-temple-red text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  全部
                </button>
                {deityHalls.map(h => (
                  <button
                    key={h.id}
                    onClick={() => setSelectedHall(h.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      selectedHall === h.id
                        ? 'bg-temple-red text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {h.name}
                  </button>
                ))}
              </div>
            )}

            {(() => {
              const list = selectedHall ? deities.filter(d => d.hallId === selectedHall) : deities;
              if (list.length === 0) {
                return <p className="text-center text-gray-400">{deities.length === 0 ? '載入中...' : '此殿尚無神明'}</p>;
              }
              return (
                <>
                  <p className="text-center text-sm text-gray-400 mb-8">共 {list.length} 尊</p>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {list.map((deity, di) => <DeityCard key={deity.id} deity={deity} index={di} />)}
                  </div>
                </>
              );
            })()}

            <div className="mt-16 text-center">
              <button
                onClick={() => goToPage('home')}
                className="px-6 py-2.5 rounded-full border border-temple-gold/60 text-temple-red hover:bg-temple-gold/10 transition-colors"
              >
                返回首頁
              </button>
            </div>
          </div>
        </section>
      </div>
      )}

      {/* ── 神尊修復（獨立分頁 /repair）── */}
      {page === 'repair' && (
      <div className="pt-20">
      {repairProjects.length === 0 && (
        <section className="py-32 text-center">
          <h3 className="text-3xl font-bold text-temple-dark font-serif mb-4">神尊修復專區</h3>
          <p className="text-gray-500">目前沒有進行中的修復專案，感謝您的關心。</p>
          <button onClick={() => goToPage('home')} className="mt-8 px-6 py-2.5 rounded-full border border-temple-gold/60 text-temple-red hover:bg-temple-gold/10 transition-colors">
            返回首頁
          </button>
        </section>
      )}
      {repairProjects.length > 0 && (
      <section id="repair" className="py-20 bg-white relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center justify-center gap-3">
              <span className="w-8 h-1 bg-temple-gold" />
              護持修復
              <span className="w-8 h-1 bg-temple-gold" />
            </h2>
            <h1 className="text-4xl sm:text-5xl font-bold text-temple-dark mb-2 font-serif">
              神尊修復專區
            </h1>
            <div className="flex items-center justify-center gap-3 mt-3 mb-4">
              <span className="w-12 h-px bg-amber-400/70" />
              <span className="w-2 h-2 rotate-45 bg-amber-500 inline-block" />
              <span className="w-12 h-px bg-amber-400/70" />
            </div>
            <p className="text-gray-600 max-w-2xl mx-auto">
              點選神尊卡片即可捐獻，您的善心將專款專用於修復指定神尊。
            </p>
          </div>

          {/* 神尊卡片牆：直式大圖，點卡片開啟詳情與捐獻視窗 */}
          {(() => {
            const shown = repairProjects.slice(0, repairShown);
            const remaining = repairProjects.length - shown.length;
            return (
              <div className="space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
                  {shown.map(proj => {
                    const raised = repairProjectTotals[proj.id] || 0;
                    const pct = proj.targetAmount > 0
                      ? Math.min(100, Math.round((raised / proj.targetAmount) * 100))
                      : null;
                    const reached = pct !== null && pct >= 100;
                    return (
                      <button type="button" key={proj.id}
                        onClick={() => { setRepairSelectedProj(proj); setRepairFormStatus('idle'); }}
                        className="group text-left rounded-2xl overflow-hidden bg-white border border-gray-200 hover:border-amber-400 hover:shadow-xl transition-all">
                        {/* 直式比例：神尊立像是直的，方形會把頭尾裁掉 */}
                        <div className="relative aspect-[3/4] bg-gradient-to-br from-amber-50 to-gray-100 overflow-hidden">
                          {proj.imageUrl
                            ? <img src={proj.imageUrl} alt={proj.name} loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            : <div className="w-full h-full flex items-center justify-center">
                                <Flame className="w-12 h-12 text-amber-200" />
                              </div>}
                          {reached && (
                            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-green-500 text-white text-[11px] font-bold shadow">
                              已達標
                            </span>
                          )}
                          {/* 名稱壓在圖片下緣，深色漸層確保白字讀得到 */}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pt-8 pb-2.5">
                            <p className="text-white font-bold font-serif text-base sm:text-lg leading-tight drop-shadow">{proj.name}</p>
                          </div>
                        </div>
                        <div className="p-3 sm:p-4 space-y-2">
                          {proj.description && (
                            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{proj.description}</p>
                          )}
                          {pct !== null ? (
                            <div className="space-y-1">
                              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${reached ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                              </div>
                              <div className="flex justify-between text-[11px] text-gray-500">
                                <span>已募 NT${raised.toLocaleString()}</span>
                                <span className="font-bold">{pct}%</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-gray-400">隨喜護持</p>
                          )}
                          <span className="block text-center text-sm font-bold text-amber-600 group-hover:text-amber-700 pt-1">
                            護持修復 →
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {remaining > 0 && (
                  <div className="text-center">
                    <button type="button"
                      onClick={() => setRepairShown(n => n + REPAIR_PAGE_SIZE)}
                      className="inline-flex items-center gap-2 px-8 py-3 rounded-full border border-amber-400 text-amber-700 font-medium hover:bg-amber-50 transition-all">
                      顯示更多
                      <span className="text-sm text-gray-500">（還有 {remaining} 尊）</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* 神尊詳情與捐獻：用視窗而非接在卡片牆下方。
              十尊以上時，表單長在整面卡片牆底下會離被點的卡片很遠，
              使用者按完會以為沒反應。 */}
          {repairSelectedProj && (
            <div
              className="fixed inset-0 z-[70] overflow-y-auto bg-black/60 backdrop-blur-sm"
              onClick={() => setRepairSelectedProj(null)}
            >
            {/* 捲動容器要是外層的 fixed，置中放在內層並加 min-h-full。
                若把 items-center 直接放在 fixed+overflow 的同一層，內容比視窗高時
                上緣會被推到捲動起點之上、永遠捲不到——關閉鈕與神尊的頭就消失了。 */}
            <div className="flex min-h-full items-start sm:items-center justify-center p-0 sm:p-6">
            <div
              className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* 大圖：這是使用者要求的重點——看得清楚神尊本尊 */}
              <div className="relative">
                {repairSelectedProj.imageUrl
                  ? <img src={repairSelectedProj.imageUrl} alt={repairSelectedProj.name}
                      className="w-full max-h-[55vh] object-contain bg-gradient-to-b from-amber-50 to-white" />
                  : <div className="w-full h-56 bg-amber-50 flex items-center justify-center">
                      <Flame className="w-16 h-16 text-amber-200" />
                    </div>}
                <button type="button" onClick={() => setRepairSelectedProj(null)}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <h4 className="text-2xl font-bold text-temple-dark font-serif mb-1">{repairSelectedProj.name}</h4>
                <p className="text-xs text-amber-600 mb-3">專款專用 · 修復捐獻</p>
                {repairSelectedProj.description && (
                  <p className="text-sm text-gray-600 leading-relaxed mb-4 whitespace-pre-wrap">{repairSelectedProj.description}</p>
                )}
                {repairSelectedProj.targetAmount > 0 && (() => {
                  const raised = repairProjectTotals[repairSelectedProj.id] || 0;
                  const pct = Math.min(100, Math.round((raised / repairSelectedProj.targetAmount) * 100));
                  return (
                    <div className="mb-5 space-y-1">
                      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>已募 NT${raised.toLocaleString()}</span>
                        <span>目標 NT${repairSelectedProj.targetAmount.toLocaleString()}（{pct}%）</span>
                      </div>
                    </div>
                  );
                })()}

              {repairFormStatus === 'success' ? (
                <div className="text-center py-8 bg-green-50 rounded-2xl border border-green-200">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-bold text-gray-900 mb-1">感謝您護持修復「{repairSelectedProj.name}」！</p>
                  <p className="text-sm text-gray-500 mb-4">廟方人員將與您聯繫後續事宜。</p>
                  <button type="button"
                    onClick={() => { setRepairSelectedProj(null); setRepairName(''); setRepairAmount(0); setRepairNotes(''); setRepairFormStatus('idle'); }}
                    className="px-5 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm">
                    返回
                  </button>
                </div>
              ) : (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!repairSelectedProj) return;
                  setRepairFormStatus('loading');
                  try {
                    await submitDonation({
                      name: repairName,
                      phone: member ? (memberProfile?.phone ?? '') : guestPhone,
                      amount: repairAmount,
                      type: DonationType.REPAIR,
                      repairProjectId: repairSelectedProj.id,
                      repairProjectName: repairSelectedProj.name,
                      notes: repairNotes || undefined,
                    });
                    setRepairFormStatus('success');
                    // 重新載入進度
                    getRepairProjectTotals().then(setRepairProjectTotals).catch(() => {});
                  } catch {
                    setRepairFormStatus('error');
                  }
                }} className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 sm:p-6 space-y-4">
                  {/* 神尊名稱與大圖已在視窗上方，這裡不重複 */}
                  <div className="flex items-center gap-2">
                    <label className="block flex-1">
                      <span className="block text-xs font-medium text-gray-600 mb-1">大德姓名 *</span>
                      <input required type="text" value={repairName}
                      onChange={e => setRepairName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-300/30 focus:border-amber-400 transition-all outline-none" />
                    </label>
                    <button type="button" onClick={() => handleOpenContactPicker('repair', '__repair__')}
                      className="flex items-center gap-1 text-xs px-2.5 py-2 rounded-full bg-temple-gold/20 border border-temple-gold text-temple-dark hover:bg-temple-gold/40 transition-all shrink-0">
                      <BookUser className="w-3 h-3 text-temple-red" /> 通訊錄
                    </button>
                  </div>
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-600 mb-1">捐款金額（NTD）*</span>
                    <input required type="number" min="1" value={repairAmount || ''}
                    onChange={e => setRepairAmount(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-300/30 focus:border-amber-400 transition-all outline-none" />
                  </label>
                  {!member && (
                    <label className="block">
                      <span className="block text-xs font-medium text-gray-600 mb-1">聯絡電話 *</span>
                      <input required type="tel" value={guestPhone}
                      onChange={e => setGuestPhone(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-300/30 focus:border-amber-400 transition-all outline-none" />
                    </label>
                  )}
                  <BankInfoBox tip="匯款完成後請於下方備註填寫後五碼！" />
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-600 mb-1">備註 / 匯款帳號後五碼（選填）</span>
                    <input type="text" value={repairNotes}
                    onChange={e => setRepairNotes(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-300/30 focus:border-amber-400 transition-all outline-none" />
                  </label>
                  {repairFormStatus === 'error' && (
                    <div role="alert" className="bg-red-50 text-red-700 p-3 rounded-lg flex items-center gap-2 text-sm">
                      <AlertCircle className="w-4 h-4" aria-hidden="true" /> 提交失敗，請稍後再試。
                    </div>
                  )}
                  <button type="submit" disabled={repairFormStatus === 'loading'}
                    className="w-full py-3 text-lg font-bold rounded-xl shadow-lg bg-amber-500 text-white hover:bg-amber-600 hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    <Wrench className="w-5 h-5" />
                    {repairFormStatus === 'loading' ? '送出中...' : '確認捐獻修復'}
                  </button>
                </form>
              )}
              </div>
            </div>
            </div>
            </div>
          )}
        </div>
      </section>
      )}
      </div>
      )}

      {/* 隨喜捐獻仍留在首頁 */}
      {page === 'home' && (
      <section id="donation" className="py-20 bg-temple-bg relative overflow-hidden">
        <PatternMedallion motif="phoenix" side="l" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center justify-center gap-3">
              <span className="w-8 h-1 bg-temple-gold" />
              功德無量
              <span className="w-8 h-1 bg-temple-gold" />
            </h2>
            <h3 className="text-4xl font-bold text-temple-dark mb-2 font-serif">
              隨喜捐獻 / 護持項目
            </h3>
            <div className="flex items-center justify-center gap-3 mt-3 mb-4">
              <span className="w-12 h-px bg-temple-gold/70" />
              <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
              <span className="w-12 h-px bg-temple-gold/70" />
            </div>
            <p className="text-gray-600 max-w-2xl mx-auto">
              您的每一分心意，都是支持和聖壇持續弘揚神恩、服務大眾的力量。
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-temple-gold/20 overflow-hidden">
            <div className="p-8 md:p-12">
              {donationStatus === 'success' ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 mb-2">感謝您的護持！</h4>
                  <p className="text-gray-600 mb-6">
                    功德無量。我們已收到您的捐款意向，<br />廟方人員將會與您聯繫後續事宜。
                  </p>
                  {!member && (
                    <div className="mb-6 mx-auto max-w-xs bg-temple-gold/10 border border-temple-gold/40 rounded-xl p-4 text-center">
                      <p className="text-sm font-semibold text-temple-dark mb-1">成為和聖壇會員</p>
                      <p className="text-xs text-gray-500 mb-3">加入會員，下次填表更快速，記錄每一次的護持功德！</p>
                      <button type="button" onClick={() => setShowMemberPortal(true)}
                        className="px-4 py-2 bg-temple-red text-white text-xs font-medium rounded-lg hover:bg-[#5C1A04] transition-colors">
                        立即加入會員
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => setDonationStatus('idle')}
                    className="px-6 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    返回
                  </button>
                </div>
              ) : (
                <form onSubmit={handleDonationSubmit} className="space-y-4">
                  {/* ── 人員卡片 ── */}
                  {donationPersons.map((p, idx) => (
                    <div key={p.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-600">第 {idx + 1} 位大德</span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => handleOpenContactPicker('donation', p.id)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-temple-gold/20 border border-temple-gold text-temple-dark hover:bg-temple-gold/40 transition-all">
                            <BookUser className="w-3 h-3 text-temple-red" /> 通訊錄
                          </button>
                          {donationPersons.length > 1 && (
                            <button type="button"
                              onClick={() => setDonationPersons(prev => prev.filter(x => x.id !== p.id))}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <label className="block">
                          <span className="block text-xs font-medium text-gray-600 mb-1">大德姓名 *</span>
                          <input
                          required
                          type="text"
                          value={p.name}
                          onChange={e => setDonationPersons(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red transition-all outline-none text-sm"
                        />
                        </label>
                        <label className="block">
                          <span className="block text-xs font-medium text-gray-600 mb-1">捐款金額（NTD）*</span>
                          <input
                          required
                          type="number"
                          min="1"
                          value={p.amount || ''}
                          onChange={e => setDonationPersons(prev => prev.map(x => x.id === p.id ? { ...x, amount: Number(e.target.value) } : x))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red transition-all outline-none text-sm"
                        />
                        </label>
                        <label className="block">
                          <span className="block text-xs font-medium text-gray-600 mb-1">捐款類別 *</span>
                          <select
                          required
                          value={p.type}
                          onChange={e => setDonationPersons(prev => prev.map(x => x.id === p.id ? { ...x, type: e.target.value as DonationType } : x))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red transition-all outline-none bg-white text-sm"
                        >
                          {donationTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        </label>
                        <label className="block">
                          <span className="block text-xs font-medium text-gray-600 mb-1">性別</span>
                          <select
                          value={p.gender || ''}
                          onChange={e => setDonationPersons(prev => prev.map(x => x.id === p.id ? { ...x, gender: e.target.value } : x))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red transition-all outline-none bg-white text-sm"
                        >
                          <option value="">性別（選填）</option>
                          {['信士', '信女', '小兒（16歲以下）', '小女兒（16歲以下）'].map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="block text-xs font-medium text-gray-600 mb-1">現居地址（選填）</span>
                          <input
                          type="text"
                          value={p.address}
                          onChange={e => setDonationPersons(prev => prev.map(x => x.id === p.id ? { ...x, address: e.target.value } : x))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red transition-all outline-none text-sm"
                        />
                        </label>
                      </div>
                    </div>
                  ))}

                  <button type="button"
                    onClick={() => setDonationPersons(prev => [...prev, { id: newId(), name: '', address: '', amount: 0, type: DonationType.GENERAL }])}
                    className="w-full py-2 border-2 border-dashed border-temple-gold/50 rounded-xl text-temple-red text-sm font-medium hover:border-temple-gold hover:bg-temple-gold/5 transition-all flex items-center justify-center gap-1">
                    <Plus className="w-4 h-4" /> 新增人員
                  </button>

                  {/* 訪客電話（未登入才顯示） */}
                  {!member && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">聯絡電話 *</label>
                      <label className="block">
                        <span className="block text-xs font-medium text-gray-600 mb-1">聯絡電話 *</span>
                        <input required type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)}
                        placeholder="請留下方便聯繫的電話"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red transition-all outline-none" />
                      </label>
                    </div>
                  )}

                  {/* 匯款資訊 */}
                  <BankInfoBox />

                  <div>
                    <label htmlFor="don_notes" className="block text-sm font-medium text-gray-700 mb-1">備註 / 匯款帳號後五碼（選填）</label>
                    <input
                      id="don_notes"
                      value={donationNotes}
                      onChange={e => setDonationNotes(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-temple-red/20 focus:border-temple-red transition-all outline-none"
                      placeholder="完成匯款後請填寫帳號後五碼，以利核對"
                    />
                  </div>

                  {donationStatus === 'error' && (
                    <div role="alert" className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" aria-hidden="true" />
                      <span>提交失敗，請檢查網路或稍後再試。</span>
                    </div>
                  )}

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={donationStatus === 'loading'}
                      className="w-full py-4 text-lg font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all bg-temple-red text-white hover:bg-[#5C1A04] hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <HeartHandshake className="w-5 h-5" />
                      {donationStatus === 'loading' ? '送出中...' : `確認捐獻護持（共 ${donationPersons.length} 人）`}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ── 常見問題（首頁；內容來自 content/faq.json，與結構化資料共用同一份）── */}
      {page === 'home' && (
      <section id="faq" className="py-20 bg-white relative overflow-hidden">
        {/* 兩側各 240px 空邊界。接在 #donation（鳳左）之下，
            往下捲是龍右 → 鳳左 → 龍右 */}
        <PatternMedallion motif="dragon" side="r" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* 標題結構與其他區塊一致：小標＋大標＋菱形分隔飾＋說明（見 #deities、#donation） */}
          <div className="text-center mb-12 sr sr-up">
            <h2 className="text-temple-red font-serif text-lg font-bold tracking-widest mb-2 flex items-center justify-center gap-3">
              <span className="w-8 h-1 bg-temple-gold" />
              有問必答
              <span className="w-8 h-1 bg-temple-gold" />
            </h2>
            <h3 className="text-4xl font-bold text-temple-dark mb-2 font-serif">
              常見問題
            </h3>
            <div className="flex items-center justify-center gap-3 mt-3 mb-4">
              <span className="w-12 h-px bg-temple-gold/70" />
              <span className="w-2 h-2 rotate-45 bg-temple-gold inline-block" />
              <span className="w-12 h-px bg-temple-gold/70" />
            </div>
            <p className="text-gray-600 max-w-2xl mx-auto">
              初次前來或有疑問，先看看這裡。
            </p>
          </div>
          {/*
            折疊式：首頁本來就長，八題全展開會再多推一大段。
            用原生 <details> 而不是自己管展開狀態——鍵盤可操作、關閉 JS 也能展開，
            重點是**答案的文字一直都在 DOM 裡**，只是視覺上收起來。
            Google 的 FAQPage 規則要求標記的內容使用者要看得到，
            「點一下就展開」算數；真的把文字拿掉就不算了。
            樣式在 index.css 的 .faq-item（箭頭是用邊框畫的，沒有多一個圖檔）。
          */}
          <div className="divide-y divide-temple-gold/20 border-y border-temple-gold/20">
            {faqItems.map((item) => (
              <details key={item.q} className="faq-item sr sr-up">
                <summary>
                  <span className="text-temple-red mr-3 select-none" aria-hidden="true">問</span>
                  <span className="flex-1">{item.q}</span>
                  <span className="faq-chevron" aria-hidden="true" />
                </summary>
                <div className="faq-answer">
                  <span className="text-temple-red/70 mr-3 select-none" aria-hidden="true">答</span>
                  <span>{item.a}</span>
                </div>
              </details>
            ))}
          </div>
          <p className="text-center text-sm text-gray-500 mt-8">
            還有其他問題，歡迎透過{' '}
            <a
              href={getLineUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackLine('faq')}
              className="text-temple-gold hover:text-temple-red underline underline-offset-4"
            >
              官方 LINE 帳號
            </a>
            {' '}或電話 <a href={telHref} className="text-temple-gold hover:text-temple-red">{siteInfo.phone}</a> 詢問。
          </p>
        </div>
      </section>
      )}

      {/* Footer（各分頁共用） */}
      <footer id="contact" className="bg-temple-dark text-white border-t border-white/10 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <img src="/logo.png" alt="台北古亭和聖壇 Logo" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
                <span className="text-xl font-bold font-serif tracking-widest">台北古亭和聖壇</span>
              </div>
              <p className="text-gray-400 leading-relaxed mb-6">
                神明慈悲為懷，庇佑十方善信。<br />
                歡迎各界善男信女蒞臨參香指導，共沐神恩。
              </p>
              <div className="flex space-x-4">
                {visibleSocials(social).map(({ key, label, url, Icon }) =>
                  key === 'lineUrl' ? (
                    <button
                      key={key}
                      onClick={() => openLine('footer')}
                      className="w-10 h-10 rounded-full bg-[#06C755] flex items-center justify-center hover:scale-110 transition-transform text-white"
                      title={label}
                    >
                      <span className="sr-only">{label}</span>
                      <Icon className="h-5 w-5" />
                    </button>
                  ) : (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={label}
                      className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-temple-gold hover:text-temple-red transition-colors"
                    >
                      <span className="sr-only">{label}</span>
                      <Icon className="h-5 w-5" />
                    </a>
                  )
                )}
              </div>
            </div>

            <div>
              <h4 className="text-lg font-bold font-serif text-temple-gold mb-6">聯絡資訊</h4>
              <div className="space-y-4">
                <div className="flex items-start space-x-3 text-gray-400">
                  <MapPin className="w-5 h-5 mt-1 text-temple-red" />
                  <span>{siteInfo.address}</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-400">
                  <Phone className="w-5 h-5 text-temple-red" />
                  <a href={telHref} className="hover:text-temple-gold transition-colors">{siteInfo.phone}</a>
                </div>
                <div className="flex items-center space-x-3 text-gray-400">
                  <Clock className="w-5 h-5 text-temple-red" />
                  <span>每日 {siteInfo.hoursOpen} - {siteInfo.hoursClose}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-bold font-serif text-temple-gold mb-6">交通指引</h4>
              <a
                href={`https://www.google.com/maps/search/${encodeURIComponent(siteInfo.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-52 rounded-lg overflow-hidden border border-gray-700 hover:opacity-90 transition-opacity"
              >
                <iframe
                  title="和聖壇地圖"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(siteInfo.address)}&output=embed&hl=zh-TW`}
                  width="100%"
                  height="100%"
                  style={{ border: 0, pointerEvents: 'none' }}
                  allowFullScreen
                  loading="lazy"
                />
              </a>
              <p className="text-sm text-gray-500 mt-3">
                點擊地圖可在 Google Maps 中開啟導航
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center text-gray-500 text-sm gap-4">
            <p>&copy; {new Date().getFullYear()} 台北古亭和聖壇. All rights reserved. 網站設計：和聖壇管理委員會</p>
            <div className="flex items-center gap-4">
              {/* py-2 把點擊區從 20px 撐到 36px：WCAG 的最小目標是 24px，
                  而頁尾是長者最常誤點的地方。文字色也從 gray-500 提到 gray-300——
                  深色底上的 gray-500 只有 2.3:1，看不清楚。 */}
              <button
                onClick={() => setShowPrivacyModal(true)}
                className="py-2 text-gray-300 hover:text-temple-gold transition-colors"
              >
                隱私權政策
              </button>
              <span className="text-gray-600" aria-hidden="true">·</span>
              <button
                onClick={() => setShowLoginModal(true)}
                className="flex items-center py-2 text-gray-300 hover:text-temple-gold transition-colors"
              >
                <Settings className="w-4 h-4 mr-1" aria-hidden="true" /> 管理員登入
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating LINE Button — 手機放右下角避免遮住左側選單，桌機維持左下角；後台把 LINE 網址清空就整顆不顯示。
          首頁的 Hero 期間先收起來：它會壓在三尊神明的裙擺上，也綁死了 Hero 按鈕能放的位置。
          捲過 Hero 才淡入；其他分頁沒有 Hero，一進來就顯示。
          用 opacity＋pointer-events 隱藏而不是不渲染，才有淡入淡出；同時關掉 aria 與 Tab 焦點。 */}
      {social.lineUrl.trim() !== '' && (
      <button
        onClick={() => openLine('floating')}
        title="加入 LINE 官方帳號"
        aria-hidden={hideLineFloat}
        tabIndex={hideLineFloat ? -1 : 0}
        className={`fixed bottom-24 right-4 sm:bottom-8 sm:right-auto sm:left-8 z-[60] flex flex-col items-center gap-1 group
          transition-all duration-500 ${hideLineFloat ? 'opacity-0 translate-y-6 pointer-events-none' : 'opacity-100 translate-y-0'}`}
      >
        {/* Pulse ring */}
        <span className="absolute w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#06C755]/40 animate-ping" />
        <span className="relative bg-[#06C755] w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-2xl group-hover:scale-110 transition-transform flex items-center justify-center">
          <LineIcon className="w-9 h-9 sm:w-10 sm:h-10" />
        </span>
        <span className="relative bg-[#06C755] text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">
          加入 LINE
        </span>
      </button>
      )}

      {/* Member Portal */}
      {showMemberPortal && (
        <Suspense fallback={<PageLoading />}>
          <MemberPortal
            pendingPhone={memberPortalPendingPhone}
            onClose={() => {
              setShowMemberPortal(false);
              setMemberPortalPendingPhone('');
              if (member) loadMemberContacts();
            }}
          />
        </Suspense>
      )}

      {/* Contact Picker Modal */}
      {showContactPicker && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setShowContactPicker(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-temple-red px-6 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold font-serif flex items-center gap-2">
                <BookUser className="w-4 h-4" /> 選擇聯絡人
              </h3>
              <button onClick={() => setShowContactPicker(null)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {/* 本人（個人資料） */}
              {memberProfile && memberProfile.name && (() => {
                const applyProfile = () => {
                  const { form, personId } = showContactPicker!;
                  const addr = memberProfile.address || '';
                  const lbl = '本人';
                  if (form === 'lamp') {
                    setLampPersons(prev => prev.map(x => x.id === personId ? { ...x, name: memberProfile.name, birthDate: memberProfile.birthDate, zodiac: memberProfile.zodiac, address: addr, contactLabel: lbl, _bKey: (x._bKey ?? 0) + 1 } : x));
                  } else if (form === 'booking') {
                    setBookingPersons(prev => prev.map(x => x.id === personId ? { ...x, name: memberProfile.name, birthDate: memberProfile.birthDate, zodiac: memberProfile.zodiac, address: addr, contactLabel: lbl, _bKey: (x._bKey ?? 0) + 1 } : x));
                  } else if (form === 'donation') {
                    setDonationPersons(prev => prev.map(x => x.id === personId ? { ...x, name: memberProfile.name, address: addr, contactLabel: lbl } : x));
                  } else if (form === 'blessing') {
                    setBlessingPersons(prev => prev.map(x => x.id === personId ? { ...x, name: memberProfile.name, birthDate: memberProfile.birthDate, zodiac: memberProfile.zodiac, gender: memberProfile.gender || '', address: addr, contactLabel: lbl, _bKey: (x._bKey ?? 0) + 1 } : x));
                  } else if (form === 'repair') {
                    setRepairName(memberProfile.name);
                    if (memberProfile.phone) setGuestPhone(memberProfile.phone);
                  }
                  setShowContactPicker(null);
                };
                return (
                  <button
                    key="__self__"
                    type="button"
                    onClick={applyProfile}
                    className="w-full text-left px-4 py-3 rounded-lg border border-temple-gold/40 bg-temple-gold/5 hover:bg-temple-gold/10 hover:border-temple-gold/60 transition-all flex items-center gap-3"
                  >
                    <span className="text-xs bg-temple-red text-white px-2 py-0.5 rounded-full font-medium shrink-0">本人</span>
                    <div>
                      <p className="font-medium text-gray-800">{memberProfile.name}</p>
                      <p className="text-xs text-gray-500">
                        {memberProfile.phone}{memberProfile.birthDate ? ` · ${memberProfile.birthDate}` : ''}
                      </p>
                    </div>
                  </button>
                );
              })()}
              {/* 分隔線（有本人且有其他聯絡人時顯示） */}
              {memberProfile && memberProfile.name && memberContacts.length > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-300">親友</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
              )}
              {/* 通訊錄聯絡人 */}
              {memberContacts.map(contact => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => {
                    const { form, personId } = showContactPicker!;
                    const addr = contact.address || '';
                    const lbl = contact.label;
                    if (form === 'lamp') {
                      setLampPersons(prev => prev.map(x => x.id === personId ? { ...x, name: contact.name, birthDate: contact.birthDate, zodiac: contact.zodiac, address: addr, contactLabel: lbl, _bKey: (x._bKey ?? 0) + 1 } : x));
                    } else if (form === 'booking') {
                      setBookingPersons(prev => prev.map(x => x.id === personId ? { ...x, name: contact.name, birthDate: contact.birthDate, zodiac: contact.zodiac, address: addr, contactLabel: lbl, _bKey: (x._bKey ?? 0) + 1 } : x));
                    } else if (form === 'donation') {
                      setDonationPersons(prev => prev.map(x => x.id === personId ? { ...x, name: contact.name, address: addr, contactLabel: lbl } : x));
                    } else if (form === 'blessing') {
                      setBlessingPersons(prev => prev.map(x => x.id === personId ? { ...x, name: contact.name, birthDate: contact.birthDate, zodiac: contact.zodiac, gender: contact.gender || '', address: addr, contactLabel: lbl, _bKey: (x._bKey ?? 0) + 1 } : x));
                    } else if (form === 'repair') {
                      setRepairName(contact.name);
                      if (contact.phone) setGuestPhone(contact.phone);
                    }
                    setShowContactPicker(null);
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg border border-gray-100 hover:bg-temple-bg hover:border-temple-gold/30 transition-all flex items-center gap-3"
                >
                  <span className="text-xs bg-temple-red/10 text-temple-red px-2 py-0.5 rounded-full font-medium shrink-0">{contact.label}</span>
                  <div>
                    <p className="font-medium text-gray-800">{contact.name}</p>
                    <p className="text-xs text-gray-500">{contact.phone}{contact.birthDate ? ` · ${contact.birthDate}` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {/* ── 共享報名表連結 Modal ── */}
      {ENABLE_GROUP_BOOKING && showShareModal && sharedSession && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-temple-dark">共享報名表已建立！</h3>
              <p className="text-sm text-gray-500 mt-1">將連結傳給親友，他們可加入報名資料</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="flex-1 text-xs text-gray-600 break-all">{sharedSessionUrl}</span>
              <button onClick={() => {
                navigator.clipboard.writeText(sharedSessionUrl);
                setUrlCopied(true);
                setTimeout(() => setUrlCopied(false), 2000);
              }} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-temple-red text-white text-xs rounded-lg hover:bg-temple-red/90 transition-colors">
                {urlCopied ? <><CheckCircle className="w-3.5 h-3.5" />已複製</> : <><Copy className="w-3.5 h-3.5" />複製</>}
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">連結 7 天後自動失效</p>
            <button onClick={() => setShowShareModal(false)}
              className="w-full mt-4 py-2.5 bg-temple-red text-white rounded-xl font-medium text-sm hover:bg-temple-red/90 transition-colors">
              開始收集資料
            </button>
          </div>
        </div>
      )}

      {/* ── 隱私權政策 Modal ── */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowPrivacyModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-temple-red px-6 py-5 flex items-center justify-between shrink-0">
              <h2 className="text-white font-bold text-lg font-serif">隱私權政策</h2>
              <button onClick={() => setShowPrivacyModal(false)} className="text-white/70 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Content */}
            <div className="overflow-y-auto p-6 space-y-5 text-sm text-gray-700 leading-relaxed">
              <p className="text-gray-500 text-xs">最後更新：{new Date().getFullYear()} 年</p>

              <div>
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5"><span className="text-temple-red">一、</span>總則</h3>
                <p>台北古亭和聖壇（以下簡稱「本宮」）重視您的個人資料保護。本政策說明本宮在您使用本網站各項服務（包括點燈登記、祈福報名、捐獻護持、問事預約等）時，如何收集、使用及保護您的個人資料，適用範圍以本網站為限。</p>
              </div>

              <div>
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5"><span className="text-temple-red">二、</span>收集的個人資料</h3>
                <p className="mb-2">本宮僅在您主動填寫表單時收集以下資料：</p>
                <ul className="space-y-1 pl-4">
                  {['姓名', '出生年月日及生肖', '現居地址', '聯絡電話', '電子郵件（會員帳號）', '捐款金額及護持類別', '問事希望日期與時段', '備註（含匯款帳號後五碼）'].map(item => (
                    <li key={item} className="flex items-start gap-2"><span className="text-temple-gold mt-1">•</span>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5"><span className="text-temple-red">三、</span>資料使用目的</h3>
                <p className="mb-2">所蒐集之個人資料，僅用於以下目的：</p>
                <ul className="space-y-1 pl-4">
                  {[
                    '辦理點燈、祈福、捐獻、問事等服務之登記與確認',
                    '廟方人員與您聯繫服務細節（電話或其他方式）',
                    '核對匯款紀錄',
                    '寄送活動通知（需您同意）',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2"><span className="text-temple-gold mt-1">•</span>{item}</li>
                  ))}
                </ul>
                <p className="mt-2 text-gray-500">本宮不會將您的個人資料出售、出租或以任何形式提供予第三方，法律要求除外。</p>
              </div>

              <div>
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5"><span className="text-temple-red">四、</span>資料保存與安全</h3>
                <p>個人資料儲存於受存取控制保護的雲端資料庫，本宮採取合理的技術措施防止未授權存取、洩漏或竄改。資料保存期限以服務完成後一年為原則，或依法令規定辦理。</p>
              </div>

              <div>
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5"><span className="text-temple-red">五、</span>您的權利</h3>
                <p>依據個人資料保護法，您得向本宮提出以下請求：查詢、閱覽、製給複製本、補充或更正、停止蒐集/處理/利用、刪除。如需行使上述權利，請透過下方聯絡資訊與本宮聯繫。</p>
              </div>

              <div>
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5"><span className="text-temple-red">六、</span>Cookie 使用</h3>
                <p>本網站使用瀏覽器本機儲存（localStorage）保存會員登入狀態，不使用追蹤型 Cookie，不與第三方廣告平台共享資料。</p>
              </div>

              <div>
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5"><span className="text-temple-red">七、</span>政策修訂</h3>
                <p>本政策如有修訂，將公告於本網站，修訂後繼續使用本網站即視為同意修訂後的內容。</p>
              </div>

              <div className="bg-temple-bg rounded-xl p-4">
                <h3 className="font-bold text-gray-800 mb-2">聯絡資訊</h3>
                <p>台北古亭和聖壇　｜　{siteInfo.address}</p>
                <p>電話：{siteInfo.phone}　｜　開放時間：每日 {siteInfo.hoursOpen} – {siteInfo.hoursClose}</p>
              </div>
            </div>
            {/* Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => setShowPrivacyModal(false)} className="px-5 py-2 bg-temple-red text-white text-sm font-medium rounded-lg hover:bg-[#5C1A04] transition-colors">
                我已閱讀並了解
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoginModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleCloseLoginModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-login-title"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-temple-red px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <h2 id="admin-login-title" className="text-white text-lg font-bold font-serif tracking-wide">管理員登入</h2>
              </div>
              <button
                onClick={handleCloseLoginModal} aria-label="關閉管理員登入"
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAdminLogin} className="px-6 py-6">
              <p className="text-gray-500 text-sm mb-5">請輸入管理員帳號與密碼以進入後台管理系統。</p>

              <div className="mb-3">
                <label htmlFor="admin-email" className="sr-only">管理員電子郵件</label>
                <input
                  id="admin-email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => { setLoginEmail(e.target.value); setLoginError(''); }}
                  placeholder="管理員電子郵件"
                  autoComplete="username"
                  autoFocus
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-temple-red focus:border-transparent"
                />
              </div>

              <div className="relative mb-2">
                <label htmlFor="admin-password" className="sr-only">密碼</label>
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => { setLoginPassword(e.target.value); setLoginError(''); }}
                  placeholder="密碼"
                  autoComplete="current-password"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 text-gray-800 focus:outline-none focus:ring-2 focus:ring-temple-red focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {loginError && (
                <p className="text-red-500 text-sm mb-4 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {loginError}
                </p>
              )}

              <div className="flex gap-3 mt-5">
                <button
                  type="button"
                  onClick={handleCloseLoginModal}
                  disabled={loginLoading}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="flex-1 px-4 py-3 bg-temple-red text-white rounded-lg hover:bg-[#5C1A04] transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loginLoading ? (
                    <span className="flex items-center gap-2"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>登入中...</span>
                  ) : (
                    <><Lock className="w-4 h-4" /> 登入後台</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
