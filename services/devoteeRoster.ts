// 信眾名冊：把各個管道出現過的人彙整成一份名單。
//
// 識別方式：以「姓名」為主（去除空白後比對），**不以電話合併**。
//   同一支電話常是一家人共用，用電話合併會把家人併成同一人。
//   電話改為保留成屬性，並用來提示「可能的親屬」（同電話的其他姓名）。
//
// ── 會員與信眾的關係：**會員一定是信眾，信眾不一定是會員**（廟方 2026-10-24）──
//   報名與點燈都不需要登入，所以名冊上絕大多數的人沒有帳號；`member_profiles`
//   本身也被當成一個管道（`'會員'`）餵進來，所以**每一個會員都會出現在名冊裡**。
//   **「是不是會員」要看 `isMemberSelf`，不要看有沒有編號**——`member_number`
//   是廟方自己給的、程式不產，沒編號的帳號照樣是會員（會員管理那邊本來就印得出
//   「（無編號）」）。拿編號當判準會讓那些人在這一頁上看起來不是會員。

import type {
  FahuiRegistrationRecord,
  VolunteerRegistrationRecord,
  MemberProfileRecord,
  MemberContact,
  BookingRecord,
  DonationRecord,
  LampRegistrationRecord,
  BlessingRegistrationRecord,
  RegistrationRecord,
} from '../types';
import { FAHUI_SERVICE_META, fahuiEntryAmount } from './fahuiServices';

/** 名冊的來源管道 */
export type DevoteeSource = '法會報名' | '法會陽上' | '志工' | '會員' | '通訊錄' | '問事' | '捐款' | '點燈' | '祈福' | '活動報名';

/** 一筆原始出現紀錄（供後台並列比對，判斷該拆分還是該合併） */
export interface DevoteeRecord {
  source: DevoteeSource;
  at: string;
  gender: string;
  phone: string;
  address: string;
  birthDate: string;
  zodiac: string;
  lineId: string;
  /** 報名時填的聯絡信箱。**空字串不一定代表沒填**：這幾欄來自
   *  `registration_email.sql`，那支還沒跑的時候讀出來一律是空的。 */
  email: string;
  amount: number;
  /**
   * 這筆紀錄**自己**就是某個會員帳號的資料（只有「會員」這個管道會是 true）。
   * 其餘管道的報名根本不需要帳號（見 CLAUDE.md：報名不需要會員帳號），
   * 資料庫裡沒有任何欄位記著「這筆是誰登入時送的」。
   *
   * **判斷「是不是會員」一律用這一欄，不要用 `memberNumber`**：編號是廟方給的、
   * 程式不產，沒編號的帳號照樣是會員，拿編號判斷會讓他在這一頁憑空消失。
   */
  isMemberSelf: boolean;
  /** 上面那個帳號的編號，例如 `#007`。**帳號還沒編號時是空字串**，見 `isMemberSelf`。 */
  memberNumber: string;
  /**
   * 這個人出現在哪一個帳號的通訊錄裡（`#007`，沒編號時是「未編號會員」）。
   * 通訊錄是綁 `user_id` 的，所以**這是事實不是推測**——與 `linkedMembers` 的
   * 可信度完全不同，呼叫端要分開顯示。注意他**不是**那個帳號本人（是家人）。
   */
  contactOf: string;
  /**
   * **用電話對應到的**會員帳號，可能不只一個（同一個人常有信箱帳號＋LINE 帳號）。
   * 這是推測不是事實：一家人共用一支號碼時會對到親屬的帳號——名冊那一句
   * 「同電話者僅提示可能親屬，不會合併成同一人」講的就是這件事。
   * 所以它**只進檢視視窗、而且要標示出來**，不進列表的「會員 #」徽章、不進匯出。
   */
  linkedMembers: string[];
  /**
   * 這筆紀錄上填的「稱謂／關係」（`本人`／父母親／兒女／手足／親戚／朋友／師長，
   * 見 App.tsx 的 `RELATION_OPTIONS`）。沒填就是空字串——**不要代入預設值**。
   *
   * **它的主詞是誰，取決於來源**：
   *   - `通訊錄`：主詞是 `contactOf` 那個帳號，所以「#007 的兒女」是**事實**
   *     （`member_contacts` 綁 `user_id`）。
   *   - 其餘報名管道：主詞是「送出那筆報名的人」，而**資料庫裡沒有欄位記著那是誰**
   *     （報名不需登入，同 `linkedMembers` 的理由）。只能靠那一筆的電話去猜，
   *     所以畫面上只能寫「報名時填：兒女」，不可以寫成「某某人的兒女」。
   */
  relation: string;
  /** 生日正規化後的值，拆分時用來分群 */
  birthKey: string;
}

