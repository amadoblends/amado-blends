"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { CalendarOff } from "lucide-react";
import { DayTimeline } from "./timeline";
import { AppointmentWizard } from "./wizard";
import { BlockHoursButton } from "./block-hours";
import { ClosureModal } from "./closure-modal";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import type { AppointmentRow, BlockedRange } from "@/lib/data/appointments";
import type { AvailabilityDay } from "@/lib/data/availability";
import type { ServiceOption } from "./wizard";

export function DayCitasShell({
  appointments,
  dayAvail,
  availability,
  services,
  dateStr,
  blockedTimes = [],
}: {
  appointments: AppointmentRow[];
  dayAvail: AvailabilityDay | null;
  availability: AvailabilityDay[];
  services: ServiceOption[];
  dateStr: string;
  blockedTimes?: BlockedRange[];
}) {
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [closureOpen, setClosureOpen] = useState(false);

  return (
    <>
      <RealtimeRefresher tables={["appointments", "blocked_times"]} />
      <DayTimeline
        appointments={appointments}
        dayAvail={dayAvail}
        dateStr={dateStr}
        blockedTimes={blockedTimes}
      />

      <BlockHoursButton dateStr={dateStr} dayAvail={dayAvail} />

      {/* Close whole days or a date range */}
      <button
        onClick={() => setClosureOpen(true)}
        className="fixed z-30 bottom-[calc(196px+max(12px,var(--safe-bottom)))] right-4 md:bottom-40 md:right-6 w-11 h-11 rounded-full bg-surface border border-border shadow-md flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Cerrar días"
        title="Cerrar días (vacaciones, feriados)"
      >
        <CalendarOff size={18} className="text-foreground" />
      </button>

      <ClosureModal
        open={closureOpen}
        onClose={() => setClosureOpen(false)}
        defaultDate={dateStr}
      />

      <AppointmentWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={() => {
          setWizardOpen(false);
          router.refresh();
        }}
        services={services}
        availability={availability}
        defaultDate={dateStr}
      />

      <button
        onClick={() => setWizardOpen(true)}
        aria-label="Nueva cita"
        className="fixed z-30 bottom-[calc(72px+max(12px,var(--safe-bottom)))] right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-brand text-white shadow-lg shadow-brand/30 flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus size={26} />
      </button>
    </>
  );
}
