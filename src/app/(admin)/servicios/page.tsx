import { createClient } from "@/lib/supabase/server";
import { ServicesManager } from "@/components/servicios/services-manager";

export default async function ServicesPage() {
  const supabase = await createClient();
  const [{ data: services }, { data: packageItems }, { data: products }, { data: serviceProducts }] =
    await Promise.all([
      supabase.from("services").select("*").order("name"),
      supabase.from("service_package_items").select("package_id, item_service_id"),
      supabase
        .from("products")
        .select("id, name, category")
        .eq("available_for_services", true)
        .order("name"),
      supabase.from("service_products").select("service_id, product_id"),
    ]);

  const itemsByPackage = new Map<string, string[]>();
  for (const row of packageItems ?? []) {
    const list = itemsByPackage.get(row.package_id) ?? [];
    list.push(row.item_service_id);
    itemsByPackage.set(row.package_id, list);
  }

  const productsByService = new Map<string, string[]>();
  for (const row of serviceProducts ?? []) {
    const list = productsByService.get(row.service_id) ?? [];
    list.push(row.product_id);
    productsByService.set(row.service_id, list);
  }

  const mapped = (services ?? []).map((s) => ({
    ...s,
    price: Number(s.price),
    package_item_ids: itemsByPackage.get(s.id) ?? [],
    product_ids: productsByService.get(s.id) ?? [],
  }));

  return <ServicesManager services={mapped} products={products ?? []} />;
}
