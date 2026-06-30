import { createClient } from "@/lib/supabase/server";
import { ServicesManager } from "@/components/servicios/services-manager";

export default async function ServicesPage() {
  const supabase = await createClient();
  const [{ data: services }, { data: packageItems }] = await Promise.all([
    supabase.from("services").select("*").order("name"),
    supabase.from("service_package_items").select("package_id, item_service_id"),
  ]);

  const itemsByPackage = new Map<string, string[]>();
  for (const row of packageItems ?? []) {
    const list = itemsByPackage.get(row.package_id) ?? [];
    list.push(row.item_service_id);
    itemsByPackage.set(row.package_id, list);
  }

  const mapped = (services ?? []).map((s) => ({
    ...s,
    price: Number(s.price),
    package_item_ids: itemsByPackage.get(s.id) ?? [],
  }));

  return <ServicesManager services={mapped} />;
}
