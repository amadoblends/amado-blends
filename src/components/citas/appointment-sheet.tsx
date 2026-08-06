"use client";

import { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  X, Phone, MessageSquare, Check, UserX, CalendarClock, Ban, ChevronRight,
  Clock, Scissors, DollarSign, ShoppingBag, StickyNote, Loader2, UserPlus,
} from "lucide-react";
import { createPortal } from "react-dom";
import { cn, formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { relationshipLabel } from "@/lib/guests";
import { updateAppointmentStatus } from "@/lib/actions/appointments";
import { createClient } from "@/lib/supabase/client";
import type { AppointmentRow } from "@/lib/data/appointments";

interface Extra {
  serviceProducts: { name: string; category: string | null }[];
  buyProducts: { name: string; quantity: number }[];
  guests: { full_name: string; relationship: string | null }[];
  phone: string;
  email: string | null;
  notes: string | null;
}

/**
 * Bottom sheet with everything about an appointment, so the barber rarely
 * needs to leave the calendar.
 */
export function AppointmentSheet({
  appointment,
  onClose,
  onReschedule,
}: {
  appointment: AppointmentRow | null;
  onClose: () => void;
  onReschedule?: (a: AppointmentRow) => void;
}) {
  const router = useRouter();
  const [extra, setExtra] = useState<Extra | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Lock the page behind the sheet
  useEffect(() => {
    if (!appointment) return;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [appointment, onClose]);

  // Details the calendar query doesn't carry
  useEffect(() => {
    if (!appointment) {
      setExtra(null);
      return;
    }
    let alive = true;
    setLoadingExtra(true);
    const supabase = createClient();

    Promise.all([
      supabase
        .from("appointments")
        .select("notes, clients(phone, email)")
        .eq("id", appointment.id)
        .maybeSingle(),
      supabase
        .from("appointment_service_products")
        .select("products(name, category)")
        .eq("appointment_id", appointment.id),
      supabase
        .from("appointment_products")
        .select("quantity, products(name)")
        .eq("appointment_id", appointment.id),
      supabase
        .from("appointment_guests")
        .select("full_name, service_id")
        .eq("appointment_id", appointment.id),
    ]).then(([apt, svcProds, buyProds, guests]) => {
      if (!alive) return;
      const client = apt.data?.clients as unknown as {
        phone: string;
        email: string | null;
      } | null;

      setExtra({
        notes: apt.data?.notes ?? null,
        phone: client?.phone ?? "",
        email: client?.email ?? null,
        serviceProducts: (svcProds.data ?? []).map((r) => {
          const p = r.products as unknown as { name: string; category: string | null };
          return { name: p?.name ?? "", category: p?.category ?? null };
        }),
        buyProducts: (buyProds.data ?? []).map((r) => ({
          quantity: r.quantity,
          name: (r.products as unknown as { name: string })?.name ?? "",
        })),
        guests: (guests.data ?? []).map((g) => ({
          full_name: g.full_name,
          relationship: null,
        })),
      });
      setLoadingExtra(false);
    });

    return () => {
      alive = false;
    };
  }, [appointment]);

  if (!appointment || typeof document === "undefined") return null;

  const a = appointment;
  const start = new Date(a.starts_at);
  const end = new Date(a.ends_at);
  const durationMins = Math.round((end.getTime() - start.getTime()) / 60000);
  const isGuest = Boolean(a.guest_name);
  const displayName = a.guest_name ?? a.client.full_name;
  const photo = isGuest ? null : a.client.avatar_url;
  const isWalkIn = extra?.phone === "walk-in";

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  function setStatus(status: string) {
    startTransition(async () => {
      await updateAppointmentStatus(a.id, status);
      router.refresh();
      onClose();
    });
  }

  return createPortal(
    // Floating card, centred on every screen with safe margins around it
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{
        paddingTop: "max(1rem, var(--safe-top))",
        paddingBottom: "max(1rem, var(--safe-bottom))",
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className={cn(
          "relative w-full max-w-[400px] bg-surface rounded-3xl shadow-2xl",
          "max-h-full flex flex-col overflow-hidden animate-sheet-in"
        )}
      >
        <div className="shrink-0 flex items-center justify-end px-3 pt-3">
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-full bg-background flex items-center justify-center"
          >
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 pb-5 space-y-4">
          {/* Client */}
          <div className="flex items-center gap-3.5 pt-1">
            <div
              className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 relative flex items-center justify-center"
              style={{ background: photo ? undefined : `${a.service.color}26` }}
            >
              {photo ? (
                <Image src={photo} alt="" fill sizes="64px" className="object-cover" />
              ) : (
                <span className="text-xl font-black" style={{ color: a.service.color }}>
                  {initials}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-foreground truncate leading-tight">
                {displayName}
              </p>
              {isGuest && (
                <p className="text-xs text-brand font-semibold flex items-center gap-1">
                  <UserPlus size={10} />
                  {relationshipLabel(a.guest_relationship)} de {a.client.full_name}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <StatusBadge status={a.status} />
                <span className="text-[10px] font-semibold text-muted bg-background border border-border px-1.5 py-0.5 rounded-full">
                  {isGuest ? "Invitado" : isWalkIn ? "Walk-in" : "Reservada"}
                </span>
              </div>
            </div>
          </div>

          {/* When and what */}
          <div className="bg-background rounded-2xl border border-border divide-y divide-border">
            <Row icon={<Clock size={15} />} label="Horario">
              {format(start, "h:mm a")} – {format(end, "h:mm a")} · {durationMins} min
            </Row>
            <Row icon={<CalendarClock size={15} />} label="Fecha">
              <span className="capitalize">
                {format(start, "EEEE d 'de' MMMM", { locale: es })}
              </span>
            </Row>
            <Row icon={<Scissors size={15} />} label="Servicio">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full inline-block shrink-0"
                  style={{ background: a.service.color }}
                />
                {a.service.name}
              </span>
            </Row>
            <Row icon={<DollarSign size={15} />} label="Precio">
              {formatCurrency(a.price)} · en el local
            </Row>
          </div>

          {loadingExtra && (
            <div className="flex items-center justify-center py-2">
              <Loader2 size={16} className="animate-spin text-muted" />
            </div>
          )}

          {/* Products requested for the service */}
          {extra && extra.serviceProducts.length > 0 && (
            <Section title="Productos a usar" icon={<Scissors size={13} />}>
              <div className="flex flex-wrap gap-1.5">
                {extra.serviceProducts.map((p, i) => (
                  <span
                    key={i}
                    className="px-2.5 h-7 rounded-full bg-brand-light border border-brand/20 text-[11px] font-semibold text-brand flex items-center"
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Products to hand over */}
          {extra && extra.buyProducts.length > 0 && (
            <Section title="Productos que se lleva" icon={<ShoppingBag size={13} />}>
              <div className="space-y-1">
                {extra.buyProducts.map((p, i) => (
                  <p key={i} className="text-sm text-foreground">
                    {p.quantity}× {p.name}
                  </p>
                ))}
              </div>
            </Section>
          )}

          {/* Guests attached to this appointment */}
          {extra && extra.guests.length > 0 && (
            <Section title="Invitados" icon={<UserPlus size={13} />}>
              <div className="space-y-1">
                {extra.guests.map((g, i) => (
                  <p key={i} className="text-sm text-foreground">
                    {g.full_name}
                  </p>
                ))}
              </div>
            </Section>
          )}

          {extra?.notes && (
            <Section title="Notas" icon={<StickyNote size={13} />}>
              <p className="text-sm text-foreground">{extra.notes}</p>
            </Section>
          )}

          {/* Contact */}
          {extra && extra.phone && extra.phone !== "walk-in" && (
            <div className="flex gap-2">
              <a
                href={`tel:${extra.phone}`}
                className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border border-border bg-background text-sm font-semibold text-foreground"
              >
                <Phone size={15} /> Llamar
              </a>
              <a
                href={`sms:${extra.phone}`}
                className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border border-border bg-background text-sm font-semibold text-foreground"
              >
                <MessageSquare size={15} /> Mensaje
              </a>
            </div>
          )}

          {/* Status actions */}
          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              onClick={() => setStatus("completada")}
              disabled={isPending || a.status === "completada"}
              icon={<Check size={15} />}
              label="Completada"
              tone="success"
            />
            <ActionButton
              onClick={() => setStatus("no_show")}
              disabled={isPending || a.status === "no_show"}
              icon={<UserX size={15} />}
              label="No asistió"
              tone="warning"
            />
            <ActionButton
              onClick={() => {
                onClose();
                onReschedule?.(a);
              }}
              disabled={isPending}
              icon={<CalendarClock size={15} />}
              label="Reagendar"
            />
            <ActionButton
              onClick={() => {
                if (confirm("¿Cancelar esta cita?")) setStatus("cancelada");
              }}
              disabled={isPending || a.status === "cancelada"}
              icon={<Ban size={15} />}
              label="Cancelar"
              tone="danger"
            />
          </div>

          {/* Full profile is one deliberate tap away */}
          <Link
            href={`/clientes/${a.client.id}`}
            className="flex items-center justify-center gap-1.5 text-sm font-semibold text-muted py-1"
          >
            Ver perfil del cliente <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <span className="text-muted shrink-0">{icon}</span>
      <span className="text-xs text-muted w-16 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-foreground text-right flex-1 min-w-0 truncate">
        {children}
      </span>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background rounded-2xl border border-border p-3.5 space-y-2">
      <p className="text-[11px] font-bold text-muted uppercase tracking-wide flex items-center gap-1.5">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  icon,
  label,
  tone,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  tone?: "success" | "danger" | "warning";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-12 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40",
        tone === "success"
          ? "border-success/30 bg-success-light text-success"
          : tone === "danger"
            ? "border-danger/30 bg-danger-light text-danger"
            : tone === "warning"
              ? "border-warning/30 bg-warning-light text-warning"
              : "border-border bg-background text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
