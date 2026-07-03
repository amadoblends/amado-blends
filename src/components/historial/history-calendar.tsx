"use client";

import { useState, useEffect } from "react";
import {
  addMonths, subMonths, addYears, subYears, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const WEEK_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

interface DayCounts {
  completada: number;
  cancelada: number;
  pendiente: number;
  confirmada: number;
}

function localKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function HistoryCalendar({
  open,
  onClose,
  selectedDate,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  selectedDate: string;
  onPick: (dateStr: string) => void;
}) {
  const [cursor, setCursor] = useState(startOfMonth(new Date(selectedDate + "T00:00:00")));
  const [counts, setCounts] = useState<Map<string, DayCounts>>(new Map());
  const [loading, setLoading] = useState(false);

  // Load status counts for the visible month
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const supabase = createClient();
    const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    supabase
      .from("appointments")
      .select("starts_at, status")
      .gte("starts_at", new Date(gridStart.getTime() - 14 * 3600_000).toISOString())
      .lte("starts_at", new Date(gridEnd.getTime() + 14 * 3600_000).toISOString())
      .then(({ data }) => {
        if (!alive) return;
        const map = new Map<string, DayCounts>();
        for (const row of data ?? []) {
          const key = localKey(row.starts_at);
          const c = map.get(key) ?? { completada: 0, cancelada: 0, pendiente: 0, confirmada: 0 };
          if (row.status in c) c[row.status as keyof DayCounts]++;
          map.set(key, c);
        }
        setCounts(map);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, cursor]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
  });

  return (
    <Modal open={open} onClose={onClose} title="Buscar fecha" maxWidthClass="max-w-[440px]">
      <div className="space-y-3">
        {/* Year + month navigation */}
        <div className="flex items-center justify-between gap-1">
          <button
            onClick={() => setCursor((c) => subYears(c, 1))}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center"
            title="Año anterior"
          >
            <ChevronsLeft size={14} />
          </button>
          <button
            onClick={() => setCursor((c) => subMonths(c, 1))}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center"
          >
            <ChevronLeft size={14} />
          </button>
          <p className="flex-1 text-center font-bold text-foreground capitalize">
            {format(cursor, "MMMM yyyy", { locale: es })}
            {loading && <Loader2 size={12} className="inline ml-2 animate-spin text-muted" />}
          </p>
          <button
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => setCursor((c) => addYears(c, 1))}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center"
            title="Año siguiente"
          >
            <ChevronsRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {WEEK_LABELS.map((w, i) => (
            <div key={i} className="text-center text-[10px] font-semibold text-muted py-1">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const c = counts.get(key);
            const inMonth = isSameMonth(d, cursor);
            const isSelected = isSameDay(d, new Date(selectedDate + "T00:00:00"));
            const isToday = isSameDay(d, new Date());
            return (
              <button
                key={key}
                onClick={() => {
                  onPick(key);
                  onClose();
                }}
                className={cn(
                  "rounded-lg flex flex-col items-center justify-start pt-1 pb-0.5 min-h-[52px] gap-0.5 border transition-colors",
                  isSelected
                    ? "bg-brand border-brand"
                    : isToday
                      ? "border-brand bg-surface"
                      : "border-transparent bg-background",
                  !inMonth && "opacity-35"
                )}
              >
                <span
                  className={cn(
                    "text-xs font-semibold leading-none",
                    isSelected ? "text-white" : isToday ? "text-brand" : "text-foreground"
                  )}
                >
                  {format(d, "d")}
                </span>
                {c && (
                  <div className="flex flex-col items-center leading-none gap-[1px]">
                    {c.completada > 0 && (
                      <span className={cn("text-[8px] font-bold", isSelected ? "text-white/90" : "text-success")}>
                        ✓{c.completada}
                      </span>
                    )}
                    {c.cancelada > 0 && (
                      <span className={cn("text-[8px] font-bold", isSelected ? "text-white/90" : "text-danger")}>
                        ✕{c.cancelada}
                      </span>
                    )}
                    {c.pendiente + c.confirmada > 0 && (
                      <span className={cn("text-[8px] font-bold", isSelected ? "text-white/90" : "text-warning")}>
                        ●{c.pendiente + c.confirmada}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4 text-[10px] text-muted pt-1">
          <span className="text-success font-bold">✓ Completadas</span>
          <span className="text-danger font-bold">✕ Canceladas</span>
          <span className="text-warning font-bold">● Pendientes</span>
        </div>
      </div>
    </Modal>
  );
}
