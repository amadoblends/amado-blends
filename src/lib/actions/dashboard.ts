"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/appointments";

export interface DashboardLayout {
  cardOrder: string[];
  hiddenCards: string[];
}

export async function getDashboardLayout(): Promise<DashboardLayout> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { cardOrder: [], hiddenCards: [] };

  const { data } = await supabase
    .from("dashboard_layout")
    .select("card_order, hidden_cards")
    .eq("admin_id", user.id)
    .maybeSingle();

  return {
    cardOrder: data?.card_order ?? [],
    hiddenCards: data?.hidden_cards ?? [],
  };
}

const layoutSchema = z.object({
  cardOrder: z.array(z.string().max(40)).max(40),
  hiddenCards: z.array(z.string().max(40)).max(40),
});

export async function saveDashboardLayout(
  cardOrder: string[],
  hiddenCards: string[]
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const parsed = layoutSchema.safeParse({ cardOrder, hiddenCards });
  if (!parsed.success) return { ok: false, error: "Configuración inválida." };

  const { error } = await supabase.from("dashboard_layout").upsert(
    {
      admin_id: user.id,
      card_order: parsed.data.cardOrder,
      hidden_cards: parsed.data.hiddenCards,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "admin_id" }
  );

  if (error) return { ok: false, error: "No se pudo guardar el orden del dashboard." };

  revalidatePath("/");
  return { ok: true };
}
