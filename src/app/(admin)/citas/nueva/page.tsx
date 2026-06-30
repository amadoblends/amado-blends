import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { NewAppointmentForm } from "@/components/citas/new-appointment-form";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: clients }, { data: services }] = await Promise.all([
    supabase.from("clients").select("id, full_name").order("full_name"),
    supabase.from("services").select("id, name, duration_minutes, price").eq("active", true).order("name"),
  ]);

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <Link href="/citas" className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold text-foreground">Nueva cita</h1>
      </header>

      <NewAppointmentForm
        clients={clients ?? []}
        services={services ?? []}
        defaultDate={params.date ?? format(new Date(), "yyyy-MM-dd")}
      />
    </div>
  );
}
