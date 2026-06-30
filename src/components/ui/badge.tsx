import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/supabase/types";

const statusStyles: Record<AppointmentStatus, string> = {
  confirmada: "bg-success-light text-success",
  pendiente: "bg-warning-light text-warning",
  completada: "bg-info-light text-info",
  cancelada: "bg-danger-light text-danger",
};

const statusLabels: Record<AppointmentStatus, string> = {
  confirmada: "Confirmada",
  pendiente: "Pendiente",
  completada: "Completada",
  cancelada: "Cancelada",
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={cn(
        "text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap",
        statusStyles[status]
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-light text-violet",
        className
      )}
    >
      {children}
    </span>
  );
}
