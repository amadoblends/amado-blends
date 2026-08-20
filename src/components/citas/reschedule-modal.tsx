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
import type { AvailabilityDay, BookingSettings } from "@/lib/data/availability";
import type { ClosureRange } from "@/lib/data/appointments";
import { shopDateAt, shopFormat } from "@/lib/timezone";
import {
  availableSlots,
  isDayClosed,
  type BusyInterval,
  type ClosureLike,
} from "@/lib/availability-slots";

const WEEK_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

interface ServiceOption {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  color: string;
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
  closures = [],
  bookingSettings,
  extraMinutes = 0,
}: {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  currentServiceId: string;
  currentStartsAt: string;
  currentEndsAt: string;
  services: ServiceOption[];
  availability: AvailabilityDay[];
  /** Holidays and vacations, so closed days can't be offered. */
  closures?: ClosureRange[];
  bookingSettings: BookingSettings;
  /** Minutes the booked products add on top of the service. */
  extraMinutes?: number;
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
    // The shop's day, so the busy window matches what the barber sees
    const dayStart = shopDateAt(date, "00:00");
    const dayEnd = new Date(shopDateAt(date, "00:00").getTime() + 86_399_000);
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

  /*
   * One source of truth for what can be booked — the same call the new
   * appointment wizard and both client screens make. This screen used to work
   * it out on its own and got it wrong in five ways: no buffer, no minimum
   * notice, no closures, no product minutes, and it happily offered times that
   * had already gone.
   */
  const slots = useMemo(() => {
    if (!service) return [];
    return availableSlots({
      dateStr: date,
      day: dayAvail,
      // Products that lengthen the visit count towards fitting it in
      durationMinutes: service.duration_minutes + extraMinutes,
      busy,
      closures: closures as ClosureLike[],
      rules: {
        bufferMinutes: bookingSettings.buffer_minutes,
        // The barber reschedules in person; the notice exists to stop clients
        // booking a minute ahead, not to restrain the barber.
        minNoticeMinutes: 0,
      },
    });
  }, [dayAvail, service, date, busy, closures, bookingSettings, extraMinutes]);

  function handleSave() {
    if (!time || !service) return;
    setError(null);
    startTransition(async () => {
      // The shop's wall clock, not this device's — see lib/timezone
      const startsAt = shopDateAt(date, time).toISOString();

      const fd = new FormData();
      fd.set("appointmentId", appointmentId);
      // Only sent when the barber actually picked a different one; otherwise
      // the action keeps the appointment's existing service, price and extras.
      if (service.id !== currentServiceId) fd.set("serviceId", service.id);
      fd.set("startsAt", startsAt);
      fd.set(
        "displayWhen",
        `${shopFormat(startsAt, { weekday: "long", day: "numeric", month: "long" })} a las ${fmtSlot(time)}`
      );

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
              const key = format(d, "yyyy-MM-dd");
              // A vacation day is greyed out here rather than opening to an
              // empty list of times
              const disabled =
                !activeWeekdays.has(wd) ||
                isBefore(startOfDay(d), today) ||
                isDayClosed(key, closures as ClosureLike[]);
              const isSelected = isSameDay(d, new Date(date + "T00:00:00"));
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => {
                    if (!disabled) {
                      setDate(key);
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
