import React from 'react';

// ─── Admin Role（後台權限分級）────────────────────────────
export type AdminRole = 'admin' | 'staff' | 'finance';

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  admin:   '管理組',
  staff:   '行政組',
  finance: '財務組',
};

export const ROLE_ALLOWED_TABS: Record<AdminRole, string[]> = {
  admin:   ['vouchers', 'traffic', 'analytics', 'social', 'siteinfo', 'about', 'relocation', 'faq', 'overview', 'fahui', 'volunteer', 'roster', 'bulletins', 'deities', 'members', 'bookings', 'lamps', 'blessings', 'repairs', 'donations', 'receivables', 'photos', 'scripture', 'feasts', 'shower'],
  // 洗澡車給 staff：進香期間是現場同工在發打卡連結，不該每次都找管理員
  staff:   ['traffic', 'siteinfo', 'about', 'relocation', 'faq', 'overview', 'fahui', 'volunteer', 'roster', 'bulletins', 'deities', 'bookings', 'lamps', 'blessings', 'repairs', 'donations', 'feasts', 'shower'],
  finance: ['vouchers', 'overview', 'fahui', 'donations', 'receivables'],
};

// ─── 法會報名 ──────────────────────────────────────────────
/** 單一項目的一筆報名（欄位 key→值，依服務類型而異） */
export type FahuiEntry = Record<string, string>;

export interface FahuiRegistrationRecord {
  id: string;
  createdAt: string;
  /** 報名來源（UTM），格式「來源/形式/檔期」如 line/broadcast/pudu2026；
   *  未追蹤到就是 google.com 這類 referrer 網域或 direct；
   *  undefined 代表這筆早於追蹤上線（2026-09-09）。
   *  注意：與 devoteeRoster 的 `source`（參與管道）是完全不同的東西。 */
  source?: string;
  name: string;
  phone: string;
  address: string;
  lineId?: string;
  /** 電子郵件（報名者自填，選填） */
  email?: string;
  /** 聯絡人性別（信士／信女） */
  contactGender?: string;
  /** 聯絡人自己的生日（國曆+農曆合併字串）與生肖 */
  contactBirthDate?: string;
  contactZodiac?: string;
  /** 服務 key → 該服務的多筆報名 */
  entries: Record<string, FahuiEntry[]>;
  /** 中元贊普供品處理方式 */
  zanpuOffering?: string;
  /** 平安餐與茶飲贊助金額 */
  mealSponsor: number;
  /** 給工作人員的留言 */
  notes?: string;
  totalAmount: number;
  status: string;
  // ─── 後台對帳欄位（報名者看不到、僅管理員填寫）───────────────
  /** 付款方式：現金｜轉帳｜功德主（功德主＝懺主，全項目皆有但不需付款） */
  paymentMethod?: FahuiPaymentMethod;
  /** 付費日期（yyyy-mm-dd） */
  paymentDate?: string;
  /** 帳號後五碼。報名者可在表單自填，後台亦可修改 */
  accountLast5?: string;
  financeCheck: boolean;
  /** 感謝狀編號（印在感謝狀上的號碼，例如 456）。由財務人員自行填寫，沒有預設值 */
  thanksLetter?: string;
  accountingCheck: boolean;
  /** 後台備註（與報名者留言 notes 分開） */
  adminNote?: string;
}

export type FahuiPaymentMethod = '現金' | '轉帳' | '功德主';

export const FAHUI_PAYMENT_METHODS: FahuiPaymentMethod[] = ['現金', '轉帳', '功德主'];

/** 對帳欄位的可更新集合 */
export interface FahuiReconcilePatch {
  paymentMethod?: FahuiPaymentMethod | null;
  paymentDate?: string | null;
  accountLast5?: string | null;
  financeCheck?: boolean;
  thanksLetter?: string | null;
  accountingCheck?: boolean;
  adminNote?: string | null;
}

