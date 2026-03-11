import React from 'react';

export enum ConsultationType {
  CAREER = '事業前途',
  HEALTH = '身體健康',
  MARRIAGE = '姻緣感情',
  FAMILY = '家庭家運',
  FORTUNE = '財運補庫',
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
  birthDate: string; // Lunar birthday is often preferred, but standard date for simplicity
  zodiac?: ZodiacSign;
  address?: string;
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

export enum DonationType {
  GENERAL = '隨喜捐款 (不指定)',
  MAINTENANCE = '廟宇維護/修繕',
  CHARITY = '慈善救助',
  EDUCATION = '教育文化',
  EVENT = '法會活動'
}

export interface DonationData {
  name: string;
  phone: string;
  address?: string;
  amount: number;
  type: DonationType;
  notes?: string;
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
  GENERAL = '一般公告',
  EVENT = '活動公告',
  CEREMONY = '法會通知'
}

export interface BulletinData {
  title: string;
  content: string;
  category: BulletinCategory;
  isPinned: boolean;
  allowRegistration: boolean;
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
  birthDate: string;
  zodiac?: ZodiacSign;
  address?: string;
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

// ─── Deities (神明介紹) ──────────────────────────────────
export interface DeityData {
  name: string;
  title: string;
  description: string;
  imagePath: string | null;
  displayOrder: number;
}

export interface DeityRecord extends DeityData {
  id: string;
  createdAt: string;
  updatedAt: string;
}