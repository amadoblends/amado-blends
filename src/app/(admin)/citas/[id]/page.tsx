import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Phone, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { AppointmentStatusActions } from "@/components/citas/status-actions";
import { RescheduleButton } from "@/components/citas/reschedule-button";
import { getAvailability } from "@/lib/data/availability";

export default async function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: appointment }, { data: requestedProducts }, { data: allServices }, availability] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(
          "id, starts_at, ends_at, status, price, notes, service_id, clients(id, full_name, phone, avatar_url), services(name, color)"
        )
        .eq("id", id)
        .single(),
      supabase
        .from("appointment_products")
        .select("id, quantity, products(name, price, image_url)")
        .eq("appointment_id", id),
      supabase
        .from("services")
        .select("id, name, duration_minutes, price, color")
        .order("name"),
      getAvailability(),
    ]);

  if (!appointment) notFound();

  const client = appointment.clients as unknown as {
    id: string;
    full_name: string;
    phone: string;
    avatar_url: string | null;
  };
  const service = appointment.services as unknown as { name: string; color: string };

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <Link href="/citas" className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Detalle de la cita</h1>
      </header>

      <div className="bg-surface rounded-2xl border border-border p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={client.full_name} src={client.avatar_url} size={48} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{client.full_name}</p>
            <p className="text-sm text-muted">{client.phone}</p>
          </div>
          <StatusBadge status={appointment.status} />
        </div>

        <div className="flex gap-2">
          <a href={`tel:${client.phone}`} className="flex-1 flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 text-sm font-semibold">
            <Phone size={16} /> Llamar
          </a>
          <Link href={`/clientes/${client.id}`} className="flex-1 flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 text-sm font-semibold">
            <MessageSquare size={16} /> Ver cliente
          </Link>
        </div>

        <dl className="space-y-2 pt-2 border-t border-border">
          <Row label="Servicio" value={service.name} />
          <Row label="Fecha" value={format(new Date(appointment.starts_at), "EEEE, d 'de' MMMM", { locale: es })} />
          <Row
            label="Horario"
            value={`${format(new Date(appointment.starts_at), "h:mm a")} – ${format(new Date(appointment.ends_at), "h:mm a")}`}
          />
          <Row label="Precio" value={formatCurrency(Number(appointment.price))} />
          {appointment.notes && <Row label="Notas" value={appointment.notes} />}
        </dl>
      </div>

      {requestedProducts && requestedProducts.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
          <p className="font-semibold text-foreground text-sm">
            🛍️ Productos solicitados por el cliente
          </p>
          <div className="space-y-2">
            {requestedProducts.map((rp) => {
              const product = rp.products as unknown as {
                name: string;
                price: number;
                image_url: string | null;
              };
              return (
                <div key={rp.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-foreground font-medium">
                    {rp.quantity}× {product.name}
                  </span>
                  <span className="text-muted">
                    {formatCurrency(Number(product.price) * rp.quantity)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted pt-2 border-t border-border">
            Prepara estos productos antes de la llegada del cliente. Se pagan en el local.
          </p>
        </div>
      )}

      {appointment.status !== "cancelada" && appointment.status !== "completada" && (
        <RescheduleButton
          appointmentId={appointment.id}
          currentServiceId={appointment.service_id}
          currentStartsAt={appointment.starts_at}
          currentEndsAt={appointment.ends_at}
          services={allServices ?? []}
          availability={availability}
        />
      )}

      <AppointmentStatusActions appointmentId={appointment.id} currentStatus={appointment.status} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-foreground font-medium text-right">{value}</dd>
    </div>
  );
}