// ─── 志工報名 ──────────────────────────────────────────────
export interface VolunteerRegistrationRecord {
  id: string;
  createdAt: string;
  /** 報名來源（UTM），格式「來源/形式/檔期」如 line/broadcast/pudu2026；
   *  未追蹤到就是 google.com 這類 referrer 網域或 direct；
   *  undefined 代表這筆早於追蹤上線（2026-09-09）。
   *  注意：與 devoteeRoster 的 `source`（參與管道）是完全不同的東西。 */
  source?: string;
  name: string;
  phone: string;
  address: string;
  /** 用餐習慣：葷食／素食（必選，供法會當日備餐） */
  diet?: string;
  birthDate?: string;
  zodiac?: string;
  lineId?: string;
  /** 可護持的日期與時段：日期 → 已勾選的時段清單 */
  availability?: Record<string, string[]>;
  /** 其他時段的自由說明 */
  availabilityNote?: string;
  status: string;
}

export enum ConsultationType {
  CAREER = '事業前途',
  HEALTH = '身體健康',
  MARRIAGE = '姻緣感情',
  FAMILY = '家庭家運',
  OTHER = '其他疑難'
}

export enum ZodiacSign {
  RAT    = '鼠',
  OX     = '牛',
  TIGER  = '虎',
  RABBIT = '兔',
  DRAGON = '龍',
  SNAKE  = '蛇',
  HORSE  = '馬',
  GOAT   = '羊',
  MONKEY = '猴',
  ROOSTER = '雞',
  DOG    = '狗',
  PIG    = '豬'
}

export enum BookingStatus {
  PENDING = '待處理',
  CONFIRMED = '已確認',
  COMPLETED = '已完成',
  CANCELLED = '已取消'
}

export interface BookingData {
  name: string;
  phone: string;
  gender?: string;
  birthDate: string; // Lunar birthday is often preferred, but standard date for simplicity
  zodiac?: ZodiacSign;
  address?: string;
  contactLabel?: string;
  bookingDate: string;
  bookingTime: string;
  sessionId?: string;
  type: ConsultationType;
  notes?: string;
  status?: BookingStatus;
  divineMessage?: string;
  createdAt?: any;
}

export interface BookingRecord extends BookingData {
  id: string;
  /** 報名來源（UTM），格式「來源/形式/檔期」如 line/broadcast/pudu2026；
   *  未追蹤到就是 google.com 這類 referrer 網域或 direct；
   *  undefined 代表這筆早於追蹤上線（2026-09-09）。
   *  注意：與 devoteeRoster 的 `source`（參與管道）是完全不同的東西。 */
  source?: string;
}

// ─── Booking Sessions (問事場次) ────────────────────────────────
export interface BookingSessionData {
  sessionDate: string;   // YYYY-MM-DD
  sessionTime: string;   // e.g. '晚上 19:00–21:00'
  maxSlots: number;      // 每場限量名額（預設 15）
  isActive: boolean;
}

export interface BookingSessionRecord extends BookingSessionData {
  id: string;
  createdAt: string;
  bookedCount?: number;  // 前端計算
}

export interface RepairProject {
  id:           string;
  name:         string;       // e.g. '鎮殿媽祖'
  description?: string;
  imageUrl?:    string;
  targetAmount: number;       // 目標金額（0 = 不顯示）
  isActive:     boolean;
  sortOrder:    number;
  createdAt:    string;
}
export type RepairProjectData = Omit<RepairProject, 'id' | 'createdAt'>;

export enum DonationType {
  GENERAL = '隨喜捐款 (不指定)',
  MAINTENANCE = '廟宇維護/修繕',
  CHARITY = '慈善救助',
  EDUCATION = '教育文化',
  EVENT = '法會活動',
  REPAIR = '神尊修復'
}

export interface DonationData {
  name: string;
  phone: string;
  gender?: string;
  address?: string;
  contactLabel?: string;
  amount: number;
  type: DonationType;
  notes?: string;
  repairProjectId?:   string;
  repairProjectName?: string;
  createdAt?: any;
}

export interface DonationRecord extends DonationData {
  id: string;
  /** 報名來源（UTM），格式「來源/形式/檔期」如 line/broadcast/pudu2026；
   *  未追蹤到就是 google.com 這類 referrer 網域或 direct；
   *  undefined 代表這筆早於追蹤上線（2026-09-09）。
   *  注意：與 devoteeRoster 的 `source`（參與管道）是完全不同的東西。 */
  source?: string;
}

export interface ServiceItem {
  title: string;
  description: string;
  icon: React.ReactNode;
}

