"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Lock, Loader2, Clock } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import { toMins, fromMins, dateAt, fmtHHMM as fmtTime } from "@/lib/time";
import { cn } from "@/lib/utils";

const DURATIONS = [15, 30, 45, 60, 90, 120];

const REASONS = [
  { value: "descanso", label: "Descanso" },
  { value: "personal", label: "Personal" },
  { value: "almuerzo", label: "Almuerzo" },
  { value: "mantenimiento", label: "Limpieza" },
  { value: "otro", label: "Otro" },
];

const addMinutesTo = (hhmm: string, mins: number) => fromMins(toMins(hhmm) + mins);

/**
 * Blocks a single slot the barber already picked on the calendar, so it only
 * asks for what's still missing: how long, why, and an optional note.
 */
export function BlockHourQuick({
  open,
  onClose,
  dateStr,
  startTime,
}: {
  open: boolean;
  onClose: () => void;
  dateStr: string;
  startTime: string;
}) {
  const router = useRouter();
  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState("descanso");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  const endTime = addMinutesTo(startTime, duration);

  async function save() {
    setError(null);
    setSaving(true);

    const supabase = createClient();
    const starts = dateAt(dateStr, toMins(startTime));
    const ends = new Date(starts.getTime() + duration * 60000);

    const label = REASONS.find((r) => r.value === reason)?.label ?? "Bloqueado";
    const { error: insertError } = await supabase.from("blocked_times").insert({
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      reason: note.trim() ? `${label} — ${note.trim()}` : label,
    });

    setSaving(false);
    if (insertError) {
      setError("No se pudo bloquear esa hora. ¿Ya hay una cita ahí?");
      return;
    }

    // Close on success and let the calendar catch up behind the modal, so the
    // barber never waits on a re-render they aren't looking at.
    onClose();
    startTransition(() => router.refresh());
  }

  return (
    <Modal open={open} onClose={onClose} title="Bloquear hora">
      <div className="space-y-4">
        {/* What was already chosen on the calendar */}
        <div className="bg-brand-light rounded-xl border border-brand/20 px-3.5 py-3 flex items-center gap-2.5">
          <Clock size={16} className="text-brand shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-brand capitalize truncate">
              {format(new Date(dateStr + "T00:00:00"), "EEEE d 'de' MMMM", { locale: es })}
            </p>
            <p className="text-xs text-brand/80">
              {fmtTime(startTime)} – {fmtTime(endTime)}
            </p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">¿Cuánto dura?</label>
          <div className="grid grid-cols-3 gap-1.5">
            {DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDuration(m)}
                className={cn(
                  "h-11 rounded-xl border text-sm font-semibold transition-colors",
                  duration === m
                    ? "bg-foreground border-foreground text-background"
                    : "border-border bg-background text-muted"
                )}
              >
                {m < 60 ? `${m} min` : `${m / 60}h${m % 60 ? ` ${m % 60}m` : ""}`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Motivo</label>
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={cn(
                  "h-9 px-3 rounded-full border text-xs font-semibold transition-colors",
                  reason === r.value
                    ? "bg-brand border-brand text-white"
                    : "border-border bg-background text-muted"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Nota (opcional)
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={120}
            placeholder="Ej. cita médica"
            className="w-full h-11 px-3.5 rounded-xl border border-border bg-background text-base text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        {error && <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-12 rounded-xl border border-border text-sm font-semibold text-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-[2] h-12 rounded-xl bg-brand text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={15} />}
            Bloquear
          </button>
        </div>
      </div>
    </Modal>
  );
}
