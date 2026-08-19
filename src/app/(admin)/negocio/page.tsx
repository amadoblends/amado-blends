import { createClient } from "@/lib/supabase/server";
import { BusinessForm } from "@/components/negocio/business-form";
import { BirthdaySettingsCard } from "@/components/negocio/birthday-settings";
import { getBirthdaySettings } from "@/lib/actions/birthday";

export default async function NegocioPage() {
  const supabase = await createClient();

  const [{ data: business }, birthday, { data: services }] = await Promise.all([
    supabase
      .from("business_settings")
      .select("name, logo_url, cover_url, description, instagram, address, phone, notify_email")
      .eq("id", 1)
      .maybeSingle(),
    getBirthdaySettings(),
    supabase.from("services").select("id, name, price").eq("active", true).order("name"),
  ]);

  return (
    <>
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

      <div className="px-4 pb-8">
        <BirthdaySettingsCard
          initial={birthday}
          services={(services ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            price: Number(s.price),
          }))}
        />
      </div>
    </>
  );
}
