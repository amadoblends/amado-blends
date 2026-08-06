import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, startOfDay, endOfDay, addDays,
} from "date-fns";
import {
  getAppointmentsForDay,
  getAppointmentsInRange,
  getAppointmentStarts,
  getBlockedTimesForDay,
  getClosures,
} from "@/lib/data/appointments";
import { getAvailability } from "@/lib/data/availability";
import { createClient } from "@/lib/supabase/server";
import { CalendarShell } from "@/components/citas/calendar-shell";
import type { CalendarView } from "@/components/citas/calendar-toolbar";

function rangeFor(view: CalendarView, date: Date): [Date, Date] {
  switch (view) {
    case "week":
      return [startOfWeek(date, { weekStartsOn: 1 }), endOfWeek(date, { weekStartsOn: 1 })];
    case "month":
      return [
        startOfWeek(startOfMonth(date), { weekStartsOn: 1 }),
        endOfWeek(endOfMonth(date), { weekStartsOn: 1 }),
      ];
    case "year":
      return [startOfYear(date), endOfYear(date)];
    default:
      return [startOfDay(date), endOfDay(date)];
  }
}

export default async function CitasPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const params = await searchParams;
  const dateStr = params.date ?? format(new Date(), "yyyy-MM-dd");
  const date = new Date(dateStr + "T00:00:00");
  const view = (["day", "week", "month", "year"].includes(params.view ?? "")
    ? params.view
    : "day") as CalendarView;

  const supabase = await createClient();

  const [rangeStart, rangeEnd] = rangeFor(view, date);
  // The day strip scrolls two months either way, so it needs that whole span
  const stripStart = addDays(date, -60);
  const stripEnd = addDays(date, 60);

  const [
    appointments,
    appointmentStarts,
    availability,
    blockedTimes,
    closures,
    { data: servicesData },
  ] = await Promise.all([
    // The day view has its own richer query; other views use the range one
    view === "day" ? getAppointmentsForDay(date) : getAppointmentsInRange(rangeStart, rangeEnd),
    view === "day" ? getAppointmentStarts(stripStart, stripEnd) : Promise.resolve([]),
    getAvailability(),
    getBlockedTimesForDay(date),
    getClosures(),
    supabase.from("services").select("id, name, duration_minutes, price, color").order("name"),
  ]);

  // Grouped in the barber's timezone, not the server's
  const dayCounts: Record<string, number> = {};
  for (const iso of appointmentStarts) {
    const d = new Date(iso);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dayCounts[key] = (dayCounts[key] ?? 0) + 1;
  }

  const dayAvail =
    availability.find((d) => d.weekday === date.getDay() && d.is_active) ?? null;

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-3">
      <CalendarShell
        view={view}
        date={date}
        dateStr={dateStr}
        appointments={appointments}
        dayAvail={dayAvail}
        availability={availability}
        services={servicesData ?? []}
        blockedTimes={blockedTimes}
        closures={closures}
        dayCounts={dayCounts}
      />
    </div>
  );
}
