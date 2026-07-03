"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AppointmentRow } from "@/lib/data/appointments";
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

export function DayTimeline({
  appointments: allAppointments,
  dayAvail,
  dateStr,
}: {
  appointments: AppointmentRow[];
  dayAvail: AvailabilityDay | null;
  dateStr: string;
}) {
  // Server fetches a widened window (UTC vs local timezone); keep only
  // appointments that fall on the selected local day.
  const appointments = allAppointments.filter((a) => localDateStr(a.starts_at) === dateStr);

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
                <p className="text-xs font-semibold text-foreground truncate leading-tight">
                  {a.client.full_name}
                </p>
                {height > 46 && (
                  <p className="text-[10px] text-muted truncate leading-tight">{a.service.name}</p>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
