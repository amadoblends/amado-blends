"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/appointments";

const clientSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(20),
  email: z.string().trim().email().optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
  quickNotes: z.string().max(1000).optional(),
});

export async function createClientRecord(formData: FormData): Promise<ActionResult & { id?: string }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const parsed = clientSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email") || "",
    birthDate: formData.get("birthDate") || "",
    quickNotes: formData.get("quickNotes") || "",
  });

  if (!parsed.success) return { ok: false, error: "Revisa los datos del formulario." };

  const { data, error } = await supabase
    .from("clients")
    .insert({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      birth_date: parsed.data.birthDate || null,
      quick_notes: parsed.data.quickNotes || null,
      segment: "nuevo",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "No se pudo guardar el cliente." };

  revalidatePath("/clientes");
  return { ok: true, id: data.id };
}

export async function updateClientRecord(clientId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const idCheck = z.string().uuid().safeParse(clientId);
  if (!idCheck.success) return { ok: false, error: "Cliente inválido." };

  const parsed = clientSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email") || "",
    birthDate: formData.get("birthDate") || "",
    quickNotes: formData.get("quickNotes") || "",
  });

  if (!parsed.success) return { ok: false, error: "Revisa los datos del formulario." };

  const { error } = await supabase
    .from("clients")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      birth_date: parsed.data.birthDate || null,
      quick_notes: parsed.data.quickNotes || null,
    })
    .eq("id", idCheck.data);

  if (error) return { ok: false, error: "No se pudo actualizar el cliente." };

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function deleteClientRecord(clientId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const idCheck = z.string().uuid().safeParse(clientId);
  if (!idCheck.success) return { ok: false, error: "Cliente inválido." };

  const { error } = await supabase.from("clients").delete().eq("id", idCheck.data);
  if (error) return { ok: false, error: "No se pudo eliminar el cliente." };

  revalidatePath("/clientes");
  return { ok: true };
}

const noteSchema = z.object({
  clientId: z.string().uuid(),
  type: z.enum(["preferencias", "productos", "estilo", "otros"]),
  content: z.string().trim().min(1).max(1000),
});

export async function addClientNote(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const parsed = noteSchema.safeParse({
    clientId: formData.get("clientId"),
    type: formData.get("type"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { ok: false, error: "Revisa la nota." };

  const { error } = await supabase.from("client_notes").insert({
    client_id: parsed.data.clientId,
    type: parsed.data.type,
    content: parsed.data.content,
  });

  if (error) return { ok: false, error: "No se pudo guardar la nota." };

  revalidatePath(`/clientes/${parsed.data.clientId}`);
  return { ok: true };
}
