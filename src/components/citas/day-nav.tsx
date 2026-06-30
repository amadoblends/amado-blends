"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarPicker } from "@/components/citas/calendar-picker";

export function DayNav({
  date,
  activeWeekdays,
  bookingWindowDays,
}: {
  date: string;
  activeWeekdays: number[];
  bookingWindowDays: number;
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const current = new Date(date + "T00:00:00");
  const isToday = format(new Date(), "yyyy-MM-dd") === date;

  function go(delta: number) {
    router.push(`/citas?date=${format(addDays(current, delta), "yyyy-MM-dd")}`);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <button onClick={() => go(-1)} className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
          <ChevronLeft size={18} />
        </button>
        <button onClick={() => setPickerOpen(true)} className="text-center active:opacity-70">
          <p className="text-xs font-semibold text-brand">{isToday ? "Hoy" : "Ver calendario"}</p>
          <p className="font-bold text-foreground capitalize">
            {format(current, "EEEE, d 'de' MMMM", { locale: es })}
          </p>
        </button>
        <button onClick={() => go(1)} className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
          <ChevronRight size={18} />
        </button>
      </div>

      <CalendarPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedDate={date}
        activeWeekdays={new Set(activeWeekdays)}
        bookingWindowDays={bookingWindowDays}
      />
    </>
  );
}
