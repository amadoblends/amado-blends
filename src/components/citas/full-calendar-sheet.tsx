"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addMonths, format, isSameDay, isSameMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { reasonLabel } from "@/lib/closures";
import { localDateStr } from "@/lib/time";
import type { ClosureRange } from "@/lib/data/appointments";

const WEEK_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
/** Months reachable either side of the current one. */
const SPAN = 36;
const SWIPE_PX = 45;

/**
 * Date picker in the iOS mould: one month per page, swipe sideways to move
 * through months and years, tap a day to go there. Nothing else lives in here
 * — choosing the view is the segmented row on the calendar screen itself.
 */
export function FullCalendarSheet({
  open,
  onClose,
  selected,
  dayCounts,
  closures,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  /** yyyy-MM-dd currently selected. */
  selected: string;
  dayCounts: Record<string, number>;
  closures: ClosureRange[];
  onPick: (dateStr: string) => void;
}) {
  const selectedDate = useMemo(() => new Date(selected + "T00:00:00"), [selected]);
  const base = useMemo(() => startOfMonth(new Date()), []);

  // Page index, where 0 is the current month
  const [page, setPage] = useState(0);
  const [slide, setSlide] = useState<"left" | "right" | null>(null);
  const touch = useRef<{ x: number; y: number; locked: boolean | null } | null>(null);

  useEffect(() => {
    if (!open) return;
    const months =
      (selectedDate.getFullYear() - base.getFullYear()) * 12 +
      (selectedDate.getMonth() - base.getMonth());
    setPage(Math.max(-SPAN, Math.min(SPAN, months)));
    setSlide(null);
  }, [open, selectedDate, base]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const move = useCallback((dir: 1 | -1) => {
    setPage((p) => {
      const next = Math.max(-SPAN, Math.min(SPAN, p + dir));
      if (next !== p) setSlide(dir === 1 ? "left" : "right");
      return next;
    });
  }, []);

  const cursor = useMemo(() => addMonths(base, page), [base, page]);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
      }),
    [cursor]
  );

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, locked: null };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const t = touch.current;
    if (!t || t.locked === false) return;
    const dx = e.touches[0].clientX - t.x;
    const dy = e.touches[0].clientY - t.y;
    if (t.locked === null && Math.hypot(dx, dy) > 10) {
      t.locked = Math.abs(dx) > Math.abs(dy) * 1.3;
    }
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const t = touch.current;
      touch.current = null;
      if (!t || !t.locked) return;
      const dx = e.changedTouches[0].clientX - t.x;
      if (Math.abs(dx) < SWIPE_PX) return;
      move(dx < 0 ? 1 : -1);
    },
    [move]
  );

  if (!open || typeof document === "undefined") return null;

  const today = new Date();
  const todayKey = localDateStr(today);

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

      <div className="relative w-full max-w-[380px] bg-surface rounded-[28px] ring-1 ring-border shadow-2xl animate-sheet-in p-4 pb-3">
        <div className="flex items-center gap-1 mb-3">
          <h2 className="flex-1 text-[17px] font-bold text-foreground capitalize truncate pl-1">
            {format(cursor, "MMMM yyyy", { locale: es })}
          </h2>
          <button
            onClick={() => move(-1)}
            aria-label="Mes anterior"
            className="w-9 h-9 rounded-full flex items-center justify-center text-brand active:bg-background"
          >
            <ChevronLeft size={20} strokeWidth={2.4} />
          </button>
          <button
            onClick={() => move(1)}
            aria-label="Mes siguiente"
            className="w-9 h-9 rounded-full flex items-center justify-center text-brand active:bg-background"
          >
            <ChevronRight size={20} strokeWidth={2.4} />
          </button>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-9 h-9 rounded-full bg-background flex items-center justify-center ml-1"
          >
            <X size={16} strokeWidth={2.6} />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {WEEK_LABELS.map((w, i) => (
            <span key={i} className="text-center text-[11px] font-bold text-muted py-1">
              {w}
            </span>
          ))}
        </div>

        {/* Swipe surface: one month per page */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="overflow-hidden"
        >
          <div
            key={page}
            className={cn(
              "grid grid-cols-7 gap-y-1",
              slide === "left" && "animate-day-in-left",
              slide === "right" && "animate-day-in-right"
            )}
          >
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
                    onPick(key);
                    onClose();
                  }}
                  title={closed ? `Cerrado · ${reasonLabel(closed.reason)}` : undefined}
                  className="h-11 flex flex-col items-center justify-center gap-1"
                >
                  <span
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-[15px] leading-none tnum",
                      !inMonth && "text-muted/30",
                      isSelected
                        ? "bg-brand text-white font-bold"
                        : isToday
                          ? "text-brand font-bold"
                          : inMonth
                            ? "text-foreground font-medium"
                            : ""
                    )}
                  >
                    {format(d, "d")}
                  </span>
                  <span
                    className={cn(
                      "w-1 h-1 rounded-full",
                      closed
                        ? "bg-danger"
                        : count > 0
                          ? isSelected
                            ? "bg-brand"
                            : "bg-brand/70"
                          : "bg-transparent"
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => {
            onPick(todayKey);
            onClose();
          }}
          className="w-full h-10 mt-1 text-[15px] font-bold text-brand active:opacity-60"
        >
          Hoy
        </button>
      </div>
    </div>,
    document.body
  );
}
