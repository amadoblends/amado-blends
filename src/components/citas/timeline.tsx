"use client";

import { useState, useEffect, useMemo, memo } from "react";
import Image from "next/image";
import { ShoppingBag, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayAppointmentName } from "@/lib/guests";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import type { AppointmentRow, BlockedRange } from "@/lib/data/appointments";
import type { AvailabilityDay } from "@/lib/data/availability";

// Taller rows so a 30-minute block still fits an avatar plus two lines
const HOUR_H = 96;

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

/**
 * Minutes since midnight as a *fraction*, refreshed every 15 seconds.
 *
 * Using whole minutes made the line jump a whole row-step at a time; a
 * fractional value makes it crawl through a block so a one-hour appointment
 * genuinely takes the full hour to be crossed.
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

/** Red line + time bubble showing the current moment. */
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
        <div className="absolute -left-[52px] min-w-[48px] h-[19px] px-1.5 rounded-full bg-danger flex items-center justify-center shadow-sm">
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

function Avatar({
  name,
  avatarUrl,
  color,
  size = 22,
  onExpand,
}: {
  name: string;
  avatarUrl?: string | null;
  color: string;
  size?: number;
  onExpand?: () => void;
}) {
  const inner = avatarUrl ? (
    <Image src={avatarUrl} alt={name} fill className="object-cover" sizes="48px" />
  ) : (
    <span className="font-bold text-white" style={{ fontSize: size * 0.38 }}>
      {initials(name)}
    </span>
  );

  const classes = cn(
    "rounded-full overflow-hidden shrink-0 relative flex items-center justify-center",
    onExpand && "active:scale-95 transition-transform"
  );

  // Tapping the photo opens it large without opening the appointment sheet
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
        style={{ width: size, height: size, background: avatarUrl ? undefined : color }}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={classes}
      style={{ width: size, height: size, background: avatarUrl ? undefined : color }}
      title={name}
    >
      {inner}
    </div>
  );
}

