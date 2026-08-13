import { format } from "date-fns";
import { getAvailability } from "@/lib/data/availability";
import {
  getAppointmentsForDay,
  getBlockedTimesForDay,
  getClosures,
} from "@/lib/data/appointments";
import { BackButton } from "@/components/ui/back-button";
import { BlocksManager } from "@/components/citas/blocks-manager";

/**
 * "Disponibilidad y bloqueos" — the home for blocking hours and closing whole
 * days. These used to be permanent buttons on the calendar; the calendar now
 * offers blocking from the slot you actually tapped, and the bulk tools live
 * here where they don't cost screen space.
 */
export default async function BloqueosPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const dateStr = params.date ?? format(new Date(), "yyyy-MM-dd");
  const date = new Date(dateStr + "T00:00:00");

  const [availability, appointments, blockedTimes, closures] = await Promise.all([
    getAvailability(),
    getAppointmentsForDay(date),
    getBlockedTimesForDay(date),
    getClosures(),
  ]);

  const dayAvail =
    availability.find((d) => d.weekday === date.getDay() && d.is_active) ?? null;

  return (
    <div className="px-4 pt-[max(10px,var(--safe-top))] pb-6 space-y-4">
      <header className="flex items-center gap-3">
        <BackButton />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">Disponibilidad y bloqueos</h1>
          <p className="text-xs text-muted">Cierra días completos o bloquea horas sueltas</p>
        </div>
      </header>

      <BlocksManager
        dateStr={dateStr}
        dayAvail={dayAvail}
        appointments={appointments}
        blockedTimes={blockedTimes}
        closures={closures}
      />
    </div>
  );
}