export interface DevoteeRow {
  name: string;
  /** 這個人底下的每一筆原始紀錄，依日期排序 */
  records: DevoteeRecord[];
  genders: string[];
  phones: string[];
  addresses: string[];
  birthDates: string[];
  zodiacs: string[];
  lineIds: string[];
  emails: string[];
  /** 各管道的參與次數 */
  counts: Record<string, number>;
  /** 累計金額（法會報名金額＋捐款金額；其他管道不計金額） */
  totalAmount: number;
  /** 最近一次參與（yyyy-mm-dd，本地時區） */
  lastSeen: string;
  firstSeen: string;
  /** 會員編號（此人若同時是註冊會員**且廟方給過編號**才有值） */
  memberNumbers: string[];
  /**
   * 這一列底下有幾個會員帳號（同一個人可能有好幾個，見 AdminDashboard 的 `toPersonKey`）。
   * **判斷「這個人是不是會員」要用這一個，不要用 `memberNumbers.length`**——
   * 沒編號的帳號不會進那個陣列，用它判斷會把未編號會員顯示成非會員。
   */
  memberAccounts: number;
  /**
   * 這一列自己那幾個帳號的代稱（`#007`，沒編號的是「未編號會員」）。
   * 用來分辨電話對到的是「自己的帳號」還是「別人的帳號」——後者才是要警告的那一種。
   * **已知限制**：好幾個未編號帳號會共用「未編號會員」這個代稱，分不出是哪一個；
   * 要分得出來就得去會員管理把編號補上，而那正是這一欄想促成的事。
   */
  memberTags: string[];
  /**
   * 這個人被填過的所有關係（去重）。**混合了兩種可信度**，只適合當搜尋／篩選的
   * 索引，不要直接當成「他是某人的什麼」顯示——要顯示請用 `relationOf`
   * 或逐筆看 `records[].relation`。
   */
  relations: string[];
  /**
   * **有主詞的關係**：這個人出現在哪個帳號的通訊錄裡、被記成什麼關係。
   * 通訊錄綁 `user_id`，所以這是事實。一個人可能同時在好幾個帳號的通訊錄裡
   * （夫妻各自把小孩加一次），所以是陣列。
   */
  relationOf: Array<{ tag: string; relation: string }>;
  /** 可能的親屬：與本人有共同電話的其他姓名 */
  relatives: string[];
  /** 由拆分產生的列，記下原始姓名（顯示名稱會加上生日以資區別） */
  splitFrom?: string;
  /** 疑似同名不同人：生日或生肖出現兩種以上（同一人不會有兩個生日） */
  nameConflict: boolean;
  /** 造成上述判斷的證據，供後台顯示 */
  conflictHint: string;
}

interface Sighting {
  name: string;
  source: DevoteeSource;
  at?: string;
  gender?: string;
  phone?: string;
  address?: string;
  birthDate?: string;
  zodiac?: string;
  lineId?: string;
  email?: string;
  amount?: number;
  isMemberSelf?: boolean;
  memberNumber?: string;
  contactOf?: string;
  relation?: string;
  /** 這一筆自己那個帳號的代稱，`linkMembersByPhone()` 用來排除「自己對到自己」。
   *  沒編號的帳號也要有代稱，否則它在電話比對裡會變成空字串、把別人的也濾掉。 */
  accountTag?: string;
  /** 由 linkMembersByPhone() 事後補上；見 DevoteeRecord.linkedMembers */
  linkedMembers?: string[];
}

