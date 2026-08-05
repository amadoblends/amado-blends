"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, format,
  isSameDay, isSameMonth, addMonths, startOfYear,
} from "date-fns";
import { es } from "date-fns/locale";
import { Lock, CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayAppointmentName } from "@/lib/guests";
import { reasonLabel } from "@/lib/closures";
import type { AppointmentRow, BlockedRange, ClosureRange } from "@/lib/data/appointments";
import type { AvailabilityDay } from "@/lib/data/availability";

const HOUR_H = 56; // week view is denser than the single-day timeline
const WEEK_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// ── Shared helpers ─────────────────────────────────────────────────────────

function localKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function localMins(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}
function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fmtHour(mins: number) {
  const h = Math.floor(mins / 60);
  const p = h >= 12 ? "PM" : "AM";
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${dh} ${p}`;
}
function fmtTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const p = h >= 12 ? "PM" : "AM";
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${dh}:${String(m).padStart(2, "0")} ${p}`;
}

/** Client photo, or their initials when there isn't one. */
function MiniAvatar({
  name,
  url,
  color,
}: {
  name: string;
  url: string | null;
  color: string;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <span
      className="w-3.5 h-3.5 rounded-full overflow-hidden shrink-0 relative flex items-center justify-center ring-1 ring-white/50"
      style={{ background: url ? undefined : color }}
    >
      {url ? (
        <Image src={url} alt="" fill sizes="14px" className="object-cover" />
      ) : (
        <span className="text-white font-bold" style={{ fontSize: 6 }}>
          {initials}
        </span>
      )}
    </span>
  );
}

/** Closure covering a given day, if any. */
export function closureFor(day: Date, closures: ClosureRange[]) {
  const key = format(day, "yyyy-MM-dd");
  return closures.find((c) => key >= c.starts_on && key <= c.ends_on) ?? null;
}

// ── Week view ──────────────────────────────────────────────────────────────

