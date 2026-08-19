"use server";

import { z } from "zod";
import { addDays, format, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/appointments";
import { CLOSURE_REASON_VALUES } from "@/lib/closures";
import {
  nextWorkingDay,
  buildClosureTitle,
  buildClosureDescription,
  buildReturnTitle,
  buildReturnDescription,
} from "@/lib/closures";
import { shopDateAt, endOfShopDay } from "@/lib/timezone";
import { diagnose, withoutKeys } from "@/lib/supabase/schema-errors";

export interface ConflictingAppointment {
  id: string;
  starts_at: string;
  ends_at: string;
  clientName: string;
  serviceName: string;
  guestName: string | null;
}

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const closureSchema = z.object({
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  allDay: z.enum(["true", "false"]).default("true"),
  startTime: z.string().regex(timeRegex).optional().or(z.literal("")),
  endTime: z.string().regex(timeRegex).optional().or(z.literal("")),
  reason: z.enum(CLOSURE_REASON_VALUES),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  // "no" | "publicar" | "borrador"
  announce: z.enum(["no", "publicar", "borrador"]).default("no"),
  announceTitle: z.string().trim().max(120).optional().or(z.literal("")),
  announceBody: z.string().trim().max(400).optional().or(z.literal("")),
  announceReturnPost: z.enum(["true", "false"]).default("false"),
});

/**
 * Appointments that fall inside a proposed closure. The UI shows these and
 * blocks saving until the barber reschedules or cancels them.
 */
export async function findClosureConflicts(
  startsOn: string,
  endsOn: string,
  allDay: boolean,
  startTime?: string,
  endTime?: string
): Promise<ConflictingAppointment[]> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  // Widen a day either side: the server is UTC, appointments are local
  const from = new Date(startsOn + "T00:00:00");
  const to = addDays(new Date(endsOn + "T00:00:00"), 1);

  // Filtering "no_show" here would break before migration_18a adds it to the
  // status enum, so only "cancelada" is excluded in SQL and the rest in JS.
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, guest_name, clients(full_name), services(name)"
    )
    .neq("status", "cancelada")
    .gte("starts_at", subDays(from, 1).toISOString())
    .lte("starts_at", addDays(to, 1).toISOString())
    .order("starts_at");

  const rows = (data ?? []).filter((a) => {
    if (a.status === "no_show") return false;
    const start = new Date(a.starts_at);
    const dayKey = format(start, "yyyy-MM-dd");
    if (dayKey < startsOn || dayKey > endsOn) return false;
    if (allDay) return true;
    if (!startTime || !endTime) return true;

    // Partial closure: only appointments overlapping the closed window
    const mins = start.getHours() * 60 + start.getMinutes();
    const endMins = new Date(a.ends_at).getHours() * 60 + new Date(a.ends_at).getMinutes();
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    return mins < eh * 60 + em && endMins > sh * 60 + sm;
  });

  return rows.map((a) => ({
    id: a.id,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    clientName: (a.clients as unknown as { full_name: string } | null)?.full_name ?? "Cliente",
    serviceName: (a.services as unknown as { name: string } | null)?.name ?? "Servicio",
    guestName: a.guest_name,
  }));
}

