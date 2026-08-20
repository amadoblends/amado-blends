"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { diagnose } from "@/lib/supabase/schema-errors";
import type { ActionResult } from "@/lib/actions/appointments";

export interface ReminderRule {
  id: string;
  minutes_before: number;
  email: boolean;
  sms: boolean;
  push: boolean;
  is_active: boolean;
}

const ruleSchema = z.object({
  // Up to 30 days out; beyond that a reminder stops being one
  minutesBefore: z.coerce.number().int().min(1).max(43200),
  email: z.boolean(),
  sms: z.boolean(),
  push: z.boolean(),
  isActive: z.boolean(),
});

const MIGRATION_HINT =
  "Corre migration_35_reminder_rules.sql en Supabase para activar los recordatorios.";

/** The rules as configured, newest lead time first. */
export async function getReminderRules(): Promise<{
  rules: ReminderRule[];
  missing: boolean;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reminder_rules")
    .select("id, minutes_before, email, sms, push, is_active")
    .order("minutes_before", { ascending: false });

  if (error) {
    // Nothing configured yet is different from nothing existing yet
    return { rules: [], missing: diagnose(error).kind === "missing-table" };
  }
  return { rules: (data ?? []) as ReminderRule[], missing: false };
}

/**
 * Adds or edits one rule.
 *
 * Changing a rule re-plans the reminders of every future appointment — a
 * database trigger does it, so the queue can't drift from the configuration
 * regardless of where the change came from.
 */
export async function saveReminderRule(input: {
  id?: string | null;
  minutesBefore: number;
  email: boolean;
  sms: boolean;
  push: boolean;
  isActive: boolean;
}): Promise<ActionResult> {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa los datos del recordatorio." };

  const { minutesBefore, email, sms, push, isActive } = parsed.data;

  // A rule with every channel off would sit in the list doing nothing
  if (isActive && !email && !sms && !push) {
    return { ok: false, error: "Enciende al menos un canal, o desactiva la regla." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const body = {
    minutes_before: minutesBefore,
    email,
    sms,
    push,
    is_active: isActive,
  };

  const { error } = input.id
    ? await supabase.from("reminder_rules").update(body).eq("id", input.id)
    : await supabase.from("reminder_rules").insert(body);

  if (error) {
    if (diagnose(error).kind === "missing-table") return { ok: false, error: MIGRATION_HINT };
    // The unique index on minutes_before: two rules at the same moment would
    // send the client the same reminder twice
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un recordatorio para ese momento." };
    }
    return { ok: false, error: "No se pudo guardar el recordatorio." };
  }

  revalidatePath("/notificaciones/recordatorios");
  return { ok: true };
}

export async function deleteReminderRule(id: string): Promise<ActionResult> {
  const check = z.string().uuid().safeParse(id);
  if (!check.success) return { ok: false, error: "Recordatorio inválido." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const { error } = await supabase.from("reminder_rules").delete().eq("id", check.data);
  if (error) return { ok: false, error: "No se pudo eliminar el recordatorio." };

  revalidatePath("/notificaciones/recordatorios");
  return { ok: true };
}
