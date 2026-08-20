"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, CalendarOff, Trash2, Loader2, ChevronRight } from "lucide-react";
import { BlockHoursModal } from "./block-hours";
import { ClosureModal } from "./closure-modal";
import { reasonLabel } from "@/lib/closures";
import { createClient } from "@/lib/supabase/client";
import { fmtMins, localMins, durationMins } from "@/lib/time";
import type { AvailabilityDay } from "@/lib/data/availability";
import type {
  AppointmentRow,
  BlockedRange,
  ClosureRange,
} from "@/lib/data/appointments";
import { shopToday } from "@/lib/timezone";

/**
 * Everything that takes time off the calendar, in one place: block hours on a
 * given day, close a run of days, and review or undo what's already set.
 */
export function BlocksManager({
  dateStr,
  dayAvail,
  appointments,
  blockedTimes,
  closures,
}: {
  dateStr: string;
  dayAvail: AvailabilityDay | null;
  appointments: AppointmentRow[];
  blockedTimes: BlockedRange[];
  closures: ClosureRange[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [hoursOpen, setHoursOpen] = useState(false);
  const [closureOpen, setClosureOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  // Past closures are noise; the barber only acts on what's still ahead
  const todayKey = shopToday();
  const upcoming = closures
    .filter((c) => c.ends_on >= todayKey)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));

  async function removeClosure(id: string) {
    setRemoving(id);
    const supabase = createClient();
    await supabase.from("closures").delete().eq("id", id);
    setRemoving(null);
    startTransition(() => router.refresh());
  }

  async function removeBlock(id: string) {
    setRemoving(id);
    const supabase = createClient();
    await supabase.from("blocked_times").delete().eq("id", id);
    setRemoving(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-5">
      {/* Entry points */}
      <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
        <ActionRow
          icon={<Clock size={19} className="text-brand" />}
          title="Bloquear horas"
          hint={format(new Date(dateStr + "T00:00:00"), "EEEE d 'de' MMMM", { locale: es })}
          onClick={() => setHoursOpen(true)}
        />
        <ActionRow
          icon={<CalendarOff size={19} className="text-brand" />}
          title="Cerrar días"
          hint="Vacaciones, feriados o imprevistos"
          onClick={() => setClosureOpen(true)}
        />
      </div>

      {/* Blocks already set for the selected day */}
      <section>
        <h2 className="text-[11px] font-bold text-muted uppercase tracking-wide mb-2">
          Horas bloqueadas hoy
        </h2>
        {blockedTimes.length === 0 ? (
          <p className="text-sm text-muted bg-surface rounded-2xl border border-border px-4 py-4">
            Ninguna. Todas tus horas de trabajo están disponibles.
          </p>
        ) : (
          <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
            {blockedTimes.map((b) => {
              const s = localMins(b.starts_at);
              return (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <Clock size={16} className="text-muted shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground tnum">
                      {fmtMins(s)} – {fmtMins(s + durationMins(b.starts_at, b.ends_at))}
                    </p>
                    {b.reason && <p className="text-xs text-muted truncate">{b.reason}</p>}
                  </div>
                  <button
                    onClick={() => removeBlock(b.id)}
                    disabled={removing === b.id}
                    aria-label="Quitar bloqueo"
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-danger active:bg-background shrink-0"
                  >
                    {removing === b.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Upcoming closures */}
      <section>
        <h2 className="text-[11px] font-bold text-muted uppercase tracking-wide mb-2">
          Días cerrados próximos
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted bg-surface rounded-2xl border border-border px-4 py-4">
            No tienes cierres programados.
          </p>
        ) : (
          <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
            {upcoming.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <CalendarOff size={16} className="text-danger shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground capitalize">
                    {c.starts_on === c.ends_on
                      ? format(new Date(c.starts_on + "T00:00:00"), "EEEE d MMM", { locale: es })
                      : `${format(new Date(c.starts_on + "T00:00:00"), "d MMM", { locale: es })} – ${format(new Date(c.ends_on + "T00:00:00"), "d MMM", { locale: es })}`}
                  </p>
                  <p className="text-xs text-muted truncate">
                    {reasonLabel(c.reason)}
                    {c.description ? ` · ${c.description}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => removeClosure(c.id)}
                  disabled={removing === c.id}
                  aria-label="Quitar cierre"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-danger active:bg-background shrink-0"
                >
                  {removing === c.id ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <BlockHoursModal
        open={hoursOpen}
        onClose={() => setHoursOpen(false)}
        dateStr={dateStr}
        dayAvail={dayAvail}
        appointments={appointments}
        blockedTimes={blockedTimes}
      />

      <ClosureModal
        open={closureOpen}
        onClose={() => setClosureOpen(false)}
        defaultDate={dateStr}
      />
    </div>
  );
}

function ActionRow({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 active:bg-background text-left"
    >
      <span className="w-10 h-10 rounded-xl bg-background flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs text-muted capitalize truncate">{hint}</span>
      </span>
      <ChevronRight size={16} className="text-muted shrink-0" />
    </button>
  );
}
