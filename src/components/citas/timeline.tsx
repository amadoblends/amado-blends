"use client";

import { useState, useEffect, useMemo, memo } from "react";
import Image from "next/image";
import { Lock, Plus } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { displayAppointmentName } from "@/lib/guests";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import { checkSlot, type SlotVerdict } from "@/lib/slot-availability";
import type { AppointmentRow, BlockedRange, ClosureRange } from "@/lib/data/appointments";
import type { AvailabilityDay } from "@/lib/data/availability";

/*
 * Duration is expressed by WHERE a block sits on the hour rail, never by how
 * tall it is: every appointment card is the same size so they stay readable
 * and comparable. The rail is spaced so a half-hour still leaves a clear gap
 * between two consecutive cards.
 */
const HOUR_H = 124;
const BLOCK_H = 60;
const BLOCK_GAP = 5;

function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function localMins(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function fmtMins(mins: number) {
  const total = Math.floor(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const p = h >= 12 ? "PM" : "AM";
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${dh}:${String(m).padStart(2, "0")} ${p}`;
}

function localDateStr(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<string, string> = {
  confirmada: "Confirmada",
  pendiente: "Pendiente",
  completada: "Completada",
  cancelada: "Cancelada",
  no_show: "No asistió",
};

/**
 * Minutes since midnight as a *fraction*, refreshed every 15 seconds, so the
 * now-line crawls through a block instead of jumping a step at a time.
 */
function useNowMins(active: boolean): number | null {
  const [mins, setMins] = useState<number | null>(null);

  useEffect(() => {
    if (!active) {
      setMins(null);
      return;
    }
    const tick = () => {
      const n = new Date();
      setMins(n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60);
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [active]);

  return mins;
}

function NowIndicator({
  nowMins,
  dayStart,
  dayEnd,
}: {
  nowMins: number | null;
  dayStart: number;
  dayEnd: number;
}) {
  if (nowMins === null || nowMins < dayStart || nowMins > dayEnd) return null;

  const top = ((nowMins - dayStart) / 60) * HOUR_H;
  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top, willChange: "transform" }}
    >
      <div className="relative flex items-center">
        <div className="absolute -left-[54px] min-w-[50px] h-[19px] px-1.5 rounded-full bg-danger flex items-center justify-center shadow-sm">
          <span className="text-white text-[9px] font-black leading-none tnum">
            {fmtMins(nowMins)}
          </span>
        </div>
        <div className="w-1.5 h-1.5 rounded-full bg-danger shrink-0" />
        <div className="flex-1 h-[1.5px] bg-danger" />
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Client photos keep their colour even inside a grey block. */
function Avatar({
  name,
  avatarUrl,
  size = 38,
  onExpand,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  onExpand?: () => void;
}) {
  const inner = avatarUrl ? (
    <Image src={avatarUrl} alt={name} fill className="object-cover" sizes="48px" />
  ) : (
    <span
      className="w-full h-full flex items-center justify-center font-bold text-muted bg-border/60"
      style={{ fontSize: size * 0.34 }}
    >
      {initials(name)}
    </span>
  );

  const classes = cn(
    "rounded-full overflow-hidden shrink-0 relative flex items-center justify-center bg-background",
    onExpand && "active:scale-95 transition-transform"
  );

  if (onExpand) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onExpand();
        }}
        aria-label={`Ver foto de ${name}`}
        className={classes}
        style={{ width: size, height: size }}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={classes} style={{ width: size, height: size }} title={name}>
      {inner}
    </div>
  );
}

function DayTimelineBase({
  appointments: allAppointments,
  dayAvail,
  dateStr,
  blockedTimes = [],
  closure = null,
  shortestServiceMins,
  onSelect,
  onSlotPick,
  onSlotRejected,
}: {
  appointments: AppointmentRow[];
  dayAvail: AvailabilityDay | null;
  dateStr: string;
  blockedTimes?: BlockedRange[];
  closure?: ClosureRange | null;
  shortestServiceMins: number;
  /** Opens the detail card instead of navigating away. */
  onSelect?: (a: AppointmentRow) => void;
  /** A free slot the barber may book. */
  onSlotPick?: (dateStr: string, hhmm: string) => void;
  /** A slot that can't take an appointment, with the reason why. */
  onSlotRejected?: (verdict: SlotVerdict) => void;
}) {
  const [photo, setPhoto] = useState<{ src: string | null; name: string } | null>(null);

  // Server fetches a widened window (UTC vs local timezone); keep only
  // appointments that fall on the selected local day.
  const appointments = useMemo(
    () => allAppointments.filter((a) => localDateStr(a.starts_at) === dateStr),
    [allAppointments, dateStr]
  );
  const blocked = useMemo(
    () => blockedTimes.filter((b) => localDateStr(b.starts_at) === dateStr),
    [blockedTimes, dateStr]
  );

  const isToday = dateStr === localDateStr(new Date().toISOString());
  const nowMins = useNowMins(isToday);

  if (!dayAvail?.is_active) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted">Día no laborable. Cámbialo en Disponibilidad.</p>
      </div>
    );
  }

  const dayStart = toMins(dayAvail.start_time);
  const dayEnd = toMins(dayAvail.end_time);
  const breakStart = dayAvail.break_start_time ? toMins(dayAvail.break_start_time) : null;
  const breakEnd = dayAvail.break_end_time ? toMins(dayAvail.break_end_time) : null;
  const step = dayAvail.slot_minutes || 30;
  const totalH = ((dayEnd - dayStart) / 60) * HOUR_H;

  const hours: number[] = [];
  for (let t = Math.ceil(dayStart / 60) * 60; t <= dayEnd; t += 60) hours.push(t);

  // Shared shape for every availability question asked on this day
  const busyApts = appointments.map((a) => ({
    start: localMins(a.starts_at),
    end: localMins(a.starts_at) + (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000,
    label: a.guest_name ?? a.client.full_name,
  }));
  const busyBlocks = blocked.map((b) => ({
    start: localMins(b.starts_at),
    end: localMins(b.starts_at) + (new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000,
    label: b.reason ?? null,
  }));

  const ctxFor = (slotMins: number) => ({
    dateStr,
    slotMins,
    hours: {
      startMins: dayStart,
      endMins: dayEnd,
      breakStartMins: breakStart,
      breakEndMins: breakEnd,
    },
    closure: closure ? { reason: closure.reason, description: closure.description } : null,
    appointments: busyApts,
    blocked: busyBlocks.map((b) => ({ ...b, label: b.label ?? undefined })),
    shortestServiceMins,
  });

  // Every slot on the rail, so free time is tappable and busy time explains itself
  const slots: number[] = [];
  for (let t = dayStart; t + step <= dayEnd; t += step) slots.push(t);

  function handleSlot(slotMins: number) {
    const verdict = checkSlot(ctxFor(slotMins));
    const hhmm = `${String(Math.floor(slotMins / 60)).padStart(2, "0")}:${String(slotMins % 60).padStart(2, "0")}`;
    if (verdict.ok) onSlotPick?.(dateStr, hhmm);
    else onSlotRejected?.(verdict);
  }

  // Ordered tops let a card shrink rather than cover the next one
  const sorted = [...appointments].sort(
    (a, b) => localMins(a.starts_at) - localMins(b.starts_at)
  );

  return (
    <div>
      {appointments.length === 0 && blocked.length === 0 && (
        <p className="text-xs text-muted text-center py-4">
          Sin citas — toca una hora libre para crear una
        </p>
      )}

      <div className="relative flex">
        {/* Hour rail — the only thing that expresses real duration */}
        <div className="w-[54px] shrink-0 relative" style={{ height: totalH + 16 }}>
          {hours.map((t) => (
            <div
              key={t}
              className="absolute right-2.5 text-[10px] font-semibold text-muted leading-none tnum"
              style={{ top: ((t - dayStart) / 60) * HOUR_H - 4 }}
            >
              {fmtMins(t)}
            </div>
          ))}
        </div>

        <div className="flex-1 relative min-w-0" style={{ height: totalH + 16 }}>
          {hours.map((t) => (
            <div
              key={t}
              className="absolute left-0 right-0 h-px bg-border"
              style={{ top: ((t - dayStart) / 60) * HOUR_H }}
            />
          ))}

          {/* Tap targets underneath everything else */}
          {slots.map((t) => {
            const verdict = checkSlot(ctxFor(t));
            return (
              <button
                key={t}
                onClick={() => handleSlot(t)}
                aria-label={`${fmtMins(t)} — ${verdict.ok ? "libre" : verdict.title}`}
                className={cn(
                  "absolute left-0 right-0 rounded-xl group",
                  verdict.ok ? "active:bg-brand-light/60" : "active:bg-border/40"
                )}
                style={{ top: ((t - dayStart) / 60) * HOUR_H, height: (step / 60) * HOUR_H }}
              >
                {verdict.ok && (
                  <span className="absolute inset-y-0 right-2 flex items-center opacity-0 group-active:opacity-100">
                    <span className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center">
                      <Plus size={13} strokeWidth={3} />
                    </span>
                  </span>
                )}
              </button>
            );
          })}

          {/* Break shading */}
          {breakStart !== null && breakEnd !== null && (
            <div
              className="absolute left-0 right-0 rounded-2xl flex items-center justify-center pointer-events-none"
              style={{
                top: ((breakStart - dayStart) / 60) * HOUR_H,
                height: ((breakEnd - breakStart) / 60) * HOUR_H,
                background: "color-mix(in srgb, var(--color-muted) 7%, transparent)",
              }}
            >
              <span className="text-[9px] font-semibold text-muted">Descanso</span>
            </div>
          )}

          {/* Blocked hours */}
          {blocked.map((b) => {
            const sMins = localMins(b.starts_at);
            const durMins =
              (new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000;
            return (
              <div
                key={b.id}
                className="absolute left-0 right-0 rounded-2xl flex items-center justify-center gap-1.5 pointer-events-none"
                style={{
                  top: ((sMins - dayStart) / 60) * HOUR_H,
                  height: Math.max((durMins / 60) * HOUR_H - BLOCK_GAP, 24),
                  background:
                    "repeating-linear-gradient(45deg, transparent, transparent 6px, color-mix(in srgb, var(--color-muted) 10%, transparent) 6px, color-mix(in srgb, var(--color-muted) 10%, transparent) 12px)",
                }}
              >
                <Lock size={11} className="text-muted" />
                <span className="text-[10px] font-bold text-muted">
                  {b.reason || "Bloqueado"}
                </span>
              </div>
            );
          })}

          {/* Appointment cards — same size for every appointment */}
          {sorted.map((a, i) => {
            const sMins = localMins(a.starts_at);
            const durMins =
              (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000;
            const eMins = sMins + durMins;
            const top = ((sMins - dayStart) / 60) * HOUR_H;

            // Never let a fixed-height card sit on top of the next one
            const nextStart = sorted[i + 1] ? localMins(sorted[i + 1].starts_at) : null;
            const roomPx =
              nextStart === null
                ? Number.POSITIVE_INFINITY
                : ((nextStart - sMins) / 60) * HOUR_H - BLOCK_GAP;
            const height = Math.max(Math.min(BLOCK_H, roomPx), 34);
            const tight = height < BLOCK_H - 8;

            const running = nowMins !== null && nowMins >= sMins && nowMins < eMins;
            const finished = nowMins !== null ? nowMins >= eMins : false;

            // Grey by default, orange for confirmed and in-progress work
            const warm = a.status === "confirmada" || running;

            const name = displayAppointmentName(
              a.client.full_name,
              a.guest_name,
              a.guest_relationship
            );

            return (
              <button
                key={a.id}
                onClick={() => onSelect?.(a)}
                className={cn(
                  "absolute left-0 right-0 rounded-2xl overflow-hidden text-left",
                  "active:scale-[0.985] transition-[opacity,transform] duration-150",
                  warm ? "bg-brand-light" : "bg-surface",
                  running && "ring-[1.5px] ring-brand",
                  // Dimmed purely because the slot is over — the stored status
                  // is never changed automatically.
                  finished && "opacity-55"
                )}
                style={{ top, height }}
              >
                <div className="flex items-center gap-2.5 h-full px-2.5">
                  <Avatar
                    name={a.guest_name ?? a.client.full_name}
                    avatarUrl={a.guest_name ? null : a.client.avatar_url}
                    size={tight ? 28 : 36}
                    onExpand={() =>
                      setPhoto({
                        src: a.guest_name ? null : a.client.avatar_url,
                        name: a.guest_name ?? a.client.full_name,
                      })
                    }
                  />

                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-[11px] font-bold leading-tight tnum",
                        running ? "text-brand" : "text-muted"
                      )}
                    >
                      {fmtMins(sMins)}
                    </p>
                    <p className="text-[14px] font-bold text-foreground truncate leading-tight">
                      {name}
                    </p>
                    {!tight && (
                      <p className="text-[11px] font-medium text-muted truncate leading-tight">
                        {a.service.name} · {formatCurrency(a.price)}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-0.5">
                    <span className="flex items-center gap-1">
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          warm ? "bg-brand" : "bg-muted"
                        )}
                      />
                      <span className="text-[11px] font-bold text-foreground tnum">
                        {Math.round(durMins)}m
                      </span>
                    </span>
                    {!tight && (
                      <span className="text-[9px] font-semibold text-muted leading-none">
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Drawn last so it rides on top of the blocks it crosses */}
          <NowIndicator nowMins={nowMins} dayStart={dayStart} dayEnd={dayEnd} />
        </div>
      </div>

      <PhotoLightbox
        open={photo !== null}
        onClose={() => setPhoto(null)}
        src={photo?.src ?? null}
        name={photo?.name ?? ""}
      />
    </div>
  );
}

// Re-renders only when the day, its data or the handlers change
export const DayTimeline = memo(DayTimelineBase);
