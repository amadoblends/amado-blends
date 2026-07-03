import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, MessageSquare } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { AppointmentStatusActions } from "@/components/citas/status-actions";
import { RescheduleButton } from "@/components/citas/reschedule-button";
import { LocalLongDate, LocalTimeRange } from "@/components/ui/local-datetime";
import { getAvailability } from "@/lib/data/availability";

export default async function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: appointment },
    { data: requestedProducts },
    { data: guests },
    { data: allServices },
    availability,
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, starts_at, ends_at, status, price, notes, service_id, clients(id, full_name, phone, email, avatar_url, quick_notes), services(name, color)"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("appointment_products")
      .select("id, quantity, products(name, price, image_url)")
      .eq("appointment_id", id),
    supabase
      .from("appointment_guests")
      .select("id, full_name, phone, email, services(name)")
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
    email: string | null;
    avatar_url: string | null;
    quick_notes: string | null;
  };
  const service = appointment.services as unknown as { name: string; color: string };

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-xl font-bold text-foreground">Detalle de la cita</h1>
      </header>

      <div className="bg-surface rounded-2xl border border-border p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={client.full_name} src={client.avatar_url} size={48} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{client.full_name}</p>
            <p className="text-sm text-muted">{client.phone}</p>
            {client.email && <p className="text-xs text-muted truncate">{client.email}</p>}
          </div>
          <StatusBadge status={appointment.status} />
        </div>

        {client.quick_notes && (
          <div className="bg-brand-light rounded-xl px-3 py-2">
            <p className="text-xs text-brand font-medium">📝 {client.quick_notes}</p>
          </div>
        )}

        <div className="flex gap-2">
          <a href={`tel:${client.phone}`} className="flex-1 flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 text-sm font-semibold">
            <Phone size={16} /> Llamar
          </a>
          <a href={`sms:${client.phone}`} className="flex-1 flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 text-sm font-semibold">
            <MessageSquare size={16} /> Mensaje
          </a>
          <Link href={`/clientes/${client.id}`} className="flex-1 flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 text-sm font-semibold">
            Ver perfil
          </Link>
        </div>

        <dl className="space-y-2 pt-2 border-t border-border">
          <Row label="Servicio">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ background: service.color }}
              />
              {service.name}
            </span>
          </Row>
          <Row label="Fecha">
            <LocalLongDate iso={appointment.starts_at} />
          </Row>
          <Row label="Horario">
            <LocalTimeRange startIso={appointment.starts_at} endIso={appointment.ends_at} />
          </Row>
          <Row label="Duración">
            {Math.round(
              (new Date(appointment.ends_at).getTime() -
                new Date(appointment.starts_at).getTime()) /
                60000
            )}{" "}
            minutos
          </Row>
          <Row label="Precio">{formatCurrency(Number(appointment.price))}</Row>
          <Row label="Teléfono">
            <a href={`tel:${client.phone}`} className="text-brand font-semibold">
              {client.phone}
            </a>
          </Row>
          {client.email && (
            <Row label="Correo">
              <a href={`mailto:${client.email}`} className="text-brand font-semibold break-all">
                {client.email}
              </a>
            </Row>
          )}
          {appointment.notes && <Row label="Notas">{appointment.notes}</Row>}
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

      {guests && guests.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
          <p className="font-semibold text-foreground text-sm">👥 Invitados del cliente</p>
          <div className="space-y-2">
            {guests.map((g) => {
              const guestService = g.services as unknown as { name: string } | null;
              return (
                <div key={g.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-foreground font-medium truncate">{g.full_name}</p>
                    <p className="text-xs text-muted truncate">
                      {guestService ? `✂️ ${guestService.name}` : "Sin servicio elegido"}
                      {g.email ? ` · ${g.email}` : ""}
                    </p>
                  </div>
                  <a href={`tel:${g.phone}`} className="text-brand font-semibold shrink-0">
                    {g.phone}
                  </a>
                </div>
              );
            })}
          </div>
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className="text-foreground font-medium text-right">{children}</dd>
    </div>
  );
}
