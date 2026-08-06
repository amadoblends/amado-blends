"use client";

import { memo } from "react";
import {
  addDays, addMonths, addYears, subDays, subMonths, subYears, format,
  startOfWeek, endOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus,
  CalendarDays, Rows3, CalendarRange, LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarView = "day" | "week" | "month" | "year";

const VIEWS: { key: CalendarView; label: string; Icon: typeof CalendarDays }[] = [
  { key: "day", label: "Día", Icon: CalendarDays },
  { key: "week", label: "Semana", Icon: Rows3 },
  { key: "month", label: "Mes", Icon: CalendarRange },
  { key: "year", label: "Año", Icon: LayoutGrid },
];

/**
 * Calendar header. The view switcher is a permanent segmented row rather than
 * a menu, so changing view is always one tap and never hides behind a popover.
 * The calendar button and the title both open the date picker.
 */
function CalendarToolbarBase({
  view,
  date,
  displayDate,
  onNavigate,
  onSetView,
  onOpenPicker,
  onNewAppointment,
}: {
  view: CalendarView;
  date: Date;
  /** Month shown in the title — follows the day strip while scrolling. */
  displayDate?: Date;
  onNavigate: (date: Date, view: CalendarView) => void;
  onSetView: (view: CalendarView) => void;
  onOpenPicker: () => void;
  onNewAppointment: () => void;
}) {
  const titleDate = displayDate ?? date;

  function shift(dir: 1 | -1) {
    const move = {
      day: dir === 1 ? addDays : subDays,
      week: (d: Date, n: number) => (dir === 1 ? addDays(d, n * 7) : subDays(d, n * 7)),
      month: dir === 1 ? addMonths : subMonths,
      year: dir === 1 ? addYears : subYears,
    }[view];
    onNavigate(move(date, 1), view);
  }

  // The day view is driven by the strip and by swiping, so it needs no arrows
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
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        {/* Opens the full date picker */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onOpenPicker}
            aria-label="Abrir calendario"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-brand shrink-0 active:bg-surface transition-colors"
          >
            <span className="relative flex items-center justify-center">
              <CalendarDays size={26} strokeWidth={1.7} />
              <span className="absolute inset-x-0 bottom-[4px] text-[9px] font-black leading-none tnum">
                {format(new Date(), "d")}
              </span>
            </span>
          </button>
          {showArrows && (
            <button
              onClick={() => shift(-1)}
              aria-label="Anterior"
              className="w-9 h-9 rounded-xl flex items-center justify-center active:bg-surface"
            >
              <ChevronLeft size={18} strokeWidth={2.2} />
            </button>
          )}
        </div>

        <button
          onClick={onOpenPicker}
          className="flex-1 min-w-0 flex items-center justify-center gap-1 px-1 py-1 rounded-xl active:bg-surface"
        >
          <span className="text-[19px] font-bold text-foreground capitalize truncate tnum">
            {title}
          </span>
          <ChevronDown size={17} strokeWidth={2.6} className="text-muted shrink-0" />
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {showArrows && (
            <button
              onClick={() => shift(1)}
              aria-label="Siguiente"
              className="w-9 h-9 rounded-xl flex items-center justify-center active:bg-surface"
            >
              <ChevronRight size={18} strokeWidth={2.2} />
            </button>
          )}
          <button
            onClick={onNewAppointment}
            className="h-10 pl-2.5 pr-3.5 rounded-2xl border border-border bg-surface flex items-center gap-1 shrink-0 active:scale-95 transition-transform"
          >
            <Plus size={17} strokeWidth={3} className="text-brand" />
            <span className="text-[13px] font-bold text-foreground whitespace-nowrap">
              Nueva cita
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Always-visible view switcher. Kept separate from the header so it can sit
 * below the day strip without re-rendering the header on every scroll tick.
 */
function ViewSwitcherBase({
  view,
  onSetView,
}: {
  view: CalendarView;
  onSetView: (v: CalendarView) => void;
}) {
  return (
    <div className="flex rounded-2xl bg-surface p-1 gap-1">
      {VIEWS.map(({ key, label, Icon }) => {
        const active = view === key;
        return (
          <button
            key={key}
            onClick={() => onSetView(key)}
            aria-pressed={active}
            className={cn(
              "flex-1 h-11 rounded-xl flex items-center justify-center gap-1.5 transition-colors",
              active ? "bg-background text-brand" : "text-muted"
            )}
          >
            <Icon size={17} strokeWidth={active ? 2.3 : 1.9} />
            <span className="text-[13px] font-bold">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const CalendarToolbar = memo(CalendarToolbarBase);
export const ViewSwitcher = memo(ViewSwitcherBase);
