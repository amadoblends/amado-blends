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
  { value: "horario", label: "Horario especial", emoji: "🕐" },
  { value: "servicio", label: "Nuevo servicio", emoji: "✂️" },
  { value: "aviso", label: "Aviso importante", emoji: "📢" },
  { value: "info", label: "Información", emoji: "ℹ️" },
] as const;

const TYPE_VALUES = [
  "promocion", "oferta", "vacaciones", "cerrado", "holiday",
  "horario", "servicio", "aviso", "info",
] as const;

const postSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  imageUrl: z.string().url().max(2000).optional().or(z.literal("")),
  type: z.enum(TYPE_VALUES),
  buttonLabel: z.string().trim().max(40).optional().or(z.literal("")),
  buttonHref: z.string().trim().max(300).optional().or(z.literal("")),
  startsOn: z.string().optional().or(z.literal("")),
  endsOn: z.string().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.enum(["true", "false"]).default("true"),
  isDraft: z.enum(["true", "false"]).default("false"),
});

export async function upsertCarouselPost(
  postId: string | null,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const parsed = postSchema.safeParse({
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
    isDraft: formData.get("isDraft") || "false",
  });

  if (!parsed.success) {
    return { ok: false, error: "Revisa el título y los datos de la publicación." };
  }
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
    is_draft: parsed.data.isDraft === "true",
  };

  const query = postId
    ? supabase.from("carousel_posts").update(payload).eq("id", postId)
    : supabase.from("carousel_posts").insert(payload);

  const { error } = await query;
  if (error) {
    // Most common cause: the migration hasn't been run yet
    if (error.code === "42P01") {
      return {
        ok: false,
        error: "Falta crear la tabla. Corre migration_16_carousel_status.sql en Supabase.",
      };
    }
    return { ok: false, error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath("/carrusel");
  revalidatePath("/");
  return { ok: true };
}

export async function setCarouselFlags(
  postId: string,
  flags: { isActive?: boolean; isDraft?: boolean }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const idCheck = z.string().uuid().safeParse(postId);
  if (!idCheck.success) return { ok: false, error: "Publicación inválida." };

  const patch: Record<string, boolean> = {};
  if (flags.isActive !== undefined) patch.is_active = flags.isActive;
  if (flags.isDraft !== undefined) patch.is_draft = flags.isDraft;

  const { error } = await supabase.from("carousel_posts").update(patch).eq("id", idCheck.data);
  if (error) return { ok: false, error: "No se pudo actualizar la publicación." };

  revalidatePath("/carrusel");
  return { ok: true };
}

export async function moveCarouselPost(
  postId: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const { data: posts } = await supabase
    .from("carousel_posts")
    .select("id, sort_order")
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (!posts) return { ok: false, error: "No se pudo reordenar." };

  const index = posts.findIndex((p) => p.id === postId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= posts.length) return { ok: true };

  // Rewrite the whole list so gaps and duplicate orders self-heal
  const reordered = [...posts];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];

  await Promise.all(
    reordered.map((p, i) =>
      supabase.from("carousel_posts").update({ sort_order: i }).eq("id", p.id)
    )
  );

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