export function WeekView({
  date,
  appointments,
  blockedTimes,
  closures,
  availability,
  onSlotClick,
}: {
  date: Date;
  appointments: AppointmentRow[];
  blockedTimes: BlockedRange[];
  closures: ClosureRange[];
  availability: AvailabilityDay[];
  onSlotClick: (dateStr: string, hhmm: string) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  });

  // Span the earliest opening to the latest close across the week
  const active = availability.filter((a) => a.is_active);
  const dayStart = active.length
    ? Math.min(...active.map((a) => toMins(a.start_time)))
    : 8 * 60;
  const dayEnd = active.length ? Math.max(...active.map((a) => toMins(a.end_time))) : 20 * 60;

  const hours: number[] = [];
  for (let t = Math.floor(dayStart / 60) * 60; t <= dayEnd; t += 60) hours.push(t);
  const totalH = ((dayEnd - dayStart) / 60) * HOUR_H;

  return (
    <div className="overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
      <div className="min-w-[720px]">
        {/* Day headers */}
        <div className="flex sticky top-0 z-20 bg-background pb-1">
          <div className="w-12 shrink-0" />
          {days.map((d) => {
            const isToday = isSameDay(d, new Date());
            const closed = closureFor(d, closures);
            return (
              <div key={d.toISOString()} className="flex-1 min-w-0 px-1">
                <Link
                  href={`/citas?view=day&date=${format(d, "yyyy-MM-dd")}`}
                  className="flex flex-col items-center gap-0.5 py-1.5 rounded-xl active:bg-surface"
                >
                  <span className="text-[10px] font-semibold text-muted uppercase">
                    {WEEK_LABELS[(d.getDay() + 6) % 7]}
                  </span>
                  <span
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold",
                      isToday ? "bg-brand text-white" : "text-foreground"
                    )}
                  >
                    {format(d, "d")}
                  </span>
                  {closed && (
                    <span className="text-[8px] font-bold text-danger uppercase truncate max-w-full px-1">
                      {reasonLabel(closed.reason)}
                    </span>
                  )}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Grid */}
        <div className="flex">
          {/* Hour rail */}
          <div className="w-12 shrink-0 relative" style={{ height: totalH + 12 }}>
            {hours.map((t) => (
              <div
                key={t}
                className="absolute right-2 text-[10px] font-medium text-muted leading-none"
                style={{ top: ((t - dayStart) / 60) * HOUR_H - 4 }}
              >
                {fmtHour(t)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const dayAvail = availability.find((a) => a.weekday === d.getDay() && a.is_active);
            const closed = closureFor(d, closures);
            const dayApts = appointments.filter((a) => localKey(a.starts_at) === key);
            const dayBlocks = blockedTimes.filter((b) => localKey(b.starts_at) === key);

            return (
              <div
                key={key}
                className="flex-1 min-w-0 relative border-l border-border"
                style={{ height: totalH + 12 }}
              >
                {/* Hour lines */}
                {hours.map((t) => (
                  <div
                    key={t}
                    className="absolute left-0 right-0 h-px bg-border"
                    style={{ top: ((t - dayStart) / 60) * HOUR_H }}
                  />
                ))}

                {/* Outside working hours / closed */}
                {(!dayAvail || closed) && (
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "repeating-linear-gradient(45deg, transparent, transparent 5px, color-mix(in srgb, var(--color-muted) 8%, transparent) 5px, color-mix(in srgb, var(--color-muted) 8%, transparent) 10px)",
                    }}
                  />
                )}

                {/* Clickable empty slots, every 30 min */}
                {dayAvail && !closed &&
                  Array.from(
                    { length: Math.floor((dayEnd - dayStart) / 30) },
                    (_, i) => dayStart + i * 30
                  ).map((t) => (
                    <button
                      key={t}
                      onClick={() =>
                        onSlotClick(
                          key,
                          `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
                        )
                      }
                      className="absolute left-0 right-0 hover:bg-brand-light/60 transition-colors"
                      style={{ top: ((t - dayStart) / 60) * HOUR_H, height: HOUR_H / 2 }}
                      aria-label={`Crear cita ${fmtTime(t)}`}
                    />
                  ))}

                {/* Blocked hours */}
                {dayBlocks.map((b) => {
                  const s = localMins(b.starts_at);
                  const dur =
                    (new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000;
                  return (
                    <div
                      key={b.id}
                      className="absolute left-0.5 right-0.5 rounded-md bg-border/60 flex items-center justify-center"
                      style={{
                        top: ((s - dayStart) / 60) * HOUR_H,
                        height: Math.max((dur / 60) * HOUR_H - 2, 14),
                      }}
                    >
                      <Lock size={9} className="text-muted" />
                    </div>
                  );
                })}

                {/* Appointments */}
                {dayApts.map((a) => {
                  const s = localMins(a.starts_at);
                  const dur =
                    (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000;
                  const height = Math.max((dur / 60) * HOUR_H - 2, 22);
                  const past = new Date(a.ends_at) < new Date();
                  const name = displayAppointmentName(
                    a.client.full_name,
                    a.guest_name,
                    a.guest_relationship
                  );
                  // Progressive detail: only show what actually fits
                  const showName = height >= 30;
                  const showService = height >= 56;
                  const showAvatar = height >= 44;

                  return (
                    <Link
                      key={a.id}
                      href={`/citas/${a.id}`}
                      title={`${fmtTime(s)} · ${name} · ${a.service.name}`}
                      className={cn(
                        "absolute left-0.5 right-0.5 rounded-md px-1 py-0.5 overflow-hidden flex flex-col active:opacity-75",
                        past && a.status !== "completada" && "opacity-55 saturate-50"
                      )}
                      style={{
                        top: ((s - dayStart) / 60) * HOUR_H,
                        height,
                        background: `color-mix(in srgb, ${a.service.color} 18%, var(--surface))`,
                        boxShadow: `inset 2px 0 0 ${a.service.color}`,
                      }}
                    >
                      <p
                        className="text-[9px] font-bold leading-none truncate shrink-0"
                        style={{ color: a.service.color }}
                      >
                        {fmtTime(s)}
                      </p>

                      {showName && (
                        <div className="flex items-center gap-1 min-w-0 mt-0.5">
                          {showAvatar && (
                            <MiniAvatar
                              name={a.guest_name ?? a.client.full_name}
                              url={a.guest_name ? null : a.client.avatar_url}
                              color={a.service.color}
                            />
                          )}
                          <span className="text-[10px] font-semibold text-foreground truncate leading-tight min-w-0">
                            {name}
                          </span>
                        </div>
                      )}

                      {showService && (
                        <span className="text-[9px] text-muted truncate leading-tight mt-px">
                          {a.service.name} · {Math.round(dur)}m
                        </span>
                      )}
                    </Link>
                  );
                })}

                {/* Now line */}
                {isSameDay(d, new Date()) && (
                  <NowLine dayStart={dayStart} dayEnd={dayEnd} hourHeight={HOUR_H} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NowLine({
  dayStart,
  dayEnd,
  hourHeight,
}: {
  dayStart: number;
  dayEnd: number;
  hourHeight: number;
}) {
  const [mins, setMins] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setMins(n.getHours() * 60 + n.getMinutes());
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  if (mins === null || mins < dayStart || mins > dayEnd) return null;

  return (
    <div
      className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
      style={{ top: ((mins - dayStart) / 60) * hourHeight }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0 -ml-0.5" />
      <span className="flex-1 h-[1.5px] bg-danger" />
    </div>
  );
}

// ── Month view ─────────────────────────────────────────────────────────────

export function MonthView({
  date,
  appointments,
  closures,
  availability,
}: {
  date: Date;
  appointments: AppointmentRow[];
  closures: ClosureRange[];
  availability: AvailabilityDay[];
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }),
  });

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    for (const a of appointments) {
      const key = localKey(a.starts_at);
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return map;
  }, [appointments]);

  const activeWeekdays = new Set(availability.filter((a) => a.is_active).map((a) => a.weekday));

  return (
    <div>
      <div className="grid grid-cols-7 gap-px mb-px">
        {WEEK_LABELS.map((w) => (
          <div key={w} className="text-center text-[10px] font-bold text-muted uppercase py-1.5">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const inMonth = isSameMonth(d, date);
          const isToday = isSameDay(d, new Date());
          const apts = byDay.get(key) ?? [];
          const closed = closureFor(d, closures);
          const worksToday = activeWeekdays.has(d.getDay());

          return (
            <Link
              key={key}
              href={`/citas?view=day&date=${key}`}
              className={cn(
                "bg-surface min-h-[92px] p-1.5 flex flex-col gap-1 active:bg-background transition-colors",
                !inMonth && "opacity-40",
                (!worksToday || closed) && "bg-background"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    isToday ? "bg-brand text-white" : "text-foreground"
                  )}
                >
                  {format(d, "d")}
                </span>
                {apts.length > 0 && (
                  <span className="text-[9px] font-bold text-muted">{apts.length}</span>
                )}
              </div>

              {closed ? (
                <span className="text-[9px] font-semibold text-danger flex items-center gap-0.5 truncate">
                  <CalendarOff size={8} className="shrink-0" />
                  {reasonLabel(closed.reason)}
                </span>
              ) : (
                <div className="flex flex-col gap-0.5 min-h-0">
                  {apts.slice(0, 3).map((a) => (
                    <span
                      key={a.id}
                      className="text-[9px] font-medium truncate rounded px-1 py-px leading-tight"
                      style={{
                        background: `color-mix(in srgb, ${a.service.color} 18%, var(--surface))`,
                        color: a.service.color,
                      }}
                    >
                      {fmtTime(localMins(a.starts_at))}{" "}
                      {a.guest_name ?? a.client.full_name.split(" ")[0]}
                    </span>
                  ))}
                  {apts.length > 3 && (
                    <span className="text-[9px] text-muted px-1">+{apts.length - 3} más</span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Year view ──────────────────────────────────────────────────────────────

export function YearView({
  date,
  appointments,
  closures,
}: {
  date: Date;
  appointments: AppointmentRow[];
  closures: ClosureRange[];
}) {
  const router = useRouter();
  const months = Array.from({ length: 12 }, (_, i) => addMonths(startOfYear(date), i));

  const countByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) {
      const key = localKey(a.starts_at);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [appointments]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {months.map((m) => {
        const days = eachDayOfInterval({
          start: startOfWeek(startOfMonth(m), { weekStartsOn: 1 }),
          end: endOfWeek(endOfMonth(m), { weekStartsOn: 1 }),
        });

        return (
          <button
            key={m.toISOString()}
            onClick={() => router.push(`/citas?view=month&date=${format(m, "yyyy-MM-dd")}`)}
            className="bg-surface rounded-xl border border-border p-2.5 text-left active:bg-background transition-colors"
          >
            <p className="text-xs font-bold text-foreground capitalize mb-1.5">
              {format(m, "MMMM", { locale: es })}
            </p>
            <div className="grid grid-cols-7 gap-px">
              {["L", "M", "M", "J", "V", "S", "D"].map((w, i) => (
                <span key={i} className="text-[7px] text-muted text-center">
                  {w}
                </span>
              ))}
              {days.map((d) => {
                const key = format(d, "yyyy-MM-dd");
                const inMonth = isSameMonth(d, m);
                const isToday = isSameDay(d, new Date());
                const count = countByDay.get(key) ?? 0;
                const closed = closureFor(d, closures);

                return (
                  <span
                    key={key}
                    className={cn(
                      "aspect-square flex items-center justify-center text-[8px] rounded-sm relative",
                      !inMonth && "opacity-25",
                      isToday && "bg-brand text-white font-bold rounded-full",
                      closed && !isToday && "text-danger font-bold"
                    )}
                  >
                    {format(d, "d")}
                    {count > 0 && !isToday && (
                      <span className="absolute bottom-0 w-1 h-1 rounded-full bg-brand" />
                    )}
                  </span>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
