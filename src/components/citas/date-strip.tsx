"use client";

import { useRouter } from "next/navigation";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function DateStrip({
  selected,
  appointmentStarts,
}: {
  selected: string;
  appointmentStarts: string[];
}) {
  const router = useRouter();
  const selectedDate = new Date(selected + "T00:00:00");
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));

  // Group by LOCAL date in the browser so evening appointments count on the right day
  const counts: Record<string, number> = {};
  for (const iso of appointmentStarts) {
    const key = format(new Date(iso), "yyyy-MM-dd");
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return (
    <div className="grid grid-cols-6 gap-1.5">
      {days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const active = isSameDay(d, selectedDate);
        return (
          <button
            key={key}
            onClick={() => router.push(`/citas?date=${key}`)}
            className={cn(
              "flex flex-col items-center gap-1 py-2 rounded-xl transition-colors",
              active ? "bg-violet text-white" : "bg-surface text-foreground border border-border"
            )}
          >
            <span className="text-[10px] font-medium uppercase opacity-80">
              {format(d, "EEE", { locale: es })}
            </span>
            <span className="text-base font-bold">{format(d, "d")}</span>
            <span className={cn("text-[10px]", active ? "text-white/80" : "text-muted")}>
              {counts[key] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
