"use client";

import { memo } from "react";
import { useRouter } from "next/navigation";
import {
  addDays, addMonths, addYears, subDays, subMonths, subYears, format,
  startOfWeek, endOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Search, Plus, Lock, CalendarOff,
  Calendar as CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarView = "day" | "week" | "month" | "year";

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "day", label: "Día" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "year", label: "Año" },
];

function CalendarToolbarBase({
  view,
  date,
  displayDate,
  onNewAppointment,
  onBlockHours,
  onCloseDays,
  onSearch,
  onToday,
}: {
  view: CalendarView;
  date: Date;
  /** Month shown in the title — follows the day strip while scrolling. */
  displayDate?: Date;
  onNewAppointment: () => void;
  onBlockHours: () => void;
  onCloseDays: () => void;
  onSearch: () => void;
  onToday?: () => void;
}) {
  const router = useRouter();
  const titleDate = displayDate ?? date;

  function go(nextDate: Date, nextView: CalendarView = view) {
    router.push(`/citas?view=${nextView}&date=${format(nextDate, "yyyy-MM-dd")}`);
  }

  function shift(dir: 1 | -1) {
    const move = {
      day: dir === 1 ? addDays : subDays,
      week: (d: Date, n: number) => (dir === 1 ? addDays(d, n * 7) : subDays(d, n * 7)),
      month: dir === 1 ? addMonths : subMonths,
      year: dir === 1 ? addYears : subYears,
    }[view];
    go(move(date, 1));
  }

  // Day view navigates by swiping the strip, so it needs no arrows
  const showArrows = view !== "day";

  const title =
    view === "day"
      ? format(titleDate, "MMMM yyyy", { locale: es })
      : view === "week"
        ? `${format(startOfWeek(date, { weekStartsOn: 1 }), "d MMM", { locale: es })} – ${format(endOfWeek(date, { weekStartsOn: 1 }), "d MMM yyyy", { locale: es })}`
        : view === "month"
          ? format(date, "MMMM yyyy", { locale: es })
          : format(date, "yyyy");

  return (
    <div className="space-y-2.5">
      {/* Row 1 — symmetric: today left, title centred, new right */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <TodayButton onClick={() => (onToday ? onToday() : go(new Date()))} />
          {showArrows && (
            <button
              onClick={() => shift(-1)}
              aria-label="Anterior"
              className="w-9 h-9 rounded-xl border border-border bg-surface flex items-center justify-center active:bg-background"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Fixed centre: min-w-0 stops long titles pushing the buttons out */}
        <h1 className="flex-1 min-w-0 text-center text-base sm:text-lg font-bold text-foreground capitalize truncate px-1">
          {title}
        </h1>

        <div className="flex items-center gap-1.5 shrink-0">
          {showArrows && (
            <button
              onClick={() => shift(1)}
              aria-label="Siguiente"
              className="w-9 h-9 rounded-xl border border-border bg-surface flex items-center justify-center active:bg-background"
            >
              <ChevronRight size={16} />
            </button>
          )}
          <button
            onClick={onNewAppointment}
            aria-label="Nueva cita"
            className="h-9 px-3 rounded-xl bg-brand text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap active:scale-95 transition-transform"
          >
            <Plus size={15} strokeWidth={2.6} />
            <span className="hidden xs:inline sm:inline">Nueva</span>
          </button>
        </div>
      </div>

      {/* Row 2 — views on the left, tools on the right, all inside the width */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-xl bg-surface border border-border p-0.5 flex-1 min-w-0">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => go(date, v.key)}
              className={cn(
                "flex-1 h-8 rounded-lg text-[11px] font-semibold transition-colors truncate px-1",
                view === v.key ? "bg-foreground text-background" : "text-muted"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <ToolButton onClick={onSearch} icon={<Search size={15} />} label="Buscar" />
          <ToolButton onClick={onBlockHours} icon={<Lock size={15} />} label="Bloquear horas" />
          <ToolButton onClick={onCloseDays} icon={<CalendarOff size={15} />} label="Cerrar días" />
        </div>
      </div>
    </div>
  );
}

function TodayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Ir a hoy"
      title="Ir a hoy"
      className="relative w-9 h-9 rounded-xl border border-border bg-surface flex items-center justify-center active:bg-background shrink-0"
    >
      <CalendarIcon size={19} className="text-muted" strokeWidth={1.6} />
      <span className="absolute inset-x-0 bottom-[7px] text-[9px] font-black text-foreground leading-none">
        {format(new Date(), "d")}
      </span>
    </button>
  );
}

function ToolButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-9 h-9 rounded-xl border border-border bg-surface text-foreground flex items-center justify-center shrink-0 active:bg-background"
    >
      {icon}
    </button>
  );
}

// The toolbar only changes with the view or the visible month
export const CalendarToolbar = memo(CalendarToolbarBase);
