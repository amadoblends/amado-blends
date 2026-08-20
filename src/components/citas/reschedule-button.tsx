"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { RescheduleModal } from "./reschedule-modal";
import type { AvailabilityDay, BookingSettings } from "@/lib/data/availability";
import type { ClosureRange } from "@/lib/data/appointments";

interface ServiceOption {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  color: string;
}

export function RescheduleButton({
  appointmentId,
  currentServiceId,
  currentStartsAt,
  currentEndsAt,
  services,
  availability,
  closures = [],
  bookingSettings,
  extraMinutes = 0,
}: {
  appointmentId: string;
  currentServiceId: string;
  currentStartsAt: string;
  currentEndsAt: string;
  services: ServiceOption[];
  availability: AvailabilityDay[];
  closures?: ClosureRange[];
  bookingSettings: BookingSettings;
  extraMinutes?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground active:bg-background"
      >
        <CalendarClock size={16} /> Reagendar cita
      </button>
      <RescheduleModal
        open={open}
        onClose={() => setOpen(false)}
        appointmentId={appointmentId}
        currentServiceId={currentServiceId}
        currentStartsAt={currentStartsAt}
        currentEndsAt={currentEndsAt}
        services={services}
        availability={availability}
        closures={closures}
        bookingSettings={bookingSettings}
        extraMinutes={extraMinutes}
      />
    </>
  );
}
