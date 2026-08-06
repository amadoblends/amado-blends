"use client";

import { useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { addDays, subDays, format, isSameDay, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

const DAYS_BACK = 60;
const DAYS_FORWARD = 120;
const CELL_W = 52; // width + gap, used to centre the selected day

/**
 * Compact horizontally scrollable day picker. Swiping through it reports the
 * month currently in view so the header can follow along.
 */
export function DayStripScroller({
  selected,
  counts,
  onVisibleMonthChange,
}: {
  selected: string;
  counts: Record<string, number>;
  onVisibleMonthChange?: (date: Date) => void;
}) {
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const selectedDate = useMemo(() => new Date(selected + "T00:00:00"), [selected]);
  const today = startOfDay(new Date());

  // A fixed window around today keeps the DOM small while feeling endless
  const days = useMemo(() => {
    const start = subDays(today, DAYS_BACK);
    return Array.from({ length: DAYS_BACK + DAYS_FORWARD }, (_, i) => addDays(start, i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const centreOn = useCallback(
    (date: Date, behavior: ScrollBehavior = "smooth") => {
      const el = scrollerRef.current;
      if (!el) return;
      const index = days.findIndex((d) => isSameDay(d, date));
      if (index === -1) return;
      el.scrollTo({
        left: Math.max(0, index * CELL_W - el.clientWidth / 2 + CELL_W / 2),
        behavior,
      });
    },
    [days]
  );

  // Jump to the selected day whenever it changes elsewhere (arrows, Today)
  useEffect(() => {
    centreOn(selectedDate, "auto");
  }, [selectedDate, centreOn]);

  // Report the month sitting in the middle of the viewport
  function handleScroll() {
    if (!onVisibleMonthChange) return;
    const el = scrollerRef.current;
    if (!el) return;
    const centreIndex = Math.round((el.scrollLeft + el.clientWidth / 2) / CELL_W);
    const day = days[Math.min(days.length - 1, Math.max(0, centreIndex))];
    if (day) onVisibleMonthChange(day);
  }

  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      className="flex gap-1 overflow-x-auto no-scrollbar -mx-4 px-4 py-0.5 scroll-smooth"
      style={{ scrollSnapType: "x proximity" }}
    >
      {days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const isSelected = isSameDay(d, selectedDate);
        const isToday = isSameDay(d, today);
        const count = counts[key] ?? 0;

        return (
          <button
            key={key}
            onClick={() => router.push(`/citas?view=day&date=${key}`)}
            style={{ scrollSnapAlign: "center" }}
            className={cn(
              "shrink-0 w-12 h-[58px] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors",
              isSelected
                ? "bg-foreground"
                : isToday
                  ? "bg-surface border border-brand"
                  : "bg-surface border border-border"
            )}
          >
            <span
              className={cn(
                "text-[9px] font-bold uppercase leading-none",
                isSelected ? "text-background/60" : isToday ? "text-brand" : "text-muted"
              )}
            >
              {format(d, "EEE", { locale: es }).slice(0, 3)}
            </span>
            <span
              className={cn(
                "text-base font-bold leading-none",
                isSelected ? "text-background" : isToday ? "text-brand" : "text-foreground"
              )}
            >
              {format(d, "d")}
            </span>
            {/* A dot is enough at this size; the number would crowd it */}
            <span
              className={cn(
                "w-1 h-1 rounded-full",
                count === 0
                  ? "bg-transparent"
                  : isSelected
                    ? "bg-background/60"
                    : "bg-brand"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
