import React from 'react';

// ─── Admin Role（後台權限分級）────────────────────────────
export type AdminRole = 'admin' | 'staff' | 'finance';

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  admin:   '管理組',
  staff:   '行政組',
  finance: '財務組',
};

export const ROLE_ALLOWED_TABS: Record<AdminRole, string[]> = {
  admin:   ['overview', 'bulletins', 'deities', 'members', 'devotees', 'bookings', 'lamps', 'blessings', 'repairs', 'donations', 'receivables', 'photos', 'scripture'],
  staff:   ['overview', 'bulletins', 'deities', 'bookings', 'lamps', 'blessings', 'repairs', 'donations'],
  finance: ['overview', 'donations', 'receivables'],
};

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
  type: ConsultationType;
  notes?: string;
  status?: BookingStatus;
  createdAt?: any;
}

export interface BookingRecord extends BookingData {
  id: string;
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
}

export interface ServiceItem {
  title: string;
  description: string;
  icon: React.ReactNode;
}

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
  createdAt: string;
  expiresAt: string;
}