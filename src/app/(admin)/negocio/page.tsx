import { createClient } from "@/lib/supabase/server";
import { BusinessForm } from "@/components/negocio/business-form";

export default async function NegocioPage() {
  const supabase = await createClient();
  const { data: business } = await supabase
    .from("business_settings")
    .select(
      "name, logo_url, cover_url, description, instagram, address, phone, notify_email"
    )
    .eq("id", 1)
    .maybeSingle();

  return (
    <BusinessForm
      name={business?.name ?? "Amado Blends"}
      logoUrl={business?.logo_url ?? null}
      coverUrl={business?.cover_url ?? null}
      description={business?.description ?? ""}
      instagram={business?.instagram ?? ""}
      address={business?.address ?? ""}
      phone={business?.phone ?? ""}
      notifyEmail={business?.notify_email ?? ""}
    />
  );
}
