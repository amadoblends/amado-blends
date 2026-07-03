import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, MessageSquare, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { ClientTabs } from "@/components/clientes/client-tabs";

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: appointments }, { data: notes }] = await Promise.all([
    supabase.from("clients").select("id, full_name, phone, email, avatar_url, segment").eq("id", id).single(),
    supabase
      .from("appointments")
      .select("id, starts_at, ends_at, status, price, services(name)")
      .eq("client_id", id)
      .order("starts_at", { ascending: false }),
    supabase.from("client_notes").select("id, type, content, created_at").eq("client_id", id).order("created_at", { ascending: false }),
  ]);

  if (!client) notFound();

  const mappedAppointments = (appointments ?? []).map((a) => ({
    id: a.id,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    status: a.status,
    price: Number(a.price),
    service_name: (a.services as unknown as { name: string })?.name ?? "",
  }));

  const totalSpent = mappedAppointments
    .filter((a) => a.status === "completada")
    .reduce((s, a) => s + a.price, 0);

  const serviceCounts = new Map<string, number>();
  for (const a of mappedAppointments) {
    if (a.status !== "completada") continue;
    serviceCounts.set(a.service_name, (serviceCounts.get(a.service_name) ?? 0) + 1);
  }
  const favoriteServices = Array.from(serviceCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center justify-between">
        <BackButton />
        <Link href={`/clientes/${id}/editar`} className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
          <Pencil size={18} />
        </Link>
      </header>

      <div className="flex flex-col items-center text-center gap-2">
        <Avatar name={client.full_name} src={client.avatar_url} size={72} />
        <div>
          <div className="flex items-center justify-center gap-1.5">
            <h1 className="text-lg font-bold text-foreground">{client.full_name}</h1>
            {client.segment === "frecuente" && <Badge>Frecuente</Badge>}
          </div>
          <p className="text-sm text-muted">{client.phone}</p>
          {client.email && <p className="text-sm text-muted">{client.email}</p>}
        </div>
        <div className="flex gap-2 w-full mt-2">
          <a href={`tel:${client.phone}`} className="flex-1 flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 text-sm font-semibold">
            <Phone size={16} /> Llamar
          </a>
          <a href={`sms:${client.phone}`} className="flex-1 flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 text-sm font-semibold">
            <MessageSquare size={16} /> Mensaje
          </a>
        </div>
      </div>

      <ClientTabs
        clientId={client.id}
        appointments={mappedAppointments}
        notes={notes ?? []}
        totalSpent={totalSpent}
        favoriteServices={favoriteServices}
      />
    </div>
  );
}
