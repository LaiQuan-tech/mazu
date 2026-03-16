import { createClient } from '@supabase/supabase-js';
import { BlessingAddon, BlessingEventData, BlessingEventPackage, BlessingEventRecord, BlessingOffering, BlessingRegistrationData, BlessingRegistrationRecord, BlessingStatus, ClaimedOffering, BookingData, BookingRecord, BookingStatus, BulletinData, BulletinRecord, DeityData, DeityRecord, DonationData, DonationRecord, HallData, HallRecord, HeroSlideRecord, LampRegistrationData, LampRegistrationRecord, LampRegistrationStatus, LampServiceConfig, LampServiceConfigData, MemberContact, MemberContactData, MemberProfileRecord, ProfileData, RegistrationData, RegistrationRecord, RepairProject, RepairProjectData, ScriptureVerseData, ScriptureVerseRecord, SharedEntryData, SharedEntryRecord, SharedServiceType, SharedSessionConfig, SharedSessionData, SharedSessionRecord, SiteImageRecord, SiteImageSection, ZodiacSign } from '../types';

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
    type: data.type,
    notes: data.notes || null,
    status: BookingStatus.PENDING,
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
    type: row.type,
    notes: row.notes,
    status: row.status as BookingStatus,
    createdAt: row.created_at,
  }));
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const createBulletin = async (data: BulletinData): Promise<boolean> => {
  const { error } = await supabase.from('bulletins').insert([{
    title: data.title,
    content: data.content,
    category: data.category,
    is_pinned: data.isPinned,
    publish_at: data.publishAt ?? null,
    linked_service: data.linkedService ?? null,
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
  const ext = file.name.split('.').pop() || 'jpg';
  const storagePath = `${section}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(SITE_IMAGES_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
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
  const ext = file.name.split('.').pop() || 'jpg';
  const storagePath = `deities/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(SITE_IMAGES_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
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
  const ext = file.name.split('.').pop() || 'jpg';
  const storagePath = `hero-slides/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(SITE_IMAGES_BUCKET)
    .upload(storagePath, file, { contentType: file.type, cacheControl: '3600', upsert: false });

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
  const ext = file.name.split('.').pop() || 'jpg';
  const storagePath = `scripture/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(SITE_IMAGES_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
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
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `blessings/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(SITE_IMAGES_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
  if (error) { console.error(error); throw error; }
  const { data } = supabase.storage.from(SITE_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

export const uploadLampImage = async (file: File): Promise<string> => {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `lamps/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(SITE_IMAGES_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
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
    status: row.status as BookingStatus, createdAt: row.created_at,
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
  entries:     (row.shared_session_entries ?? []).map(mapSharedEntry),
  createdAt:   row.created_at,
  expiresAt:   row.expires_at,
});

export const createSharedSession = async (d: SharedSessionData): Promise<SharedSessionRecord> => {
  const { data, error } = await supabase
    .from('shared_sessions')
    .insert({ service_type: d.serviceType, config: d.config, notes: d.notes || null })
    .select()
    .single();
  if (error) { console.error(error); throw error; }
  return mapSharedSession({ ...data, shared_session_entries: [] });
};

export const getSharedSession = async (id: string): Promise<SharedSessionRecord | null> => {
  const { data, error } = await supabase
    .from('shared_sessions')
    .select('*, shared_session_entries(*)')
    .eq('id', id)
    .order('created_at', { referencedTable: 'shared_session_entries', ascending: true })
    .single();
  if (error) return null;
  return mapSharedSession(data);
};

export const addSharedEntry = async (d: SharedEntryData): Promise<SharedEntryRecord> => {
  const { data, error } = await supabase
    .from('shared_session_entries')
    .insert({
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
    })
    .select()
    .single();
  if (error) { console.error(error); throw error; }
  return mapSharedEntry(data);
};

export const markSharedSessionSubmitted = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('shared_sessions')
    .update({ status: 'submitted' })
    .eq('id', id);
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
  const { data, error } = await supabase
    .from('donations')
    .select('repair_project_id, amount')
    .not('repair_project_id', 'is', null);
  if (error) { console.error(error); throw error; }
  const totals: Record<string, number> = {};
  for (const row of data || []) {
    totals[row.repair_project_id] = (totals[row.repair_project_id] || 0) + Number(row.amount);
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
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `repair-projects/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(SITE_IMAGES_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
  if (error) { console.error(error); throw error; }
  const { data } = supabase.storage.from(SITE_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
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

/** 取得 LINE 導流統計（今日 / 累計） */
export const getLineClickStats = async (): Promise<{ today: number; total: number }> => {
  const { data, error } = await supabase
    .from('line_clicks')
    .select('clicked_at');
  if (error || !data) return { today: 0, total: 0 };
  const todayStr = new Date().toISOString().slice(0, 10);
  const today = data.filter(r => (r.clicked_at as string).slice(0, 10) === todayStr).length;
  return { today, total: data.length };
};
