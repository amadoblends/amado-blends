"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/appointments";

const promoSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  discountPercent: z.coerce.number().int().min(1).max(100),
  serviceId: z.string().uuid().optional().or(z.literal("")),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1),
  startTime: z.string().optional().or(z.literal("")),
  endTime: z.string().optional().or(z.literal("")),
  endsOn: z.string().optional().or(z.literal("")),
});

export async function createPromotion(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const parsed = promoSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || "",
    discountPercent: formData.get("discountPercent"),
    serviceId: formData.get("serviceId") || "",
    weekdays: formData.getAll("weekdays").map(String),
    startTime: formData.get("startTime") || "",
    endTime: formData.get("endTime") || "",
    endsOn: formData.get("endsOn") || "",
  });

  if (!parsed.success) return { ok: false, error: "Revisa los datos de la promoción." };

  const { error } = await supabase.from("promotions").insert({
    title: parsed.data.title,
    description: parsed.data.description || null,
    discount_percent: parsed.data.discountPercent,
    service_id: parsed.data.serviceId || null,
    weekdays: parsed.data.weekdays,
    start_time: parsed.data.startTime || null,
    end_time: parsed.data.endTime || null,
    ends_on: parsed.data.endsOn || null,
    is_active: true,
  });

  if (error) return { ok: false, error: `No se pudo crear la promoción: ${error.message}` };

  // Notify every client about the new promotion
  await supabase.rpc("notify_all_clients", {
    p_title: `🎉 ${parsed.data.title}`,
    p_body: `${parsed.data.discountPercent}% de descuento${parsed.data.description ? ` — ${parsed.data.description}` : ""}. ¡Reserva ahora desde la app!`,
    p_type: "promo",
  });

  revalidatePath("/promociones");
  return { ok: true };
}

export async function togglePromotion(promoId: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const idCheck = z.string().uuid().safeParse(promoId);
  if (!idCheck.success) return { ok: false, error: "Promoción inválida." };

  const { error } = await supabase
    .from("promotions")
    .update({ is_active: isActive })
    .eq("id", idCheck.data);

  if (error) return { ok: false, error: "No se pudo actualizar la promoción." };

  revalidatePath("/promociones");
  return { ok: true };
}

export async function deletePromotion(promoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const idCheck = z.string().uuid().safeParse(promoId);
  if (!idCheck.success) return { ok: false, error: "Promoción inválida." };

  const { error } = await supabase.from("promotions").delete().eq("id", idCheck.data);
  if (error) return { ok: false, error: "No se pudo eliminar la promoción." };

  revalidatePath("/promociones");
  return { ok: true };
}
