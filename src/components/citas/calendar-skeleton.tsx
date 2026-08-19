import { cn } from "@/lib/utils";
import type { CalendarView } from "./calendar-toolbar";

/**
 * What the calendar shows between tapping a view and its data arriving.
 *
 * Each shape mirrors the view it stands in for — a rail of rows for Día, a
 * seven-column grid for Semana, a month grid, twelve small months for Año — so
 * the switch reads as the new view loading rather than as the old one
 * freezing. The button state has already changed by the time this renders;
 * this is the other half of that answer.
 */
export function CalendarSkeleton({ view }: { view: CalendarView }) {
  if (view === "day") {
    return (
      <div className="space-y-2 animate-view-in">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-2.5">
            <Shimmer className="w-11 h-4 mt-1 rounded-md" />
            <Shimmer
              className="flex-1 rounded-xl"
              style={{ height: i % 3 === 0 ? 74 : i % 3 === 1 ? 52 : 38 }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (view === "week") {
    return (
      <div className="grid grid-cols-7 gap-1.5 animate-view-in">
        {Array.from({ length: 7 }).map((_, c) => (
          <div key={c} className="space-y-1.5">
            <Shimmer className="h-6 rounded-lg" />
            {Array.from({ length: 5 }).map((_, r) => (
              <Shimmer
                key={r}
                className="rounded-lg"
                style={{ height: (c + r) % 3 === 0 ? 44 : 28 }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (view === "month") {
    return (
      <div className="grid grid-cols-7 gap-1.5 animate-view-in">
        {Array.from({ length: 42 }).map((_, i) => (
          <Shimmer key={i} className="rounded-lg aspect-square" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-view-in">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Shimmer className="h-4 w-16 rounded-md" />
          <div className="grid grid-cols-7 gap-[3px]">
            {Array.from({ length: 35 }).map((_, d) => (
              <Shimmer key={d} className="rounded-[3px] aspect-square" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Shimmer({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={cn("bg-surface animate-pulse", className)}
      style={style}
    />
  );
}
