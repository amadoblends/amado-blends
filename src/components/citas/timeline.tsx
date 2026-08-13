"use client";

import { useState, useEffect, useMemo, memo } from "react";
import Image from "next/image";
import { Lock, Plus } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { displayAppointmentName } from "@/lib/guests";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import { checkSlot, type SlotVerdict } from "@/lib/slot-availability";
import {
  toMins, fromMins, localMins, localDateStr, fmtMins, durationMins, todayStr,
} from "@/lib/time";
import type { AppointmentRow, BlockedRange, ClosureRange } from "@/lib/data/appointments";
import type { AvailabilityDay } from "@/lib/data/availability";

/*
 * A card's height IS its duration: 45 minutes of service covers exactly 45
 * minutes of the rail, so the day can be read by eye. Density changes how
 * many pixels an hour is worth — never how long anything lasts.
 */
const BLOCK_GAP = 3;
/** Below this a card can't fit an avatar and two lines, so it goes one-line. */
const TIGHT_H = 52;

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
  hourH,
}: {
  nowMins: number | null;
  dayStart: number;
  dayEnd: number;
  hourH: number;
}) {
  if (nowMins === null || nowMins < dayStart || nowMins > dayEnd) return null;

  const top = ((nowMins - dayStart) / 60) * hourH;
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

/** Client photos keep their colour even inside a grey card. */
function Avatar({
  name,
  avatarUrl,
  size = 36,
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
  draft,
  hourH,
  onSelect,
  onSlotTap,
  onDraftTap,
  onSlotRejected,
  onBlockTap,
  onClosureTap,
}: {
  appointments: AppointmentRow[];
  dayAvail: AvailabilityDay | null;
  dateStr: string;
  blockedTimes?: BlockedRange[];
  closure?: ClosureRange | null;
  shortestServiceMins: number;
  /** Pixels per hour — set by the density preference. */
  hourH: number;
  /** The pencilled-in slot waiting for a second tap. */
  draft: { date: string; time: string } | null;
  onSelect?: (a: AppointmentRow) => void;
  /** First tap on free time — pencils in the placeholder. */
  onSlotTap?: (dateStr: string, hhmm: string) => void;
  /** Second tap, on the placeholder itself — opens the action card. */
  onDraftTap?: () => void;
  onSlotRejected?: (verdict: SlotVerdict) => void;
  /** Tapping a blocked stretch opens it for editing or removal. */
  onBlockTap?: (block: BlockedRange) => void;
  /** Tapping the closure banner area opens the closure for editing. */
  onClosureTap?: (closure: ClosureRange) => void;
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

  const nowMins = useNowMins(dateStr === todayStr());

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
  const totalH = ((dayEnd - dayStart) / 60) * hourH;
  /** Minutes → pixels, the one conversion the whole view is built on. */
  const y = (mins: number) => ((mins - dayStart) / 60) * hourH;

  const hours: number[] = [];
  for (let t = Math.ceil(dayStart / 60) * 60; t <= dayEnd; t += 60) hours.push(t);

  const busyApts = appointments.map((a) => ({
    start: localMins(a.starts_at),
    end: localMins(a.starts_at) + durationMins(a.starts_at, a.ends_at),
    label: a.guest_name ?? a.client.full_name,
  }));
  const busyBlocks = blocked.map((b) => ({
    start: localMins(b.starts_at),
    end: localMins(b.starts_at) + durationMins(b.starts_at, b.ends_at),
    label: b.reason ?? undefined,
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
    blocked: busyBlocks,
    shortestServiceMins,
  });

  const slots: number[] = [];
  for (let t = dayStart; t + step <= dayEnd; t += step) slots.push(t);

  function handleSlot(slotMins: number) {
    const verdict = checkSlot(ctxFor(slotMins));
    if (verdict.ok) onSlotTap?.(dateStr, fromMins(slotMins));
    else onSlotRejected?.(verdict);
  }

  const draftMins =
    draft && draft.date === dateStr ? toMins(draft.time) : null;

  // Ordered tops let a card shrink rather than cover the next one
  const sorted = [...appointments].sort(
    (a, b) => localMins(a.starts_at) - localMins(b.starts_at)
  );

  return (
    <div>
      <div className="relative flex">
        {/* Hour rail — the only thing that expresses real duration */}
        <div className="w-[54px] shrink-0 relative" style={{ height: totalH + 16 }}>
          {hours.map((t) => (
            <div
              key={t}
              className="absolute right-2.5 text-[10px] font-semibold text-muted leading-none tnum"
              style={{ top: y(t) - 4 }}
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
              style={{ top: y(t) }}
            />
          ))}

          {/* Tap targets underneath everything else */}
          {slots.map((t) => (
            <button
              key={t}
              onClick={() => handleSlot(t)}
              aria-label={`${fmtMins(t)}`}
              className="absolute left-0 right-0 rounded-xl active:bg-surface/60"
              style={{ top: y(t), height: (step / 60) * hourH }}
            />
          ))}

          {/* Break shading */}
          {breakStart !== null && breakEnd !== null && (
            <div
              className="absolute left-0 right-0 rounded-2xl flex items-center justify-center pointer-events-none"
              style={{
                top: y(breakStart),
                height: ((breakEnd - breakStart) / 60) * hourH,
                background: "color-mix(in srgb, var(--color-muted) 7%, transparent)",
              }}
            >
              <span className="text-[9px] font-semibold text-muted">Descanso</span>
            </div>
          )}

          {/* Blocked hours — tap to edit or remove them */}
          {blocked.map((b) => {
            const sMins = localMins(b.starts_at);
            const dur = durationMins(b.starts_at, b.ends_at);
            const h = Math.max((dur / 60) * hourH - BLOCK_GAP, 22);
            return (
              <button
                key={b.id}
                onClick={() => onBlockTap?.(b)}
                aria-label={`Bloqueo ${fmtMins(sMins)} — tocar para editar`}
                className="absolute left-0 right-0 rounded-xl flex items-center justify-center gap-1.5 z-[5] active:scale-[0.985] transition-transform overflow-hidden"
                style={{
                  top: y(sMins),
                  height: h,
                  background:
                    "repeating-linear-gradient(45deg, transparent, transparent 6px, color-mix(in srgb, var(--color-muted) 12%, transparent) 6px, color-mix(in srgb, var(--color-muted) 12%, transparent) 12px)",
                }}
              >
                <Lock size={11} className="text-muted shrink-0" />
                <span className="text-[10px] font-bold text-muted truncate px-1">
                  {b.reason || "Bloqueado"}
                </span>
              </button>
            );
          })}

          {/* Pencilled-in slot: tap once to place, again to choose what to do */}
          {draftMins !== null && (
            <button
              onClick={onDraftTap}
              className="absolute left-0 right-0 rounded-xl border-2 border-dashed border-brand bg-brand-light flex items-center justify-between px-3 z-10 animate-view-in overflow-hidden"
              style={{
                top: y(draftMins),
                // Sized like the shortest bookable service, so the placeholder
                // shows how much room the slot actually has
                height: Math.max((shortestServiceMins / 60) * hourH - BLOCK_GAP, 34),
              }}
            >
              <span className="text-left">
                <span className="block text-[11px] font-bold text-brand tnum">
                  {fmtMins(draftMins)}
                </span>
                <span className="block text-[13px] font-bold text-foreground">
                  Toca para continuar
                </span>
              </span>
              <span className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center shrink-0">
                <Plus size={16} strokeWidth={3} />
              </span>
            </button>
          )}

          {/* Appointment cards — height is the real duration */}
          {sorted.map((a) => {
            const sMins = localMins(a.starts_at);
            const dur = durationMins(a.starts_at, a.ends_at);
            const eMins = sMins + dur;
            const top = y(sMins);

            // The card spans exactly its own minutes, less a hairline so two
            // back-to-back appointments stay visually separate.
            const exact = (dur / 60) * hourH;
            const height = Math.max(exact - BLOCK_GAP, 26);
            const tight = height < TIGHT_H;
            const veryTight = height < 34;

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
                  "absolute left-0 right-0 rounded-xl overflow-hidden text-left",
                  "active:scale-[0.985] transition-[opacity,transform] duration-150",
                  warm ? "bg-brand-light" : "bg-surface",
                  running && "ring-[1.5px] ring-brand",
                  // Dimmed purely because the slot is over — the stored status
                  // is never changed automatically.
                  finished && "opacity-55"
                )}
                style={{ top, height }}
              >
                {/* Left rail carries the status colour */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0 left-0 w-[3px] rounded-full",
                    warm ? "bg-brand" : "bg-muted/50"
                  )}
                />

                {/*
                  * A short service leaves little room, so detail is dropped in
                  * order of usefulness: price and status first, then the
                  * service name, leaving the name and time always readable.
                  */}
                <div
                  className={cn(
                    "flex items-center gap-2 h-full pl-3 pr-2.5",
                    veryTight && "gap-1.5"
                  )}
                >
                  {!veryTight && (
                    <Avatar
                      name={a.guest_name ?? a.client.full_name}
                      avatarUrl={a.guest_name ? null : a.client.avatar_url}
                      size={tight ? 26 : 34}
                      onExpand={() =>
                        setPhoto({
                          src: a.guest_name ? null : a.client.avatar_url,
                          name: a.guest_name ?? a.client.full_name,
                        })
                      }
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    {veryTight ? (
                      <p className="text-[12px] font-bold text-foreground truncate leading-tight">
                        <span className={cn("tnum mr-1.5", running ? "text-brand" : "text-muted")}>
                          {fmtMins(sMins)}
                        </span>
                        {name}
                      </p>
                    ) : (
                      <>
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
                            {a.service.name}
                          </p>
                        )}
                      </>
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
                        {Math.round(dur)}m
                      </span>
                    </span>
                    {!tight && (
                      <>
                        <span
                          className={cn(
                            "text-[9px] font-semibold leading-none",
                            warm ? "text-brand" : "text-muted"
                          )}
                        >
                          {STATUS_LABEL[a.status] ?? a.status}
                        </span>
                        <span className="text-[11px] font-bold text-foreground leading-none tnum">
                          {formatCurrency(a.price)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Drawn last so it rides on top of the cards it crosses */}
          <NowIndicator
            nowMins={nowMins}
            dayStart={dayStart}
            dayEnd={dayEnd}
            hourH={hourH}
          />
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
