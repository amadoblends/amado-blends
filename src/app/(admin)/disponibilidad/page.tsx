import Link from "next/link";
import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { getAvailability } from "@/lib/data/availability";
import { DayToggle } from "@/components/disponibilidad/day-toggle";

const weekdayLabels = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const displayOrder = [1, 2, 3, 4, 5, 6, 0];

function formatHour(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

export default async function AvailabilityPage() {
  const days = await getAvailability();
  const byWeekday = new Map(days.map((d) => [d.weekday, d]));

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href="/mas"
          className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center shrink-0"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-foreground flex-1">Disponibilidad</h1>
        <Link
          href="/disponibilidad/configuracion"
          className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center shrink-0"
          title="Configuración de reservas"
        >
          <Settings2 size={18} className="text-foreground" />
        </Link>
      </header>

      <p className="text-sm text-muted">
        Activa los días que trabajas y toca el nombre del día para configurar el horario.
      </p>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        {displayOrder.map((weekday, idx) => {
          const day = byWeekday.get(weekday);
          const isLast = idx === displayOrder.length - 1;
          return (
            <div
              key={weekday}
              className={`flex items-center gap-3 px-4 py-4 ${!isLast ? "border-b border-border" : ""}`}
            >
              {/* Toggle — NOT inside the link so it's independently tappable */}
              <DayToggle weekday={weekday} isActive={day?.is_active ?? false} />

              {/* Link area — tap to open day settings */}
              <Link
                href={`/disponibilidad/${weekday}`}
                className="flex-1 flex items-center justify-between min-w-0 active:opacity-70"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground">{weekdayLabels[weekday]}</p>
                  <p className="text-sm text-muted mt-0.5">
                    {day?.is_active
                      ? `${formatHour(day.start_time)} – ${formatHour(day.end_time)}${
                          day.slot_minutes ? ` · ${day.slot_minutes} min/turno` : ""
                        }`
                      : "No laboral"}
                  </p>
                </div>
                <ChevronRight size={18} className="text-muted shrink-0 ml-2" />
              </Link>
            </div>
          );
        })}
      </div>

    </div>
  );
}
