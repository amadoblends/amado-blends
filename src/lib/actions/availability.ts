"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/appointments";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const daySchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  isActive: z.coerce.boolean(),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  breakStartTime: z.string().regex(timeRegex).optional().or(z.literal("")),
  breakEndTime: z.string().regex(timeRegex).optional().or(z.literal("")),
  slotMinutes: z.coerce.number().int().min(5).max(240),
});

export async function toggleAvailabilityDay(weekday: number, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const parsed = z.object({ weekday: z.number().int().min(0).max(6), isActive: z.boolean() }).safeParse({
    weekday,
    isActive,
  });
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const { error } = await supabase
    .from("availability")
    .update({ is_active: parsed.data.isActive })
    .eq("weekday", parsed.data.weekday);

  if (error) return { ok: false, error: "No se pudo actualizar el día." };


  revalidatePath("/disponibilidad");
  revalidatePath("/citas");
  return { ok: true };
}

export async function updateAvailabilityDay(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const parsed = daySchema.safeParse({
    weekday: formData.get("weekday"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    breakStartTime: formData.get("breakStartTime") || "",
    breakEndTime: formData.get("breakEndTime") || "",
    slotMinutes: formData.get("slotMinutes"),
  });

  if (!parsed.success) return { ok: false, error: "Revisa los horarios ingresados." };
  if (parsed.data.startTime >= parsed.data.endTime) {
    return { ok: false, error: "La hora de inicio debe ser antes que la de fin." };
  }

  const { error } = await supabase
    .from("availability")
    .update({
      is_active: parsed.data.isActive,
      start_time: parsed.data.startTime,
      end_time: parsed.data.endTime,
      break_start_time: parsed.data.breakStartTime || null,
      break_end_time: parsed.data.breakEndTime || null,
      slot_minutes: parsed.data.slotMinutes,
    })
    .eq("weekday", parsed.data.weekday);

  if (error) return { ok: false, error: "No se pudo guardar el horario." };


  revalidatePath("/disponibilidad");
  revalidatePath("/citas");
  return { ok: true };
}

const settingsSchema = z.object({
  bookingWindowDays: z.coerce.number().int().min(1).max(365),
  minNoticeMinutes: z.coerce.number().int().min(0).max(10080),
  bufferMinutes: z.coerce.number().int().min(0).max(120),
});

export async function updateBookingSettings(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const parsed = settingsSchema.safeParse({
    bookingWindowDays: formData.get("bookingWindowDays"),
    minNoticeMinutes: formData.get("minNoticeMinutes"),
    bufferMinutes: formData.get("bufferMinutes") ?? "0",
  });
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const { error } = await supabase
    .from("booking_settings")
    .update({
      booking_window_days: parsed.data.bookingWindowDays,
      min_notice_minutes: parsed.data.minNoticeMinutes,
      buffer_minutes: parsed.data.bufferMinutes,
    })
    .eq("id", 1);

  if (error) return { ok: false, error: "No se pudo guardar la configuración." };


  revalidatePath("/disponibilidad");
  revalidatePath("/citas");
  return { ok: true };
}
