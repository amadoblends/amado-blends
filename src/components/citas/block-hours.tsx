"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { AvailabilityDay } from "@/lib/data/availability";

function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fmtSlot(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const p = h >= 12 ? "PM" : "AM";
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${dh}:${String(m).padStart(2, "0")} ${p}`;
}

interface BlockedRow {
  id: string;
  starts_at: string;
  ends_at: string;
}

export function BlockHoursButton({
  dateStr,
  dayAvail,
}: {
  dateStr: string;
  dayAvail: AvailabilityDay | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState<BlockedRow[]>([]);
  const [busyApts, setBusyApts] = useState<{ start: number; end: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [y, mo, d] = dateStr.split("-").map(Number);
    const dayStart = new Date(y, mo - 1, d, 0, 0, 0);
    const dayEnd = new Date(y, mo - 1, d, 23, 59, 59);

    const [{ data: blockedRows }, { data: apts }] = await Promise.all([
      supabase
        .from("blocked_times")
        .select("id, starts_at, ends_at")
        .lt("starts_at", dayEnd.toISOString())
        .gt("ends_at", dayStart.toISOString()),
      supabase
        .from("appointments")
        .select("starts_at, ends_at")
        .neq("status", "cancelada")
        .lt("starts_at", dayEnd.toISOString())
        .gt("ends_at", dayStart.toISOString()),
    ]);

    setBlocked(blockedRows ?? []);
    setBusyApts(
      (apts ?? []).map((a) => ({
        start: new Date(a.starts_at).getTime(),
        end: new Date(a.ends_at).getTime(),
      }))
    );
    setLoading(false);
  }, [dateStr]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!dayAvail?.is_active) return null;

  const start = toMins(dayAvail.start_time);
  const end = toMins(dayAvail.end_time);
  const step = dayAvail.slot_minutes;
  const bS = dayAvail.break_start_time ? toMins(dayAvail.break_start_time) : null;
  const bE = dayAvail.break_end_time ? toMins(dayAvail.break_end_time) : null;

  const slots: number[] = [];
  for (let t = start; t + step <= end; t += step) {
    if (bS !== null && bE !== null && t < bE && t + step > bS) continue;
    slots.push(t);
  }

  function slotDate(mins: number) {
    const [y, mo, d] = dateStr.split("-").map(Number);
    return new Date(y, mo - 1, d, Math.floor(mins / 60), mins % 60, 0);
  }

  function blockFor(mins: number): BlockedRow | undefined {
    const sMs = slotDate(mins).getTime();
    const eMs = sMs + step * 60000;
    return blocked.find(
      (b) => new Date(b.starts_at).getTime() < eMs && new Date(b.ends_at).getTime() > sMs
    );
  }

  function hasAppointment(mins: number): boolean {
    const sMs = slotDate(mins).getTime();
    const eMs = sMs + step * 60000;
    return busyApts.some((a) => a.start < eMs && a.end > sMs);
  }

  async function toggleSlot(mins: number) {
    setPendingSlot(mins);
    const supabase = createClient();
    const existing = blockFor(mins);

    if (existing) {
      await supabase.from("blocked_times").delete().eq("id", existing.id);
    } else {
      const startsAt = slotDate(mins);
      const endsAt = new Date(startsAt.getTime() + step * 60000);
      await supabase.from("blocked_times").insert({
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        reason: "Bloqueado por el barbero",
      });
    }
    await load();
    setPendingSlot(null);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed z-30 bottom-[calc(140px+max(12px,var(--safe-bottom)))] right-4 md:bottom-24 md:right-6 w-11 h-11 rounded-full bg-surface border border-border shadow-md flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Bloquear horas"
        title="Bloquear horas"
      >
        <Lock size={18} className="text-foreground" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Bloquear horas">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Toca las horas que quieras bloquear (puedes elegir varias). Los clientes no podrán
            reservar en esas horas. Toca de nuevo para desbloquear.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((t) => {
                const isBlocked = Boolean(blockFor(t));
                const hasApt = hasAppointment(t);
                const isPending = pendingSlot === t;
                return (
                  <button
                    key={t}
                    disabled={hasApt || isPending}
                    onClick={() => toggleSlot(t)}
                    className={cn(
                      "h-11 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center gap-1",
                      hasApt
                        ? "border-border bg-background text-muted/40 cursor-not-allowed"
                        : isBlocked
                          ? "bg-danger border-danger text-white"
                          : "border-border text-foreground bg-background active:bg-surface"
                    )}
                  >
                    {isPending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <>
                        {isBlocked && <Lock size={11} />}
                        {fmtSlot(t)}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-danger inline-block" /> Bloqueada
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-background border border-border inline-block" />{" "}
              Libre
            </span>
            <span className="flex items-center gap-1 opacity-50">Con cita = no se puede</span>
          </div>
        </div>
      </Modal>
    </>
  );
}
