"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  notifyCreatedByBarber,
  notifyCancelledByBarber,
  notifyRescheduledByBarber,
} from "@/lib/actions/notify";
import { dispatch, recordChannel, type EventKind } from "@/lib/notifications/dispatch";

const appointmentSchema = z.object({
  clientId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  price: z.coerce.number().min(0).max(100000),
  notes: z.string().max(500).optional(),
});

/**
 * `warning` is for a save that succeeded but needs the barber's attention —
 * a pending migration, say. Distinct from `error`, which means nothing was
 * written.
 */
export type ActionResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

export async function createAppointment(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const parsed = appointmentSchema.safeParse({
    clientId: formData.get("clientId"),
    serviceId: formData.get("serviceId"),
    startsAt: formData.get("startsAt"),
    durationMinutes: formData.get("durationMinutes"),
    price: formData.get("price"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos. Revisa el formulario." };
  }

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false, error: "Fecha/hora inválida." };
  }
  const endsAt = new Date(startsAt.getTime() + parsed.data.durationMinutes * 60000);

  const { data: inserted, error } = await supabase
    .from("appointments")
    .insert({
      client_id: parsed.data.clientId,
      service_id: parsed.data.serviceId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price: parsed.data.price,
      notes: parsed.data.notes ?? null,
      status: "pendiente",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, error: "Ya existe una cita en ese horario." };
    }
    return { ok: false, error: "No se pudo crear la cita." };
  }

  // Confirmation to the client and a copy to the shop. Awaited so a serverless
  // function isn't torn down mid-send, but any failure is swallowed — the
  // appointment is already saved.
  if (inserted?.id) {
    await notifyCreatedByBarber(inserted.id).catch(() => {});
  }

  revalidatePath("/citas");
  revalidatePath("/");
  return { ok: true };
}

const rescheduleSchema = z.object({
  appointmentId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startsAt: z.string().min(10),
  displayWhen: z.string().max(120).optional(),
});

export async function rescheduleAppointment(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const parsed = rescheduleSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    serviceId: formData.get("serviceId"),
    startsAt: formData.get("startsAt"),
    displayWhen: formData.get("displayWhen") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "Fecha/hora inválida." };

  // Duration and price come from the (possibly new) service
  const { data: service } = await supabase
    .from("services")
    .select("duration_minutes, price")
    .eq("id", parsed.data.serviceId)
    .single();
  if (!service) return { ok: false, error: "Servicio no encontrado." };

  const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60000);

  // Read the old time before overwriting it — the email says "antes era..."
  const { data: before } = await supabase
    .from("appointments")
    .select("starts_at")
    .eq("id", parsed.data.appointmentId)
    .maybeSingle();

  const { error } = await supabase
    .from("appointments")
    .update({
      service_id: parsed.data.serviceId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price: service.price,
    })
    .eq("id", parsed.data.appointmentId);

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, error: "Ya existe una cita en ese horario." };
    }
    return { ok: false, error: "No se pudo reagendar la cita." };
  }

  const eventId = await notifyAppointmentClient(
    supabase,
    parsed.data.appointmentId,
    "booking_rescheduled",
    "Tu cita fue reagendada 📅",
    parsed.data.displayWhen
      ? `Tu nueva cita es el ${parsed.data.displayWhen}. Toca para ver los detalles.`
      : "El barbero cambió el horario de tu cita. Toca para ver los detalles.",
    { previousStartsAt: before?.starts_at ?? null, newStartsAt: startsAt.toISOString() }
  );

  // The email carries the calendar invite, so it's sent by notify.ts and its
  // outcome written back onto the same event
  if (before?.starts_at) {
    await notifyRescheduledByBarber(parsed.data.appointmentId, before.starts_at)
      .then(() => recordChannel(supabase, eventId, "email", "sent"))
      .catch((e) =>
        recordChannel(supabase, eventId, "email", `failed: ${e?.message ?? String(e)}`)
      );
  }

  revalidatePath("/citas");
  revalidatePath(`/citas/${parsed.data.appointmentId}`);
  revalidatePath("/");
  return { ok: true };
}

/**
 * Tells the appointment's client that the barber changed something.
 *
 * This used to insert straight into client_notifications, which meant the
 * bell, the email and (later) push were three unrelated paths that could
 * disagree. It now goes through the dispatcher: one event row, every enabled
 * channel derived from it, and the outcome of each recorded on that row.
 *
 * The email is sent separately by lib/actions/notify because it needs the
 * full appointment and a calendar invite, so it's skipped here and its result
 * written back afterwards.
 */
async function notifyAppointmentClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  appointmentId: string,
  kind: EventKind,
  title: string,
  body: string,
  payload: Record<string, unknown> = {}
): Promise<string | null> {
  const { data: apt } = await supabase
    .from("appointments")
    .select("client_id")
    .eq("id", appointmentId)
    .maybeSingle();

  const { eventId } = await dispatch(
    supabase,
    {
      kind,
      appointmentId,
      clientId: apt?.client_id ?? null,
      actor: "barber",
      title,
      body,
      // Tapping the push opens that appointment, not just the app
      href: `/citas/${appointmentId}`,
      payload,
    },
    { skip: ["email"] }
  );

  return eventId;
}

// "no_show" was missing here, so the detail card's "No asistió" button was
// rejected as invalid before it ever reached the database.
const statusSchema = z.enum([
  "confirmada",
  "pendiente",
  "completada",
  "cancelada",
  "no_show",
]);

export async function updateAppointmentStatus(appointmentId: string, status: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const parsedId = z.string().uuid().safeParse(appointmentId);
  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) {
    return { ok: false, error: "Datos inválidos." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status: parsedStatus.data })
    .eq("id", parsedId.data);

  if (error) return { ok: false, error: "No se pudo actualizar la cita." };

  if (parsedStatus.data === "cancelada") {
    const eventId = await notifyAppointmentClient(
      supabase,
      parsedId.data,
      "booking_cancelled",
      "Tu cita fue cancelada ❌",
      "El barbero canceló tu cita. Puedes reservar un nuevo horario desde la app."
    );
    await notifyCancelledByBarber(parsedId.data, "cancelada")
      .then(() => recordChannel(supabase, eventId, "email", "sent"))
      .catch((e) =>
        recordChannel(supabase, eventId, "email", `failed: ${e?.message ?? String(e)}`)
      );
  } else if (parsedStatus.data === "no_show") {
    // Recorded for the shop only — telling a client by push and email that
    // they didn't turn up isn't the app's job.
    await notifyCancelledByBarber(parsedId.data, "no_show").catch(() => {});
  } else if (parsedStatus.data === "confirmada") {
    await notifyAppointmentClient(
      supabase,
      parsedId.data,
      "booking_updated",
      "Tu cita fue confirmada ✅",
      "Te esperamos. Toca para ver los detalles de tu cita."
    );
  }

  revalidatePath("/citas");
  revalidatePath("/");
  return { ok: true };
}
