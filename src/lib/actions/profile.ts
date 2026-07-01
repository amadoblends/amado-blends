"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/appointments";

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  avatarUrl: z.string().url().max(2000).optional().or(z.literal("")),
});

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    avatarUrl: formData.get("avatarUrl") || "",
  });
  if (!parsed.success) return { ok: false, error: "Revisa los datos del perfil." };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      avatar_url: parsed.data.avatarUrl || null,
    })
    .eq("id", auth.user.id);

  if (error) return { ok: false, error: "No se pudo actualizar el perfil." };

  revalidatePath("/perfil");
  revalidatePath("/");
  revalidatePath("/mas");
  return { ok: true };
}

export async function updatePassword(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const newPassword = formData.get("newPassword") as string;
  const confirm = formData.get("confirmPassword") as string;

  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (newPassword !== confirm) {
    return { ok: false, error: "Las contraseñas no coinciden." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: "No se pudo actualizar la contraseña." };

  return { ok: true };
}
