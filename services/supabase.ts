import { createClient } from '@supabase/supabase-js';
import type { DevoteeOverride } from './devoteeRoster';
import { AboutSection, AboutSectionData, AboutFacts, DeityFeast, DeityFeastData, FaqItem, FaqItemData, DonationTypeRecord, DonationTypeData, SiteInfo, SectionPage, RelocationPlan, RelocationPlanData, RelocationPlanRow, RelocationHome, AnalyticsSettings, SocialSettings, SOCIAL_KEYS, BlessingAddon, BlessingEventData, BlessingEventPackage, BlessingEventRecord, BlessingOffering, BlessingRegistrationData, BlessingRegistrationRecord, BlessingStatus, ClaimedOffering, BookingData, BookingRecord, BookingSessionData, BookingSessionRecord, BookingStatus, BulletinData, BulletinRecord, DeityData, DeityRecord, DonationData, DonationRecord, FahuiRegistrationRecord, FahuiReconcilePatch, VolunteerRegistrationRecord, HallData, HallRecord, HeroSlideRecord, LampRegistrationData, LampRegistrationRecord, LampRegistrationStatus, LampServiceConfig, LampServiceConfigData, MemberContact, MemberContactData, MemberProfileRecord, ProfileData, RegistrationData, RegistrationRecord, RepairProject, RepairProjectData, ScriptureVerseData, ScriptureVerseRecord, SharedEntryData, SharedEntryRecord, SharedServiceType, SharedSessionConfig, SharedSessionData, SharedSessionRecord, SiteImageRecord, SiteImageSection, ZodiacSign } from '../types';
import { getSource } from './attribution';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Bookings ────────────────────────────────────────────────────────────────

export const submitBooking = async (data: BookingData): Promise<boolean> => {
  const { error } = await supabase.from('bookings').insert([{
    name: data.name,
    phone: data.phone,
    gender: data.gender || null,
    birth_date: data.birthDate,
    zodiac: data.zodiac || null,
    address: data.address || null,
    contact_label: data.contactLabel || null,
    booking_date: data.bookingDate,
    booking_time: data.bookingTime,
    session_id: data.sessionId || null,
    type: data.type,
    notes: data.notes || null,
    status: BookingStatus.PENDING,
    source: getSource(),
  }]);

  if (error) {
    console.error('Error submitting booking:', error);
    throw error;
  }
  return true;
};

export const getBookings = async (): Promise<BookingRecord[]> => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching bookings:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    gender: row.gender || undefined,
    birthDate: row.birth_date,
    zodiac: row.zodiac as ZodiacSign | undefined,
    address: row.address || undefined,
    contactLabel: row.contact_label || undefined,
    bookingDate: row.booking_date,
    bookingTime: row.booking_time,
    sessionId: row.session_id || undefined,
    type: row.type,
    notes: row.notes,
    status: row.status as BookingStatus,
    divineMessage: row.divine_message || undefined,
    createdAt: row.created_at,
    source: row.source ?? undefined,   // 舊資料是 NULL＝早於追蹤上線
  }));
};

export const updateBookingDivineMessage = async (id: string, message: string): Promise<boolean> => {
  const { error } = await supabase.from('bookings').update({ divine_message: message }).eq('id', id);
  if (error) throw error;
  return true;
};

export const updateBookingStatus = async (id: string, status: BookingStatus): Promise<boolean> => {
  const { error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('Error updating booking status:', error);
    throw error;
  }
  return true;
};

// ─── Booking Sessions ─────────────────────────────────────────────────────────

export const getBookingSessions = async (activeOnly = true): Promise<BookingSessionRecord[]> => {
  let query = supabase
    .from('booking_sessions')
    .select('*')
    .order('session_date', { ascending: true })
    .order('session_time', { ascending: true });
  if (activeOnly) {
    // 前台只顯示今天（含）以後的場次，過期場次不可再報名
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    query = query.eq('is_active', true).gte('session_date', today);
  }
  const { data, error } = await query;
  if (error) { console.error('Error fetching booking sessions:', error); throw error; }
  return (data || []).map(r => ({
    id: r.id,
    sessionDate: r.session_date,
    sessionTime: r.session_time,
    maxSlots: r.max_slots,
    isActive: r.is_active,
    createdAt: r.created_at,
  }));
};

export const getBookingCountsBySession = async (): Promise<Record<string, number>> => {
  // 走 SECURITY DEFINER RPC：RLS 收緊後 anon 不可直接讀 bookings，只回傳統計數
  const { data, error } = await supabase.rpc('get_booking_session_counts');
  if (error) { console.error('Error fetching booking counts:', error); return {}; }
  const counts: Record<string, number> = {};
  (data || []).forEach((r: { session_id: string; cnt: number }) => {
    counts[r.session_id] = Number(r.cnt);
  });
  return counts;
};

export const createBookingSession = async (data: BookingSessionData): Promise<BookingSessionRecord> => {
  const { data: row, error } = await supabase
    .from('booking_sessions')
    .insert([{ session_date: data.sessionDate, session_time: data.sessionTime, max_slots: data.maxSlots, is_active: data.isActive }])
    .select()
    .single();
  if (error) { console.error('Error creating booking session:', error); throw error; }
  return { id: row.id, sessionDate: row.session_date, sessionTime: row.session_time, maxSlots: row.max_slots, isActive: row.is_active, createdAt: row.created_at };
};

export const updateBookingSession = async (id: string, updates: Partial<BookingSessionData>): Promise<boolean> => {
  const payload: any = {};
  if (updates.sessionDate !== undefined) payload.session_date = updates.sessionDate;
  if (updates.sessionTime !== undefined) payload.session_time = updates.sessionTime;
  if (updates.maxSlots !== undefined) payload.max_slots = updates.maxSlots;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;
  const { error } = await supabase.from('booking_sessions').update(payload).eq('id', id);
  if (error) { console.error('Error updating booking session:', error); throw error; }
  return true;
};

export const deleteBookingSession = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('booking_sessions').delete().eq('id', id);
  if (error) { console.error('Error deleting booking session:', error); throw error; }
  return true;
};

// ─── Donations ───────────────────────────────────────────────────────────────

export const submitDonation = async (data: DonationData): Promise<boolean> => {
  const { error } = await supabase.from('donations').insert([{
    name: data.name,
    phone: data.phone,
    gender: data.gender || null,
    address: data.address || null,
    contact_label: data.contactLabel || null,
    amount: data.amount,
    type: data.type,
    notes: data.notes || null,
    repair_project_id:   data.repairProjectId   || null,
    repair_project_name: data.repairProjectName || null,
    source: getSource(),
  }]);

  if (error) {
    console.error('Error submitting donation:', error);
    throw error;
  }
  return true;
};

export const getDonations = async (): Promise<DonationRecord[]> => {
  const { data, error } = await supabase
    .from('donations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching donations:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    gender: row.gender || undefined,
    address: row.address || undefined,
    contactLabel: row.contact_label || undefined,
    amount: row.amount,
    type: row.type,
    notes: row.notes,
    repairProjectId:   row.repair_project_id   || undefined,
    repairProjectName: row.repair_project_name || undefined,
    createdAt: row.created_at,
    source: row.source ?? undefined,   // 舊資料是 NULL＝早於追蹤上線
  }));
};

// ─── Bulletins (公佈欄) ─────────────────────────────────────────────────────

export const getBulletins = async (adminMode = false): Promise<BulletinRecord[]> => {
  let query = supabase
    .from('bulletins')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (!adminMode) {
    // 公開模式：只顯示 publish_at 為 null 或已到時間的公告
    query = query.or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching bulletins:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    isPinned: row.is_pinned,
    publishAt: row.publish_at ?? null,
    linkedService: row.linked_service ?? null,
    imageUrl: row.image_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

/**
 * 上傳前在瀏覽器端縮圖。
 * 手機直出照片動輒 4-8MB、4000px 寬，直接上傳會讓前台載入極慢
 * （實測有一張 4.7MB 的公告照片）。長邊壓到 1600px、JPEG 82% 後
 * 通常落在 200-400KB，網頁顯示尺寸最多也才 1000px 左右，看不出差別。
 */
const shrinkImage = async (file: File, maxEdge = 1600, quality = 0.82): Promise<Blob> => {
  // 動畫 GIF 縮圖會只剩第一張，直接原檔上傳
  if (file.type === 'image/gif') return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // 瀏覽器不支援就原檔上傳，不要讓使用者傳不了
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 800 * 1024) return file; // already small enough
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality));
  // 壓不贏原檔就用原檔（例如本來就是小張的 PNG 去背圖）
  return blob && blob.size < file.size ? blob : file;
};