// ─── 網站設定：追蹤碼 ─────────────────────────────────────
/** 只存編號，不存整段程式碼；腳本由前端依官方標準寫法組出 */
export interface AnalyticsSettings {
  /** GA4 評估 ID，形如 G-XXXXXXXXXX */
  ga4Id: string;
  /** Meta 像素 ID，15-16 位數字 */
  metaPixelId: string;
  /** Google 代碼管理工具容器 ID，形如 GTM-XXXXXXX */
  gtmId: string;
}

// ─── 網站設定：社群帳號 ───────────────────────────────────
/** 全部存完整網址；留空代表該平台不顯示在前台 */
export interface SocialSettings {
  lineUrl: string;
  facebookUrl: string;
  facebookGroupUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
}

export const SOCIAL_KEYS: Array<{ field: keyof SocialSettings; dbKey: string; label: string }> = [
  { field: 'lineUrl', dbKey: 'social_line', label: 'LINE 官方帳號' },
  { field: 'facebookUrl', dbKey: 'social_facebook', label: '臉書粉絲專頁' },
  { field: 'facebookGroupUrl', dbKey: 'social_facebook_group', label: '臉書社團' },
  { field: 'instagramUrl', dbKey: 'social_instagram', label: 'IG 帳號' },
  { field: 'tiktokUrl', dbKey: 'social_tiktok', label: '抖音帳號' },
];

// ─── Bulletin (公佈欄) ────────────────────────────────────
export enum BulletinCategory {
  GENERAL  = '一般公告',
  BOOKING  = '問事公告',
  LAMP     = '點燈公告',
  BLESSING = '祈福公告',
  DONATION = '捐獻公告',
}

export interface BulletinData {
  title: string;
  content: string;
  category: BulletinCategory;
  isPinned: boolean;
  publishAt?: string | null;
  linkedService?: 'lamp' | 'blessing' | 'booking' | 'donation' | null;
  /** 活動照片：存完整公開 URL，與 RepairProject.imageUrl 同慣例 */
  imageUrl?: string | null;
}

export interface BulletinRecord extends BulletinData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Bulletin Registration (活動報名) ─────────────────────
export interface RegistrationData {
  bulletinId: string;
  name: string;
  phone: string;
  numPeople: number;
  notes?: string;
}

export interface RegistrationRecord extends RegistrationData {
  id: string;
  createdAt: string;
}

// ─── 關於我們（後台可編輯的圖文段落）────────────────────
/**
 * 一列 = 一個圖文段落。前台依 sortOrder 由小到大排，照片左右交錯。
 * body 空一行＝新的一段，並支援 **粗體** 與 [文字](網址) 兩種標記。
 */
/** 段落所屬的頁面。兩頁結構相同，共用 about_sections 表，用這個欄位分流 */
export type SectionPage = 'about' | 'relocation';

export interface AboutSection {
  id: string;
  page: SectionPage;
  sortOrder: number;
  heading: string;
  body: string;
  /** storage 路徑，不是完整網址；要顯示時用 getSiteImagePublicUrl 轉 */
  imagePath: string | null;
  caption: string;
  isVisible: boolean;
}

/** 新增／更新用（id 由呼叫端決定，沿用 anon 不可讀回的慣例） */
export type AboutSectionData = Omit<AboutSection, 'id'>;

// ─── 常見問題 ──────────────────────────────────────────────
/**
 * 首頁「常見問題」的一題。內容在資料庫 `faq_items`，後台可增刪改。
 * `content/faq.json` 保留為保底：資料表還沒建、或讀取失敗時前台仍有內容。
 */
export interface FaqItem {
  id: string;
  sortOrder: number;
  question: string;
  answer: string;
  isVisible: boolean;
}

export type FaqItemData = Omit<FaqItem, 'id'>;

// ─── 捐款類別 ──────────────────────────────────────────────
/**
 * 隨喜捐獻表單的一個選項。內容在資料庫 `donation_types`，後台可增刪改。
 *
 * **`name` 同時是寫進 `donations.type` 的值**（歷史紀錄存的是文字不是 id），
 * 所以改名不會回頭改到已收的捐款——那是財務資料，要不要一併更新由廟方決定。
 * 上面的 `DonationType` 列舉降為保底：資料表沒建或讀取失敗時前台仍有選項可用。
 */