/** ISO 時間 → 本地時區 yyyy-mm-dd（不可用 toISOString，台灣早上 8 點前會差一天） */
const localDate = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const clean = (s?: string): string => (s ?? '').trim();

/** 姓名正規化：去掉所有空白（含全形），避免「王 小明」與「王小明」被當成兩個人 */
const nameKey = (s: string): string => s.replace(/[\s　]/g, '');

/** 生日正規化：去掉括號內的農曆說明，只留數字，讓不同來源的寫法可以比對
 *  例：「民國72年6月20日（農曆五月初十）」與「民國72年6月20日」→ 皆為 72620 */
const birthKey = (s: string): string => s.replace(/[（(].*?[）)]/g, '').replace(/\D/g, '');

/** 會員編號，`#007` 這種格式；還沒編號回空字串 */
const memberNo = (m: MemberProfileRecord): string =>
  m.memberNumber == null ? '' : `#${String(m.memberNumber).padStart(3, '0')}`;

/** 會員帳號在畫面上的代稱。**沒編號也一定要給得出一個名字**——不然那個帳號
 *  在「帳號」這一欄會整個不存在，看起來就像這個人不是會員。 */
const memberTag = (m: MemberProfileRecord): string => memberNo(m) || '未編號會員';

function pushUnique(arr: string[], v?: string): void {
  const x = clean(v);
  if (x && !arr.includes(x)) arr.push(x);
}

export interface RosterSources {
  fahui?: FahuiRegistrationRecord[];
  volunteers?: VolunteerRegistrationRecord[];
  members?: MemberProfileRecord[];
  contacts?: MemberContact[];
  bookings?: BookingRecord[];
  donations?: DonationRecord[];
  lamps?: LampRegistrationRecord[];
  blessings?: BlessingRegistrationRecord[];
  registrations?: RegistrationRecord[];
}

/** 把各來源攤平成「一次出現」的清單 */
function collectSightings(src: RosterSources): Sighting[] {
  const out: Sighting[] = [];

  (src.fahui ?? []).forEach(r => {
    const at = localDate(r.createdAt);
    // 聯絡人（報名金額歸在聯絡人身上）
    out.push({
      name: r.name, source: '法會報名', at, gender: r.contactGender, phone: r.phone,
      address: r.address, birthDate: r.contactBirthDate, zodiac: r.contactZodiac,
      lineId: r.lineId, amount: r.totalAmount,
    });
    // 各項目的陽上姓名也是真實的信眾，但金額不重複計算
    FAHUI_SERVICE_META.forEach(meta => {
      (r.entries?.[meta.key] ?? []).forEach(e => {
        const donor = clean(e.donor);
        if (!donor) return;
        out.push({
          name: donor, source: '法會陽上', at, gender: e.gender,
          address: e.address, birthDate: e.birthdate, zodiac: e.zodiac,
        });
      });
    });
  });

  (src.volunteers ?? []).forEach(v => out.push({
    name: v.name, source: '志工', at: localDate(v.createdAt), phone: v.phone,
    address: v.address, birthDate: v.birthDate, zodiac: v.zodiac, lineId: v.lineId,
  }));

  (src.members ?? []).forEach(m => out.push({
    name: m.name, source: '會員', at: localDate(m.createdAt), gender: m.gender,
    phone: m.phone, address: m.address, birthDate: m.birthDate, zodiac: m.zodiac,
    isMemberSelf: true, memberNumber: memberNo(m) || undefined, accountTag: memberTag(m),
  }));

  // 通訊錄綁 `user_id`，所以「這是誰的通訊錄」是**查得到的事實**，不必拿電話去猜
  // （而且家人那幾筆本來就沒有電話，猜也猜不到）。
  const ownerTag = new Map<string, string>();
  (src.members ?? []).forEach(m => ownerTag.set(m.userId, memberTag(m)));
  (src.contacts ?? []).forEach(c => out.push({
    name: c.name, source: '通訊錄', at: localDate(c.createdAt), gender: c.gender,
    phone: c.phone, address: c.address, birthDate: c.birthDate, zodiac: c.zodiac,
    // 抓不到那個帳號的資料（有通訊錄卻沒有 member_profiles 那一列）時也要說得出
    // 「這是某個帳號的通訊錄」，那比留白誠實
    contactOf: ownerTag.get(c.userId) ?? '未編號會員',
    relation: c.label,
  }));

  (src.bookings ?? []).forEach(b => out.push({
    name: b.name, source: '問事', at: localDate(b.createdAt) || b.bookingDate, gender: b.gender,
    phone: b.phone, address: b.address, birthDate: b.birthDate, zodiac: b.zodiac,
    relation: b.contactLabel, email: b.email,
  }));

  (src.donations ?? []).forEach(d => out.push({
    name: d.name, source: '捐款', at: localDate(d.createdAt), gender: d.gender,
    phone: d.phone, address: d.address, amount: d.amount, relation: d.contactLabel, email: d.email,
  }));

  (src.lamps ?? []).forEach(l => out.push({
    name: l.name, source: '點燈', at: localDate(l.createdAt), gender: l.gender,
    phone: l.phone, address: l.address, birthDate: l.birthDate, zodiac: l.zodiac,
    relation: l.contactLabel, email: l.email,
  }));

  // 祈福報名原本**整個不在名冊裡**（2026-10-29 補）：只參加過祈福的人在這一頁上
  // 不存在，而祈福是會員最常報的項目之一。
  (src.blessings ?? []).forEach(b => out.push({
    name: b.name, source: '祈福', at: localDate(b.createdAt), gender: b.gender,
    phone: b.phone, address: b.address, birthDate: b.birthDate, zodiac: b.zodiac,
    relation: b.contactLabel, email: b.email,
  }));

  (src.registrations ?? []).forEach(r => out.push({
    name: r.name, source: '活動報名', at: localDate(r.createdAt), phone: r.phone,
  }));

  return linkMembersByPhone(out.filter(s => clean(s.name) !== ''), src.members ?? []);
}