/** 活動照片上傳，回傳公開 URL（與 uploadRepairProjectImage 同慣例） */
export const uploadBulletinImage = async (file: File): Promise<string> => {
  const blob = await shrinkImage(file);
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop()?.toLowerCase() || 'jpg');
  const path = `bulletins/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(SITE_IMAGES_BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '3600', upsert: false });
  if (error) { console.error('Error uploading bulletin image:', error); throw error; }
  const { data } = supabase.storage.from(SITE_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

export const createBulletin = async (data: BulletinData): Promise<boolean> => {
  const { error } = await supabase.from('bulletins').insert([{
    title: data.title,
    content: data.content,
    category: data.category,
    is_pinned: data.isPinned,
    publish_at: data.publishAt ?? null,
    linked_service: data.linkedService ?? null,
    image_url: data.imageUrl ?? null,
  }]);

  if (error) {
    console.error('Error creating bulletin:', error);
    throw error;
  }
  return true;
};

export const updateBulletin = async (id: string, data: Partial<BulletinData>): Promise<boolean> => {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.isPinned !== undefined) updateData.is_pinned = data.isPinned;
  if (data.publishAt !== undefined) updateData.publish_at = data.publishAt ?? null;
  if (data.linkedService !== undefined) updateData.linked_service = data.linkedService ?? null;
  if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl ?? null;

  const { error } = await supabase
    .from('bulletins')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Error updating bulletin:', error);
    throw error;
  }
  return true;
};

export const deleteBulletin = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('bulletins')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting bulletin:', error);
    throw error;
  }
  return true;
};

// ─── Bulletin Registrations (活動報名) ─────────────────────────────────────

export const submitRegistration = async (data: RegistrationData): Promise<boolean> => {
  const { error } = await supabase.from('bulletin_registrations').insert([{
    bulletin_id: data.bulletinId,
    name: data.name,
    phone: data.phone,
    num_people: data.numPeople,
    notes: data.notes || null,
  }]);

  if (error) {
    console.error('Error submitting registration:', error);
    throw error;
  }
  return true;
};

export const getRegistrations = async (bulletinId?: string): Promise<RegistrationRecord[]> => {
  let query = supabase
    .from('bulletin_registrations')
    .select('*')
    .order('created_at', { ascending: false });

  if (bulletinId) {
    query = query.eq('bulletin_id', bulletinId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching registrations:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    bulletinId: row.bulletin_id,
    name: row.name,
    phone: row.phone,
    numPeople: row.num_people,
    notes: row.notes,
    createdAt: row.created_at,
  }));
};

export const deleteRegistration = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('bulletin_registrations')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting registration:', error);
    throw error;
  }
  return true;
};

// ─── Site Images (照片管理) ────────────────────────────────────────────────────

const SITE_IMAGES_BUCKET = 'site-images';

export const getSiteImages = async (): Promise<SiteImageRecord[]> => {
  const { data, error } = await supabase
    .from('site_images')
    .select('*');

  if (error) {
    console.error('Error fetching site images:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    sectionKey: row.section_key as SiteImageSection,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    updatedAt: row.updated_at,
  }));
};

export const uploadSiteImage = async (
  section: SiteImageSection,
  file: File
): Promise<string> => {
  // 先縮圖（見 shrinkImage）。這裡漏掉過：廟方 2026-08 上傳的「關於我們」照片是
  // 手機直出的 IMG_7606.jpeg，4843KB／3024px 寬，而前台只顯示 358px——
  // 一張圖就佔首頁流量的一半以上。
  const blob = await shrinkImage(file);
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop()?.toLowerCase() || 'jpg');
  const storagePath = `${section}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(SITE_IMAGES_BUCKET)
    .upload(storagePath, blob, {
      contentType: blob.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('Error uploading site image:', uploadError);
    throw uploadError;
  }

  const { error: dbError } = await supabase
    .from('site_images')
    .upsert({
      section_key: section,
      storage_path: storagePath,
      original_filename: file.name,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'section_key' });

  if (dbError) {
    console.error('Error updating site_images record:', dbError);
    throw dbError;
  }

  return storagePath;
};

export const getSiteImagePublicUrl = (storagePath: string): string => {
  const { data } = supabase.storage
    .from(SITE_IMAGES_BUCKET)
    .getPublicUrl(storagePath);
  return data.publicUrl;
};

// ─── Deity Halls (殿) ─────────────────────────────────────────────────────────

export const getDeityHalls = async (): Promise<HallRecord[]> => {
  const { data, error } = await supabase
    .from('deity_halls')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const createDeityHall = async (data: HallData): Promise<boolean> => {
  const { error } = await supabase.from('deity_halls').insert([{
    name: data.name,
    display_order: data.displayOrder,
  }]);
  if (error) throw error;
  return true;
};

export const updateDeityHall = async (id: string, data: Partial<HallData>): Promise<boolean> => {
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) upd.name = data.name;
  if (data.displayOrder !== undefined) upd.display_order = data.displayOrder;
  const { error } = await supabase.from('deity_halls').update(upd).eq('id', id);
  if (error) throw error;
  return true;
};

export const deleteDeityHall = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('deity_halls').delete().eq('id', id);
  if (error) throw error;
  return true;
};

// ─── Deities (神明介紹) ────────────────────────────────────────────────────────

export const getDeities = async (): Promise<DeityRecord[]> => {
  const { data, error } = await supabase
    .from('deities')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching deities:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    title: row.title || '',
    description: row.description,
    imagePath: row.image_path,
    displayOrder: row.display_order,
    isVisible: row.is_visible !== false,
    hallId: row.hall_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const createDeity = async (data: DeityData): Promise<boolean> => {
  const { error } = await supabase.from('deities').insert([{
    name: data.name,
    title: data.title || null,
    description: data.description,
    image_path: data.imagePath || null,
    display_order: data.displayOrder,
    is_visible: data.isVisible !== false,
    hall_id: data.hallId ?? null,
  }]);

  if (error) {
    console.error('Error creating deity:', error);
    throw error;
  }
  return true;
};

export const updateDeity = async (id: string, data: Partial<DeityData>): Promise<boolean> => {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.imagePath !== undefined) updateData.image_path = data.imagePath;
  if (data.displayOrder !== undefined) updateData.display_order = data.displayOrder;
  if (data.isVisible !== undefined) updateData.is_visible = data.isVisible;
  if (data.hallId !== undefined) updateData.hall_id = data.hallId ?? null;

  const { error } = await supabase
    .from('deities')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Error updating deity:', error);
    throw error;
  }
  return true;
};

export const deleteDeity = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('deities')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting deity:', error);
    throw error;
  }
  return true;
};

export const uploadDeityImage = async (file: File): Promise<string> => {
  // 神明照片同樣先縮圖再上傳（見 shrinkImage 的說明）
  const blob = await shrinkImage(file);
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'jpg');
  const storagePath = `deities/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(SITE_IMAGES_BUCKET)
    .upload(storagePath, blob, {
      contentType: blob.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Error uploading deity image:', error);
    throw error;
  }

  return storagePath;
};

// ─── Hero Slides (首頁輪播) ──────────────────────────────────────────────────

export const getHeroSlides = async (): Promise<HeroSlideRecord[]> => {
  const { data, error } = await supabase
    .from('hero_slides')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching hero slides:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    imagePath: row.image_path,
    displayOrder: row.display_order,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
};

export const uploadHeroSlide = async (file: File): Promise<HeroSlideRecord> => {
  const blob = await shrinkImage(file);   // 見 shrinkImage
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop()?.toLowerCase() || 'jpg');
  const storagePath = `hero-slides/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(SITE_IMAGES_BUCKET)
    .upload(storagePath, blob, { contentType: blob.type, cacheControl: '3600', upsert: false });

  if (uploadError) throw uploadError;

  const { data: existing } = await supabase
    .from('hero_slides')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .single();

  const nextOrder = existing ? (existing.display_order + 1) : 0;

  const { data, error: dbError } = await supabase
    .from('hero_slides')
    .insert({ image_path: storagePath, display_order: nextOrder })
    .select()
    .single();

  if (dbError) throw dbError;

  return {
    id: data.id,
    imagePath: data.image_path,
    displayOrder: data.display_order,
    isActive: data.is_active,
    createdAt: data.created_at,
  };
};

export const deleteHeroSlide = async (id: string, imagePath: string): Promise<void> => {
  const { error: dbError } = await supabase.from('hero_slides').delete().eq('id', id);
  if (dbError) throw dbError;
  await supabase.storage.from(SITE_IMAGES_BUCKET).remove([imagePath]);
};

// ─── Scripture Verses (聖母經) ──────────────────────────────────────────────

export const getScriptureVerses = async (): Promise<ScriptureVerseRecord[]> => {
  const { data, error } = await supabase
    .from('scripture_verses')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching scripture verses:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    sectionNumber: row.section_number,
    bookPage: row.book_page,
    verse: row.verse,
    annotation: row.annotation,
    imagePath: row.image_path,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const updateScriptureVerse = async (id: string, data: Partial<ScriptureVerseData>): Promise<boolean> => {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.verse !== undefined) updateData.verse = data.verse;
  if (data.annotation !== undefined) updateData.annotation = data.annotation;
  if (data.imagePath !== undefined) updateData.image_path = data.imagePath;
  if (data.bookPage !== undefined) updateData.book_page = data.bookPage;
  if (data.displayOrder !== undefined) updateData.display_order = data.displayOrder;

  const { error } = await supabase
    .from('scripture_verses')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Error updating scripture verse:', error);
    throw error;
  }
  return true;
};

