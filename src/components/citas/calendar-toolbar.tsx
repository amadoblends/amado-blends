"use client";

import { memo, useState, useRef, useEffect } from "react";
import {
  addDays, addMonths, addYears, subDays, subMonths, subYears, format,
  startOfWeek, endOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, ChevronDown, Search, Check,
  Calendar as CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarView = "day" | "week" | "month" | "year";

const VIEWS: { key: CalendarView; label: string; hint: string }[] = [
  { key: "day", label: "Día", hint: "Línea de tiempo hora por hora" },
  { key: "week", label: "Semana", hint: "Los siete días en columnas" },
  { key: "month", label: "Mes", hint: "Cuadrícula del mes completo" },
  { key: "year", label: "Año", hint: "Los doce meses de un vistazo" },
];

/**
 * Header of the calendar: search on the left, the period title in the middle
 * doubling as the view picker, and "go to today" on the right.
 *
 * There is deliberately no hamburger here — navigation lives in the bottom bar
 * on phones and in the sidebar on wider screens.
 */
function CalendarToolbarBase({
  view,
  date,
  displayDate,
  onNavigate,
  onSearch,
  onToday,
}: {
  view: CalendarView;
  date: Date;
  /** Month shown in the title — follows the day strip while scrolling. */
  displayDate?: Date;
  /** Single entry point for every date/view change, so transitions stay smooth. */
  onNavigate: (date: Date, view: CalendarView) => void;
  onSearch: () => void;
  onToday: () => void;
}) {
  const titleDate = displayDate ?? date;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the view menu on an outside tap or Escape
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
    <div className="relative flex items-center gap-1.5">
      {/* Left cluster — fixed width so the title stays optically centred */}
      <div className="flex items-center gap-1 shrink-0">
        <IconButton onClick={onSearch} label="Buscar cita o cliente">
          <Search size={18} strokeWidth={2} />
        </IconButton>
        {showArrows && (
          <IconButton onClick={() => shift(-1)} label="Anterior">
            <ChevronLeft size={18} strokeWidth={2.2} />
          </IconButton>
        )}
      </div>

      {/* Centre — the title is the view picker */}
      <div ref={menuRef} className="flex-1 min-w-0 flex justify-center">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="max-w-full flex items-center gap-1 px-2 py-1 rounded-xl active:bg-surface"
        >
          <span className="text-[17px] font-bold text-foreground capitalize truncate tnum">
            {title}
          </span>
          <ChevronDown
            size={16}
            strokeWidth={2.4}
            className={cn(
              "text-muted shrink-0 transition-transform duration-200",
              menuOpen && "rotate-180"
            )}
          />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute top-full mt-1.5 z-40 w-[236px] left-1/2 -translate-x-1/2 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-view-in"
          >
            {VIEWS.map((v) => (
              <button
                key={v.key}
                role="menuitemradio"
                aria-checked={view === v.key}
                onClick={() => {
                  setMenuOpen(false);
                  if (v.key !== view) onNavigate(date, v.key);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-2.5 text-left active:bg-background",
                  view === v.key && "bg-background"
                )}
              >
                <span className="w-4 shrink-0">
                  {view === v.key && <Check size={15} className="text-brand" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-foreground leading-tight">
                    {v.label}
                  </span>
                  <span className="block text-[11px] text-muted leading-tight truncate">
                    {v.hint}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right cluster — mirrors the left one's width */}
      <div className="flex items-center gap-1 shrink-0">
        {showArrows && (
          <IconButton onClick={() => shift(1)} label="Siguiente">
            <ChevronRight size={18} strokeWidth={2.2} />
          </IconButton>
        )}
        <IconButton onClick={onToday} label="Ir a hoy">
          <span className="relative flex items-center justify-center">
            <CalendarIcon size={20} strokeWidth={1.7} />
            <span className="absolute inset-x-0 bottom-[3px] text-[8px] font-black leading-none tnum">
              {format(new Date(), "d")}
            </span>
          </span>
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-10 h-10 rounded-xl flex items-center justify-center text-foreground shrink-0 active:bg-surface transition-colors"
    >
      {children}
    </button>
  );
}

// The toolbar only changes with the view, the date or the visible month
export const CalendarToolbar = memo(CalendarToolbarBase);
