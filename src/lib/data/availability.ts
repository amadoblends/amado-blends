import { unstable_cache } from "next/cache";
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
}

export const getAvailability = unstable_cache(
  async (): Promise<AvailabilityDay[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("availability").select("*").order("weekday");
    if (error || !data) return [];
    return data;
  },
  ["availability"],
  { tags: ["availability"], revalidate: 60 }
);

export const getBookingSettings = unstable_cache(
  async (): Promise<BookingSettings> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("booking_settings")
      .select("booking_window_days, min_notice_minutes")
      .eq("id", 1)
      .single();
    return data ?? { booking_window_days: 30, min_notice_minutes: 60 };
  },
  ["booking_settings"],
  { tags: ["booking_settings"], revalidate: 60 }
);
