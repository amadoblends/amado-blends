/**
 * One source of truth for "can a new appointment start here?".
 *
 * Both the day timeline and the week grid ask this before opening the booking
 * wizard, so a slot can never be picked that the server would reject later.
 * Pure and server-free: safe to import from client components.
 */

export type SlotBlockReason =
  | "closed"
  | "not-working-day"
  | "outside-hours"
  | "break"
  | "past"
  | "appointment"
  | "blocked"
  | "no-room";

export interface SlotVerdict {
  ok: boolean;
  reason?: SlotBlockReason;
  /** Short title for the message shown to the barber. */
  title?: string;
  /** One sentence explaining exactly why, in the barber's own terms. */
  detail?: string;
}

export interface Busy {
  /** Minutes since midnight, local time. */
  start: number;
  end: number;
  label?: string;
}

export interface SlotContext {
  /** yyyy-MM-dd of the slot being tested. */
  dateStr: string;
  /** Minutes since midnight where the appointment would start. */
  slotMins: number;
  /** Working hours for that weekday, or null when it isn't a working day. */
  hours: {
    startMins: number;
    endMins: number;
    breakStartMins: number | null;
    breakEndMins: number | null;
  } | null;
  /** Closure covering the day, if any. */
  closure: { reason: string; description: string | null } | null;
  appointments: Busy[];
  blocked: Busy[];
  /** Shortest bookable service; a slot with less room than this is useless. */
  shortestServiceMins: number;
}

export function fmtSlot(mins: number): string {
  const total = Math.round(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const p = h >= 12 ? "PM" : "AM";
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${dh}:${String(m).padStart(2, "0")} ${p}`;
}

function overlaps(aStart: number, aEnd: number, b: Busy) {
  return aStart < b.end && aEnd > b.start;
}

/** Minutes since midnight right now, or null when the day isn't today. */
export function nowMinsOn(dateStr: string): number | null {
  const n = new Date();
  const todayStr = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  if (dateStr !== todayStr) return dateStr < todayStr ? Number.POSITIVE_INFINITY : null;
  return n.getHours() * 60 + n.getMinutes();
}

/**
 * How many free minutes there are from `slotMins` before something gets in the
 * way (an appointment, a block, the break, or closing time).
 */
export function roomAt(ctx: SlotContext): number {
  const { slotMins, hours, appointments, blocked } = ctx;
  if (!hours) return 0;

  let limit = hours.endMins;
  if (hours.breakStartMins !== null && slotMins < hours.breakStartMins) {
    limit = Math.min(limit, hours.breakStartMins);
  }
  for (const b of [...appointments, ...blocked]) {
    if (b.start >= slotMins) limit = Math.min(limit, b.start);
  }
  return Math.max(0, limit - slotMins);
}

export function checkSlot(ctx: SlotContext): SlotVerdict {
  const { dateStr, slotMins, hours, closure, appointments, blocked, shortestServiceMins } = ctx;

  if (closure) {
    return {
      ok: false,
      reason: "closed",
      title: "Día cerrado",
      detail:
        closure.description?.trim() ||
        `La barbería está cerrada este día (${closure.reason}). Elimina el cierre si quieres agendar.`,
    };
  }

  if (!hours) {
    return {
      ok: false,
      reason: "not-working-day",
      title: "Día no laborable",
      detail: "Este día está desactivado. Actívalo en Disponibilidad para poder agendar.",
    };
  }

  // Whole day already gone, or this particular hour already passed
  const now = nowMinsOn(dateStr);
  if (now !== null && slotMins < now) {
    return {
      ok: false,
      reason: "past",
      title: "Esa hora ya pasó",
      detail:
        now === Number.POSITIVE_INFINITY
          ? "Ese día ya pasó. Solo puedes crear citas de hoy en adelante."
          : `Ya son las ${fmtSlot(now)}. Elige una hora más adelante.`,
    };
  }

  if (slotMins < hours.startMins || slotMins >= hours.endMins) {
    return {
      ok: false,
      reason: "outside-hours",
      title: "Fuera del horario",
      detail: `Ese día atiendes de ${fmtSlot(hours.startMins)} a ${fmtSlot(hours.endMins)}. Cámbialo en Disponibilidad si necesitas más horas.`,
    };
  }

  if (
    hours.breakStartMins !== null &&
    hours.breakEndMins !== null &&
    slotMins >= hours.breakStartMins &&
    slotMins < hours.breakEndMins
  ) {
    return {
      ok: false,
      reason: "break",
      title: "Hora de descanso",
      detail: `Tu descanso va de ${fmtSlot(hours.breakStartMins)} a ${fmtSlot(hours.breakEndMins)}.`,
    };
  }

  // Anything already sitting on this minute wins
  const clash = appointments.find((a) => overlaps(slotMins, slotMins + 1, a));
  if (clash) {
    return {
      ok: false,
      reason: "appointment",
      title: "Hora ocupada",
      detail: clash.label
        ? `Ya tienes la cita de ${clash.label} de ${fmtSlot(clash.start)} a ${fmtSlot(clash.end)}.`
        : `Ya hay una cita de ${fmtSlot(clash.start)} a ${fmtSlot(clash.end)}.`,
    };
  }

  const blockedHit = blocked.find((b) => overlaps(slotMins, slotMins + 1, b));
  if (blockedHit) {
    return {
      ok: false,
      reason: "blocked",
      title: "Hora bloqueada",
      detail: blockedHit.label
        ? `Bloqueaste ${fmtSlot(blockedHit.start)} – ${fmtSlot(blockedHit.end)}: ${blockedHit.label}.`
        : `Bloqueaste ${fmtSlot(blockedHit.start)} – ${fmtSlot(blockedHit.end)}. Desbloquéala para agendar.`,
    };
  }

  // The gap has to fit a whole service, not just its first minute
  const room = roomAt(ctx);
  if (room < shortestServiceMins) {
    return {
      ok: false,
      reason: "no-room",
      title: "No cabe el servicio",
      detail: `Solo quedan ${room} minutos libres desde las ${fmtSlot(slotMins)}, y tu servicio más corto dura ${shortestServiceMins} minutos.`,
    };
  }

  return { ok: true };
}
