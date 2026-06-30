import Link from "next/link";
import { ChevronLeft, Plus, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, cn } from "@/lib/utils";

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: products } = await supabase.from("products").select("*").order("name");

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/mas" className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
            <ChevronLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold text-foreground">Productos</h1>
        </div>
        <Link href="/productos/nuevo" className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center">
          <Plus size={20} />
        </Link>
      </header>

      <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
        {(!products || products.length === 0) ? (
          <p className="text-sm text-muted text-center py-10">Aún no tienes productos registrados.</p>
        ) : (
          products.map((p) => {
            const critical = p.stock <= p.critical_stock_threshold;
            const low = !critical && p.stock <= p.low_stock_threshold;
            return (
              <Link key={p.id} href={`/productos/${p.id}/editar`} className="flex items-center gap-3 px-4 py-3 active:bg-background">
                <div className="w-11 h-11 rounded-lg bg-background border border-border shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted">{p.stock} en stock · {p.units_sold} vendidas</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{formatCurrency(Number(p.price))}</p>
                  {(critical || low) && (
                    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold", critical ? "text-danger" : "text-warning")}>
                      <AlertTriangle size={10} /> {critical ? "Crítico" : "Bajo"}
                    </span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