export const uploadScriptureImage = async (file: File): Promise<string> => {
  const blob = await shrinkImage(file);   // 見 shrinkImage
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop()?.toLowerCase() || 'jpg');
  const storagePath = `scripture/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(SITE_IMAGES_BUCKET)
    .upload(storagePath, blob, {
      contentType: blob.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Error uploading scripture image:', error);
    throw error;
  }

  return storagePath;
};

export const deleteScriptureImage = async (imagePath: string): Promise<void> => {
  await supabase.storage.from(SITE_IMAGES_BUCKET).remove([imagePath]);
};

// ─── Lamp Service Configs (點燈服務設定) ──────────────────────────────────────

export const getLampServiceConfigs = async (activeOnly = false): Promise<LampServiceConfig[]> => {
  let query = supabase
    .from('lamp_service_configs')
    .select('*')
    .order('display_order', { ascending: true });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching lamp service configs:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    fee: row.fee,
    description: row.description,
    imageUrl: row.image_url || undefined,
    isActive: row.is_active,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const createLampServiceConfig = async (data: LampServiceConfigData): Promise<boolean> => {
  const { error } = await supabase.from('lamp_service_configs').insert([{
    name: data.name,
    fee: data.fee,
    description: data.description,
    image_url: data.imageUrl || null,
    is_active: data.isActive,
    display_order: data.displayOrder,
  }]);

  if (error) {
    console.error('Error creating lamp service config:', error);
    throw error;
  }
  return true;
};

export const updateLampServiceConfig = async (id: string, data: Partial<LampServiceConfigData>): Promise<boolean> => {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.fee !== undefined) updateData.fee = data.fee;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl || null;
  if (data.isActive !== undefined) updateData.is_active = data.isActive;
  if (data.displayOrder !== undefined) updateData.display_order = data.displayOrder;

  const { error } = await supabase
    .from('lamp_service_configs')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Error updating lamp service config:', error);
    throw error;
  }
  return true;
};

export const deleteLampServiceConfig = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('lamp_service_configs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting lamp service config:', error);
    throw error;
  }
  return true;
};

// ─── Lamp Registrations (點燈報名) ───────────────────────────────────────────

export const submitLampRegistration = async (data: LampRegistrationData): Promise<boolean> => {
  const { error } = await supabase.from('lamp_registrations').insert([{
    service_id: data.serviceId,
    name: data.name,
    phone: data.phone,
    gender: data.gender || null,
    birth_date: data.birthDate,
    zodiac: data.zodiac || null,
    address: data.address || null,
    contact_label: data.contactLabel || null,
    notes: data.notes || null,
    status: LampRegistrationStatus.PENDING,
    source: getSource(),
  }]);

  if (error) {
    console.error('Error submitting lamp registration:', error);
    throw error;
  }
  return true;
};

export const getLampRegistrations = async (): Promise<LampRegistrationRecord[]> => {
  const { data, error } = await supabase
    .from('lamp_registrations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching lamp registrations:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    serviceId: row.service_id,
    name: row.name,
    phone: row.phone,
    gender: row.gender || undefined,
    birthDate: row.birth_date,
    zodiac: row.zodiac as ZodiacSign | undefined,
    address: row.address || undefined,
    contactLabel: row.contact_label || undefined,
    notes: row.notes,
    status: row.status as LampRegistrationStatus,
    createdAt: row.created_at,
    source: row.source ?? undefined,   // 舊資料是 NULL＝早於追蹤上線
  }));
};

export const updateLampRegistrationStatus = async (id: string, status: LampRegistrationStatus): Promise<boolean> => {
  const { error } = await supabase
    .from('lamp_registrations')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('Error updating lamp registration status:', error);
    throw error;
  }
  return true;
};

export const deleteLampRegistration = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('lamp_registrations')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting lamp registration:', error);
    throw error;
  }
  return true;
};

// ─── Member Contacts (會員通訊錄) ─────────────────────────────────────────────

/** 後台：取得指定會員的親友通訊錄（需已登入） */
export const getMemberContactsByUserId = async (userId: string): Promise<MemberContact[]> => {
  const { data, error } = await supabase
    .from('member_contacts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching contacts for user:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    contactNumber: row.contact_number ?? undefined,
    label: row.label,
    name: row.name,
    phone: row.phone,
    birthDate: row.birth_date,
    zodiac: row.zodiac || undefined,
    gender: row.gender || undefined,
    address: row.address || undefined,
    createdAt: row.created_at,
  }));
};

export const getMemberContacts = async (): Promise<MemberContact[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('member_contacts')
    .select('*')
    .eq('user_id', user.id)   // 明確只取自己的資料，不依賴 RLS
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching member contacts:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    contactNumber: row.contact_number ?? undefined,
    label: row.label,
    name: row.name,
    phone: row.phone,
    birthDate: row.birth_date,
    zodiac: row.zodiac || undefined,
    gender: row.gender || undefined,
    address: row.address || undefined,
    createdAt: row.created_at,
  }));
};

/** 後台信眾管理用：取「全部會員」的通訊錄（需管理員權限；RLS 由 is_admin 政策把關） */
export const getAllMemberContactsAdmin = async (): Promise<MemberContact[]> => {
  const { data, error } = await supabase
    .from('member_contacts')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) { console.error('Error fetching all member contacts:', error); return []; }
  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    contactNumber: row.contact_number ?? undefined,
    label: row.label,
    name: row.name,
    phone: row.phone,
    birthDate: row.birth_date,
    zodiac: row.zodiac || undefined,
    gender: row.gender || undefined,
    address: row.address || undefined,
    createdAt: row.created_at,
  }));
};

export const createMemberContact = async (data: MemberContactData): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('member_contacts').insert([{
    user_id: user.id,
    label: data.label,
    name: data.name,
    phone: data.phone,
    birth_date: data.birthDate,
    zodiac: data.zodiac || null,
    gender: data.gender || null,
    address: data.address || null,
  }]);

  if (error) {
    console.error('Error creating member contact:', error);
    throw error;
  }
  return true;
};

/** 報名送出後自動將表單人員存入通訊錄（依姓名去重，靜默失敗） */
export const autoSaveContactsForMember = async (
  persons: Array<{
    name: string;
    birthDate?: string;
    zodiac?: ZodiacSign;
    address?: string;
    gender?: string;
    contactLabel?: string;
  }>,
  fallbackPhone: string,
  existingNames: Set<string>,
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const toInsert = persons
    .filter(p => p.name.trim() && !existingNames.has(p.name.trim()))
    .map(p => ({
      user_id:    user.id,
      label:      p.contactLabel || '朋友',
      name:       p.name.trim(),
      phone:      fallbackPhone,
      birth_date: p.birthDate || '',
      zodiac:     p.zodiac    || null,
      gender:     p.gender    || null,
      address:    p.address   || null,
    }));

  if (!toInsert.length) return;
  const { error } = await supabase.from('member_contacts').insert(toInsert);
  if (error) console.error('autoSaveContacts error:', error);
};

export const updateMemberContact = async (id: string, data: MemberContactData): Promise<boolean> => {
  const { error } = await supabase
    .from('member_contacts')
    .update({
      label: data.label,
      name: data.name,
      phone: data.phone,
      birth_date: data.birthDate,
      zodiac: data.zodiac || null,
      gender: data.gender || null,
      address: data.address || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating member contact:', error);
    throw error;
  }
  return true;
};

export const deleteMemberContact = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('member_contacts')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting member contact:', error);
    throw error;
  }
  return true;
};

// ─── Member Profile (個人資料) ────────────────────────────
/** 後台：取得所有已建立個人資料的會員（需登入） */
/** 後台：取得所有會員的最後登入時間（需已登入，呼叫 RPC） */
export const getUsersLastLogin = async (): Promise<Record<string, string>> => {
  const { data, error } = await supabase.rpc('get_users_last_login');
  if (error || !data) return {};
  const result: Record<string, string> = {};
  for (const row of data as { user_id: string; last_sign_in_at: string }[]) {
    if (row.last_sign_in_at) result[row.user_id] = row.last_sign_in_at;
  }
  return result;
};

export const getAllMemberProfiles = async (): Promise<MemberProfileRecord[]> => {
  const { data, error } = await supabase
    .from('member_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map(row => ({
    userId: row.user_id,
    memberNumber: row.member_number ?? undefined,
    name: row.name || '',
    phone: row.phone || '',
    birthDate: row.birth_date || '',
    zodiac: row.zodiac || undefined,
    gender: row.gender || undefined,
    address: row.address || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || undefined,
  }));
};

export const getProfile = async (): Promise<ProfileData | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('member_profiles')
    .select('*')
    .eq('user_id', user.id)   // 明確只取自己的 profile，不依賴 RLS
    .maybeSingle();

  if (error || !data) return null;
  return {
    name: data.name || '',
    phone: data.phone || '',
    birthDate: data.birth_date || '',
    zodiac: data.zodiac || undefined,
    gender: data.gender || undefined,
    address: data.address || undefined,
  };
};

// ─── Image Upload Helpers ────────────────────────────────────────────────────

export const uploadBlessingImage = async (file: File): Promise<string> => {
  const blob = await shrinkImage(file);   // 見 shrinkImage
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop()?.toLowerCase() || 'jpg');
  const path = `blessings/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(SITE_IMAGES_BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '3600', upsert: false });
  if (error) { console.error(error); throw error; }
  const { data } = supabase.storage.from(SITE_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

export const uploadLampImage = async (file: File): Promise<string> => {
  const blob = await shrinkImage(file);   // 見 shrinkImage
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop()?.toLowerCase() || 'jpg');
  const path = `lamps/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(SITE_IMAGES_BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '3600', upsert: false });
  if (error) { console.error(error); throw error; }
  const { data } = supabase.storage.from(SITE_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

// ─── Blessing Events (祈福活動) ─────────────────────────────────────────────

const mapBlessingEvent = (row: any): BlessingEventRecord => ({
  id: row.id,
  title: row.title,
  description: row.description || undefined,
  eventType: row.event_type,
  startDate: row.start_date,
  endDate: row.end_date,
  registrationDeadline: row.registration_deadline || undefined,
  fee: row.fee,
  packages: Array.isArray(row.packages) ? (row.packages as BlessingEventPackage[]) : [],
  addons: Array.isArray(row.addons) ? (row.addons as BlessingAddon[]) : [],
  offerings: Array.isArray(row.offerings) ? (row.offerings as BlessingOffering[]) : [],
  imageUrl: row.image_url || undefined,
  isActive: row.is_active,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapBlessingReg = (row: any): BlessingRegistrationRecord => ({
  id: row.id,
  eventId: row.event_id,
  name: row.name,
  phone: row.phone,
  birthDate: row.birth_date || undefined,
  zodiac: row.zodiac || undefined,
  gender: row.gender || undefined,
  address: row.address || undefined,
  notes: row.notes || undefined,
  packageName: row.package_name ?? undefined,
  packageFee:  row.package_fee  ?? undefined,
  selectedAddons:   Array.isArray(row.selected_addons)   ? (row.selected_addons   as BlessingAddon[])    : [],
  claimedOfferings: Array.isArray(row.claimed_offerings) ? (row.claimed_offerings as ClaimedOffering[]) : [],
  status: (row.status as BlessingStatus) || BlessingStatus.PENDING,
  createdAt: row.created_at,
  source: row.source ?? undefined,   // 舊資料是 NULL＝早於追蹤上線
});

export const getBlessingEvents = async (activeOnly = false): Promise<BlessingEventRecord[]> => {
  let q = supabase.from('blessing_events').select('*').order('sort_order').order('start_date');
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map(mapBlessingEvent);
};

export const getBlessingEventById = async (id: string): Promise<BlessingEventRecord | null> => {
  const { data, error } = await supabase.from('blessing_events').select('*').eq('id', id).single();
  if (error || !data) return null;
  return mapBlessingEvent(data);
};

export const createBlessingEvent = async (d: BlessingEventData): Promise<boolean> => {
  const { error } = await supabase.from('blessing_events').insert({
    title: d.title,
    description: d.description || null,
    event_type: d.eventType,
    start_date: d.startDate,
    end_date: d.endDate,
    registration_deadline: d.registrationDeadline || null,
    fee: d.fee,
    packages: d.packages || [],
    addons: d.addons || [],
    offerings: d.offerings || [],
    image_url: d.imageUrl || null,
    is_active: d.isActive,
    sort_order: d.sortOrder,
  });
  if (error) { console.error(error); throw error; }
  return true;
};

export const updateBlessingEvent = async (id: string, d: Partial<BlessingEventData>): Promise<boolean> => {
  const payload: any = { updated_at: new Date().toISOString() };
  if (d.title               !== undefined) payload.title                = d.title;
  if (d.description         !== undefined) payload.description          = d.description || null;
  if (d.eventType           !== undefined) payload.event_type           = d.eventType;
  if (d.startDate           !== undefined) payload.start_date           = d.startDate;
  if (d.endDate             !== undefined) payload.end_date             = d.endDate;
  if (d.registrationDeadline !== undefined) payload.registration_deadline = d.registrationDeadline || null;
  if (d.fee                 !== undefined) payload.fee                  = d.fee;
  if (d.imageUrl            !== undefined) payload.image_url            = d.imageUrl || null;
  if (d.isActive            !== undefined) payload.is_active            = d.isActive;
  if (d.sortOrder           !== undefined) payload.sort_order           = d.sortOrder;
  if (d.packages            !== undefined) payload.packages             = d.packages;
  if (d.addons              !== undefined) payload.addons               = d.addons;
  if (d.offerings           !== undefined) payload.offerings            = d.offerings;
  const { error } = await supabase.from('blessing_events').update(payload).eq('id', id);
  if (error) { console.error(error); throw error; }
  return true;
};

export const deleteBlessingEvent = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('blessing_events').delete().eq('id', id);
  if (error) { console.error(error); throw error; }
  return true;
};

// ─── Blessing Registrations (祈福報名) ──────────────────────────────────────

/** 前台祈福 modal 用：只取「各方案已報名數」與「各供品已認領數」統計，不含個資（anon 可呼叫） */
export const getBlessingEventStats = async (eventId: string): Promise<{ packageCounts: Record<string, number>; offeringCounts: Record<string, number> }> => {
  const { data, error } = await supabase.rpc('get_blessing_event_stats', { p_event_id: eventId });
  if (error) { console.error('Error fetching blessing stats:', error); return { packageCounts: {}, offeringCounts: {} }; }
  const row = data as { package_counts?: Record<string, number>; offering_counts?: Record<string, number> } | null;
  return {
    packageCounts: row?.package_counts ?? {},
    offeringCounts: row?.offering_counts ?? {},
  };
};

export const getBlessingRegistrations = async (eventId?: string): Promise<BlessingRegistrationRecord[]> => {
  let q = supabase.from('blessing_registrations').select('*').order('created_at', { ascending: false });
  if (eventId) q = q.eq('event_id', eventId);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map(mapBlessingReg);
};

export const createBlessingRegistration = async (d: BlessingRegistrationData): Promise<boolean> => {
  const { error } = await supabase.from('blessing_registrations').insert({
    event_id: d.eventId,
    name: d.name,
    phone: d.phone,
    birth_date: d.birthDate || null,
    zodiac: d.zodiac || null,
    gender: d.gender || null,
    address: d.address || null,
    notes: d.notes || null,
    package_name:      d.packageName       || null,
    package_fee:       d.packageFee        ?? null,
    selected_addons:   d.selectedAddons    || [],
    claimed_offerings: d.claimedOfferings  || [],
    source: getSource(),
  });
  if (error) { console.error(error); throw error; }
  return true;
};

export const updateBlessingRegistrationStatus = async (id: string, status: BlessingStatus): Promise<boolean> => {
  const { error } = await supabase.from('blessing_registrations').update({ status }).eq('id', id);
  if (error) { console.error(error); throw error; }
  return true;
};

export const deleteBlessingRegistration = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('blessing_registrations').delete().eq('id', id);
  if (error) { console.error(error); throw error; }
  return true;
};

// ─── Member Profile ───────────────────────────────────────────────────────────

export const saveProfile = async (data: ProfileData): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('member_profiles')
    .upsert({
      user_id: user.id,
      name: data.name,
      phone: data.phone,
      birth_date: data.birthDate,
      zodiac: data.zodiac || null,
      gender: data.gender || null,
      address: data.address || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('Error saving profile:', error);
    throw error;
  }
  return true;
};

// ─── Member Registration History (會員報名紀錄) ──────────────────────────────

export const getMyLampRegistrations = async (phone: string): Promise<LampRegistrationRecord[]> => {
  const { data, error } = await supabase
    .from('lamp_registrations')
    .select('*')
    .eq('phone', phone)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(row => ({
    id: row.id, serviceId: row.service_id, name: row.name, phone: row.phone,
    birthDate: row.birth_date, zodiac: row.zodiac as ZodiacSign | undefined,
    address: row.address || undefined, contactLabel: row.contact_label || undefined,
    notes: row.notes || undefined, status: row.status as LampRegistrationStatus,
    createdAt: row.created_at,
  }));
};

export const getMyBookings = async (phone: string): Promise<BookingRecord[]> => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('phone', phone)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(row => ({
    id: row.id, name: row.name, phone: row.phone, birthDate: row.birth_date,
    zodiac: row.zodiac as ZodiacSign | undefined, address: row.address || undefined,
    contactLabel: row.contact_label || undefined, bookingDate: row.booking_date,
    bookingTime: row.booking_time, type: row.type, notes: row.notes || undefined,
    status: row.status as BookingStatus, divineMessage: row.divine_message || undefined,
    createdAt: row.created_at,
  }));
};

export const getMyBlessingRegistrations = async (phone: string): Promise<BlessingRegistrationRecord[]> => {
  const { data, error } = await supabase
    .from('blessing_registrations')
    .select('*')
    .eq('phone', phone)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapBlessingReg);
};

// ─── Shared Sessions (共享報名表) ────────────────────────────────────────────

const mapSharedEntry = (row: any): SharedEntryRecord => ({
  id:           row.id,
  sessionId:    row.session_id,
  name:         row.name,
  phone:        row.phone        ?? undefined,
  birthDate:    row.birth_date   ?? undefined,
  zodiac:       row.zodiac       ?? undefined,
  gender:       row.gender       ?? undefined,
  address:      row.address      ?? undefined,
  contactLabel: row.contact_label ?? undefined,
  serviceId:    row.service_id   ?? undefined,
  packageId:    row.package_id   ?? undefined,
  bookingType:  row.booking_type ?? undefined,
  notes:        row.notes        ?? undefined,
  createdAt:    row.created_at,
});

const mapSharedSession = (row: any): SharedSessionRecord => ({
  id:          row.id,
  serviceType: row.service_type as SharedServiceType,
  config:      row.config as SharedSessionConfig,
  notes:       row.notes ?? undefined,
  status:      row.status as 'open' | 'submitted',
  entries:     (row.shared_session_entries ?? row.entries ?? []).map(mapSharedEntry),
  createdBy:   (row.created_by as string | null) ?? null,
  createdAt:   row.created_at,
  expiresAt:   row.expires_at,
});

// 揪團：**只有主揪要有帳號**，被揪的人不必登入（概念同 Uber Eats 揪團）。
//   主揪 authenticated  建立場次、看到全部名單、按下送出
//   被揪的人 anon       知道 UUID 就能讀這一張、加自己那一筆
// 名單讀取仍走 SECURITY DEFINER RPC，不開放整表查詢，避免個資外洩。
// 寫入由客戶端產生 UUID、不做 .select() 讀回（anon 無 SELECT 權限）。

/**
 * 建立共享場次。**必須先登入**：RLS 的 WITH CHECK 要求 created_by = auth.uid()，
 * 未登入送出會被擋下（前端也會先擋，但不能只靠前端）。
 */
export const createSharedSession = async (d: SharedSessionData): Promise<SharedSessionRecord> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('請先登入會員才能建立揪團報名表');
  const id = crypto.randomUUID();
  const { error } = await supabase
    .from('shared_sessions')
    .insert({ id, service_type: d.serviceType, config: d.config, notes: d.notes || null, created_by: user.id });
  if (error) { console.error(error); throw error; }
  return mapSharedSession({
    id, service_type: d.serviceType, config: d.config, notes: d.notes || null,
    status: 'open', shared_session_entries: [], created_by: user.id,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
};

/**
 * 我開的、還沒送出且未過期的場次。未登入回空陣列。
 * 換裝置也查得到——這正是主揪要登入的理由。
 */
export const getMySharedSessions = async (): Promise<SharedSessionRecord[]> => {
  const { data, error } = await supabase.rpc('get_my_shared_sessions');
  if (error || !Array.isArray(data)) return [];
  return (data as any[]).map(mapSharedSession);
};

/**
 * 我開過的每一張共享報名表——不分狀態、不管過期，給會員中心的揪團紀錄用。
 * 與 getMySharedSessions（只回還能動的）分工不同，見 shared_sessions_history.sql。
 */
export const getMySharedHistory = async (): Promise<SharedSessionRecord[]> => {
  const { data, error } = await supabase.rpc('get_my_shared_history');
  if (error || !Array.isArray(data)) return [];
  return (data as any[]).map(mapSharedSession);
};

/**
 * 主揪刪掉自己的共享報名表。名單靠 ON DELETE CASCADE 一起清。
 * RLS 只放行 created_by = auth.uid()：被揪的人拿著連結刪不掉；
 * 舊場次（created_by 為 NULL）也刪不掉，只能等到期——放寬會讓任何人能刪別人的表。
 *
 * **不要相信回傳沒 error 就代表刪了**：RLS 擋下的 DELETE 是靜默的 0 列，不會報錯
 * （與 anon INSERT 被擋回 200 [] 是同一件事）。用 select('id') 讀回實際刪掉的列數。
 */
export const deleteSharedSession = async (id: string): Promise<boolean> => {
  const { data, error } = await supabase.from('shared_sessions').delete().eq('id', id).select('id');
  if (error) { console.error(error); throw error; }
  return Array.isArray(data) && data.length > 0;
};

export const getSharedSession = async (id: string): Promise<SharedSessionRecord | null> => {
  const { data, error } = await supabase.rpc('get_shared_session', { p_id: id });
  if (error || !data) return null;
  const row = data as { session: any; entries: any[] } | null;
  if (!row?.session) return null;
  return mapSharedSession({ ...row.session, shared_session_entries: row.entries ?? [] });
};

export const addSharedEntry = async (d: SharedEntryData): Promise<SharedEntryRecord> => {
  const id = crypto.randomUUID();
  const payload = {
    id,
    session_id:    d.sessionId,
    name:          d.name,
    phone:         d.phone        || null,
    birth_date:    d.birthDate    || null,
    zodiac:        d.zodiac       || null,
    gender:        d.gender       || null,
    address:       d.address      || null,
    contact_label: d.contactLabel || null,
    service_id:    d.serviceId    || null,
    package_id:    d.packageId    || null,
    booking_type:  d.bookingType  || null,
    notes:         d.notes        || null,
  };
  const { error } = await supabase.from('shared_session_entries').insert(payload);
  if (error) { console.error(error); throw error; }
  return mapSharedEntry({ ...payload, created_at: new Date().toISOString() });
};

export const markSharedSessionSubmitted = async (id: string): Promise<boolean> => {
  const { error } = await supabase.rpc('mark_shared_session_submitted', { p_id: id });
  if (error) { console.error(error); throw error; }
  return true;
};

// ─── Repair Projects (神尊修復專案) ─────────────────────────────────────────

const mapRepairProject = (row: any): RepairProject => ({
  id: row.id,
  name: row.name,
  description: row.description || undefined,
  imageUrl: row.image_url || undefined,
  targetAmount: row.target_amount ?? 0,
  isActive: row.is_active,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
});

export const getRepairProjects = async (): Promise<RepairProject[]> => {
  const { data, error } = await supabase.from('repair_projects').select('*').order('sort_order');
  if (error) { console.error(error); throw error; }
  return (data || []).map(mapRepairProject);
};

export const getRepairProjectTotals = async (): Promise<Record<string, number>> => {
  // 走 SECURITY DEFINER RPC：RLS 收緊後 anon 不可直接讀 donations，只回傳各專案累計
  const { data, error } = await supabase.rpc('get_repair_totals');
  if (error) { console.error(error); throw error; }
  const totals: Record<string, number> = {};
  for (const row of (data || []) as { repair_project_id: string; total: number }[]) {
    totals[row.repair_project_id] = Number(row.total);
  }
  return totals;
};

export const createRepairProject = async (d: RepairProjectData): Promise<boolean> => {
  const { error } = await supabase.from('repair_projects').insert({
    name: d.name,
    description: d.description || null,
    image_url: d.imageUrl || null,
    target_amount: d.targetAmount || 0,
    is_active: d.isActive,
    sort_order: d.sortOrder,
  });
  if (error) { console.error(error); throw error; }
  return true;
};

export const updateRepairProject = async (id: string, d: Partial<RepairProjectData>): Promise<boolean> => {
  const payload: any = {};
  if (d.name        !== undefined) payload.name          = d.name;
  if (d.description !== undefined) payload.description   = d.description || null;
  if (d.imageUrl    !== undefined) payload.image_url     = d.imageUrl || null;
  if (d.targetAmount !== undefined) payload.target_amount = d.targetAmount;
  if (d.isActive    !== undefined) payload.is_active     = d.isActive;
  if (d.sortOrder   !== undefined) payload.sort_order    = d.sortOrder;
  const { error } = await supabase.from('repair_projects').update(payload).eq('id', id);
  if (error) { console.error(error); throw error; }
  return true;
};

export const deleteRepairProject = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('repair_projects').delete().eq('id', id);
  if (error) { console.error(error); throw error; }
  return true;
};

export const uploadRepairProjectImage = async (file: File): Promise<string> => {
  // 神尊照片會有十幾張，同樣先縮圖再上傳（見 shrinkImage 的說明）
  const blob = await shrinkImage(file);
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop()?.toLowerCase() || 'jpg');
  const path = `repair-projects/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(SITE_IMAGES_BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '3600', upsert: false });
  if (error) { console.error(error); throw error; }
  const { data } = supabase.storage.from(SITE_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

// ─── 網站設定：追蹤碼 ───────────────────────────────────────────────────────

const EMPTY_ANALYTICS: AnalyticsSettings = { ga4Id: '', metaPixelId: '', gtmId: '' };

/** 讀取追蹤碼設定。任何錯誤都回空值——追蹤碼掛不上不該讓整個網站失敗 */
export const getAnalyticsSettings = async (): Promise<AnalyticsSettings> => {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key,value')
      .in('key', ['ga4_id', 'meta_pixel_id', 'gtm_id']);
    if (error) throw error;
    const map = new Map((data ?? []).map(r => [r.key as string, (r.value ?? '') as string]));
    return {
      ga4Id: (map.get('ga4_id') ?? '').trim(),
      metaPixelId: (map.get('meta_pixel_id') ?? '').trim(),
      gtmId: (map.get('gtm_id') ?? '').trim(),
    };
  } catch (e) {
    console.warn('讀取追蹤碼設定失敗，本次不掛載追蹤碼:', e);
    return EMPTY_ANALYTICS;
  }
};

