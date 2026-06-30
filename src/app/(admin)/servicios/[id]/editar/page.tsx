import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ServiceForm } from "@/components/servicios/service-form";

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: service } = await supabase.from("services").select("*").eq("id", id).single();

  if (!service) notFound();

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <Link href="/servicios" className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold text-foreground">Editar servicio</h1>
      </header>
      <ServiceForm
        serviceId={service.id}
        defaults={{
          name: service.name,
          durationMinutes: service.duration_minutes,
          price: Number(service.price),
          color: service.color,
        }}
      />
    </div>
  );
}