function DayTimelineBase({
  appointments: allAppointments,
  dayAvail,
  dateStr,
  blockedTimes = [],
  onSelect,
}: {
  appointments: AppointmentRow[];
  dayAvail: AvailabilityDay | null;
  dateStr: string;
  blockedTimes?: BlockedRange[];
  /** Opens the detail card instead of navigating away. */
  onSelect?: (a: AppointmentRow) => void;
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
  const totalH = ((dayEnd - dayStart) / 60) * HOUR_H;

  // Hour lines only — half-hour ticks made the grid noisy on small screens
  const hours: number[] = [];
  for (let t = Math.ceil(dayStart / 60) * 60; t <= dayEnd; t += 60) hours.push(t);

  return (
    <div>
      {appointments.length === 0 && blocked.length === 0 && (
        <p className="text-xs text-muted text-center py-6">Sin citas — toca “Nueva cita” para crear una</p>
      )}

      <div className="relative flex">
        {/* Hour rail */}
        <div className="w-[52px] shrink-0 relative" style={{ height: totalH + 14 }}>
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

        {/* Grid + blocks */}
        <div className="flex-1 relative min-w-0" style={{ height: totalH + 14 }}>
          {/* Hairline per hour, no vertical rule or outer frame */}
          {hours.map((t) => (
            <div
              key={t}
              className="absolute left-0 right-0 h-px bg-border"
              style={{ top: ((t - dayStart) / 60) * HOUR_H }}
            />
          ))}

          {/* Break shading */}
          {breakStart !== null && breakEnd !== null && (
            <div
              className="absolute left-0 right-0 rounded-2xl flex items-center justify-center"
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
                className="absolute left-0 right-0 rounded-2xl flex items-center justify-center gap-1.5"
                style={{
                  top: ((sMins - dayStart) / 60) * HOUR_H,
                  height: Math.max((durMins / 60) * HOUR_H - 3, 22),
                  background:
                    "repeating-linear-gradient(45deg, transparent, transparent 6px, color-mix(in srgb, var(--color-muted) 10%, transparent) 6px, color-mix(in srgb, var(--color-muted) 10%, transparent) 12px)",
                }}
              >
                <Lock size={11} className="text-muted" />
                <span className="text-[10px] font-bold text-muted">Bloqueado</span>
              </div>
            );
          })}

          {/* Appointment blocks */}
          {appointments.map((a) => {
            const sMins = localMins(a.starts_at);
            const durMins =
              (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000;
            const eMins = sMins + durMins;
            const top = ((sMins - dayStart) / 60) * HOUR_H;
            // 4px gap keeps back-to-back appointments visually separate
            const height = Math.max((durMins / 60) * HOUR_H - 4, 38);
            const compact = height < 62;

            // Purely time-based: nothing here changes the stored status.
            const running = nowMins !== null && nowMins >= sMins && nowMins < eMins;
            const finished = nowMins !== null ? nowMins >= eMins : false;
            // 0 → 1 across the block, so the fill tracks the red line exactly
            const progress = running ? (nowMins! - sMins) / durMins : 0;

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
                  // Only dims once the slot is fully in the past
                  finished && "opacity-55"
                )}
                style={{
                  top,
                  height,
                  background: `color-mix(in srgb, ${a.service.color} 14%, var(--surface))`,
                  boxShadow: running
                    ? `inset 0 0 0 1.5px ${a.service.color}`
                    : `inset 0 0 0 1px color-mix(in srgb, ${a.service.color} 22%, transparent)`,
                }}
              >
                {/* Elapsed portion of an appointment happening right now */}
                {running && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 pointer-events-none"
                    style={{
                      width: `${Math.min(100, progress * 100)}%`,
                      background: `color-mix(in srgb, ${a.service.color} 12%, transparent)`,
                    }}
                  />
                )}

                <div className="relative flex items-center gap-2.5 h-full px-2.5 py-1.5">
                  <Avatar
                    name={a.guest_name ?? a.client.full_name}
                    avatarUrl={a.guest_name ? null : a.client.avatar_url}
                    color={a.service.color}
                    size={compact ? 30 : 38}
                    onExpand={() =>
                      setPhoto({
                        src: a.guest_name ? null : a.client.avatar_url,
                        name: a.guest_name ?? a.client.full_name,
                      })
                    }
                  />

                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[11px] font-bold leading-tight tnum"
                      style={{ color: a.service.color }}
                    >
                      {fmtMins(sMins)}
                    </p>
                    <p className="text-[15px] font-bold text-foreground truncate leading-tight">
                      {name}
                    </p>
                    {!compact && (
                      <p className="text-xs font-medium text-muted truncate leading-tight">
                        {a.service.name}
                      </p>
                    )}
                  </div>

                  {/* Guests riding along on this appointment */}
                  {a.guests.slice(0, 3).map((g, i) => (
                    <Avatar key={i} name={g} color={a.service.color} size={20} />
                  ))}

                  {/* Duration pill, mirroring the reference layout */}
                  <span className="shrink-0 flex items-center gap-1 self-start mt-0.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: a.service.color }}
                    />
                    <span className="text-[11px] font-bold text-muted tnum">
                      {Math.round(durMins)}m
                    </span>
                  </span>
                </div>

                {/* Product thumbnails: know what to prepare at a glance */}
                {a.products.length > 0 && height > 78 && (
                  <div className="absolute bottom-1.5 left-[54px] flex items-center gap-1">
                    {a.products.slice(0, 4).map((p, i) =>
                      p.image_url ? (
                        <span
                          key={i}
                          className="w-5 h-5 rounded-md overflow-hidden border border-border shrink-0 relative"
                          title={`${p.quantity}× ${p.name}`}
                        >
                          <Image src={p.image_url} alt={p.name} fill className="object-cover" />
                        </span>
                      ) : (
                        <span
                          key={i}
                          className="w-5 h-5 rounded-md bg-background border border-border flex items-center justify-center shrink-0"
                          title={`${p.quantity}× ${p.name}`}
                        >
                          <ShoppingBag size={10} className="text-muted" />
                        </span>
                      )
                    )}
                    <span className="text-[9px] font-bold text-muted tnum">
                      {a.products.reduce((acc, p) => acc + p.quantity, 0)} prod.
                    </span>
                  </div>
                )}
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

// Re-renders only when the day, its data or the selection handler change
export const DayTimeline = memo(DayTimelineBase);