export const saveAnalyticsSettings = async (s: AnalyticsSettings): Promise<boolean> => {
  const rows = [
    { key: 'ga4_id', value: s.ga4Id.trim(), updated_at: new Date().toISOString() },
    { key: 'meta_pixel_id', value: s.metaPixelId.trim(), updated_at: new Date().toISOString() },
    { key: 'gtm_id', value: s.gtmId.trim(), updated_at: new Date().toISOString() },
  ];
  const { error } = await supabase.from('site_settings').upsert(rows, { onConflict: 'key' });
  if (error) {
    console.error('Error saving analytics settings:', error);
    throw error;
  }
  return true;
};

// ─── 信眾名冊人工校正 ───────────────────────────────────────────────────────

/** 讀取校正規則。表還沒建好時回空陣列——名冊仍可正常顯示，只是沒有校正 */
export const getDevoteeOverrides = async (): Promise<DevoteeOverride[]> => {
  try {
    const { data, error } = await supabase
      .from('devotee_overrides')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(r => ({
      id: r.id,
      kind: r.kind as DevoteeOverride['kind'],
      nameKey: r.name_key,
      targetKey: r.target_key ?? null,
      payload: r.payload ?? null,
      note: r.note ?? null,
    }));
  } catch (e) {
    console.warn('讀取名冊校正規則失敗，本次不套用校正:', e);
    return [];
  }
};

