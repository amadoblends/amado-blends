"use client";

import { useRef, useEffect, useMemo, useCallback, memo } from "react";
import { addDays, subDays, format, isSameDay, startOfDay, isFirstDayOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

const DAYS_BACK = 60;
const DAYS_FORWARD = 120;
const CELL_W = 44;
const SEP_W = 30;
const GAP = 4;

type Item =
  | { kind: "day"; date: Date; key: string; offset: number }
  | { kind: "month"; label: string; key: string; offset: number };

/**
 * Compact horizontally scrollable day picker: weekday label above the number,
 * a filled pill on the selected day, and a dot when the day has appointments.
 * Month initials are injected before each 1st so long scrolls stay oriented.
 */
function DayStripScrollerBase({
  selected,
  counts,
  onPick,
  onVisibleMonthChange,
}: {
  /** Already optimistic — the shell owns the selection so taps feel instant. */
  selected: string;
  counts: Record<string, number>;
  onPick: (dateKey: string) => void;
  onVisibleMonthChange?: (date: Date) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastReported = useRef<string>("");

  const selectedDate = useMemo(() => new Date(selected + "T00:00:00"), [selected]);
  const today = useMemo(() => startOfDay(new Date()), []);

  // Built once: every item carries its left offset so centring is exact even
  // though month chips are narrower than day cells.
  const { items, offsetByDay } = useMemo(() => {
    const start = subDays(today, DAYS_BACK);
    const list: Item[] = [];
    const map = new Map<string, number>();
    let offset = 0;

    for (let i = 0; i < DAYS_BACK + DAYS_FORWARD; i++) {
      const d = addDays(start, i);

      if (isFirstDayOfMonth(d)) {
        list.push({
          kind: "month",
          label: format(d, "MMM", { locale: es }).toUpperCase().replace(".", ""),
          key: `m-${format(d, "yyyy-MM")}`,
          offset,
        });
        offset += SEP_W + GAP;
      }

      const key = format(d, "yyyy-MM-dd");
      list.push({ kind: "day", date: d, key, offset });
      map.set(key, offset);
      offset += CELL_W + GAP;
    }
    return { items: list, offsetByDay: map };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const centreOn = useCallback(
    (dateStr: string, behavior: ScrollBehavior) => {
      const el = scrollerRef.current;
      const offset = offsetByDay.get(dateStr);
      if (!el || offset === undefined) return;
      // Left edge that puts the cell's midpoint at the viewport's midpoint
      const left = Math.max(0, offset - el.clientWidth / 2 + CELL_W / 2);
      // Don't fight the user if they've already scrolled it into place
      if (Math.abs(el.scrollLeft - left) < 2) return;
      el.scrollTo({ left, behavior });
    },
    [offsetByDay]
  );

  // Centre without animation on mount, smoothly when the day changes later
  const mounted = useRef(false);
  useEffect(() => {
    centreOn(selected, mounted.current ? "smooth" : "auto");
    mounted.current = true;
  }, [selected, centreOn]);

  // Report the month under the middle of the viewport, only when it changes
  const handleScroll = useCallback(() => {
    if (!onVisibleMonthChange) return;
    const el = scrollerRef.current;
    if (!el) return;

    const centre = el.scrollLeft + el.clientWidth / 2;
    let best: Item | null = null;
    for (const item of items) {
      if (item.kind !== "day") continue;
      if (item.offset <= centre) best = item;
      else break;
    }
    if (!best || best.kind !== "day") return;

    const monthKey = format(best.date, "yyyy-MM");
    if (monthKey === lastReported.current) return;
    lastReported.current = monthKey;
    onVisibleMonthChange(best.date);
  }, [items, onVisibleMonthChange]);

  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      className="flex gap-1 overflow-x-auto no-scrollbar -mx-4 px-4 overscroll-x-contain"
      style={{
        scrollSnapType: "x proximity",
        WebkitOverflowScrolling: "touch",
        contain: "content",
      }}
    >
      {items.map((item) =>
        item.kind === "month" ? (
          <div
            key={item.key}
            aria-hidden
            className="shrink-0 flex items-end justify-center pb-3"
            style={{ width: SEP_W, height: 62 }}
          >
            <span className="text-[9px] font-extrabold text-muted/50 tracking-widest">
              {item.label}
            </span>
          </div>
        ) : (
          <DayCell
            key={item.key}
            dateKey={item.key}
            date={item.date}
            selected={isSameDay(item.date, selectedDate)}
            isToday={isSameDay(item.date, today)}
            hasAppointments={(counts[item.key] ?? 0) > 0}
            onPick={onPick}
          />
        )
      )}
    </div>
  );
}

const DayCell = memo(function DayCell({
  dateKey,
  date,
  selected,
  isToday,
  hasAppointments,
  onPick,
}: {
  dateKey: string;
  date: Date;
  selected: boolean;
  isToday: boolean;
  hasAppointments: boolean;
  onPick: (dateKey: string) => void;
}) {
  return (
    <button
      onClick={() => onPick(dateKey)}
      style={{ scrollSnapAlign: "center", width: CELL_W }}
      className="shrink-0 h-[62px] flex flex-col items-center gap-1 pt-0.5"
    >
      <span
        className={cn(
          "text-[10px] font-bold uppercase leading-none tracking-wide",
          selected ? "text-foreground" : "text-muted"
        )}
      >
        {format(date, "EEE", { locale: es }).slice(0, 3).replace(".", "")}
      </span>

      {/* Number sits in a filled pill only when it's the selected day */}
      <span
        className={cn(
          "w-9 h-9 rounded-2xl flex items-center justify-center text-[15px] font-bold leading-none tnum transition-colors",
          selected
            ? "bg-foreground text-background"
            : isToday
              ? "text-brand"
              : "text-foreground"
        )}
      >
        {format(date, "d")}
      </span>

      <span
        className={cn(
          "w-1 h-1 rounded-full",
          !hasAppointments ? "bg-transparent" : selected ? "bg-brand" : "bg-brand/70"
        )}
      />
    </button>
  );
});

export const DayStripScroller = memo(DayStripScrollerBase);
