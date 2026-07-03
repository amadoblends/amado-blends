"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppointmentRow, BlockedRange } from "@/lib/data/appointments";
import type { AvailabilityDay } from "@/lib/data/availability";

const HOUR_H = 80;

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
}: {
  name: string;
  avatarUrl?: string | null;
  color: string;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      <div
        className="rounded-full overflow-hidden border border-white/40 shrink-0 relative"
        style={{ width: size, height: size }}
        title={name}
      >
        <Image src={avatarUrl} alt={name} fill className="object-cover" />
      </div>
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 border border-white/40"
      style={{ width: size, height: size, background: color }}
      title={name}
    >
      <span className="text-white font-bold" style={{ fontSize: size * 0.38 }}>
        {initials(name)}
      </span>
    </div>
  );
}

export function DayTimeline({
  appointments: allAppointments,
  dayAvail,
  dateStr,
  blockedTimes = [],
}: {
  appointments: AppointmentRow[];
  dayAvail: AvailabilityDay | null;
  dateStr: string;
  blockedTimes?: BlockedRange[];
}) {
  // Server fetches a widened window (UTC vs local timezone); keep only
  // appointments that fall on the selected local day.
  const appointments = allAppointments.filter((a) => localDateStr(a.starts_at) === dateStr);
  const blocked = blockedTimes.filter((b) => localDateStr(b.starts_at) === dateStr);

  if (!dayAvail?.is_active) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-8 text-center">
        <p className="text-sm text-muted">Día no laborable. Cambia tu disponibilidad en Ajustes.</p>
      </div>
    );
  }

  const dayStart = toMins(dayAvail.start_time);
  const dayEnd = toMins(dayAvail.end_time);
  const breakStart = dayAvail.break_start_time ? toMins(dayAvail.break_start_time) : null;
  const breakEnd = dayAvail.break_end_time ? toMins(dayAvail.break_end_time) : null;
  const totalH = ((dayEnd - dayStart) / 60) * HOUR_H;

  const ticks: number[] = [];
  for (let t = dayStart; t <= dayEnd; t += 30) ticks.push(t);

  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden">
      {appointments.length === 0 && (
        <p className="text-xs text-muted text-center pt-3">Sin citas — toca + para crear</p>
      )}
      <div className="relative flex pt-2 pb-4">
        {/* Hour labels */}
        <div className="w-14 shrink-0 relative" style={{ height: totalH + 8 }}>
          {ticks
            .filter((t) => t % 60 === 0)
            .map((t) => (
              <div
                key={t}
                className="absolute right-2 text-[10px] text-muted leading-none"
                style={{ top: ((t - dayStart) / 60) * HOUR_H }}
              >
                {fmtMins(t).replace(":00", "")}
              </div>
            ))}
        </div>

        {/* Grid + blocks */}
        <div className="flex-1 relative border-l border-border" style={{ height: totalH + 8 }}>
          {/* Grid lines */}
          {ticks.map((t) => (
            <div
              key={t}
              className={cn(
                "absolute left-0 right-0 border-t",
                t % 60 === 0 ? "border-border" : "border-border/30"
              )}
              style={{ top: ((t - dayStart) / 60) * HOUR_H }}
            />
          ))}

          {/* Break shading */}
          {breakStart !== null && breakEnd !== null && (
            <div
              className="absolute left-1 right-1 rounded flex items-center justify-center"
              style={{
                top: ((breakStart - dayStart) / 60) * HOUR_H,
                height: ((breakEnd - breakStart) / 60) * HOUR_H,
                background: "color-mix(in srgb, var(--color-muted) 8%, transparent)",
              }}
            >
              <span className="text-[9px] text-muted">Descanso</span>
            </div>
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
                className="absolute left-1 right-1 rounded-lg flex items-center justify-center gap-1 border border-dashed border-border"
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
            const height = Math.max((durMins / 60) * HOUR_H - 2, 26);

            return (
              <Link
                key={a.id}
                href={`/citas/${a.id}`}
                className="absolute left-1 right-1 rounded-xl px-2.5 py-1.5 overflow-hidden active:opacity-75"
                style={{
                  top,
                  height,
                  background: `${a.service.color}22`,
                  borderLeft: `3px solid ${a.service.color}`,
                }}
              >
                <p
                  className="text-[10px] font-bold leading-tight"
                  style={{ color: a.service.color }}
                >
                  {fmtMins(sMins)} – {fmtMins(sMins + durMins)}
                </p>
                <div className="flex items-center gap-1.5 min-w-0">
                  <InitialsCircle
                    name={a.client.full_name}
                    avatarUrl={a.client.avatar_url}
                    color={a.service.color}
                  />
                  <p className="text-xs font-semibold text-foreground truncate leading-tight flex-1">
                    {a.client.full_name}
                  </p>
                  {/* One small circle per guest */}
                  {a.guests.slice(0, 3).map((g, i) => (
                    <InitialsCircle key={i} name={g} color={a.service.color} size={18} />
                  ))}
                </div>
                {height > 46 && (
                  <p className="text-[10px] text-muted truncate leading-tight">{a.service.name}</p>
                )}
                {/* Product thumbnails: know what to prepare at a glance */}
                {a.products.length > 0 && height > 64 && (
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
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