/** 新增或覆蓋一條校正規則（同 kind + name_key 只留一筆） */
export const saveDevoteeOverride = async (o: DevoteeOverride): Promise<boolean> => {
  const { error } = await supabase.from('devotee_overrides').upsert({
    kind: o.kind,
    name_key: o.nameKey,
    target_key: o.targetKey ?? null,
    payload: o.payload ?? null,
    note: o.note ?? null,
  }, { onConflict: 'kind,name_key' });
  if (error) { console.error('Error saving devotee override:', error); throw error; }
  return true;
};

export const deleteDevoteeOverride = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('devotee_overrides').delete().eq('id', id);
  if (error) { console.error('Error deleting devotee override:', error); throw error; }
  return true;
};

// ─── 網站設定：社群帳號 ─────────────────────────────────────────────────────

/** 廟方原本就在用的帳號，當作預設值——設定表還沒建好時前台不會突然少一排圖示 */
export const DEFAULT_SOCIAL: SocialSettings = {
  lineUrl: 'https://lin.ee/lj0gLqR',
  facebookUrl: 'https://www.facebook.com/100064534546570',
  facebookGroupUrl: '',
  instagramUrl: '',
  tiktokUrl: '',
};

export const getSocialSettings = async (): Promise<SocialSettings> => {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key,value')
      .in('key', SOCIAL_KEYS.map(k => k.dbKey));
    if (error) throw error;
    // 設定表沒有任何社群資料時（migration 還沒跑）退回預設值
    if (!data || data.length === 0) return DEFAULT_SOCIAL;
    const map = new Map(data.map(r => [r.key as string, ((r.value ?? '') as string).trim()]));
    const out = {} as SocialSettings;
    for (const k of SOCIAL_KEYS) out[k.field] = map.get(k.dbKey) ?? '';
    return out;
  } catch (e) {
    console.warn('讀取社群設定失敗，改用預設值:', e);
    return DEFAULT_SOCIAL;
  }
};

export const saveSocialSettings = async (s: SocialSettings): Promise<boolean> => {
  const now = new Date().toISOString();
  const rows = SOCIAL_KEYS.map(k => ({ key: k.dbKey, value: s[k.field].trim(), updated_at: now }));
  const { error } = await supabase.from('site_settings').upsert(rows, { onConflict: 'key' });
  if (error) {
    console.error('Error saving social settings:', error);
    throw error;
  }
  return true;
};

// ─── LINE Click Tracking ───────────────────────────────────────────────────

/** 記錄一次 LINE 按鈕點擊（fire-and-forget，不拋錯） */
export const trackLineClick = async (source: string): Promise<void> => {
  try {
    await supabase.from('line_clicks').insert([{ source }]);
  } catch {
    // 不影響使用者體驗
  }
};

/** 取得 LINE 導流統計（今日 / 累計）；「今日」以本地時區計算，避免台灣早上 8 點前統計錯置 */
export const getLineClickStats = async (): Promise<{ today: number; total: number }> => {
  const { data, error } = await supabase
    .from('line_clicks')
    .select('clicked_at');
  if (error || !data) return { today: 0, total: 0 };
  const localDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayStr = localDateStr(new Date());
  const today = data.filter(r => localDateStr(new Date(r.clicked_at as string)) === todayStr).length;
  return { today, total: data.length };
};