export interface DonationTypeRecord {
  id: string;
  sortOrder: number;
  name: string;
  isVisible: boolean;
}

export type DonationTypeData = Omit<DonationTypeRecord, 'id'>;

// ─── 網站基本資料 ──────────────────────────────────────────
/**
 * 地址、電話、開放時間。存在 site_settings（key 前綴 `info_`），後台可改。
 *
 * 地址存兩份：`address` 是給人看的完整字串，其餘四欄是結構化資料的
 * PostalAddress 需要的拆分欄位。開放時間存「時:分」而不是一段文字，
 * 因為 opens/closes 要機器可讀，存成「每日 06:00 – 23:00」得回頭解析。
 */
export interface SiteInfo {
  address: string;
  street: string;
  locality: string;
  region: string;
  postalCode: string;
  phone: string;
  hoursOpen: string;
  hoursClose: string;
}

/** 遷址捐款的方案表格：金額當欄、回饋項目當列的矩陣 */
export interface RelocationPlanRow {
  label: string;
  /** 每一格的內容，長度對應 tiers；渲染時會自動補齊，少填不會壞版 */
  cells: string[];
}

export interface RelocationPlan {
  id: string;
  sortOrder: number;
  /** 表格標題，例如「每月同行｜月供養」 */
  title: string;
  /** 表格左上角那一格，例如「每月供養」 */
  amountHeader: string;
  /** 表格上方的說明文字 */
  intro: string;
  /** 欄標題（金額） */
  tiers: string[];
  rows: RelocationPlanRow[];
  /** 表格下方的補充說明 */
  note: string;
  isVisible: boolean;
}

export type RelocationPlanData = Omit<RelocationPlan, 'id'>;

/** 首頁「遷址捐款」摘要：與 /relocation 的段落分開，可獨立寫得更精簡 */
export interface RelocationHome {
  heading: string;
  body: string;
}

/** 首頁那兩張數字卡 */
export interface AboutFacts {
  fact1Value: string;
  fact1Label: string;
  fact2Value: string;
  fact2Label: string;
}

// ─── Site Images (照片管理) ───────────────────────────────
export type SiteImageSection = 'hero' | 'about';

export interface SiteImageRecord {
  id: string;
  sectionKey: SiteImageSection;
  storagePath: string;
  originalFilename: string | null;
  updatedAt: string;
}