/**
 * 替每一筆紀錄補上「這支電話對得到哪些會員帳號」。
 *
 * **為什麼只能用電話**：全站的報名都不需要登入（見 CLAUDE.md），資料庫裡
 * 沒有任何欄位記著「這筆是哪個帳號送的」。後台既有的統計也是這樣對的
 * （MembersTab 的 `l.phone === p.phone`、確認信拿電話回頭對 member_profiles），
 * 這裡沿用同一套，沒有擴大暴露面。
 *
 * **這是推測不是事實**，所以呼叫端要把它跟 `memberNumber`（紀錄自己就是帳號資料）
 * 分開顯示：一家人共用一支號碼時，兒子的報名會對到母親的帳號。
 *
 * **空電話一律不對**——不擋的話所有沒留電話的紀錄會跟所有沒填電話的帳號
 * 互相對上，整欄變成雜訊。
 */
function linkMembersByPhone(list: Sighting[], members: MemberProfileRecord[]): Sighting[] {
  const byPhone = new Map<string, string[]>();
  members.forEach(m => {
    const phone = clean(m.phone);
    if (!phone) return;
    // **沒編號的帳號也要收進來**：原本這裡 `m.memberNumber == null` 就跳過，
    // 於是未編號會員的電話永遠對不到任何東西——而那個帳號是真的存在的。
    const no = memberTag(m);
    const arr = byPhone.get(phone) ?? [];
    if (!arr.includes(no)) arr.push(no);
    byPhone.set(phone, arr);
  });
  return list.map(s => {
    const phone = clean(s.phone);
    const hit = phone ? byPhone.get(phone) : undefined;
    // 自己就是那個帳號的那一筆不必再對一次（會變成「#020（以電話對應 #020）」）
    const linked = hit?.filter(no => no !== s.accountTag) ?? [];
    return linked.length > 0 ? { ...s, linkedMembers: linked } : s;
  });
}

/** 人工校正規則（存在 devotee_overrides 表） */
export interface DevoteeOverride {
  id?: string;
  kind: 'confirm_same' | 'split' | 'alias';
  nameKey: string;
  /** alias 專用：要併進哪一個 nameKey */
  targetKey?: string | null;
  /** split 專用：主要生日 key，沒有生日的紀錄歸給這位 */
  payload?: { main?: string } | null;
  note?: string | null;
}

