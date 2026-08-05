"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/appointments";

const businessSchema = z.object({
  name: z.string().trim().min(2).max(80),
  logoUrl: z.string().url().max(2000).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

export async function updateBusiness(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const parsed = businessSchema.safeParse({
    name: formData.get("name"),
    logoUrl: formData.get("logoUrl") || "",
    address: formData.get("address") || "",
    phone: formData.get("phone") || "",
  });
  if (!parsed.success) return { ok: false, error: "Revisa los datos del negocio." };

  const { error } = await supabase.from("business_settings").upsert(
    {
      id: 1,
      name: parsed.data.name,
      logo_url: parsed.data.logoUrl || null,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    const missing =
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      /schema cache|does not exist/i.test(error.message);
    return {
      ok: false,
      error: missing
        ? "Falta la tabla del negocio. Corre migration_20_branding.sql en Supabase."
        : `No se pudo guardar: ${error.message}`,
    };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
