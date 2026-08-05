import { createClient } from "@/lib/supabase/server";
import { BusinessForm } from "@/components/negocio/business-form";

export default async function NegocioPage() {
  const supabase = await createClient();
  const { data: business } = await supabase
    .from("business_settings")
    .select("name, logo_url, address, phone")
    .eq("id", 1)
    .maybeSingle();

  return (
    <BusinessForm
      name={business?.name ?? "Amado Blends"}
      logoUrl={business?.logo_url ?? null}
      address={business?.address ?? ""}
      phone={business?.phone ?? ""}
    />
  );
}