/** 姓名正規化，供後台產生校正規則時使用（與內部彙整同一套規則） */
export const toNameKey = (s: string): string => nameKey(clean(s));
/** 生日正規化，供後台顯示拆分選項 */
export const toBirthKey = (s: string): string => birthKey(s);

const emptyRow = (name: string): DevoteeRow => ({
  name, records: [], genders: [], phones: [], addresses: [], birthDates: [], zodiacs: [], lineIds: [], emails: [], memberNumbers: [],
  memberAccounts: 0, memberTags: [], counts: {}, totalAmount: 0, lastSeen: '', firstSeen: '',
  relations: [], relationOf: [], relatives: [],
  nameConflict: false, conflictHint: '',
});

const toRecord = (s: Sighting): DevoteeRecord => ({
  source: s.source,
  at: s.at ?? '',
  gender: clean(s.gender),
  phone: clean(s.phone),
  address: clean(s.address),
  birthDate: clean(s.birthDate),
  zodiac: clean(s.zodiac),
  lineId: clean(s.lineId),
  email: clean(s.email),
  amount: s.amount ?? 0,
  isMemberSelf: s.isMemberSelf ?? false,
  memberNumber: s.memberNumber ?? '',
  contactOf: s.contactOf ?? '',
  linkedMembers: s.linkedMembers ?? [],
  relation: clean(s.relation),
  birthKey: birthKey(s.birthDate ?? ''),
});

/** 把一組「出現紀錄」壓成一列 */
function foldSightings(name: string, list: Sighting[]): DevoteeRow {
  const row = emptyRow(name);
  row.records = list.map(toRecord).sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  list.forEach(s => {
    pushUnique(row.genders, s.gender);
    pushUnique(row.phones, s.phone);
    pushUnique(row.addresses, s.address);
    pushUnique(row.birthDates, s.birthDate);
    pushUnique(row.zodiacs, s.zodiac);
    pushUnique(row.lineIds, s.lineId);
    pushUnique(row.emails, s.email);
    pushUnique(row.memberNumbers, s.memberNumber);
    pushUnique(row.relations, s.relation);
    // 通訊錄那幾筆才有主詞（綁 user_id）；報名表的關係沒有主詞，不能放進這裡
    if (s.source === '通訊錄' && clean(s.relation) && clean(s.contactOf)) {
      const tag = clean(s.contactOf);
      const relation = clean(s.relation);
      if (!row.relationOf.some(x => x.tag === tag && x.relation === relation)) {
        row.relationOf.push({ tag, relation });
      }
    }
    if (s.isMemberSelf) { row.memberAccounts += 1; pushUnique(row.memberTags, s.accountTag); }
    row.counts[s.source] = (row.counts[s.source] ?? 0) + 1;
    row.totalAmount += s.amount ?? 0;
    if (s.at) {
      if (!row.lastSeen || s.at > row.lastSeen) row.lastSeen = s.at;
      if (!row.firstSeen || s.at < row.firstSeen) row.firstSeen = s.at;
    }
  });
  return row;
}

/** 建立信眾名冊：以姓名彙整，並用共同電話推測可能的親屬。
 *  overrides 為後台的人工校正規則，會覆寫自動判斷的結果。 */
