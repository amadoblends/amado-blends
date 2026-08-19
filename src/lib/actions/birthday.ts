"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { diagnose } from "@/lib/supabase/schema-errors";
import type { ActionResult } from "@/lib/actions/appointments";
import type { BirthdaySettings } from "@/lib/client-rules";
import { DEFAULT_BIRTHDAY } from "@/lib/client-rules";

const schema = z.object({
  enabled: z.boolean(),
  kind: z.enum(["percent", "fixed"]),
  amount: z.number().min(0).max(100000),
  windowDays: z.number().int().min(0).max(60),
  serviceIds: z.array(z.string().uuid()),
});

/**
 * Saves the birthday discount.
 *
 * The percentage is capped at 100 here rather than only in the input, because
 * the field is the easy half: a stored 150% would come back as a negative
 * price at booking time.
 */
export async function updateBirthdaySettings(input: {
  enabled: boolean;
  kind: "percent" | "fixed";
  amount: number;
  windowDays: number;
  serviceIds: string[];
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa los datos del descuento." };

  const { enabled, kind, amount, windowDays, serviceIds } = parsed.data;
  if (kind === "percent" && amount > 100) {
    return { ok: false, error: "El porcentaje no puede pasar de 100%." };
  }

  const { error } = await supabase
    .from("business_settings")
    .update({
      birthday_enabled: enabled,
      birthday_kind: kind,
      birthday_amount: amount,
      birthday_window_days: windowDays,
      birthday_service_ids: serviceIds,
    })
    .eq("id", 1);

  if (error) {
    if (diagnose(error).kind === "missing-column") {
      return { ok: false, error: "Corre migration_29 en Supabase para activar los cumpleaños." };
    }
    return { ok: false, error: "No se pudo guardar el descuento." };
  }

  revalidatePath("/negocio");
  revalidatePath("/clientes");
  return { ok: true };
}

/**
 * Current birthday rules, with the defaults standing in when the migration
 * hasn't been run — so callers can price an appointment without first
 * checking whether the columns exist.
 */
export async function getBirthdaySettings(): Promise<BirthdaySettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_settings")
    .select(
      "birthday_enabled, birthday_kind, birthday_amount, birthday_window_days, birthday_service_ids"
    )
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return DEFAULT_BIRTHDAY;

  return {
    birthday_enabled: Boolean(data.birthday_enabled),
    birthday_kind: data.birthday_kind === "fixed" ? "fixed" : "percent",
    birthday_amount: Number(data.birthday_amount ?? DEFAULT_BIRTHDAY.birthday_amount),
    birthday_window_days: Number(
      data.birthday_window_days ?? DEFAULT_BIRTHDAY.birthday_window_days
    ),
    birthday_service_ids: (data.birthday_service_ids as string[] | null) ?? [],
  };
}
