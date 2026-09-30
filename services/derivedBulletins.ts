/**
 * 把服務資料轉成公佈欄的公告——讓廟方不必做二次工
 *
 * ── 為什麼有這支 ──
 * 廟方 2026-10-01 回報：一個活動要在「祈福管理」上架一次，再到「公佈欄」貼一次，
 * 兩邊分開維護，改了一邊另一邊就過時。公佈欄講的本來就是這些服務在辦的事，
 * 沒有理由要人手動抄第二遍。
 *
 * 作法是**衍生而不是複製**：不往 bulletins 寫任何一列，前台讀公佈欄時把
 * 祈福活動、辦事日、誦經祈福、點燈項目即時轉成公告卡，與真正的公告合併後排序。
 * 廟方在服務那邊上架、下架、改名，公佈欄立刻跟著變，不會有兩份資料對不起來。
 * 代價是**這些卡的文案不能單獨改**——要改就去改活動本身。廟方 2026-10-01 選了這個。
 *
 * ── 為什麼場次類要合併成一則 ──
 * 辦事日與誦經祈福是一場一列的資料，一場一則公告會讓公佈欄被場次淹掉，
 * 真正的公告全被擠到下面。所以同一類合併成一則，內文把近期場次列出來。
 * 點燈項目同理：那是年年都在的常設服務，四種燈各一則會長期佔著版面。
 *
 * ── 衍生的卡不置頂 ──
 * 置頂是廟方用來讓某一則壓在最上面的手段。衍生的卡若也能置頂，就會把廟方
 * 特意置頂的那則擠掉。一律 isPinned = false。
 */
import {
  BulletinCategory, BulletinRecord, BlessingEventRecord,
  BookingSessionRecord, RegularSession, LampServiceConfig,
} from '../types';

/** 衍生卡的 id 前綴。前台用它判斷「這張不是真的公告」（例如不給編輯、不送報名） */
export const DERIVED_PREFIX = 'derived:';

export const isDerivedBulletin = (id: string): boolean => id.startsWith(DERIVED_PREFIX);

/** 一律本地時區組字串，不用 toISOString（台灣早上 8 點前會差一天，見 CLAUDE.md） */
const todayYmd = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** 2026-10-11 → 10/11（日）。給列在內文裡的場次用 */
const dayLabel = (ymd: string): string => {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return `${m}/${d}（${'日一二三四五六'[new Date(y, m - 1, d).getDay()]}）`;
};

const fmtMoney = (n: number): string => `NT$${n.toLocaleString()}`;

/**
 * 組一張衍生卡。createdAt 決定它在公佈欄的位置（公佈欄是依時間新到舊排），
 * 所以傳的要是「廟方什麼時候把這件事放上來」，不是活動哪天舉行。
 */
const card = (
  key: string,
  title: string,
  content: string,
  category: BulletinCategory,
  createdAt: string,
  linkedService: BulletinRecord['linkedService'],
  imageUrl?: string | null,
): BulletinRecord => ({
  id: `${DERIVED_PREFIX}${key}`,
  title,
  content,
  category,
  isPinned: false,
  publishAt: null,
  linkedService,
  imageUrl: imageUrl ?? null,
  createdAt,
  updatedAt: createdAt,
});

export interface DerivedSources {
  blessingEvents: BlessingEventRecord[];
  bookingSessions: BookingSessionRecord[];
  regularSessions: RegularSession[];
  lampConfigs: LampServiceConfig[];
  /**
   * 廟方手寫的公告。用來擋掉重複：標題一樣的衍生卡不產生。
   *
   * 這是給過渡期用的——在有衍生卡之前，廟方本來就替每個活動手貼了一則公告
   * （實測首頁上「天赦日－點燈祈福」一度出現兩張卡）。手寫的優先，
   * 廟方哪天把舊公告刪掉，衍生的那張就自己接上，中間不會有空窗。
   */
  bulletins: BulletinRecord[];
}

/**
 * 產生衍生公告。傳進來的資料就是各服務頁在用的那幾份（都已經濾過上架與否），
 * 這裡只再濾掉「已經過去的場次」——公佈欄講的是接下來會發生的事。
 */
