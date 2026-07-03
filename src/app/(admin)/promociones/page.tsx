import { createClient } from "@/lib/supabase/server";
import { PromotionsManager } from "@/components/promociones/promotions-manager";

export default async function PromocionesPage() {
  const supabase = await createClient();
  const [{ data: promotions }, { data: services }] = await Promise.all([
    supabase.from("promotions").select("*").order("created_at", { ascending: false }),
    supabase.from("services").select("id, name").order("name"),
  ]);

  const mapped = (promotions ?? []).map((p) => ({
    ...p,
    start_time: p.start_time ? String(p.start_time).slice(0, 5) : null,
    end_time: p.end_time ? String(p.end_time).slice(0, 5) : null,
  }));

  return <PromotionsManager promotions={mapped} services={services ?? []} />;
}
