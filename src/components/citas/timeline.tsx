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
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const p = h >= 12 ? "PM" : "AM";
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${dh}:${String(m).padStart(2, "0")} ${p}`;
}

function localDateStr(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Red line + circle showing the current time, moving down as the day advances
function NowIndicator({ dayStart, dayEnd }: { dayStart: number; dayEnd: number }) {
  const [nowMins, setNowMins] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNowMins(n.getHours() * 60 + n.getMinutes());
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  if (nowMins === null || nowMins < dayStart || nowMins > dayEnd) return null;

  const top = ((nowMins - dayStart) / 60) * HOUR_H;
  return (
    <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top }}>
      <div className="relative flex items-center">
        <div className="absolute -left-[48px] min-w-[44px] h-[20px] px-1.5 rounded-full bg-danger flex items-center justify-center shadow-sm">
          <span className="text-white text-[9px] font-black leading-none">{fmtMins(nowMins)}</span>
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

function InitialsCircle({
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
    <span className="text-white font-bold" style={{ fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  );

  const classes = cn(
    "rounded-full overflow-hidden shrink-0 relative flex items-center justify-center",
    "ring-2 ring-white/70 shadow-sm",
    onExpand && "active:scale-95 transition-transform"
  );

  // Tapping the photo opens it large without following the block's link
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
  /** Opens the detail sheet instead of navigating away. */
  onSelect?: (a: AppointmentRow) => void;
}) {
  const [photo, setPhoto] = useState<{ src: string | null; name: string } | null>(null);
  const onPhotoClick = (src: string | null, name: string) => setPhoto({ src, name });
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

  if (!dayAvail?.is_active) {
    return (
      <div className="py-12 text-center">
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
      {appointments.length === 0 && (
        <p className="text-xs text-muted text-center pb-3">Sin citas — toca + para crear</p>
      )}
      <div className="relative flex">
        {/* Hour labels — sit slightly above their line so they read as headers */}
        <div className="w-12 shrink-0 relative" style={{ height: totalH + 12 }}>
          {hours.map((t) => (
            <div
              key={t}
              className="absolute right-2.5 text-[10px] font-medium text-muted leading-none"
              style={{ top: ((t - dayStart) / 60) * HOUR_H - 4 }}
            >
              {fmtMins(t).replace(":00", "")}
            </div>
          ))}
        </div>

        {/* Grid + blocks */}
        <div className="flex-1 relative min-w-0" style={{ height: totalH + 12 }}>
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
              className="absolute left-0 right-0 rounded-xl flex items-center justify-center"
              style={{
                top: ((breakStart - dayStart) / 60) * HOUR_H,
                height: ((breakEnd - breakStart) / 60) * HOUR_H,
                background: "color-mix(in srgb, var(--color-muted) 7%, transparent)",
              }}
            >
              <span className="text-[9px] font-medium text-muted">Descanso</span>
            </div>
          )}

          {/* Current time indicator (only on today) */}
          {dateStr === localDateStr(new Date().toISOString()) && (
            <NowIndicator dayStart={dayStart} dayEnd={dayEnd} />
          )}

          {/* Blocked hours */}
          {blocked.map((b) => {
            const sMins = localMins(b.starts_at);
            const durMins =
              (new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000;
            const top = ((sMins - dayStart) / 60) * HOUR_H;
            const height = Math.max((durMins / 60) * HOUR_H - 2, 20);
            return (
              <div
                key={b.id}
                className="absolute left-0 right-0 rounded-xl flex items-center justify-center gap-1"
                style={{
                  top,
                  height,
                  background:
                    "repeating-linear-gradient(45deg, transparent, transparent 6px, color-mix(in srgb, var(--color-muted) 10%, transparent) 6px, color-mix(in srgb, var(--color-muted) 10%, transparent) 12px)",
                }}
              >
                <Lock size={11} className="text-muted" />
                <span className="text-[10px] font-semibold text-muted">Bloqueado</span>
              </div>
            );
          })}

          {/* Appointment blocks */}
          {appointments.map((a) => {
            const sMins = localMins(a.starts_at);
            const durMins =
              (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000;
            const top = ((sMins - dayStart) / 60) * HOUR_H;
            // 3px gap keeps back-to-back appointments visually separate
            const height = Math.max((durMins / 60) * HOUR_H - 3, 34);
            const compact = height < 56;

            const past = new Date(a.ends_at) < new Date();

            return (
              // Opens the detail sheet; the profile stays one tap further in
              <button
                key={a.id}
                onClick={() => (onSelect ? onSelect(a) : undefined)}
                className={cn(
                  "absolute left-0 right-0 rounded-xl px-2.5 py-1.5 overflow-hidden text-left",
                  "active:opacity-75 transition-opacity",
                  past && a.status !== "completada" && "opacity-60 saturate-[0.6]"
                )}
                style={{
                  top,
                  height,
                  background: `color-mix(in srgb, ${a.service.color} 16%, var(--surface))`,
                  boxShadow: `inset 3px 0 0 ${a.service.color}`,
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0 h-full">
                  <InitialsCircle
                    name={a.guest_name ?? a.client.full_name}
                    avatarUrl={a.guest_name ? null : a.client.avatar_url}
                    color={a.service.color}
                    size={compact ? 28 : 40}
                    onExpand={() =>
                      onPhotoClick?.(
                        a.guest_name ? null : a.client.avatar_url,
                        a.guest_name ?? a.client.full_name
                      )
                    }
                  />

                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[11px] font-bold leading-tight"
                      style={{ color: a.service.color }}
                    >
                      {fmtMins(sMins)} – {fmtMins(sMins + durMins)}
                    </p>
                    <p className="text-sm font-bold text-foreground truncate leading-tight">
                      {displayAppointmentName(
                        a.client.full_name,
                        a.guest_name,
                        a.guest_relationship
                      )}
                    </p>
                    {!compact && (
                      <p className="text-xs font-medium text-muted truncate leading-tight">
                        {a.service.name}
                      </p>
                    )}
                  </div>

                  {/* One small circle per guest attached to this appointment */}
                  {a.guests.slice(0, 3).map((g, i) => (
                    <InitialsCircle key={i} name={g} color={a.service.color} size={20} />
                  ))}
                </div>
                {/* Product thumbnails: know what to prepare at a glance */}
                {a.products.length > 0 && height > 72 && (
                  <div className="flex items-center gap-1 mt-1">
                    {a.products.slice(0, 4).map((p, i) =>
                      p.image_url ? (
                        <div
                          key={i}
                          className="w-5 h-5 rounded overflow-hidden border border-border shrink-0 relative"
                          title={`${p.quantity}× ${p.name}`}
                        >
                          <Image src={p.image_url} alt={p.name} fill className="object-cover" />
                        </div>
                      ) : (
                        <div
                          key={i}
                          className="w-5 h-5 rounded bg-background border border-border flex items-center justify-center shrink-0"
                          title={`${p.quantity}× ${p.name}`}
                        >
                          <ShoppingBag size={10} className="text-muted" />
                        </div>
                      )
                    )}
                    <span className="text-[9px] font-semibold text-muted">
                      {a.products.reduce((acc, p) => acc + p.quantity, 0)} prod.
                    </span>
                  </div>
                )}
              </button>
            );
          })}
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
