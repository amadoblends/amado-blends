import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Telling apart "the table is missing" from "a column is missing".
 *
 * ── The bug this exists to prevent ───────────────────────────────────────
 * PostgREST reports both with a message containing "schema cache", so a
 * regex on the message alone conflates them. The carousel editor did exactly
 * that: a payload referencing a column added by a later migration produced
 * "the table doesn't exist — run migration 16", which was wrong twice over.
 * The table existed, migration 16 had already been run, and re-running it
 * could never help. The barber was sent in a loop.
 *
 * The codes are unambiguous, so use them:
 *   42P01 / PGRST205 — relation does not exist
 *   PGRST204         — column does not exist
 */

export interface SchemaProblem {
  kind: "missing-table" | "missing-column" | "other";
  /** The column PostgREST couldn't find, when it named one. */
  column?: string;
}

export function diagnose(error: PostgrestError | null): SchemaProblem {
  if (!error) return { kind: "other" };

  if (error.code === "42P01" || error.code === "PGRST205") {
    return { kind: "missing-table" };
  }

  if (error.code === "PGRST204" || /could not find the .* column/i.test(error.message)) {
    // "Could not find the 'is_permanent' column of 'carousel_posts' in the schema cache"
    const named = error.message.match(/'([^']+)' column/);
    return { kind: "missing-column", column: named?.[1] };
  }

  // Older PostgREST versions sometimes only give the text
  if (/column .* does not exist/i.test(error.message)) {
    const named = error.message.match(/column "?([\w.]+)"? does not exist/i);
    return { kind: "missing-column", column: named?.[1]?.split(".").pop() };
  }

  if (/relation .* does not exist/i.test(error.message)) {
    return { kind: "missing-table" };
  }

  return { kind: "other" };
}

/**
 * Drops keys a write can live without, so a save still succeeds against a
 * database that hasn't caught up with the newest migration. The caller
 * reports which migration to run, but the barber's work isn't blocked in the
 * meantime.
 */
export function withoutKeys<T extends Record<string, unknown>>(
  payload: T,
  keys: readonly string[]
): Partial<T> {
  const copy: Record<string, unknown> = { ...payload };
  for (const k of keys) delete copy[k];
  return copy as Partial<T>;
}
