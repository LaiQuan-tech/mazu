import { createClient } from '@supabase/supabase-js';
import { BookingData, BookingRecord, BookingStatus, DonationData } from '../types';

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
    status: 'pending',
  }]);

  if (error) {
    console.error('Error submitting donation:', error);
    throw error;
  }
  return true;
};
