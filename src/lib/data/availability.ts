import { createClient } from "@/lib/supabase/server";

export interface AvailabilityDay {
  id: string;
  weekday: number;
  is_active: boolean;
  start_time: string;
  end_time: string;
  break_start_time: string | null;
  break_end_time: string | null;
  slot_minutes: number;
}

export interface BookingSettings {
  booking_window_days: number;
  min_notice_minutes: number;
  buffer_minutes: number;
  slot_interval_minutes: number;
  optimize_gaps: boolean;
}

export async function getAvailability(): Promise<AvailabilityDay[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("availability").select("*").order("weekday");
  if (error || !data) return [];
  return data;
}

export async function getBookingSettings(): Promise<BookingSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("booking_settings")
    .select(
      "booking_window_days, min_notice_minutes, buffer_minutes, slot_interval_minutes, optimize_gaps"
    )
    .eq("id", 1)
    .single();

  return {
    booking_window_days: data?.booking_window_days ?? 30,
    min_notice_minutes: data?.min_notice_minutes ?? 60,
    buffer_minutes: data?.buffer_minutes ?? 0,
    slot_interval_minutes: data?.slot_interval_minutes ?? 30,
    optimize_gaps: data?.optimize_gaps ?? false,
  };
}
