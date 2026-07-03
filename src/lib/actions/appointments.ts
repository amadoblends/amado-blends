"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const appointmentSchema = z.object({
  clientId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  price: z.coerce.number().min(0).max(100000),
  notes: z.string().max(500).optional(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

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

  const { error } = await supabase.from("appointments").insert({
    client_id: parsed.data.clientId,
    service_id: parsed.data.serviceId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    price: parsed.data.price,
    notes: parsed.data.notes ?? null,
    status: "pendiente",
  });

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, error: "Ya existe una cita en ese horario." };
    }
    return { ok: false, error: "No se pudo crear la cita." };
  }

  revalidatePath("/citas");
  revalidatePath("/");
  return { ok: true };
}

const rescheduleSchema = z.object({
  appointmentId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startsAt: z.string().min(10),
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

  revalidatePath("/citas");
  revalidatePath(`/citas/${parsed.data.appointmentId}`);
  revalidatePath("/");
  return { ok: true };
}

const statusSchema = z.enum(["confirmada", "pendiente", "completada", "cancelada"]);

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

  revalidatePath("/citas");
  revalidatePath("/");
  return { ok: true };
}
