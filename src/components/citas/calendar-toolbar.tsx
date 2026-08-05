"use client";

import { useRouter } from "next/navigation";
import {
  addDays, addMonths, addYears, subDays, subMonths, subYears, format, startOfWeek, endOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Search, Plus, Lock, CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarView = "day" | "week" | "month" | "year";

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "day", label: "Día" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "year", label: "Año" },
];

export function CalendarToolbar({
  view,
  date,
  onNewAppointment,
  onBlockHours,
  onCloseDays,
  onSearch,
}: {
  view: CalendarView;
  date: Date;
  onNewAppointment: () => void;
  onBlockHours: () => void;
  onCloseDays: () => void;
  onSearch: () => void;
}) {
  const router = useRouter();

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

  const title =
    view === "day"
      ? format(date, "d 'de' MMMM yyyy", { locale: es })
      : view === "week"
        ? `${format(startOfWeek(date, { weekStartsOn: 1 }), "d MMM", { locale: es })} – ${format(endOfWeek(date, { weekStartsOn: 1 }), "d MMM yyyy", { locale: es })}`
        : view === "month"
          ? format(date, "MMMM yyyy", { locale: es })
          : format(date, "yyyy");

  return (
    <div className="space-y-3">
      {/* Row 1 — title, navigation, primary actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl md:text-2xl font-bold text-foreground capitalize flex-1 min-w-0 truncate">
          {title}
        </h1>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => shift(-1)}
            aria-label="Anterior"
            className="w-9 h-9 rounded-xl border border-border bg-surface flex items-center justify-center active:bg-background"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => go(new Date())}
            className="h-9 px-3 rounded-xl border border-border bg-surface text-xs font-semibold text-foreground active:bg-background"
          >
            Hoy
          </button>
          <button
            onClick={() => shift(1)}
            aria-label="Siguiente"
            className="w-9 h-9 rounded-xl border border-border bg-surface flex items-center justify-center active:bg-background"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Row 2 — view switcher plus the tools, scrollable on phones */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-xl bg-surface border border-border p-1 shrink-0">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => go(date, v.key)}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-semibold transition-colors",
                view === v.key ? "bg-foreground text-background" : "text-muted"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto overflow-x-auto no-scrollbar">
          <ToolButton onClick={onSearch} icon={<Search size={15} />} label="Buscar" />
          <ToolButton
            onClick={onBlockHours}
            icon={<Lock size={15} />}
            label="Bloquear horas"
          />
          <ToolButton
            onClick={onCloseDays}
            icon={<CalendarOff size={15} />}
            label="Cerrar días"
          />
          <button
            onClick={onNewAppointment}
            className="h-9 px-3 rounded-xl bg-brand text-white text-xs font-bold flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform"
          >
            <Plus size={15} /> Nueva cita
          </button>
        </div>
      </div>
    </div>
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
      className="h-9 px-2.5 md:px-3 rounded-xl border border-border bg-surface text-xs font-semibold text-foreground flex items-center gap-1.5 shrink-0 active:bg-background"
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
