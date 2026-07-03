import { format, startOfWeek, addDays } from "date-fns";
import { Bell } from "lucide-react";
import Link from "next/link";
import {
  getAppointmentsForDay,
  getAppointmentStarts,
  getBlockedTimesForDay,
} from "@/lib/data/appointments";
import { getAvailability, getBookingSettings } from "@/lib/data/availability";
import { createClient } from "@/lib/supabase/server";
import { DateStrip } from "@/components/citas/date-strip";
import { DayNav } from "@/components/citas/day-nav";
import { DayCitasShell } from "@/components/citas/day-shell";
import { BackButton } from "@/components/ui/back-button";

export default async function CitasPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const dateStr = params.date ?? format(new Date(), "yyyy-MM-dd");
  const date = new Date(dateStr + "T00:00:00");

  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 5);

  const supabase = await createClient();

  const [
    appointments,
    appointmentStarts,
    availability,
    bookingSettings,
    blockedTimes,
    { data: servicesData },
  ] = await Promise.all([
    getAppointmentsForDay(date),
    getAppointmentStarts(weekStart, weekEnd),
    getAvailability(),
    getBookingSettings(),
    getBlockedTimesForDay(date),
    supabase
      .from("services")
      .select("id, name, duration_minutes, price, color")
      .order("name"),
  ]);

  const activeWeekdays = availability.filter((d) => d.is_active).map((d) => d.weekday);

  // Availability config for the selected day
  const weekday = date.getDay();
  const dayAvail = availability.find((d) => d.weekday === weekday && d.is_active) ?? null;

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton />
          <h1 className="text-xl font-bold text-foreground">Citas</h1>
        </div>
        <Link
          href="/notificaciones"
          className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center"
        >
          <Bell size={18} />
        </Link>
      </header>

      <DateStrip selected={dateStr} appointmentStarts={appointmentStarts} />
      <DayNav
        date={dateStr}
        activeWeekdays={activeWeekdays}
        bookingWindowDays={bookingSettings.booking_window_days}
      />

      <DayCitasShell
        appointments={appointments}
        dayAvail={dayAvail}
        availability={availability}
        services={servicesData ?? []}
        dateStr={dateStr}
        blockedTimes={blockedTimes}
      />
    </div>
  );
}
