import Link from "next/link";
import { Plus, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ClientSearch } from "@/components/clientes/client-search";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const filterToSegment: Record<string, string | null> = {
  todos: null,
  frecuentes: "frecuente",
  nuevos: "nuevo",
  inactivos: "inactivo",
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const filter = params.filter ?? "todos";

  let query = supabase
    .from("clients")
    .select("id, full_name, phone, avatar_url, segment, created_at")
    .order("full_name");

  if (params.q) {
    query = query.ilike("full_name", `%${params.q}%`);
  }
  const segment = filterToSegment[filter];
  if (segment) {
    query = query.eq("segment", segment);
  }

  const { data: clients } = await query;

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Clientes</h1>
        <div className="flex items-center gap-2">
          <Link href="/notificaciones" className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
            <Bell size={18} />
          </Link>
          <Link href="/clientes/nuevo" className="w-10 h-10 rounded-full bg-violet text-white flex items-center justify-center">
            <Plus size={20} />
          </Link>
        </div>
      </header>

      <ClientSearch defaultValue={params.q ?? ""} activeFilter={filter} />

      <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
        {(!clients || clients.length === 0) ? (
          <p className="text-sm text-muted text-center py-10">No se encontraron clientes.</p>
        ) : (
          clients.map((c) => (
            <Link key={c.id} href={`/clientes/${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-background">
              <Avatar name={c.full_name} src={c.avatar_url} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-foreground truncate">{c.full_name}</p>
                  {c.segment === "frecuente" && <Badge>Frecuente</Badge>}
                </div>
                <p className="text-xs text-muted">{c.phone}</p>
                <p className="text-[11px] text-muted">
                  Última visita: {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: es })}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