export async function createClosure(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const parsed = closureSchema.safeParse({
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
    allDay: formData.get("allDay") || "true",
    startTime: formData.get("startTime") || "",
    endTime: formData.get("endTime") || "",
    reason: formData.get("reason") || "otro",
    description: formData.get("description") || "",
    announce: formData.get("announce") || "no",
    announceTitle: formData.get("announceTitle") || "",
    announceBody: formData.get("announceBody") || "",
    announceReturnPost: formData.get("announceReturnPost") || "false",
  });

  if (!parsed.success) return { ok: false, error: "Revisa las fechas del cierre." };
  const d = parsed.data;

  if (d.endsOn < d.startsOn) {
    return { ok: false, error: "La fecha de fin debe ser posterior a la de inicio." };
  }
  const allDay = d.allDay === "true";
  if (!allDay && (!d.startTime || !d.endTime)) {
    return { ok: false, error: "Indica desde y hasta qué hora estarás cerrado." };
  }
  if (!allDay && d.startTime! >= d.endTime!) {
    return { ok: false, error: "La hora de fin debe ser posterior a la de inicio." };
  }

  // Refuse to close over live appointments
  const conflicts = await findClosureConflicts(
    d.startsOn,
    d.endsOn,
    allDay,
    d.startTime || undefined,
    d.endTime || undefined
  );
  if (conflicts.length > 0) {
    return {
      ok: false,
      error: `Hay ${conflicts.length} cita(s) en esas fechas. Reagéndalas o cancélalas antes de cerrar.`,
    };
  }

  let carouselPostId: string | null = null;

  /*
   * Columns added by migration 23. Writing them against a database that
   * hasn't run it fails with PGRST204, whose message mentions the schema
   * cache — which an older check here misread as "the table is missing, run
   * migrations 16 and 17". Both had been run; neither could have helped.
   * The announcement is retried without them so the closure still saves.
   */
  const V23_COLUMNS = ["starts_at", "ends_at", "is_permanent"] as const;

  // Optional announcement in the client carousel
  if (d.announce !== "no") {
    const announcement = {
      title: d.announceTitle || buildClosureTitle(d.startsOn, d.endsOn),
      description: d.announceBody || d.description || null,
      type: d.reason === "vacaciones" ? "vacaciones" : "cerrado",
      starts_on: null, // visible from today so clients see it coming
      ends_on: d.endsOn,
      // The exact instant it stops. Without this the notice never expired.
      starts_at: null,
      ends_at: endOfShopDay(d.endsOn).toISOString(),
      is_active: true,
      is_draft: d.announce === "borrador",
      sort_order: 0,
    };

    let { data: post, error: postError } = await supabase
      .from("carousel_posts")
      .insert(announcement)
      .select("id")
      .single();

    if (postError) {
      const problem = diagnose(postError);

      if (problem.kind === "missing-column") {
        const retry = await supabase
          .from("carousel_posts")
          .insert(withoutKeys(announcement, V23_COLUMNS))
          .select("id")
          .single();
        post = retry.data;
        postError = retry.error;
      }

      if (postError) {
        return {
          ok: false,
          error:
            problem.kind === "missing-table"
              ? "Falta la tabla del carrusel. Corre migration_16_carousel_status.sql en Supabase."
              : problem.kind === "missing-column"
                ? `Falta la columna "${problem.column ?? "?"}" en carousel_posts. Corre migration_23_carousel_window.sql en Supabase.`
                : `No se pudo publicar el aviso: ${postError.message}`,
        };
      }
    }
    carouselPostId = post?.id ?? null;

    // "Tomorrow I'm back" teaser, scheduled for the final closed day
    if (d.announceReturnPost === "true") {
      const { data: availability } = await supabase
        .from("availability")
        .select("weekday, is_active");
      const activeWeekdays = new Set(
        (availability ?? []).filter((a) => a.is_active).map((a) => a.weekday)
      );
      const back = nextWorkingDay(new Date(d.endsOn + "T00:00:00"), activeWeekdays);

      if (back) {
        const teaser = {
          title: buildReturnTitle(back),
          description: buildReturnDescription(back),
          type: "aviso",
          starts_on: d.endsOn,
          ends_on: format(back, "yyyy-MM-dd"),
          starts_at: shopDateAt(d.endsOn, "00:00").toISOString(),
          ends_at: endOfShopDay(format(back, "yyyy-MM-dd")).toISOString(),
          button_label: "Reservar",
          button_href: "/reservar",
          is_active: true,
          is_draft: false,
          sort_order: 0,
        };
        const { error: teaserError } = await supabase
          .from("carousel_posts")
          .insert(teaser);
        // A missing column here is not worth failing the closure over
        if (teaserError && diagnose(teaserError).kind === "missing-column") {
          await supabase.from("carousel_posts").insert(withoutKeys(teaser, V23_COLUMNS));
        }
      }
    }
  }

  const { error } = await supabase.from("closures").insert({
    starts_on: d.startsOn,
    ends_on: d.endsOn,
    all_day: allDay,
    start_time: allDay ? null : d.startTime,
    end_time: allDay ? null : d.endTime,
    reason: d.reason,
    description: d.description || null,
    carousel_post_id: carouselPostId,
  });

  if (error) {
    // Same lesson as the carousel: name the actual problem, not a guess
    const problem = diagnose(error);
    return {
      ok: false,
      error:
        problem.kind === "missing-table"
          ? "Falta la tabla de cierres. Corre migration_17_closures_theme_slots.sql en Supabase."
          : problem.kind === "missing-column"
            ? `Falta la columna "${problem.column ?? "?"}" en closures. Revisa migration_17_closures_theme_slots.sql.`
            : `No se pudo guardar el cierre: ${error.message}`,
    };
  }

  revalidatePath("/citas");
  revalidatePath("/disponibilidad");
  revalidatePath("/carrusel");
  return { ok: true };
}

export async function deleteClosure(closureId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const idCheck = z.string().uuid().safeParse(closureId);
  if (!idCheck.success) return { ok: false, error: "Cierre inválido." };

  // Drop the announcement alongside the closure it belongs to
  const { data: closure } = await supabase
    .from("closures")
    .select("carousel_post_id")
    .eq("id", idCheck.data)
    .maybeSingle();

  if (closure?.carousel_post_id) {
    await supabase.from("carousel_posts").delete().eq("id", closure.carousel_post_id);
  }

  const { error } = await supabase.from("closures").delete().eq("id", idCheck.data);
  if (error) return { ok: false, error: "No se pudo eliminar el cierre." };

  revalidatePath("/citas");
  revalidatePath("/disponibilidad");
  return { ok: true };
}

/** Return date preview for the form, computed from the real schedule. */
export async function previewReturnDate(endsOn: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const [{ data: availability }, { data: closures }] = await Promise.all([
    supabase.from("availability").select("weekday, is_active"),
    supabase.from("closures").select("starts_on, ends_on"),
  ]);

  const activeWeekdays = new Set(
    (availability ?? []).filter((a) => a.is_active).map((a) => a.weekday)
  );
  const back = nextWorkingDay(new Date(endsOn + "T00:00:00"), activeWeekdays, closures ?? []);
  return back ? back.toISOString() : null;
}

/** Ready-made announcement text so the form can prefill and let it be edited. */
export async function buildAnnouncement(
  startsOn: string,
  endsOn: string
): Promise<{ title: string; body: string; returnISO: string | null }> {
  const returnISO = await previewReturnDate(endsOn);
  return {
    title: buildClosureTitle(startsOn, endsOn),
    body: buildClosureDescription(startsOn, endsOn, returnISO ? new Date(returnISO) : null),
    returnISO,
  };
}
