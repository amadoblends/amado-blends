"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/appointments";

export const CAROUSEL_TYPES = [
  { value: "promocion", label: "Promoción", emoji: "🎉" },
  { value: "oferta", label: "Oferta", emoji: "🏷️" },
  { value: "vacaciones", label: "Vacaciones", emoji: "🌴" },
  { value: "cerrado", label: "Día cerrado", emoji: "🚫" },
  { value: "holiday", label: "Feriado", emoji: "📅" },
  { value: "aviso", label: "Aviso", emoji: "📢" },
  { value: "servicio", label: "Nuevo servicio", emoji: "✂️" },
  { value: "info", label: "Información", emoji: "ℹ️" },
] as const;

const postSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  imageUrl: z.string().url().max(2000).optional().or(z.literal("")),
  type: z.enum([
    "promocion", "oferta", "vacaciones", "cerrado", "holiday", "aviso", "servicio", "info",
  ]),
  buttonLabel: z.string().trim().max(40).optional().or(z.literal("")),
  buttonHref: z.string().trim().max(300).optional().or(z.literal("")),
  startsOn: z.string().optional().or(z.literal("")),
  endsOn: z.string().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.enum(["true", "false"]).default("true"),
});

function parseForm(formData: FormData) {
  return postSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || "",
    imageUrl: formData.get("imageUrl") || "",
    type: formData.get("type") || "aviso",
    buttonLabel: formData.get("buttonLabel") || "",
    buttonHref: formData.get("buttonHref") || "",
    startsOn: formData.get("startsOn") || "",
    endsOn: formData.get("endsOn") || "",
    sortOrder: formData.get("sortOrder") || 0,
    isActive: formData.get("isActive") || "true",
  });
}

export async function upsertCarouselPost(
  postId: string | null,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const parsed = parseForm(formData);
  if (!parsed.success) return { ok: false, error: "Revisa los datos de la publicación." };

  if (parsed.data.startsOn && parsed.data.endsOn && parsed.data.startsOn > parsed.data.endsOn) {
    return { ok: false, error: "La fecha de fin debe ser posterior a la de inicio." };
  }

  const payload = {
    title: parsed.data.title,
    description: parsed.data.description || null,
    image_url: parsed.data.imageUrl || null,
    type: parsed.data.type,
    button_label: parsed.data.buttonLabel || null,
    button_href: parsed.data.buttonHref || null,
    starts_on: parsed.data.startsOn || null,
    ends_on: parsed.data.endsOn || null,
    sort_order: parsed.data.sortOrder,
    is_active: parsed.data.isActive === "true",
  };

  const query = postId
    ? supabase.from("carousel_posts").update(payload).eq("id", postId)
    : supabase.from("carousel_posts").insert(payload);

  const { error } = await query;
  if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/carrusel");
  return { ok: true };
}

export async function toggleCarouselPost(postId: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const idCheck = z.string().uuid().safeParse(postId);
  if (!idCheck.success) return { ok: false, error: "Publicación inválida." };

  const { error } = await supabase
    .from("carousel_posts")
    .update({ is_active: isActive })
    .eq("id", idCheck.data);

  if (error) return { ok: false, error: "No se pudo actualizar." };

  revalidatePath("/carrusel");
  return { ok: true };
}

export async function deleteCarouselPost(postId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const idCheck = z.string().uuid().safeParse(postId);
  if (!idCheck.success) return { ok: false, error: "Publicación inválida." };

  const { error } = await supabase.from("carousel_posts").delete().eq("id", idCheck.data);
  if (error) return { ok: false, error: "No se pudo eliminar." };

  revalidatePath("/carrusel");
  return { ok: true };
}