export const deriveBulletins = (src: DerivedSources): BulletinRecord[] => {
  const today = todayYmd();
  const out: BulletinRecord[] = [];
  /** 廟方已經手寫過同名公告的，衍生卡就不產生（見 DerivedSources.bulletins） */
  const written = new Set(src.bulletins.map(b => b.title.trim()));

  // ── 祈福活動：一個活動一則 ──
  // 活動本來就是一件一件的事，合併反而讓人看不出有哪些活動。
  // 報名走外部表單的（普渡那種）不列：公佈欄的卡會帶「前往祈福登記」，
  // 而那顆對這種活動是錯的入口（見 blessing_events_external_form.sql）。
  src.blessingEvents
    .filter(ev => !ev.externalForm && ev.endDate >= today && !written.has(ev.title.trim()))
    .forEach(ev => {
      const when = ev.startDate === ev.endDate ? dayLabel(ev.startDate) : `${dayLabel(ev.startDate)} ～ ${dayLabel(ev.endDate)}`;
      const price = ev.packages?.length
        ? `${ev.packages.length} 個方案・起 ${fmtMoney(Math.min(...ev.packages.map(p => p.fee)))}`
        : ev.fee > 0 ? `費用 ${fmtMoney(ev.fee)}` : '';
      const head = [when, price].filter(Boolean).join('　');
      out.push(card(
        `blessing:${ev.id}`,
        ev.title,
        [head, ev.description?.trim()].filter(Boolean).join('\n\n'),
        BulletinCategory.BLESSING,
        ev.createdAt,
        'blessing',
        ev.imageUrl,
      ));
    });

  // ── 辦事日：全部合併成一則 ──
  // 最多列六場：再多就變成把整份場次表貼進公佈欄，而完整的清單在問事頁與歲時節令上。
  const sessions = src.bookingSessions
    .filter(s => s.isActive && s.sessionDate >= today)
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.sessionTime.localeCompare(b.sessionTime));
  if (sessions.length > 0) {
    const shown = sessions.slice(0, 6);
    const lines = shown.map(s => `${dayLabel(s.sessionDate)}　${s.sessionTime}`);
    if (sessions.length > shown.length) lines.push(`（另有 ${sessions.length - shown.length} 場，請至預約問事頁查看）`);
    out.push(card(
      'booking',
      '近期辦事日（問事）',
      ['本壇近期開放預約的問事場次：', ...lines].join('\n'),
      BulletinCategory.BOOKING,
      // 用「最晚被建立的那一場」當時間：廟方新開一批場次，這則就浮上來
      sessions.reduce((max, s) => (s.createdAt > max ? s.createdAt : max), sessions[0].createdAt),
      'booking',
    ));
  }

  // ── 誦經祈福：同上合併 ──
  // 沒有 linkedService：誦經祈福不收報名，給「前往登記」的按鈕會把人帶到不相干的表單。
  const regulars = src.regularSessions
    .filter(r => r.isVisible && r.sessionDate >= today)
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  if (regulars.length > 0) {
    const shown = regulars.slice(0, 6);
    const lines = shown.map(r => [dayLabel(r.sessionDate), r.sessionTime].filter(Boolean).join('　'));
    if (regulars.length > shown.length) lines.push(`（另有 ${regulars.length - shown.length} 場，請至歲時節令查看）`);
    out.push(card(
      'regular',
      '近期誦經祈福',
      ['本壇近期的誦經祈福，歡迎信眾隨喜參加：', ...lines].join('\n'),
      BulletinCategory.GENERAL,
      // 用建立時間不是場次日期：場次都在未來，拿它排序會讓這則永遠壓在最上面
      regulars.reduce((max, r) => (r.createdAt > max ? r.createdAt : max), regulars[0].createdAt),
      null,
    ));
  }

  // ── 點燈項目：合併成一則常設服務 ──
  // 這是年年都在的服務，不是「最新消息」。時間戳刻意給最舊的一筆，讓它沉在底下，
  // 不要把真正的新消息擠下去（廟方 2026-10-01 仍希望它出現在公佈欄）。
  const lamps = src.lampConfigs.filter(c => c.isActive);
  if (lamps.length > 0) {
    const lines = lamps
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(c => `${c.name}　${fmtMoney(c.fee)} / 年`);
    out.push(card(
      'lamp',
      '祈福點燈服務',
      ['本壇全年開放線上登記點燈：', ...lines, '', '歡迎為本人或家人點燈，祈求諸事順遂、光明護佑。'].join('\n'),
      BulletinCategory.LAMP,
      lamps.reduce((min, c) => (c.createdAt < min ? c.createdAt : min), lamps[0].createdAt),
      'lamp',
    ));
  }

  return out;
};
