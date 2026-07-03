"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { DayTimeline } from "./timeline";
import { AppointmentWizard } from "./wizard";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import type { AppointmentRow } from "@/lib/data/appointments";
import type { AvailabilityDay } from "@/lib/data/availability";
import type { ServiceOption } from "./wizard";

export function DayCitasShell({
  appointments,
  dayAvail,
  availability,
  services,
  dateStr,
}: {
  appointments: AppointmentRow[];
  dayAvail: AvailabilityDay | null;
  availability: AvailabilityDay[];
  services: ServiceOption[];
  dateStr: string;
}) {
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <>
      <RealtimeRefresher tables={["appointments"]} />
      <DayTimeline appointments={appointments} dayAvail={dayAvail} dateStr={dateStr} />

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
