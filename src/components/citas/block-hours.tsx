"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Lock, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  toMins, localMins, localDateStr, todayStr, durationMins, dateAt,
  fmtMins as fmtSlot,
} from "@/lib/time";
import type { AvailabilityDay } from "@/lib/data/availability";
import type { AppointmentRow, BlockedRange } from "@/lib/data/appointments";

type SlotState = "free" | "blocked" | "busy" | "past";

/**
 * Toggle blocks on the selected day.
 *
 * It used to open empty and fire two queries before drawing anything. The
 * calendar has already loaded that day's appointments and blocks, so those are
 * passed straight in: the grid is on screen the moment the modal opens, and
 * each toggle paints optimistically while the write goes out in the
 * background.
 */
export function BlockHoursModal({
  open,
  onClose,
  dateStr,
  dayAvail,
  appointments,
  blockedTimes,
}: {
  open: boolean;
  onClose: () => void;
  dateStr: string;
  dayAvail: AvailabilityDay | null;
  appointments: AppointmentRow[];
  blockedTimes: BlockedRange[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Local mirror so a tap lands instantly; re-seeded whenever the page revalidates
  const [blocks, setBlocks] = useState<BlockedRange[]>(blockedTimes);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setBlocks(blockedTimes), [blockedTimes]);
  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const dayBlocks = useMemo(
    () => blocks.filter((b) => localDateStr(b.starts_at) === dateStr),
    [blocks, dateStr]
  );
  const dayApts = useMemo(
    () => appointments.filter((a) => localDateStr(a.starts_at) === dateStr),
    [appointments, dateStr]
  );

  const step = dayAvail?.slot_minutes || 30;

  const slots = useMemo(() => {
    if (!dayAvail?.is_active) return [];
    const start = toMins(dayAvail.start_time);
    const end = toMins(dayAvail.end_time);
    const bS = dayAvail.break_start_time ? toMins(dayAvail.break_start_time) : null;
    const bE = dayAvail.break_end_time ? toMins(dayAvail.break_end_time) : null;

    const out: number[] = [];
    for (let t = start; t + step <= end; t += step) {
      if (bS !== null && bE !== null && t < bE && t + step > bS) continue;
      out.push(t);
    }
    return out;
  }, [dayAvail, step]);

  if (!open) return null;

  if (!dayAvail?.is_active) {
    return (
      <Modal open={open} onClose={onClose} title="Bloquear horas">
        <p className="text-sm text-muted py-2">
          Ese día no es laborable, así que no hay horas que bloquear.
        </p>
      </Modal>
    );
  }

  const nowRef = new Date();
  const today = todayStr();
  const nowMins = nowRef.getHours() * 60 + nowRef.getMinutes();

  const slotDate = (mins: number) => dateAt(dateStr, mins);

  function blockFor(mins: number): BlockedRange | undefined {
    return dayBlocks.find((b) => {
      const s = localMins(b.starts_at);
      return s < mins + step && s + durationMins(b.starts_at, b.ends_at) > mins;
    });
  }

  function stateOf(mins: number): SlotState {
    const busy = dayApts.some((a) => {
      const s = localMins(a.starts_at);
      return s < mins + step && s + durationMins(a.starts_at, a.ends_at) > mins;
    });
    if (busy) return "busy";
    if (blockFor(mins)) return "blocked";
    if (dateStr < today || (dateStr === today && mins < nowMins)) return "past";
    return "free";
  }

  async function toggleSlot(mins: number) {
    const existing = blockFor(mins);
    const snapshot = blocks;
    setError(null);
    setSaving(mins);

    const supabase = createClient();

    if (existing) {
      // Paint the unblock first, undo it only if the delete fails
      setBlocks((prev) => prev.filter((b) => b.id !== existing.id));
      const { error: delErr } = await supabase
        .from("blocked_times")
        .delete()
        .eq("id", existing.id);
      if (delErr) {
        setBlocks(snapshot);
        setError("No se pudo desbloquear esa hora.");
      }
    } else {
      const startsAt = slotDate(mins);
      const endsAt = new Date(startsAt.getTime() + step * 60000);
      const optimistic: BlockedRange = {
        id: `temp-${mins}`,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        reason: "Bloqueado por el barbero",
      };
      setBlocks((prev) => [...prev, optimistic]);

      const { data, error: insErr } = await supabase
        .from("blocked_times")
        .insert({
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          reason: "Bloqueado por el barbero",
        })
        .select("id, starts_at, ends_at, reason")
        .single();

      if (insErr || !data) {
        setBlocks(snapshot);
        setError("No se pudo bloquear esa hora. ¿Ya hay una cita ahí?");
      } else {
        // Swap the placeholder for the real row so a second tap can delete it
        setBlocks((prev) => prev.map((b) => (b.id === optimistic.id ? data : b)));
      }
    }

    setSaving(null);
    // Refresh the calendar behind the modal without blocking the interface
    startTransition(() => router.refresh());
  }

  return (
    <Modal open={open} onClose={onClose} title="Bloquear horas">
      <div className="space-y-3.5">
        <div>
          <p className="text-sm font-bold text-foreground capitalize">
            {format(new Date(dateStr + "T00:00:00"), "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <p className="text-xs text-muted mt-0.5">
            Toca las horas que quieras bloquear. Toca de nuevo para desbloquear.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {slots.map((t) => {
            const state = stateOf(t);
            const isSaving = saving === t;
            const disabled = state === "busy" || state === "past" || isSaving;

            return (
              <button
                key={t}
                disabled={disabled}
                onClick={() => toggleSlot(t)}
                title={
                  state === "busy"
                    ? "Ya hay una cita en esa hora"
                    : state === "past"
                      ? "Esa hora ya pasó"
                      : undefined
                }
                className={cn(
                  "h-11 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1",
                  state === "busy"
                    ? "border-border bg-background text-muted/40 cursor-not-allowed"
                    : state === "past"
                      ? "border-border/60 bg-background text-muted/30 cursor-not-allowed"
                      : state === "blocked"
                        ? "bg-danger border-danger text-white"
                        : "border-border text-foreground bg-background active:bg-surface"
                )}
              >
                {isSaving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <>
                    {state === "blocked" && <Lock size={11} />}
                    <span className="tnum">{fmtSlot(t)}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-danger inline-block" /> Bloqueada
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-background border border-border inline-block" />
            Libre
          </span>
          <span className="opacity-60">Con cita o ya pasada = no se puede</span>
        </div>
      </div>
    </Modal>
  );
}
