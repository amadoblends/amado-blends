import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getAvailability, getBookingSettings } from "@/lib/data/availability";
import { DayToggle } from "@/components/disponibilidad/day-toggle";
import { BookingSettingsForm } from "@/components/disponibilidad/booking-settings-form";

const weekdayLabels = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const displayOrder = [1, 2, 3, 4, 5, 6, 0];

function formatHour(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

export default async function AvailabilityPage() {
  const [days, settings] = await Promise.all([getAvailability(), getBookingSettings()]);
  const byWeekday = new Map(days.map((d) => [d.weekday, d]));

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <Link href="/mas" className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Disponibilidad</h1>
      </header>

      <div>
        <p className="text-xs font-semibold text-muted mb-2 px-1">Días de la semana</p>
        <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
          {displayOrder.map((weekday) => {
            const day = byWeekday.get(weekday);
            return (
              <Link
                key={weekday}
                href={`/disponibilidad/${weekday}`}
                className="flex items-center justify-between gap-3 px-4 py-3 active:bg-background"
              >
                <p className="text-sm font-semibold text-foreground">{weekdayLabels[weekday]}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">
                    {day?.is_active ? `${formatHour(day.start_time)} - ${formatHour(day.end_time)}` : "No laboral"}
                  </span>
                  <DayToggle weekday={weekday} isActive={day?.is_active ?? false} />
                  <ChevronRight size={16} className="text-muted" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted mb-2 px-1">Configuración de reservas</p>
        <BookingSettingsForm
          bookingWindowDays={settings.booking_window_days}
          minNoticeMinutes={settings.min_notice_minutes}
        />
      </div>
    </div>
  );
}
