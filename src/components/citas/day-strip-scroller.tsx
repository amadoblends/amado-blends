"use client";

import { useRef, useEffect, useMemo, useCallback, useState, useTransition, memo } from "react";
import { useRouter } from "next/navigation";
import { addDays, subDays, format, isSameDay, startOfDay, isFirstDayOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

const DAYS_BACK = 60;
const DAYS_FORWARD = 120;
const CELL_W = 48;
const SEP_W = 34;
const GAP = 4;

type Item =
  | { kind: "day"; date: Date; key: string; offset: number }
  | { kind: "month"; label: string; key: string; offset: number };

/**
 * Compact horizontally scrollable day picker with month separators.
 * Swiping reports the month in view so the header can follow along.
 */
function DayStripScrollerBase({
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
  const lastReported = useRef<string>("");
  const [, startTransition] = useTransition();

  // Highlight the tapped day immediately; the server catches up after
  const [optimistic, setOptimistic] = useState(selected);
  useEffect(() => setOptimistic(selected), [selected]);

  const selectedDate = useMemo(() => new Date(optimistic + "T00:00:00"), [optimistic]);
  const today = useMemo(() => startOfDay(new Date()), []);

  const pick = useCallback(
    (dateKey: string) => {
      setOptimistic(dateKey);
      startTransition(() => {
        router.push(`/citas?view=day&date=${dateKey}`, { scroll: false });
      });
    },
    [router]
  );

  // Build once: a month chip is injected before each 1st of the month, and
  // every item carries its left offset so centring is exact.
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
      el.scrollTo({
        left: Math.max(0, offset - el.clientWidth / 2 + CELL_W / 2),
        behavior,
      });
    },
    [offsetByDay]
  );

  // Centre without animation on mount, smoothly when the day changes later
  const mounted = useRef(false);
  useEffect(() => {
    centreOn(optimistic, mounted.current ? "smooth" : "auto");
    mounted.current = true;
  }, [optimistic, centreOn]);

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
      className="flex gap-1 overflow-x-auto no-scrollbar -mx-4 px-4 py-0.5 overscroll-x-contain"
      style={{
        scrollSnapType: "x proximity",
        // Momentum scrolling and GPU compositing keep the swipe smooth
        WebkitOverflowScrolling: "touch",
        contain: "content",
      }}
    >
      {items.map((item) =>
        item.kind === "month" ? (
          <div
            key={item.key}
            aria-hidden
            className="shrink-0 flex items-center justify-center"
            style={{ width: SEP_W, height: 58 }}
          >
            <span className="text-[10px] font-black text-muted/70 tracking-wider">
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
            onPick={pick}
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
      className={cn(
        "shrink-0 h-[58px] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors",
        selected
          ? "bg-foreground"
          : isToday
            ? "bg-surface border border-brand"
            : "bg-surface border border-border"
      )}
    >
      <span
        className={cn(
          "text-[9px] font-bold uppercase leading-none",
          selected ? "text-background/60" : isToday ? "text-brand" : "text-muted"
        )}
      >
        {format(date, "EEE", { locale: es }).slice(0, 3)}
      </span>
      <span
        className={cn(
          "text-base font-bold leading-none",
          selected ? "text-background" : isToday ? "text-brand" : "text-foreground"
        )}
      >
        {format(date, "d")}
      </span>
      <span
        className={cn(
          "w-1 h-1 rounded-full",
          !hasAppointments ? "bg-transparent" : selected ? "bg-background/60" : "bg-brand"
        )}
      />
    </button>
  );
});

export const DayStripScroller = memo(DayStripScrollerBase);
