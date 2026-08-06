/**
 * Local-time helpers shared by the calendar, the wizard and the block editors.
 *
 * These five functions had drifted into five separate copies. Everything that
 * converts between an ISO timestamp and "minutes since midnight, as the barber
 * sees it" now lives here.
 *
 * Server-free on purpose: safe to import from client components.
 */

/** "09:30" → 570 */
export function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 570 → "09:30" */
export function fromMins(mins: number): string {
  const t = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Minutes since local midnight for an ISO timestamp. */
export function localMins(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** yyyy-MM-dd in the viewer's timezone (never the server's UTC day). */
export function localDateStr(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today, as yyyy-MM-dd. */
export function todayStr(): string {
  return localDateStr(new Date());
}

/** 570 → "9:30 AM" */
export function fmtMins(mins: number): string {
  const total = Math.floor(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const p = h >= 12 ? "PM" : "AM";
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${dh}:${String(m).padStart(2, "0")} ${p}`;
}

/** "09:30" → "9:30 AM" */
export function fmtHHMM(hhmm: string): string {
  return fmtMins(toMins(hhmm));
}

/** Minutes an ISO range spans. */
export function durationMins(startISO: string, endISO: string): number {
  return (new Date(endISO).getTime() - new Date(startISO).getTime()) / 60000;
}

/** A Date at a given minute-of-day on a yyyy-MM-dd, in local time. */
export function dateAt(dateStr: string, mins: number): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d, Math.floor(mins / 60), mins % 60, 0, 0);
}
