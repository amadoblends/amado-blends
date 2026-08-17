"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/appointments";
import { CAROUSEL_TYPE_VALUES } from "@/lib/carousel-types";
import { shopDateAt, endOfShopDay } from "@/lib/timezone";
import { diagnose, withoutKeys } from "@/lib/supabase/schema-errors";

const postSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  imageUrl: z.string().url().max(2000).optional().or(z.literal("")),
  type: z.enum(CAROUSEL_TYPE_VALUES),
  buttonLabel: z.string().trim().max(40).optional().or(z.literal("")),
  buttonHref: z.string().trim().max(300).optional().or(z.literal("")),
  startsOn: z.string().optional().or(z.literal("")),
  endsOn: z.string().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.enum(["true", "false"]).default("true"),
  isDraft: z.enum(["true", "false"]).default("false"),
  isPermanent: z.enum(["true", "false", "on"]).default("false"),
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
    // An unchecked checkbox sends nothing at all
    isPermanent: formData.get("isPermanent") || "false",
  });

  if (!parsed.success) {
    return { ok: false, error: "Revisa el título y los datos de la publicación." };
  }

  const permanent = parsed.data.isPermanent !== "false";

  if (parsed.data.startsOn && parsed.data.endsOn && parsed.data.startsOn > parsed.data.endsOn) {
    return { ok: false, error: "La fecha de fin debe ser posterior a la de inicio." };
  }
  /*
   * A post with no end date never stopped showing — that's how a finished
   * vacation notice stayed in the client's carousel. Permanent content is the
   * only kind allowed to run without an end.
   */
  if (!permanent && !parsed.data.endsOn) {
    return {
      ok: false,
      error:
        "Pon una fecha de fin, o márcala como contenido permanente. Sin fecha de fin nunca dejaría de mostrarse.",
    };
  }

  const payload = {
    title: parsed.data.title,
    description: parsed.data.description || null,
    image_url: parsed.data.imageUrl || null,
    type: parsed.data.type,
    button_label: parsed.data.buttonLabel || null,
    button_href: parsed.data.buttonHref || null,
    starts_on: permanent ? null : parsed.data.startsOn || null,
    ends_on: permanent ? null : parsed.data.endsOn || null,
    /*
     * The exact instants are what the client actually checks, so it can drop
     * a post the moment it expires instead of at the next UTC midnight.
     * ends_at is the *end* of the chosen day in the shop's timezone, which is
     * how "deja de mostrarse el 6 de agosto" reads to a person.
     */
    starts_at:
      permanent || !parsed.data.startsOn
        ? null
        : shopDateAt(parsed.data.startsOn, "00:00").toISOString(),
    ends_at:
      permanent || !parsed.data.endsOn
        ? null
        : endOfShopDay(parsed.data.endsOn).toISOString(),
    is_permanent: permanent,
    sort_order: parsed.data.sortOrder,
    is_active: parsed.data.isActive === "true",
    is_draft: parsed.data.isDraft === "true",
  };

  /*
   * Columns added by migration 23. If that migration hasn't been run the save
   * is retried without them rather than refused: the post still publishes,
   * scheduled by its date columns, and the barber is told what to run to get
   * the to-the-minute window back.
   */
  const V23_COLUMNS = ["starts_at", "ends_at", "is_permanent"] as const;

  const write = (body: Record<string, unknown>) =>
    postId
      ? supabase.from("carousel_posts").update(body).eq("id", postId)
      : supabase.from("carousel_posts").insert(body);

  let { error } = await write(payload);
  let ranWithoutNewColumns = false;

  if (error) {
    const problem = diagnose(error);

    if (problem.kind === "missing-table") {
      return {
        ok: false,
        error: "Falta la tabla del carrusel. Corre migration_16_carousel_status.sql en Supabase.",
      };
    }

    if (problem.kind === "missing-column") {
      const retry = await write(withoutKeys(payload, V23_COLUMNS));
      if (retry.error) {
        return {
          ok: false,
          error: `Falta la columna "${problem.column ?? "?"}" en carousel_posts. Corre migration_23_carousel_window.sql en Supabase.`,
        };
      }
      error = null;
      ranWithoutNewColumns = true;
    } else {
      return { ok: false, error: `No se pudo guardar: ${error.message}` };
    }
  }

  if (ranWithoutNewColumns) {
    revalidatePath("/carrusel");
    revalidatePath("/");
    return {
      ok: true,
      warning:
        "Guardada. Para que caduque a la hora exacta y para usar contenido permanente, corre migration_23_carousel_window.sql en Supabase.",
    };
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