// ─── 法會報名 ────────────────────────────────────────────────────────────────

export interface FahuiRegistrationData {
  contact: { name: string; gender?: string; phone: string; address: string; lineId: string; email?: string; accountLast5?: string; birthDate?: string; zodiac?: string };
  entries: Record<string, Array<Record<string, string>>>;
  total: number;
  zanpuOffering?: string;
  mealSponsor?: number;
  notes?: string;
}

export const submitFahuiRegistration = async (data: FahuiRegistrationData): Promise<void> => {
  // 不使用 .select() 讀回：anon 角色僅有 INSERT 權限、無 SELECT 權限，
  // 讀回會觸發 RLS 阻擋。送出成功即可，無需回傳資料。
  const { error } = await supabase
    .from('fahui_registrations')
    .insert([{
      name: data.contact.name,
      contact_gender: data.contact.gender || null,
      phone: data.contact.phone,
      address: data.contact.address,
      line_id: data.contact.lineId || null,
      email: data.contact.email?.trim() || null,
      account_last5: data.contact.accountLast5?.trim() || null,
      contact_birth_date: data.contact.birthDate || null,
      contact_zodiac: data.contact.zodiac || null,
      entries: data.entries,
      zanpu_offering: data.zanpuOffering || null,
      meal_sponsor: data.mealSponsor || 0,
      notes: data.notes || null,
      total_amount: data.total,
      source: getSource(),
    }]);

  if (error) {
    console.error('Error submitting fahui registration:', error);
    throw error;
  }
};

export const getFahuiRegistrations = async (): Promise<FahuiRegistrationRecord[]> => {
  const { data, error } = await supabase
    .from('fahui_registrations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching fahui registrations:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    source: row.source ?? undefined,   // 舊資料是 NULL＝早於追蹤上線
    name: row.name,
    phone: row.phone,
    address: row.address,
    lineId: row.line_id || undefined,
    email: row.email || undefined,
    contactGender: row.contact_gender || undefined,
    contactBirthDate: row.contact_birth_date || undefined,
    contactZodiac: row.contact_zodiac || undefined,
    entries: row.entries || {},
    zanpuOffering: row.zanpu_offering || undefined,
    mealSponsor: row.meal_sponsor ?? 0,
    notes: row.notes || undefined,
    totalAmount: row.total_amount ?? 0,
    status: row.status || 'pending',
    paymentMethod: row.payment_method || undefined,
    paymentDate: row.payment_date || undefined,
    accountLast5: row.account_last5 || undefined,
    financeCheck: row.finance_check ?? false,
    // 這欄原本是 BOOLEAN。若 fahui_thanks_letter_no.sql 還沒跑，讀到的會是 true/false，
    // 直接塞進文字欄位會讓輸入框顯示「true」。只認字串，其餘一律當成未填。
    thanksLetter: typeof row.thanks_letter === 'string' ? (row.thanks_letter || undefined) : undefined,
    accountingCheck: row.accounting_check ?? false,
    adminNote: row.admin_note || undefined,
  }));
};

/** 更新後台對帳欄位（只更新有帶到的欄位） */
export const updateFahuiReconcile = async (id: string, patch: FahuiReconcilePatch): Promise<void> => {
  const row: Record<string, unknown> = {};
  if ('paymentMethod' in patch)   row.payment_method   = patch.paymentMethod || null;
  if ('paymentDate' in patch)     row.payment_date     = patch.paymentDate || null;
  if ('accountLast5' in patch)    row.account_last5    = patch.accountLast5 || null;
  if ('financeCheck' in patch)    row.finance_check    = patch.financeCheck;
  if ('thanksLetter' in patch)    row.thanks_letter    = patch.thanksLetter || null;
  if ('accountingCheck' in patch) row.accounting_check = patch.accountingCheck;
  if ('adminNote' in patch)       row.admin_note       = patch.adminNote || null;
  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from('fahui_registrations').update(row).eq('id', id);
  if (error) { console.error('Error updating fahui reconcile fields:', error); throw error; }
};

/** 更新報名項目內容（後台修正／回補欄位，例如既有報名缺的性別）。整包 entries 覆寫。 */
export const updateFahuiEntries = async (id: string, entries: Record<string, Array<Record<string, string>>>): Promise<void> => {
  const { error } = await supabase.from('fahui_registrations').update({ entries }).eq('id', id);
  if (error) { console.error('Error updating fahui entries:', error); throw error; }
};

/** 更新聯絡人基本資料（後台修正用；不含報名項目） */
export const updateFahuiContact = async (id: string, patch: { name?: string; gender?: string | null; phone?: string; address?: string; lineId?: string | null; email?: string | null }): Promise<void> => {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.gender !== undefined) row.contact_gender = patch.gender || null;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.address !== undefined) row.address = patch.address;
  if (patch.lineId !== undefined) row.line_id = patch.lineId || null;
  if (patch.email !== undefined) row.email = patch.email || null;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from('fahui_registrations').update(row).eq('id', id);
  if (error) { console.error('Error updating fahui contact:', error); throw error; }
};
export const updateFahuiStatus = async (id: string, status: string): Promise<void> => {
  const { error } = await supabase
    .from('fahui_registrations')
    .update({ status })
    .eq('id', id);
  if (error) { console.error('Error updating fahui status:', error); throw error; }
};

export const deleteFahuiRegistration = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('fahui_registrations')
    .delete()
    .eq('id', id);
  if (error) { console.error('Error deleting fahui registration:', error); throw error; }
};

// ─── 志工報名 ────────────────────────────────────────────────────────────────

export interface VolunteerRegistrationData {
  name: string;
  phone: string;
  address: string;
  diet?: string;
  birthDate?: string;
  zodiac?: string;
  lineId?: string;
  availability?: Record<string, string[]>;
  availabilityNote?: string;
}

export const submitVolunteerRegistration = async (data: VolunteerRegistrationData): Promise<void> => {
  // 同法會：anon 僅有 INSERT 權限，不做 .select() 讀回
  const { error } = await supabase
    .from('volunteer_registrations')
    .insert([{
      name: data.name,
      phone: data.phone,
      address: data.address,
      diet: data.diet || null,
      birth_date: data.birthDate || null,
      zodiac: data.zodiac || null,
      line_id: data.lineId || null,
      availability: data.availability && Object.keys(data.availability).length ? data.availability : null,
      availability_note: data.availabilityNote || null,
      source: getSource(),
    }]);
  if (error) { console.error('Error submitting volunteer registration:', error); throw error; }
};

export const getVolunteerRegistrations = async (): Promise<VolunteerRegistrationRecord[]> => {
  const { data, error } = await supabase
    .from('volunteer_registrations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('Error fetching volunteer registrations:', error); throw error; }
  return (data || []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    source: row.source ?? undefined,   // 舊資料是 NULL＝早於追蹤上線
    name: row.name,
    phone: row.phone,
    address: row.address,
    diet: row.diet || undefined,
    birthDate: row.birth_date || undefined,
    zodiac: row.zodiac || undefined,
    lineId: row.line_id || undefined,
    availability: row.availability || undefined,
    availabilityNote: row.availability_note || undefined,
    status: row.status || 'pending',
  }));
};

export const updateVolunteerStatus = async (id: string, status: string): Promise<void> => {
  const { error } = await supabase.from('volunteer_registrations').update({ status }).eq('id', id);
  if (error) { console.error('Error updating volunteer status:', error); throw error; }
};

export const deleteVolunteerRegistration = async (id: string): Promise<void> => {
  const { error } = await supabase.from('volunteer_registrations').delete().eq('id', id);
  if (error) { console.error('Error deleting volunteer registration:', error); throw error; }
};

// ─── 關於我們（後台可編輯的圖文段落）──────────────────────────────────────────

