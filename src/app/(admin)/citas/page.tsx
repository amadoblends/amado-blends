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
  autoCompletePastAppointments,
} from "@/lib/data/appointments";
import { getAvailability, getBookingSettings } from "@/lib/data/availability";
import { createClient } from "@/lib/supabase/server";
import { DateStrip } from "@/components/citas/date-strip";
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
  await autoCompletePastAppointments();

  const [rangeStart, rangeEnd] = rangeFor(view, date);
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 5);

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
    view === "day" ? getAppointmentStarts(weekStart, weekEnd) : Promise.resolve([]),
    getAvailability(),
    getBlockedTimesForDay(date),
    getClosures(),
    supabase.from("services").select("id, name, duration_minutes, price, color").order("name"),
  ]);

  const dayAvail =
    availability.find((d) => d.weekday === date.getDay() && d.is_active) ?? null;

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-4">
      {/* The week strip only makes sense alongside the single-day timeline */}
      {view === "day" && (
        <DateStrip selected={dateStr} appointmentStarts={appointmentStarts} />
      )}

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
      />
    </div>
  );
}
