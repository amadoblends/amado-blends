"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "read", "archived"]),
});

/**
 * Moves one message between new / read / archived.
 *
 * The three states are the whole workflow: a message the barber has looked at
 * shouldn't keep shouting, and one they're done with shouldn't be deleted —
 * complaints are worth keeping.
 */
export async function setFeedbackStatus(input: {
  id: string;
  status: "new" | "read" | "archived";
}): Promise<{ ok: boolean; error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("feedback")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (error) return { ok: false, error: "No se pudo actualizar el comentario." };

  revalidatePath("/mas/feedback");
  return { ok: true };
}