export function buildDevoteeRoster(src: RosterSources, overrides: DevoteeOverride[] = []): DevoteeRow[] {
  const aliasMap = new Map<string, string>();
  const confirmed = new Set<string>();
  const splits = new Map<string, { main?: string }>();
  overrides.forEach(o => {
    if (o.kind === 'alias' && o.targetKey) aliasMap.set(o.nameKey, o.targetKey);
    else if (o.kind === 'confirm_same') confirmed.add(o.nameKey);
    else if (o.kind === 'split') splits.set(o.nameKey, o.payload ?? {});
  });

  // alias 可能串接（甲→乙、乙→丙），一路解到底；設上限避免規則互指造成無窮迴圈
  const resolveKey = (k: string): string => {
    let cur = k;
    for (let i = 0; i < 10 && aliasMap.has(cur); i++) {
      const next = aliasMap.get(cur)!;
      if (next === cur) break;
      cur = next;
    }
    return cur;
  };

  // 先依（校正後的）姓名分組，保留每一筆出現紀錄以便後續拆分
  const groups = new Map<string, { name: string; list: Sighting[] }>();
  collectSightings(src).forEach(s => {
    const name = clean(s.name);
    const key = resolveKey(nameKey(name));
    let g = groups.get(key);
    if (!g) { g = { name, list: [] }; groups.set(key, g); }
    // 合併後顯示的姓名，用被併入的那一方（target）為主
    if (nameKey(name) === key) g.name = name;
    g.list.push(s);
  });

  const rows: DevoteeRow[] = [];
  groups.forEach((g, key) => {
    const split = splits.get(key);
    if (!split) { rows.push(foldSightings(g.name, g.list)); return; }

    // 拆分：以生日分群，沒有生日的紀錄歸給指定的主要那位
    const buckets = new Map<string, Sighting[]>();
    const noBirth: Sighting[] = [];
    g.list.forEach(s => {
      const bk = birthKey(s.birthDate ?? '');
      if (!bk) { noBirth.push(s); return; }
      const arr = buckets.get(bk) ?? [];
      arr.push(s);
      buckets.set(bk, arr);
    });
    if (buckets.size <= 1) { rows.push(foldSightings(g.name, g.list)); return; }

    // 主要那位：指定的，或紀錄最多的
    let mainKey = split.main && buckets.has(split.main) ? split.main : '';
    if (!mainKey) {
      let best = -1;
      buckets.forEach((arr, k) => { if (arr.length > best) { best = arr.length; mainKey = k; } });
    }
    buckets.forEach((arr, bk) => {
      const list = bk === mainKey ? [...arr, ...noBirth] : arr;
      const row = foldSightings(g.name, list);
      // 標上生日以資區別，否則兩列同名分不出誰是誰
      const label = row.birthDates[0] ?? '';
      row.name = label ? `${g.name}（${label}）` : g.name;
      row.splitFrom = g.name;
      rows.push(row);
    });
  });

  // 同名同姓偵測：同一個人不會有兩個生日或兩個生肖，出現兩種以上就標記出來讓人工確認。
  // （只做提示、不自動拆分——拆錯比合併更難救）
  rows.forEach(r => {
    if (confirmed.has(nameKey(r.splitFrom ?? r.name))) return; // 後台已確認是同一人
    const births: string[] = [];
    r.birthDates.forEach(b => { const k = birthKey(b); if (k && !births.includes(k)) births.push(k); });
    const reasons: string[] = [];
    if (births.length > 1) reasons.push(`生日 ${r.birthDates.join('、')}`);
    if (r.zodiacs.length > 1) reasons.push(`生肖 ${r.zodiacs.join('、')}`);
    if (reasons.length > 0) {
      r.nameConflict = true;
      r.conflictHint = reasons.join('；');
    }
  });

  // 可能的親屬：共用同一支電話的其他姓名（僅提示，不做合併）
  const byPhone = new Map<string, string[]>();
  rows.forEach(r => r.phones.forEach(p => {
    const list = byPhone.get(p) ?? [];
    if (!list.includes(r.name)) list.push(r.name);
    byPhone.set(p, list);
  }));
  rows.forEach(r => {
    r.phones.forEach(p => {
      (byPhone.get(p) ?? []).forEach(n => {
        if (n !== r.name && !r.relatives.includes(n)) r.relatives.push(n);
      });
    });
  });

  // 最近參與者排前面；同日期則姓名排序
  rows.sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || '') || a.name.localeCompare(b.name, 'zh-Hant'));
  return rows;
}

/** 法會報名的實際金額（供對照用；名冊的金額直接取 totalAmount 欄位） */
export const fahuiEntrySum = (r: FahuiRegistrationRecord): number =>
  FAHUI_SERVICE_META.reduce(
    (sum, meta) => sum + (r.entries?.[meta.key] ?? []).reduce((s, e) => s + fahuiEntryAmount(meta, e), 0),
    0,
  );
