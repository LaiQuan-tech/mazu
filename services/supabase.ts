import { createClient } from '@supabase/supabase-js';
import { BookingData, BookingRecord, BookingStatus, BulletinData, BulletinRecord, DonationData, DonationRecord } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Bookings ────────────────────────────────────────────────────────────────

export const submitBooking = async (data: BookingData): Promise<boolean> => {
  const { error } = await supabase.from('bookings').insert([{
    name: data.name,
    phone: data.phone,
    birth_date: data.birthDate,
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
