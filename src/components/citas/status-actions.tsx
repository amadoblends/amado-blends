"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAppointmentStatus } from "@/lib/actions/appointments";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/supabase/types";

const options: { value: AppointmentStatus; label: string; activeClass: string }[] = [
  { value: "confirmada", label: "Confirmar", activeClass: "bg-success text-white" },
  { value: "completada", label: "Completar", activeClass: "bg-info text-white" },
  { value: "cancelada", label: "Cancelar", activeClass: "bg-danger text-white" },
];

export function AppointmentStatusActions({
  appointmentId,
  currentStatus,
}: {
  appointmentId: string;
  currentStatus: AppointmentStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setStatus(status: AppointmentStatus) {
    startTransition(async () => {
      await updateAppointmentStatus(appointmentId, status);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          disabled={isPending || currentStatus === opt.value}
          onClick={() => setStatus(opt.value)}
          className={cn(
            "py-2.5 rounded-xl text-sm font-semibold border border-border transition-colors disabled:opacity-50",
            currentStatus === opt.value ? opt.activeClass : "bg-surface text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
