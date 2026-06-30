"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isBefore,
  isAfter,
  startOfDay,
  addDays,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

const weekLabels = ["L", "M", "M", "J", "V", "S", "D"];

export function CalendarPicker({
  open,
  onClose,
  selectedDate,
  activeWeekdays,
  bookingWindowDays,
}: {
  open: boolean;
  onClose: () => void;
  selectedDate: string;
  activeWeekdays: Set<number>;
  bookingWindowDays: number;
}) {
  const router = useRouter();
  const selected = new Date(selectedDate + "T00:00:00");
  const [cursor, setCursor] = useState(startOfMonth(selected));

  const today = startOfDay(new Date());
  const maxDate = addDays(today, bookingWindowDays);

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function isDisabled(d: Date) {
    const weekday = d.getDay();
    const beyondWindow = isAfter(startOfDay(d), maxDate);
    const tooOld = isBefore(startOfDay(d), today);
    const dayOff = activeWeekdays.size > 0 && !activeWeekdays.has(weekday);
    return beyondWindow || (tooOld && !isSameDay(d, today)) || dayOff;
  }

  function selectDay(d: Date) {
    if (isDisabled(d)) return;
    router.push(`/citas?date=${format(d, "yyyy-MM-dd")}`);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Selecciona una fecha">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCursor((c) => subMonths(c, 1))} className="w-8 h-8 rounded-full border border-border flex items-center justify-center">
          <ChevronLeft size={16} />
        </button>
        <p className="font-semibold text-foreground capitalize">{format(cursor, "MMMM yyyy", { locale: es })}</p>
        <button onClick={() => setCursor((c) => addMonths(c, 1))} className="w-8 h-8 rounded-full border border-border flex items-center justify-center">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekLabels.map((w, i) => (
          <div key={i} className="text-center text-[11px] font-semibold text-muted py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const disabled = isDisabled(d);
          const inMonth = isSameMonth(d, cursor);
          const isSelected = isSameDay(d, selected);
          const isToday = isSameDay(d, today);

          return (
            <button
              key={d.toISOString()}
              onClick={() => selectDay(d)}
              disabled={disabled}
              className={cn(
                "aspect-square rounded-xl text-sm font-medium flex items-center justify-center transition-colors",
                !inMonth && "text-muted/40",
                disabled && "text-muted/30 cursor-not-allowed",
                !disabled && inMonth && "text-foreground",
                isSelected && "bg-violet text-white font-bold",
                !isSelected && isToday && "border border-brand text-brand font-bold"
              )}
            >
              {format(d, "d")}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted mt-3 text-center">
        Puedes agendar hasta {bookingWindowDays} días por adelantado. Los días no laborables están deshabilitados.
      </p>
    </Modal>
  );
}