// ─── Hero Slides (首頁輪播) ──────────────────────────────
export interface HeroSlideRecord {
  id: string;
  imagePath: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

// ─── Scripture Verses (聖母經) ────────────────────────────
export interface ScriptureVerseData {
  sectionNumber: number;
  bookPage: number;
  verse: string;
  annotation: string;
  imagePath: string | null;
  displayOrder: number;
}

export interface ScriptureVerseRecord extends ScriptureVerseData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Lamp Services (點燈服務) ────────────────────────────
export enum LampRegistrationStatus {
  PENDING   = '待處理',
  CONFIRMED = '已確認',
  COMPLETED = '已完成',
  CANCELLED = '已取消'
}

export interface LampServiceConfigData {
  name: string;
  fee: number;
  description: string;
  imageUrl?: string;
  isActive: boolean;
  displayOrder: number;
}

export interface LampServiceConfig extends LampServiceConfigData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface LampRegistrationData {
  serviceId: string;
  name: string;
  phone: string;
  gender?: string;
  birthDate: string;
  zodiac?: ZodiacSign;
  address?: string;
  contactLabel?: string;
  notes?: string;
}

export interface LampRegistrationRecord extends LampRegistrationData {
  id: string;
  status: LampRegistrationStatus;
  createdAt: string;
  /** 報名來源（UTM），格式「來源/形式/檔期」如 line/broadcast/pudu2026；
   *  未追蹤到就是 google.com 這類 referrer 網域或 direct；
   *  undefined 代表這筆早於追蹤上線（2026-09-09）。
   *  注意：與 devoteeRoster 的 `source`（參與管道）是完全不同的東西。 */
  source?: string;
}

// ─── Member Contacts (會員通訊錄) ────────────────────────
export interface MemberContactData {
  label: string;      // 父母親 / 兒女 / 手足 / 親戚 / 朋友 / 師長
  name: string;
  phone: string;      // 僅「本人」必填，其他不顯示
  birthDate: string;  // 農曆生日（文字）
  zodiac?: ZodiacSign;
  gender?: string;    // 信士 / 信女 / 小兒（16歲以下）/ 小女兒（16歲以下）
  address?: string;   // 居住地址
}

export interface MemberContact extends MemberContactData {
  id: string;
  userId: string;
  contactNumber?: number;
  createdAt: string;
}

export interface ProfileData {
  name: string;
  phone: string;
  birthDate: string;
  zodiac?: ZodiacSign;
  gender?: string;
  address?: string;
}

/** 後台用：所有已註冊會員的完整資料列 */
export interface MemberProfileRecord extends ProfileData {
  userId: string;
  memberNumber?: number;
  createdAt: string;
  updatedAt?: string;
}

// ─── Blessing Events (祈福活動) ──────────────────────────
export enum BlessingStatus {
  PENDING   = '待確認',
  CONFIRMED = '已確認',
  CANCELLED = '已取消'
}

export interface BlessingAddon {
  id:           string;    // nanoid，前端產生
  name:         string;    // 品項名稱，e.g. '蠟燭' / '隨喜敬獻'
  fee:          number;    // 固定費用；voluntary 時為 0（儲存時改為實際輸入值）
  voluntary?:   boolean;   // true = 信眾自填金額
  description?: string;    // 說明（選填）
}

/** 法會供品名額（限量認領，非加購） */
export interface BlessingOffering {
  id:           string;    // nanoid，前端產生
  name:         string;    // e.g. '五果一份'、'香爐一個'
  totalQty:     number;    // 總名額（限量）
  fee?:         number;    // 認領費用，0 或未填 = 免費認領
  description?: string;    // 說明（選填）
}

/** 報名者所認領的供品（存入 registration） */
export interface ClaimedOffering {
  id:   string;  // 對應 BlessingOffering.id
  name: string;  // 冗餘存名稱，方便顯示
}

export interface BlessingEventPackage {
  id:           string;   // 前端用 nanoid / random string
  name:         string;   // 方案名稱，e.g. '基礎護持'
  fee:          number;   // 方案費用
  totalQty?:    number;   // 限量名額（undefined 或 0 = 不限）
  description?: string;   // 簡短說明（選填）
}

export interface BlessingEventData {
  title: string;
  description?: string;
  eventType: string;          // '法會' | '進香' | '祭典' | '祈福' | '其他'
  startDate: string;          // YYYY-MM-DD
  endDate: string;            // YYYY-MM-DD（單日則同 startDate）
  registrationDeadline?: string; // ISO datetime
  fee: number;                // 無方案時的統一費用（有方案時可設 0）
  packages: BlessingEventPackage[]; // 多方案（空陣列表示只有單一費用）
  addons: BlessingAddon[];          // 可加購品項（空陣列 = 無加購）
  offerings: BlessingOffering[];    // 法會供品名額（限量認領，空陣列 = 無）
  imageUrl?: string;
  isActive: boolean;
  sortOrder: number;
  /**
   * 報名走哪一套外部表單。目前只有 'fahui'（法會報名表 fahui_registrations）。
   * undefined＝走一般祈福報名（blessing_registrations）。
   *
   * 普渡法會那一筆是為了讓它出現在歲時節令上補建的，報名其實在法會那套；
   * 沒有這個欄位的話，後台會顯示「0 筆報名」（見 blessing_events_external_form.sql）。
   */
  externalForm?: string;
}

export interface BlessingEventRecord extends BlessingEventData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlessingRegistrationData {
  eventId: string;
  name: string;
  phone: string;
  birthDate?: string;
  zodiac?: ZodiacSign;
  gender?: string;
  address?: string;
  notes?: string;
  packageName?: string;   // 所選方案名稱（無方案時為 undefined）
  packageFee?:  number;   // 所選方案費用（無方案時為 undefined）
  selectedAddons?: BlessingAddon[];      // 此人選擇的加購（voluntary 項目 fee 為實際輸入值）
  claimedOfferings?: ClaimedOffering[];  // 此人認領的法會供品
}

export interface BlessingRegistrationRecord extends BlessingRegistrationData {
  id: string;
  status: BlessingStatus;
  createdAt: string;
  /** 報名來源（UTM），格式「來源/形式/檔期」如 line/broadcast/pudu2026；
   *  未追蹤到就是 google.com 這類 referrer 網域或 direct；
   *  undefined 代表這筆早於追蹤上線（2026-09-09）。
   *  注意：與 devoteeRoster 的 `source`（參與管道）是完全不同的東西。 */
  source?: string;
}

// ─── Deity Halls (殿) ────────────────────────────────────
export interface HallData {
  name: string;
  displayOrder: number;
}
export interface HallRecord extends HallData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Deities (神明介紹) ──────────────────────────────────
export interface DeityData {
  name: string;
  title: string;
  description: string;
  imagePath: string | null;
  displayOrder: number;
  isVisible: boolean;   // false = 隱藏（不顯示於前台）
  hallId?: string | null;
}

export interface DeityRecord extends DeityData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Shared Registration Session (共享報名表) ────────────────
export type SharedServiceType = 'lamp' | 'blessing' | 'booking';

export interface SharedSessionConfig {
  eventId?:     string;   // blessing
  eventTitle?:  string;   // blessing
  fee?:         number;   // blessing
  bookingDate?: string;   // booking
  bookingTime?: string;   // booking
}

export interface SharedEntryData {
  sessionId:     string;
  name:          string;
  phone?:        string;
  birthDate?:    string;
  zodiac?:       string;
  gender?:       string;
  address?:      string;
  contactLabel?: string;
  serviceId?:    string;  // lamp：燈種 ID
  packageId?:    string;  // blessing：方案 ID
  bookingType?:  string;  // booking：ConsultationType value
  notes?:        string;
}

export interface SharedEntryRecord extends SharedEntryData {
  id:        string;
  createdAt: string;
}

export interface SharedSessionData {
  serviceType: SharedServiceType;
  config:      SharedSessionConfig;
  notes?:      string;
}

export interface SharedSessionRecord extends SharedSessionData {
  id:        string;
  status:    'open' | 'submitted';
  entries:   SharedEntryRecord[];
  /** 主揪的會員 id。null＝2026-09-10 改為必須登入之前建立的舊場次 */
  createdBy: string | null;
  createdAt: string;
  expiresAt: string;
}

// ─── 歲時節令（deity_feasts）────────────────────────────────────────────────
// 每年重複的日子：神明聖誕與節日。單次活動放 blessing_events，兩張表分工見
// supabase/migrations/deity_feasts.sql 的檔頭。

/** 日期型態。三種算法完全不同，不能合成一個欄位 */
export type FeastCalendarType = 'lunar' | 'solar' | 'jieqi';

export interface DeityFeastData {
  title: string;
  calendarType: FeastCalendarType;
  /** calendarType === 'lunar' 時有值 */
  lunarMonth: number | null;
  lunarDay: number | null;
  isLeapMonth: boolean;
  /** calendarType === 'solar' 時有值 */
  solarMonth: number | null;
  solarDay: number | null;
  /** calendarType === 'jieqi' 時有值，例如「冬至」 */
  jieqi: string | null;
  note: string;
  isVisible: boolean;
  /** 同一天有多筆時的排序 */
  sortOrder: number;
}

export interface DeityFeast extends DeityFeastData {
  id: string;
}

// ─── 定期共修場次（regular_sessions）────────────────────────────────────────
// 誦經祈福這類每月都辦、但日期時間由廟方當月決定的活動。為什麼不併進 deity_feasts
// 或 blessing_events，見 supabase/migrations/regular_sessions.sql 的檔頭。
// 辦事日不在這裡：那是既有的 booking_sessions（後台「問事管理」維護），
// 歲時節令直接讀那張表，不另外複製一份。

export interface RegularSessionData {
  title: string;            // 預設「誦經祈福」
  sessionDate: string;      // YYYY-MM-DD
  sessionTime: string;      // 自由文字，例「上午 09:00–11:00」。可留空
  note: string;
  isVisible: boolean;
}

export interface RegularSession extends RegularSessionData {
  id: string;
  /** 建立時間。公佈欄那則衍生卡用它排序——用場次日期會讓未來的場次排到最上面 */
  createdAt: string;
}

// ─── 進香洗澡車（shower_trucks / shower_checkins）──────────────────────────
// 白沙屯媽祖進香沒有固定路線，洗澡車停在哪只有現場的人知道。
// 志工用專屬連結打卡、香客在 /shower 查詢並導航。
// 設計與權限見 supabase/migrations/shower_trucks.sql 的檔頭。

/** 香客頁看到的一台車。**不含 checkin_key**——那是志工的憑證，不可以送到前台 */
export interface ShowerTruckLocation {
  id: string;
  name: string;
  /** 最新一次打卡的座標。沒有座標只有地標時為 undefined（導航改用地名搜尋） */
  lat?: number;
  lng?: number;
  place?: string;
  note?: string;
  /** 最新一次打卡的時間。從來沒打過卡時為 undefined */
  checkedAt?: string;
}

/** 後台管理用。只有管理員讀得到，所以這個型別帶 checkinKey */
export interface ShowerTruckAdmin {
  id: string;
  name: string;
  checkinKey: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

// ─── 財務憑證（支出／收入）─────────────────────────────────────
/**
 * 設計說明見 docs/finance-voucher-plan.md 與 supabase/migrations/finance_vouchers.sql。
 *
 * 兩件事在型別上就要守住：
 * 1. **金額是一個整數，不是七個格子。** 紙本傳票把金額拆成「佰萬／拾萬／萬／仟／
 *    佰／拾／元」是防竄改用的；資料只存數字，要印成傳票時才排進格子。
 * 2. **憑證沒有 total 欄位。** 合計一律由明細加總——存下來就會有「單頭與明細
 *    對不起來時該信哪個」的問題，而那無解。
 */

export type VoucherDirection = 'expense' | 'income';
/** draft 打到一半、confirmed 財務確認、void 作廢（財務資料不刪，只作廢） */
export type VoucherStatus = 'draft' | 'confirmed' | 'void';
export type AttachmentKind = '支出傳票' | '發票' | '收據' | '其他';

/** 收入憑證可以引用的業務紀錄來源。與 migration 的 CHECK 一致，改動要兩邊一起 */
export type VoucherSourceTable =
  | 'donations' | 'lamp_registrations' | 'blessing_registrations'
  | 'bookings' | 'fahui_registrations';

export const VOUCHER_SOURCE_LABEL: Record<VoucherSourceTable, string> = {
  donations: '捐獻',
  lamp_registrations: '點燈',
  blessing_registrations: '祈福',
  bookings: '問事',
  fahui_registrations: '法會',
};

export interface AccountingAccountData {
  code: string;
  name: string;
  direction: VoucherDirection | 'both';
  sortOrder: number;
  isActive: boolean;
  note: string;
}
export interface AccountingAccount extends AccountingAccountData {
  id: string;
}

export interface VoucherItemData {
  seq: number;
  accountId: string | null;
  summary: string;
  /** 元，整數。不拆格子 */
  amount: number;
  applicant: string;
  /** 收入憑證才有：指向產生這筆錢的業務紀錄。兩個欄位必須同時有或同時無 */
  sourceTable: VoucherSourceTable | null;
  sourceId: string | null;
}
export interface VoucherItem extends VoucherItemData {
  id: string;
}

export interface VoucherAttachment {
  id: string;
  itemId: string | null;
  kind: AttachmentKind;
  /** 私有 bucket 內的路徑，不是可直接開的網址。要看檔案得換簽名網址 */
  storagePath: string;
  fileName: string;
  mime: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
}

export interface VoucherData {
  direction: VoucherDirection;
  /** 單號。UNIQUE，但可自己填——擋重號而不是強迫格式 */
  voucherNo: string;
  /** 傳票日期 YYYY-MM-DD */
  voucherDate: string;
  summary: string;
  status: VoucherStatus;
  note: string;
}

export interface VoucherRecord extends VoucherData {
  id: string;
  createdAt: string;
  updatedAt: string;
  items: VoucherItem[];
  attachments: VoucherAttachment[];
}

/** 合計一律算出來，不從資料庫讀 */
export const voucherTotal = (items: { amount: number }[]): number =>
  items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
