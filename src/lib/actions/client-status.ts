"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { diagnose } from "@/lib/supabase/schema-errors";
import type { ActionResult } from "@/lib/actions/appointments";
import type { StoredClientStatus } from "@/lib/client-status";

const schema = z.object({
  clientId: z.string().uuid(),
  status: z.enum(["active", "deactivated", "blocked", "deleted"]),
  reason: z.string().max(60).optional(),
  note: z.string().max(500).optional(),
});

/**
 * Moves a client between states.
 *
 * Goes through the database function rather than a plain update, so the
 * reason, the timestamp and who did it are recorded every time — and so the
 * rule about a blocked client not booking is enforced where the writes
 * actually happen, not only where the buttons are.
 */
export async function setClientStatus(input: {
  clientId: string;
  status: StoredClientStatus;
  reason?: string;
  note?: string;
}): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const { data, error } = await supabase.rpc("set_client_status", {
    p_client_id: parsed.data.clientId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason ?? null,
    p_note: parsed.data.note ?? null,
  });

  if (error) {
    if (diagnose(error).kind !== "other") {
      return { ok: false, error: "Corre migration_31 en Supabase para activar los estados." };
    }
    return { ok: false, error: "No se pudo cambiar el estado." };
  }
  if (data === false) return { ok: false, error: "No se pudo cambiar el estado." };

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${parsed.data.clientId}`);
  return { ok: true };
}

export interface DeleteImpact {
  appointments: number;
  completed: number;
  totalSpent: number;
  notes: number;
  feedback: number;
  firstVisit: string | null;
  lastVisit: string | null;
}

/**
 * What deleting this client would destroy.
 *
 * Shown before the confirmation, because the number that matters — money
 * already taken, which the reports are built on — is exactly the one nobody
 * thinks about while tapping through a dialog.
 */
export async function getDeleteImpact(clientId: string): Promise<DeleteImpact | null> {
  const idCheck = z.string().uuid().safeParse(clientId);
  if (!idCheck.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_delete_impact", {
    p_client_id: idCheck.data,
  });
  if (error || !data) return null;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    appointments: Number(row.appointments ?? 0),
    completed: Number(row.completed ?? 0),
    totalSpent: Number(row.total_spent ?? 0),
    notes: Number(row.notes ?? 0),
    feedback: Number(row.feedback ?? 0),
    firstVisit: row.first_visit ?? null,
    lastVisit: row.last_visit ?? null,
  };
}
