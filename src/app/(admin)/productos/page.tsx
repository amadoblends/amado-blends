import { createClient } from "@/lib/supabase/server";
import { ProductsManager } from "@/components/productos/products-manager";

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: products } = await supabase.from("products").select("*").order("name");

  return <ProductsManager products={products ?? []} />;
}
