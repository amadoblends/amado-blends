"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/appointments";

export async function saveTheme(theme: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const parsed = z.enum(["dark", "light"]).safeParse(theme);
  if (!parsed.success) return { ok: false, error: "Tema inválido." };

  const { error } = await supabase
    .from("profiles")
    .update({ theme: parsed.data })
    .eq("id", user.id);

  if (error) return { ok: false, error: "No se pudo guardar el tema." };

  revalidatePath("/", "layout");
  return { ok: true };
}
