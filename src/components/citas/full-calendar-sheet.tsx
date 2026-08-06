"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addMonths, subMonths, format, isSameDay, isSameMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import { X, ChevronLeft, ChevronRight, CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { reasonLabel } from "@/lib/closures";
import type { ClosureRange } from "@/lib/data/appointments";
import type { CalendarView } from "./calendar-toolbar";

const WEEK_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "day", label: "Día" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "year", label: "Año" },
];

/**
 * The full calendar behind the header's calendar button: jump to any date and
 * choose which view to land in. Nothing is trimmed here — every month is
 * reachable, closures are marked, and days with appointments carry a dot.
 */
export function FullCalendarSheet({
  open,
  onClose,
  selected,
  view,
  dayCounts,
  closures,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  /** yyyy-MM-dd currently selected. */
  selected: string;
  view: CalendarView;
  dayCounts: Record<string, number>;
  closures: ClosureRange[];
  onPick: (dateStr: string, view: CalendarView) => void;
}) {
  const selectedDate = useMemo(() => new Date(selected + "T00:00:00"), [selected]);
  const [cursor, setCursor] = useState(selectedDate);
  const [pendingView, setPendingView] = useState<CalendarView>(view);

  // Reopen on the month the barber is actually looking at
  useEffect(() => {
    if (open) {
      setCursor(selectedDate);
      setPendingView(view);
    }
  }, [open, selectedDate, view]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
      }),
    [cursor]
  );

  if (!open || typeof document === "undefined") return null;

  const today = new Date();

  function closureOn(day: Date) {
    const key = format(day, "yyyy-MM-dd");
    return closures.find((c) => key >= c.starts_on && key <= c.ends_on) ?? null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{
        paddingTop: "max(1rem, var(--safe-top))",
        paddingBottom: "max(1rem, var(--safe-bottom))",
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-[400px] max-h-full overflow-y-auto bg-surface rounded-[28px] ring-1 ring-border shadow-2xl animate-sheet-in p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor((c) => subMonths(c, 1))}
            aria-label="Mes anterior"
            className="w-9 h-9 rounded-xl border border-border flex items-center justify-center active:bg-background"
          >
            <ChevronLeft size={17} />
          </button>
          <h2 className="flex-1 text-center text-base font-bold text-foreground capitalize truncate">
            {format(cursor, "MMMM yyyy", { locale: es })}
          </h2>
          <button
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label="Mes siguiente"
            className="w-9 h-9 rounded-xl border border-border flex items-center justify-center active:bg-background"
          >
            <ChevronRight size={17} />
          </button>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center"
          >
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>

        {/* Which view the chosen date should open in */}
        <div className="flex rounded-xl bg-background border border-border p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setPendingView(v.key)}
              className={cn(
                "flex-1 h-9 rounded-lg text-xs font-bold transition-colors",
                pendingView === v.key ? "bg-foreground text-background" : "text-muted"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div>
          <div className="grid grid-cols-7 mb-1">
            {WEEK_LABELS.map((w, i) => (
              <span
                key={i}
                className="text-center text-[10px] font-bold text-muted uppercase py-1"
              >
                {w}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const inMonth = isSameMonth(d, cursor);
              const isToday = isSameDay(d, today);
              const isSelected = key === selected;
              const count = dayCounts[key] ?? 0;
              const closed = closureOn(d);

              return (
                <button
                  key={key}
                  onClick={() => {
                    onPick(key, pendingView);
                    onClose();
                  }}
                  title={closed ? `Cerrado · ${reasonLabel(closed.reason)}` : undefined}
                  className={cn(
                    "aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 relative",
                    !inMonth && "opacity-30",
                    isSelected
                      ? "bg-foreground text-background"
                      : isToday
                        ? "border border-brand text-brand"
                        : "text-foreground active:bg-background"
                  )}
                >
                  <span className="text-[13px] font-bold leading-none tnum">
                    {format(d, "d")}
                  </span>
                  {closed ? (
                    <CalendarOff
                      size={8}
                      className={isSelected ? "text-background/70" : "text-danger"}
                    />
                  ) : (
                    <span
                      className={cn(
                        "w-1 h-1 rounded-full",
                        count === 0
                          ? "bg-transparent"
                          : isSelected
                            ? "bg-background/70"
                            : "bg-brand"
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => {
            onPick(format(today, "yyyy-MM-dd"), pendingView);
            onClose();
          }}
          className="w-full h-11 rounded-xl bg-foreground text-background text-sm font-bold active:scale-[0.98] transition-transform"
        >
          Ir a hoy
        </button>
      </div>
    </div>,
    document.body
  );
}
