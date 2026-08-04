import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";

export const CLOSURE_REASONS = [
  { value: "vacaciones", label: "Vacaciones", emoji: "🌴" },
  { value: "personal", label: "Día personal", emoji: "🏠" },
  { value: "enfermedad", label: "Enfermedad", emoji: "🤒" },
  { value: "feriado", label: "Día feriado", emoji: "📅" },
  { value: "evento", label: "Evento", emoji: "🎪" },
  { value: "capacitacion", label: "Capacitación", emoji: "🎓" },
  { value: "mantenimiento", label: "Mantenimiento", emoji: "🔧" },
  { value: "otro", label: "Otro", emoji: "📌" },
] as const;

export const CLOSURE_REASON_VALUES = [
  "vacaciones", "personal", "enfermedad", "feriado",
  "evento", "capacitacion", "mantenimiento", "otro",
] as const;

export type ClosureReason = (typeof CLOSURE_REASON_VALUES)[number];

export function reasonLabel(value: string) {
  return CLOSURE_REASONS.find((r) => r.value === value)?.label ?? "Cierre";
}

/**
 * First day after `lastClosedDay` that the barber actually works: it skips
 * weekdays that are off and any day covered by another closure.
 */
export function nextWorkingDay(
  lastClosedDay: Date,
  activeWeekdays: Set<number>,
  otherClosures: { starts_on: string; ends_on: string }[] = [],
  lookaheadDays = 60
): Date | null {
  if (activeWeekdays.size === 0) return null;

  for (let i = 1; i <= lookaheadDays; i++) {
    const candidate = addDays(lastClosedDay, i);
    if (!activeWeekdays.has(candidate.getDay())) continue;

    const key = format(candidate, "yyyy-MM-dd");
    const stillClosed = otherClosures.some((c) => key >= c.starts_on && key <= c.ends_on);
    if (stillClosed) continue;

    return candidate;
  }
  return null;
}

/** "Estaré fuera del 10 al 15 de agosto" (or a single-day variant). */
export function buildClosureTitle(startsOn: string, endsOn: string): string {
  const start = new Date(startsOn + "T00:00:00");
  const end = new Date(endsOn + "T00:00:00");

  if (startsOn === endsOn) {
    return `Cerrado el ${format(start, "d 'de' MMMM", { locale: es })}`;
  }
  const sameMonth = start.getMonth() === end.getMonth();
  return sameMonth
    ? `Estaré fuera del ${format(start, "d")} al ${format(end, "d 'de' MMMM", { locale: es })}`
    : `Estaré fuera del ${format(start, "d 'de' MMMM", { locale: es })} al ${format(end, "d 'de' MMMM", { locale: es })}`;
}

/** Body text, closing with the real return date when we can work it out. */
export function buildClosureDescription(
  startsOn: string,
  endsOn: string,
  returnDay: Date | null
): string {
  const start = new Date(startsOn + "T00:00:00");
  const end = new Date(endsOn + "T00:00:00");

  const range =
    startsOn === endsOn
      ? `No estaré trabajando el ${format(start, "EEEE d 'de' MMMM", { locale: es })}.`
      : `No estaré trabajando desde el ${format(start, "d 'de' MMMM", { locale: es })} hasta el ${format(end, "d 'de' MMMM", { locale: es })}.`;

  if (!returnDay) return range;

  return `${range} Estaré de vuelta el ${format(returnDay, "EEEE d 'de' MMMM", { locale: es })}.`;
}

/** Teaser published on the last closed day. */
export function buildReturnTitle(returnDay: Date): string {
  return `¡Mañana estoy de vuelta! Ya puedes reservar tu cita.`;
}

export function buildReturnDescription(returnDay: Date): string {
  return `Vuelvo el ${format(returnDay, "EEEE d 'de' MMMM", { locale: es })}. Aparta tu turno desde la app.`;
}
