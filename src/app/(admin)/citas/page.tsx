import { format, startOfWeek, addDays } from "date-fns";
import { Bell } from "lucide-react";
import Link from "next/link";
import { getAppointmentsForDay, getAppointmentCountsByDay } from "@/lib/data/appointments";
import { getAvailability, getBookingSettings } from "@/lib/data/availability";
import { DateStrip } from "@/components/citas/date-strip";
import { DayNav } from "@/components/citas/day-nav";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

  const [appointments, countsMap, availability, bookingSettings] = await Promise.all([
    getAppointmentsForDay(date),
    getAppointmentCountsByDay(weekStart, weekEnd),
    getAvailability(),
    getBookingSettings(),
  ]);

  const counts = Object.fromEntries(countsMap.entries());
  const activeWeekdays = availability.filter((d) => d.is_active).map((d) => d.weekday);

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Citas</h1>
        <Link
          href="/notificaciones"
          className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center"
        >
          <Bell size={18} />
        </Link>
      </header>

      <DateStrip selected={dateStr} counts={counts} />
      <DayNav date={dateStr} activeWeekdays={activeWeekdays} bookingWindowDays={bookingSettings.booking_window_days} />

      <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
        {appointments.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">No hay citas para este día.</p>
        ) : (
          appointments.map((a) => (
            <Link
              key={a.id}
              href={`/citas/${a.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-background"
            >
              <span className="text-xs font-semibold text-muted w-16 shrink-0">
                {format(new Date(a.starts_at), "h:mm a")}
              </span>
              <span
                className="w-1 self-stretch rounded-full shrink-0"
                style={{ background: a.service.color }}
              />
              <Avatar name={a.client.full_name} src={a.client.avatar_url} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{a.client.full_name}</p>
                <p className="text-xs text-muted truncate">{a.service.name}</p>
              </div>
              <StatusBadge status={a.status} />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
