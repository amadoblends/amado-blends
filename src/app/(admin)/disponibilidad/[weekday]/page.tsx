import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DayForm } from "@/components/disponibilidad/day-form";

const weekdayLabels = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function AvailabilityDayPage({ params }: { params: Promise<{ weekday: string }> }) {
  const { weekday: weekdayParam } = await params;
  const weekday = Number(weekdayParam);

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) notFound();

  const supabase = await createClient();
  const { data: day } = await supabase.from("availability").select("*").eq("weekday", weekday).single();

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <Link href="/disponibilidad" className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-foreground">{weekdayLabels[weekday]}</h1>
      </header>

      <DayForm
        weekday={weekday}
        defaults={{
          isActive: day?.is_active ?? false,
          startTime: day?.start_time?.slice(0, 5) ?? "09:00",
          endTime: day?.end_time?.slice(0, 5) ?? "18:00",
          breakStartTime: day?.break_start_time?.slice(0, 5) ?? "",
          breakEndTime: day?.break_end_time?.slice(0, 5) ?? "",
          slotMinutes: day?.slot_minutes ?? 30,
        }}
      />
    </div>
  );
}
