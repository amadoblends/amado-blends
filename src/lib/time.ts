/**
 * Time helpers shared by the calendar, the wizard and the block editors.
 *
 * "Local" here means **the shop's timezone**, not the device's and not the
 * server's. Everything that reads or writes a wall-clock time goes through
 * `@/lib/timezone`, so a timestamp renders identically on the barber's phone,
 * in a server component and in a background job.
 *
 * Server-free on purpose: safe to import from client components.
 */

import { shopDateStr, shopMins, shopDateAt, shopToday } from "@/lib/timezone";

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

/** Minutes since midnight in the shop's timezone. */
export const localMins = shopMins;

/** The shop-timezone calendar day a timestamp falls on, as yyyy-MM-dd. */
export const localDateStr = shopDateStr;

/** Today in the shop's timezone, as yyyy-MM-dd. */
export const todayStr = shopToday;

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

/**
 * The instant matching a wall-clock time in the shop.
 *
 * Deliberately not `new Date(y, m, d, h, mi)` — that reads the *device's*
 * timezone, so the same booking stored a different instant depending on where
 * the phone was.
 */
export function dateAt(dateStr: string, mins: number): Date {
  return shopDateAt(dateStr, fromMins(mins));
}
