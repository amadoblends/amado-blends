"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, format,
  isSameMonth, isSameDay, isBefore, startOfDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2, CalendarClock } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { rescheduleAppointment } from "@/lib/actions/appointments";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { AvailabilityDay } from "@/lib/data/availability";

const WEEK_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

interface ServiceOption {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  color: string;
}

interface BusyInterval {
  start: number;
  end: number;
}

function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMins(t: number) {
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
function fmtSlot(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const p = h >= 12 ? "PM" : "AM";
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${dh}:${String(m).padStart(2, "0")} ${p}`;
}

export function RescheduleModal({
  open,
  onClose,
  appointmentId,
  currentServiceId,
  currentStartsAt,
  currentEndsAt,
  services,
  availability,
}: {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  currentServiceId: string;
  currentStartsAt: string;
  currentEndsAt: string;
  services: ServiceOption[];
  availability: AvailabilityDay[];
}) {
  const router = useRouter();
  const current = new Date(currentStartsAt);
  const [serviceId, setServiceId] = useState(currentServiceId);
  const [date, setDate] = useState(format(current, "yyyy-MM-dd"));
  const [time, setTime] = useState("");
  const [calCursor, setCalCursor] = useState(startOfMonth(current));
  const [busy, setBusy] = useState<BusyInterval[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const service = services.find((s) => s.id === serviceId) ?? null;
  const activeWeekdays = new Set(availability.filter((d) => d.is_active).map((d) => d.weekday));
  const today = startOfDay(new Date());

  const dayAvail = useMemo(() => {
    const wd = new Date(date + "T00:00:00").getDay();
    return availability.find((d) => d.weekday === wd && d.is_active) ?? null;
  }, [date, availability]);

  // Busy times for the selected day, excluding this appointment's own block
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const supabase = createBrowserClient();
    const [y, mo, d] = date.split("-").map(Number);
    const dayStart = new Date(y, mo - 1, d, 0, 0, 0);
    const dayEnd = new Date(y, mo - 1, d, 23, 59, 59);
    const ownStart = new Date(currentStartsAt).getTime();
    const ownEnd = new Date(currentEndsAt).getTime();
    supabase
      .rpc("get_busy_times", {
        p_start: dayStart.toISOString(),
        p_end: dayEnd.toISOString(),
      })
      .then(({ data: rows }) => {
        if (!alive) return;
        setBusy(
          (rows ?? [])
            .map((b: { starts_at: string; ends_at: string }) => ({
              start: new Date(b.starts_at).getTime(),
              end: new Date(b.ends_at).getTime(),
            }))
            .filter((b: BusyInterval) => !(b.start === ownStart && b.end === ownEnd))
        );
      });
    return () => {
      alive = false;
    };
  }, [date, open, currentStartsAt, currentEndsAt]);

  const slots = useMemo(() => {
    if (!dayAvail || !service) return [];
    const start = toMins(dayAvail.start_time);
    const end = toMins(dayAvail.end_time);
    const step = dayAvail.slot_minutes;
    const bS = dayAvail.break_start_time ? toMins(dayAvail.break_start_time) : null;
    const bE = dayAvail.break_end_time ? toMins(dayAvail.break_end_time) : null;
    const dur = service.duration_minutes;
    const [y, mo, d] = date.split("-").map(Number);
    const out: string[] = [];
    for (let t = start; t + dur <= end; t += step) {
      if (bS !== null && bE !== null && t < bE && t + dur > bS) continue;
      const sMs = new Date(y, mo - 1, d, Math.floor(t / 60), t % 60, 0).getTime();
      const eMs = sMs + dur * 60000;
      if (busy.some((b) => sMs < b.end && eMs > b.start)) continue;
      out.push(fromMins(t));
    }
    return out;
  }, [dayAvail, service, date, busy]);

  function handleSave() {
    if (!time || !service) return;
    setError(null);
    startTransition(async () => {
      const [y, mo, d] = date.split("-").map(Number);
      const [h, mi] = time.split(":").map(Number);
      const startsAt = new Date(y, mo - 1, d, h, mi, 0).toISOString();

      const fd = new FormData();
      fd.set("appointmentId", appointmentId);
      fd.set("serviceId", service.id);
      fd.set("startsAt", startsAt);

      const result = await rescheduleAppointment(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Reagendar cita">
      <div className="space-y-4">
        {/* Current appointment */}
        <div className="flex items-center gap-2 bg-background rounded-xl border border-border p-3">
          <CalendarClock size={16} className="text-muted shrink-0" />
          <p className="text-xs text-muted">
            Actual:{" "}
            <span className="font-semibold text-foreground capitalize">
              {format(current, "EEE d MMM", { locale: es })} ·{" "}
              {format(current, "h:mm a")}
            </span>
          </p>
        </div>

        {/* Service selector */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Servicio</label>
          <select
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              setTime("");
            }}
            className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.duration_minutes} min · ${s.price}
              </option>
            ))}
          </select>
        </div>

        {/* Calendar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setCalCursor((c) => subMonths(c, 1))}
              className="w-8 h-8 rounded-full border border-border flex items-center justify-center"
            >
              <ChevronLeft size={14} />
            </button>
            <p className="font-semibold text-sm text-foreground capitalize">
              {format(calCursor, "MMMM yyyy", { locale: es })}
            </p>
            <button
              onClick={() => setCalCursor((c) => addMonths(c, 1))}
              className="w-8 h-8 rounded-full border border-border flex items-center justify-center"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-0.5">
            {WEEK_LABELS.map((w, i) => (
              <div key={i} className="text-center text-[10px] font-semibold text-muted py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {eachDayOfInterval({
              start: startOfWeek(startOfMonth(calCursor), { weekStartsOn: 1 }),
              end: endOfWeek(endOfMonth(calCursor), { weekStartsOn: 1 }),
            }).map((d) => {
              const wd = d.getDay();
              const inMonth = isSameMonth(d, calCursor);
              const disabled = !activeWeekdays.has(wd) || isBefore(startOfDay(d), today);
              const isSelected = isSameDay(d, new Date(date + "T00:00:00"));
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => {
                    if (!disabled) {
                      setDate(format(d, "yyyy-MM-dd"));
                      setTime("");
                    }
                  }}
                  className={cn(
                    "aspect-square rounded-lg text-xs font-medium flex items-center justify-center",
                    !inMonth && "text-muted/30",
                    disabled && "text-muted/25 cursor-not-allowed",
                    !disabled && inMonth && "text-foreground",
                    isSelected && "bg-brand text-white font-bold"
                  )}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>
        </div>

        {/* Slots */}
        {!dayAvail ? (
          <p className="text-xs text-muted text-center py-2 bg-background rounded-xl border border-border px-3">
            No hay horario configurado para este día.
          </p>
        ) : slots.length === 0 ? (
          <p className="text-xs text-muted text-center py-2 bg-background rounded-xl border border-border px-3">
            Sin horarios libres este día.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {slots.map((s) => (
              <button
                key={s}
                onClick={() => setTime(s)}
                className={cn(
                  "h-9 rounded-lg text-xs font-semibold border transition-colors",
                  time === s
                    ? "bg-brand border-brand text-white"
                    : "border-border text-foreground bg-background active:bg-surface"
                )}
              >
                {fmtSlot(s)}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-danger text-center">{error}</p>}

        <button
          disabled={!time || isPending}
          onClick={handleSave}
          className="w-full h-12 rounded-xl bg-brand text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {isPending ? "Guardando..." : "Confirmar cambio"}
        </button>
      </div>
    </Modal>
  );
}
