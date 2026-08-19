import Link from "next/link";
import { Plus, Bell } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ClientSearch } from "@/components/clientes/client-search";
import { BackButton } from "@/components/ui/back-button";
import { getClientsWithSegments, type ClientFilter } from "@/lib/data/clients";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PhotoReminder } from "@/components/clientes/photo-reminder";

const SEGMENT_STYLE: Record<string, string> = {
  frecuentes: "bg-success-light text-success",
  nuevos: "bg-violet-light text-violet",
  inactivos: "bg-warning-light text-warning",
};

const SEGMENT_LABEL: Record<string, string> = {
  frecuentes: "Frecuente",
  nuevos: "Nuevo",
  inactivos: "Inactivo",
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const filter = (["todos", "frecuentes", "nuevos", "inactivos"].includes(params.filter ?? "")
    ? params.filter
    : "todos") as ClientFilter;

  const { clients, counts } = await getClientsWithSegments(filter, params.q);

  // Regulars without a photo: the ones the barber sees often enough for it
  // to be worth the tap.
  const needPhoto = clients
    .filter((c) => !c.avatar_url && c.segment !== "inactivos")
    .slice(0, 12)
    .map((c) => ({ id: c.id, full_name: c.full_name }));

  return (
    <div className="px-4 pt-[max(10px,var(--safe-top))] pb-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton />
          <h1 className="text-xl font-bold text-foreground">Clientes</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/notificaciones"
            className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center"
          >
            <Bell size={18} />
          </Link>
          <Link
            href="/clientes/nuevo"
            className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center"
          >
            <Plus size={20} />
          </Link>
        </div>
      </header>

      <ClientSearch
        defaultValue={params.q ?? ""}
        activeFilter={filter}
        counts={{
          todos: counts.frecuentes + counts.nuevos + counts.inactivos,
          ...counts,
        }}
      />


      <PhotoReminder clients={needPhoto} />

      <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
        {clients.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">
            {filter === "todos"
              ? "No se encontraron clientes."
              : `Ningún cliente en «${SEGMENT_LABEL[filter]}» por ahora.`}
          </p>
        ) : (
          clients.map((c) => (
            <Link
              key={c.id}
              href={`/clientes/${c.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-background"
            >
              <Avatar name={c.full_name} src={c.avatar_url} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-foreground truncate">{c.full_name}</p>
                  {/* No badge for a client who is simply a client — the label
                      only earns its space when it says something. */}
                  {c.segment && (
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                        SEGMENT_STYLE[c.segment]
                      )}
                    >
                      {SEGMENT_LABEL[c.segment]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted">{c.phone}</p>
                <p className="text-[11px] text-muted">
                  {c.lastVisit
                    ? `Última visita ${formatDistanceToNow(new Date(c.lastVisit), {
                        addSuffix: true,
                        locale: es,
                      })}`
                    : "Sin visitas registradas"}
                  {c.visits > 0 && ` · ${c.visits} en 90 días`}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