/** 段落照片上傳，回傳 storage 路徑（不是完整網址，與 site_images 的慣例一致） */
export const uploadAboutImage = async (file: File): Promise<string> => {
  const blob = await shrinkImage(file);
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop()?.toLowerCase() || 'jpg');
  const path = `about/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(SITE_IMAGES_BUCKET)
    .upload(path, blob, { contentType: blob.type, cacheControl: '3600', upsert: false });
  if (error) { console.error('Error uploading about image:', error); throw error; }
  return path;
};

const mapAboutRow = (r: Record<string, unknown>): AboutSection => ({
  id: String(r.id),
  page: ((r.page as SectionPage) || 'about'),
  sortOrder: Number(r.sort_order ?? 0),
  heading: (r.heading as string) || '',
  body: (r.body as string) || '',
  imagePath: (r.image_path as string) || null,
  caption: (r.caption as string) || '',
  isVisible: (r.is_visible as boolean) ?? true,
});

/**
 * 讀取段落。
 * @param includeHidden 後台傳 true 才會拿到隱藏的段落；前台不要傳，
 *   否則就算 RLS 擋住也會多送一次無謂的查詢條件。
 */
export const getAboutSections = async (includeHidden = false, page: SectionPage = 'about'): Promise<AboutSection[]> => {
  let query = supabase.from('about_sections').select('*')
    .eq('page', page)
    .order('sort_order', { ascending: true });
  if (!includeHidden) query = query.eq('is_visible', true);
  const { data, error } = await query;
  // 這裡不寫 console.error：表還沒建（migration 未跑）對訪客不是錯誤，
  // 前台會退回保底文案。要不要當成錯誤由呼叫端決定——後台才需要大聲抱怨。
  if (error) throw error;
  return (data || []).map(mapAboutRow);
};

/** 新增一個段落，回傳新的 id。id 由客戶端產：anon 不可 select 讀回（RLS） */
export const createAboutSection = async (data: AboutSectionData): Promise<string> => {
  const id = crypto.randomUUID();
  const { error } = await supabase.from('about_sections').insert({
    id,
    page: data.page,
    sort_order: data.sortOrder,
    heading: data.heading || null,
    body: data.body || null,
    image_path: data.imagePath,
    caption: data.caption || null,
    is_visible: data.isVisible,
  });
  if (error) { console.error('Error creating about section:', error); throw error; }
  return id;
};

/** 只更新有帶到的欄位 */
export const updateAboutSection = async (id: string, patch: Partial<AboutSectionData>): Promise<void> => {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('sortOrder' in patch)  row.sort_order = patch.sortOrder;
  if ('heading' in patch)    row.heading    = patch.heading || null;
  if ('body' in patch)       row.body       = patch.body || null;
  if ('imagePath' in patch)  row.image_path = patch.imagePath;
  if ('caption' in patch)    row.caption    = patch.caption || null;
  if ('isVisible' in patch)  row.is_visible = patch.isVisible;
  const { error } = await supabase.from('about_sections').update(row).eq('id', id);
  if (error) { console.error('Error updating about section:', error); throw error; }
};

export const deleteAboutSection = async (id: string): Promise<void> => {
  const { error } = await supabase.from('about_sections').delete().eq('id', id);
  if (error) { console.error('Error deleting about section:', error); throw error; }
};

/**
 * 拖拉排序後整批重寫順序。
 * 逐列 update 而不是 upsert：upsert 會把沒帶到的欄位覆蓋成 null，
 * 排序只該動 sort_order，內文不能被清掉。
 */
export const reorderAboutSections = async (idsInOrder: string[]): Promise<void> => {
  await Promise.all(idsInOrder.map((id, i) =>
    supabase.from('about_sections').update({ sort_order: i }).eq('id', id)
  ));
};

/**
 * 觸發正式站重新部署（後台「重新發布」用）。
 *
 * 前端**不持有** Deploy Hook 的網址——那等於部署權限，而 VITE_ 開頭的環境變數
 * 會被打包進 JS 檔案、任何人都看得到。這裡只呼叫自家的 /api/republish，
 * 並附上登入者的 token，由那支端點確認是管理員後才去打 Vercel。
 */
export const requestRepublish = async (): Promise<void> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('尚未登入');
  const res = await fetch('/api/republish', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
};

// ─── 網站基本資料（site_settings 的 info_ 系列）──────────────────────────
// 沿用 site_settings，不另外開表：這只是幾個字串。

const INFO_KEYS: { field: keyof SiteInfo; dbKey: string; fallback: string }[] = [
  { field: 'address',    dbKey: 'info_address',     fallback: '100 臺北市中正區晉江街 72 巷 9 號' },
  { field: 'street',     dbKey: 'info_street',      fallback: '晉江街72巷9號' },
  { field: 'locality',   dbKey: 'info_locality',    fallback: '中正區' },
  { field: 'region',     dbKey: 'info_region',      fallback: '臺北市' },
  { field: 'postalCode', dbKey: 'info_postal_code', fallback: '100' },
  { field: 'phone',      dbKey: 'info_phone',       fallback: '0953-945-349' },
  { field: 'hoursOpen',  dbKey: 'info_hours_open',  fallback: '06:00' },
  { field: 'hoursClose', dbKey: 'info_hours_close', fallback: '23:00' },
];

/** 保底值：資料表沒建或讀取失敗時用這份，前台不會出現空白的地址與電話 */
export const DEFAULT_SITE_INFO: SiteInfo = INFO_KEYS.reduce(
  (acc, k) => ({ ...acc, [k.field]: k.fallback }), {} as SiteInfo,
);

export const getSiteInfo = async (): Promise<SiteInfo> => {
  try {
    const { data, error } = await supabase.from('site_settings')
      .select('key,value').in('key', INFO_KEYS.map(k => k.dbKey));
    if (error) throw error;
    const map = new Map((data || []).map(r => [r.key as string, ((r.value ?? '') as string).trim()]));
    return INFO_KEYS.reduce((acc, k) => ({
      ...acc, [k.field]: map.get(k.dbKey) || k.fallback,
    }), {} as SiteInfo);
  } catch (e) {
    console.warn('讀取網站基本資料失敗，改用保底值:', e);
    return DEFAULT_SITE_INFO;
  }
};

export const saveSiteInfo = async (v: SiteInfo): Promise<void> => {
  const now = new Date().toISOString();
  const rows = INFO_KEYS.map(k => ({ key: k.dbKey, value: v[k.field], updated_at: now }));
  const { error } = await supabase.from('site_settings').upsert(rows, { onConflict: 'key' });
  if (error) { console.error('Error saving site info:', error); throw error; }
};

// ─── 捐款類別（donation_types）────────────────────────────────────────────

const mapDonationTypeRow = (r: Record<string, unknown>): DonationTypeRecord => ({
  id: String(r.id),
  sortOrder: Number(r.sort_order ?? 0),
  name: String(r.name ?? ''),
  isVisible: r.is_visible !== false,
});

export const getDonationTypes = async (includeHidden = false): Promise<DonationTypeRecord[]> => {
  let query = supabase.from('donation_types').select('*').order('sort_order', { ascending: true });
  if (!includeHidden) query = query.eq('is_visible', true);
  const { data, error } = await query;
  // 不寫 console.error：表還沒建對訪客不是錯誤，前台會退回 DonationType 列舉
  if (error) throw error;
  return (data || []).map(mapDonationTypeRow);
};

export const createDonationType = async (data: DonationTypeData): Promise<string> => {
  const id = crypto.randomUUID();
  const { error } = await supabase.from('donation_types').insert({
    id, sort_order: data.sortOrder, name: data.name, is_visible: data.isVisible,
  });
  if (error) { console.error('Error creating donation type:', error); throw error; }
  return id;
};

export const updateDonationType = async (id: string, patch: Partial<DonationTypeData>): Promise<void> => {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('sortOrder' in patch) row.sort_order = patch.sortOrder;
  if ('name' in patch)      row.name       = patch.name;
  if ('isVisible' in patch) row.is_visible = patch.isVisible;
  const { error } = await supabase.from('donation_types').update(row).eq('id', id);
  if (error) { console.error('Error updating donation type:', error); throw error; }
};

export const deleteDonationType = async (id: string): Promise<void> => {
  const { error } = await supabase.from('donation_types').delete().eq('id', id);
  if (error) { console.error('Error deleting donation type:', error); throw error; }
};

export const reorderDonationTypes = async (idsInOrder: string[]): Promise<void> => {
  await Promise.all(idsInOrder.map((id, i) =>
    supabase.from('donation_types').update({ sort_order: i }).eq('id', id)
  ));
};

/**
 * 把既有捐款紀錄裡的類別文字一起改掉。
 *
 * **只有廟方在後台明確勾選時才呼叫。** 預設不動歷史——`donations.type` 是財務資料，
 * 「改個顯示名稱」不該悄悄重寫過去的帳。打錯字時才需要一併更新。
 */
export const renameDonationsType = async (oldName: string, newName: string): Promise<void> => {
  const { error } = await supabase.from('donations').update({ type: newName }).eq('type', oldName);
  if (error) { console.error('Error renaming donations type:', error); throw error; }
};

// ─── 常見問題（faq_items）────────────────────────────────────────────────
// 寫法與 about_sections 一致：一列一題、拖拉排序整批重寫 sort_order、
// id 由客戶端產（anon 不可 select 讀回）。

const mapFaqRow = (r: Record<string, unknown>): FaqItem => ({
  id: String(r.id),
  sortOrder: Number(r.sort_order ?? 0),
  question: String(r.question ?? ''),
  answer: String(r.answer ?? ''),
  isVisible: r.is_visible !== false,
});

export const getFaqItems = async (includeHidden = false): Promise<FaqItem[]> => {
  let query = supabase.from('faq_items').select('*').order('sort_order', { ascending: true });
  if (!includeHidden) query = query.eq('is_visible', true);
  const { data, error } = await query;
  // 不寫 console.error：表還沒建（migration 未跑）對訪客不是錯誤，前台會退回 content/faq.json。
  // 要不要當成錯誤由呼叫端決定——後台才需要大聲抱怨。
  if (error) throw error;
  return (data || []).map(mapFaqRow);
};

/** 新增一題，回傳新的 id。id 由客戶端產：anon 不可 select 讀回（RLS） */
export const createFaqItem = async (data: FaqItemData): Promise<string> => {
  const id = crypto.randomUUID();
  const { error } = await supabase.from('faq_items').insert({
    id,
    sort_order: data.sortOrder,
    question: data.question,
    answer: data.answer,
    is_visible: data.isVisible,
  });
  if (error) { console.error('Error creating faq item:', error); throw error; }
  return id;
};

/** 只更新有帶到的欄位 */
export const updateFaqItem = async (id: string, patch: Partial<FaqItemData>): Promise<void> => {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('sortOrder' in patch) row.sort_order = patch.sortOrder;
  if ('question' in patch)  row.question   = patch.question;
  if ('answer' in patch)    row.answer     = patch.answer;
  if ('isVisible' in patch) row.is_visible = patch.isVisible;
  const { error } = await supabase.from('faq_items').update(row).eq('id', id);
  if (error) { console.error('Error updating faq item:', error); throw error; }
};

export const deleteFaqItem = async (id: string): Promise<void> => {
  const { error } = await supabase.from('faq_items').delete().eq('id', id);
  if (error) { console.error('Error deleting faq item:', error); throw error; }
};

/** 拖拉排序後整批重寫順序。逐列 update，不用 upsert（upsert 會把沒帶到的欄位清成 null） */
export const reorderFaqItems = async (idsInOrder: string[]): Promise<void> => {
  await Promise.all(idsInOrder.map((id, i) =>
    supabase.from('faq_items').update({ sort_order: i }).eq('id', id)
  ));
};

const ABOUT_FACT_KEYS: { field: keyof AboutFacts; dbKey: string; fallback: string }[] = [
  { field: 'fact1Value', dbKey: 'about_fact1_value', fallback: '1986' },
  { field: 'fact1Label', dbKey: 'about_fact1_label', fallback: '建壇年份' },
  { field: 'fact2Value', dbKey: 'about_fact2_value', fallback: '10萬+' },
  { field: 'fact2Label', dbKey: 'about_fact2_label', fallback: '年度信眾' },
];

export const DEFAULT_ABOUT_FACTS: AboutFacts = {
  fact1Value: '1986', fact1Label: '建壇年份',
  fact2Value: '10萬+', fact2Label: '年度信眾',
};

/** 讀不到就退回預設值：Supabase 閒置暫停時首頁不該因此開天窗 */
export const getAboutFacts = async (): Promise<AboutFacts> => {
  try {
    const { data, error } = await supabase.from('site_settings')
      .select('key,value').in('key', ABOUT_FACT_KEYS.map(k => k.dbKey));
    if (error) throw error;
    if (!data || data.length === 0) return DEFAULT_ABOUT_FACTS;
    const map = new Map(data.map(r => [r.key as string, ((r.value ?? '') as string).trim()]));
    const out = {} as AboutFacts;
    for (const k of ABOUT_FACT_KEYS) out[k.field] = map.get(k.dbKey) || k.fallback;
    return out;
  } catch (e) {
    console.warn('讀取關於我們數字卡失敗，改用預設值:', e);
    return DEFAULT_ABOUT_FACTS;
  }
};

export const saveAboutFacts = async (facts: AboutFacts): Promise<void> => {
  const rows = ABOUT_FACT_KEYS.map(k => ({ key: k.dbKey, value: facts[k.field], updated_at: new Date().toISOString() }));
  const { error } = await supabase.from('site_settings').upsert(rows, { onConflict: 'key' });
  if (error) { console.error('Error saving about facts:', error); throw error; }
};

// ─── 遷址捐款方案（金額當欄、回饋項目當列的矩陣表）──────────────────────────

/** cells 少於 tiers 時補空字串：後台加了一欄但還沒填格子，前台不該因此壞版 */
const normalizePlanRows = (rows: unknown, tierCount: number): RelocationPlanRow[] =>
  (Array.isArray(rows) ? rows : []).map((r) => {
    const row = (r ?? {}) as { label?: unknown; cells?: unknown };
    const cells = Array.isArray(row.cells) ? row.cells.map(c => String(c ?? '')) : [];
    while (cells.length < tierCount) cells.push('');
    return { label: String(row.label ?? ''), cells: cells.slice(0, tierCount) };
  });

const mapPlanRow = (r: Record<string, unknown>): RelocationPlan => {
  const tiers = (Array.isArray(r.tiers) ? r.tiers : []).map(t => String(t ?? ''));
  return {
    id: String(r.id),
    sortOrder: Number(r.sort_order ?? 0),
    title: (r.title as string) || '',
    amountHeader: (r.amount_header as string) || '',
    intro: (r.intro as string) || '',
    tiers,
    rows: normalizePlanRows(r.rows, tiers.length),
    note: (r.note as string) || '',
    isVisible: (r.is_visible as boolean) ?? true,
  };
};

export const getRelocationPlans = async (includeHidden = false): Promise<RelocationPlan[]> => {
  let query = supabase.from('relocation_plans').select('*').order('sort_order', { ascending: true });
  if (!includeHidden) query = query.eq('is_visible', true);
  const { data, error } = await query;
  // 與 getAboutSections 同理：表還沒建對訪客不是錯誤，交給呼叫端決定怎麼記錄
  if (error) throw error;
  return (data || []).map(mapPlanRow);
};

export const createRelocationPlan = async (data: RelocationPlanData): Promise<string> => {
  const id = crypto.randomUUID();
  const { error } = await supabase.from('relocation_plans').insert({
    id,
    sort_order: data.sortOrder,
    title: data.title || null,
    amount_header: data.amountHeader || null,
    intro: data.intro || null,
    tiers: data.tiers,
    rows: data.rows,
    note: data.note || null,
    is_visible: data.isVisible,
  });
  if (error) { console.error('Error creating relocation plan:', error); throw error; }
  return id;
};

export const updateRelocationPlan = async (id: string, patch: Partial<RelocationPlanData>): Promise<void> => {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('sortOrder' in patch)    row.sort_order    = patch.sortOrder;
  if ('title' in patch)        row.title         = patch.title || null;
  if ('amountHeader' in patch) row.amount_header = patch.amountHeader || null;
  if ('intro' in patch)        row.intro         = patch.intro || null;
  if ('tiers' in patch)        row.tiers         = patch.tiers;
  if ('rows' in patch)         row.rows          = patch.rows;
  if ('note' in patch)         row.note          = patch.note || null;
  if ('isVisible' in patch)    row.is_visible    = patch.isVisible;
  const { error } = await supabase.from('relocation_plans').update(row).eq('id', id);
  if (error) { console.error('Error updating relocation plan:', error); throw error; }
};

export const deleteRelocationPlan = async (id: string): Promise<void> => {
  const { error } = await supabase.from('relocation_plans').delete().eq('id', id);
  if (error) { console.error('Error deleting relocation plan:', error); throw error; }
};

// ─── 首頁「遷址捐款」摘要 ────────────────────────────────────────────────────
// 沿用 site_settings，不另外開表：這只是兩個字串，為它建一張表沒有意義。
// 留空時前台會退回 /relocation 的第一個段落，所以不必強迫填。

const RELOCATION_HOME_KEYS = {
  heading: 'relocation_home_heading',
  body: 'relocation_home_body',
};

export const getRelocationHome = async (): Promise<RelocationHome> => {
  try {
    const { data, error } = await supabase.from('site_settings')
      .select('key,value').in('key', Object.values(RELOCATION_HOME_KEYS));
    if (error) throw error;
    const map = new Map((data || []).map(r => [r.key as string, ((r.value ?? '') as string)]));
    return {
      heading: (map.get(RELOCATION_HOME_KEYS.heading) || '').trim(),
      body: (map.get(RELOCATION_HOME_KEYS.body) || '').trim(),
    };
  } catch (e) {
    console.warn('讀取首頁遷址摘要失敗:', e);
    return { heading: '', body: '' };
  }
};

export const saveRelocationHome = async (v: RelocationHome): Promise<void> => {
  const now = new Date().toISOString();
  const { error } = await supabase.from('site_settings').upsert([
    { key: RELOCATION_HOME_KEYS.heading, value: v.heading, updated_at: now },
    { key: RELOCATION_HOME_KEYS.body, value: v.body, updated_at: now },
  ], { onConflict: 'key' });
  if (error) { console.error('Error saving relocation home summary:', error); throw error; }
};


// ─── 歲時祭曆（deity_feasts）────────────────────────────────────────────────
// 每年重複的日子（聖誕、節日）。單次活動在 blessing_events，兩張表刻意分開，
// 理由見 supabase/migrations/deity_feasts.sql 的檔頭。

const mapFeastRow = (r: Record<string, unknown>): DeityFeast => ({
  id:           String(r.id),
  title:        String(r.title ?? ''),
  calendarType: (r.calendar_type as DeityFeast['calendarType']) ?? 'lunar',
  lunarMonth:   r.lunar_month === null || r.lunar_month === undefined ? null : Number(r.lunar_month),
  lunarDay:     r.lunar_day   === null || r.lunar_day   === undefined ? null : Number(r.lunar_day),
  isLeapMonth:  Boolean(r.is_leap_month),
  solarMonth:   r.solar_month === null || r.solar_month === undefined ? null : Number(r.solar_month),
  solarDay:     r.solar_day   === null || r.solar_day   === undefined ? null : Number(r.solar_day),
  jieqi:        (r.jieqi as string | null) ?? null,
  note:         String(r.note ?? ''),
  isVisible:    Boolean(r.is_visible),
  sortOrder:    Number(r.sort_order ?? 0),
});

/** 資料列。型態決定要送哪幾個欄位——送錯會撞上 deity_feasts_date_fields 這條 CHECK */
const feastRow = (d: DeityFeastData) => ({
  title:         d.title,
  calendar_type: d.calendarType,
  lunar_month:   d.calendarType === 'lunar' ? d.lunarMonth : null,
  lunar_day:     d.calendarType === 'lunar' ? d.lunarDay   : null,
  is_leap_month: d.calendarType === 'lunar' ? d.isLeapMonth : false,
  solar_month:   d.calendarType === 'solar' ? d.solarMonth : null,
  solar_day:     d.calendarType === 'solar' ? d.solarDay   : null,
  jieqi:         d.calendarType === 'jieqi' ? d.jieqi      : null,
  note:          d.note,
  is_visible:    d.isVisible,
  sort_order:    d.sortOrder,
});

export const getDeityFeasts = async (includeHidden = false): Promise<DeityFeast[]> => {
  let query = supabase.from('deity_feasts').select('*')
    .order('lunar_month', { ascending: true, nullsFirst: false })
    .order('lunar_day',   { ascending: true, nullsFirst: false })
    .order('sort_order',  { ascending: true });
  if (!includeHidden) query = query.eq('is_visible', true);
  const { data, error } = await query;
  // 不寫 console.error：表還沒建（migration 未跑）對訪客不是錯誤，前台會顯示空狀態。
  // 要不要當成錯誤由呼叫端決定——後台才需要大聲抱怨。
  if (error) throw error;
  return (data || []).map(mapFeastRow);
};

/** 新增一筆，回傳新的 id。id 由客戶端產：anon 不可 select 讀回（RLS） */
export const createDeityFeast = async (data: DeityFeastData): Promise<string> => {
  const id = crypto.randomUUID();
  const { error } = await supabase.from('deity_feasts').insert({ id, ...feastRow(data) });
  if (error) { console.error('Error creating deity feast:', error); throw error; }
  return id;
};

/**
 * 更新。**日期型態一改就整組欄位重送**，不做部分更新——
 * 只改 calendar_type 卻留著舊型態的欄位，會撞上 CHECK 而整筆存不進去。
 */
export const updateDeityFeast = async (id: string, data: DeityFeastData): Promise<void> => {
  const { error } = await supabase.from('deity_feasts')
    .update({ ...feastRow(data), updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { console.error('Error updating deity feast:', error); throw error; }
};

export const deleteDeityFeast = async (id: string): Promise<void> => {
  const { error } = await supabase.from('deity_feasts').delete().eq('id', id);
  if (error) { console.error('Error deleting deity feast:', error); throw error; }
};
