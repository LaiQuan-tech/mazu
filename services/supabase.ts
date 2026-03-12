import { createClient } from '@supabase/supabase-js';
import { BookingData, BookingRecord, BookingStatus, BulletinData, BulletinRecord, DeityData, DeityRecord, DonationData, DonationRecord, HeroSlideRecord, LampRegistrationData, LampRegistrationRecord, LampRegistrationStatus, LampServiceConfig, LampServiceConfigData, MemberContact, MemberContactData, MemberProfileRecord, ProfileData, RegistrationData, RegistrationRecord, ScriptureVerseData, ScriptureVerseRecord, SiteImageRecord, SiteImageSection, ZodiacSign } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Bookings ────────────────────────────────────────────────────────────────

export const submitBooking = async (data: BookingData): Promise<boolean> => {
  const { error } = await supabase.from('bookings').insert([{
    name: data.name,
    phone: data.phone,
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
    address: data.address || null,
    contact_label: data.contactLabel || null,
    amount: data.amount,
    type: data.type,
    notes: data.notes || null,
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
    address: row.address || undefined,
    contactLabel: row.contact_label || undefined,
    amount: row.amount,
    type: row.type,
    notes: row.notes,
    createdAt: row.created_at,
  }));
};

// ─── Bulletins (公佈欄) ─────────────────────────────────────────────────────

export const getBulletins = async (): Promise<BulletinRecord[]> => {
  const { data, error } = await supabase
    .from('bulletins')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

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
    allowRegistration: row.allow_registration ?? false,
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
    allow_registration: data.allowRegistration,
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
  if (data.allowRegistration !== undefined) updateData.allow_registration = data.allowRegistration;

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
  const { data, error } = await supabase
    .from('member_contacts')
    .select('*')
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
  const { data, error } = await supabase
    .from('member_profiles')
    .select('*')
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
