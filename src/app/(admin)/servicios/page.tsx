import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export default async function ServicesPage() {
  const supabase = await createClient();
  const { data: services } = await supabase.from("services").select("*").order("name");

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/mas" className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
            <ChevronLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold text-foreground">Servicios</h1>
        </div>
        <Link href="/servicios/nuevo" className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center">
          <Plus size={20} />
        </Link>
      </header>

      <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
        {(!services || services.length === 0) ? (
          <p className="text-sm text-muted text-center py-10">Aún no tienes servicios registrados.</p>
        ) : (
          services.map((s) => (
            <Link key={s.id} href={`/servicios/${s.id}/editar`} className="flex items-center gap-3 px-4 py-3 active:bg-background">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                <p className="text-xs text-muted">{s.duration_minutes} min</p>
              </div>
              <p className="text-sm font-bold text-foreground">{formatCurrency(Number(s.price))}</p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
