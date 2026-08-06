"use client";

import { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  X, Phone, Check, UserX, CalendarClock, Ban, ChevronRight,
  Clock, Timer, Scissors, DollarSign, ShoppingBag, StickyNote, Loader2,
  UserPlus, CalendarDays, Wallet, User,
} from "lucide-react";
import { createPortal } from "react-dom";
import { cn, formatCurrency } from "@/lib/utils";
import { relationshipLabel } from "@/lib/guests";
import { updateAppointmentStatus } from "@/lib/actions/appointments";
import { createClient } from "@/lib/supabase/client";
import type { AppointmentRow } from "@/lib/data/appointments";

interface Extra {
  serviceProducts: { name: string; category: string | null }[];
  buyProducts: { name: string; quantity: number }[];
  guests: { full_name: string }[];
  phone: string;
  email: string | null;
  notes: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  confirmada: "Cita confirmada",
  pendiente: "Cita pendiente",
  completada: "Cita completada",
  cancelada: "Cita cancelada",
  no_show: "No asistió",
};

const STATUS_COLOR: Record<string, string> = {
  confirmada: "var(--color-brand)",
  pendiente: "var(--color-warning)",
  completada: "var(--color-success)",
  cancelada: "var(--color-danger)",
  no_show: "var(--color-danger)",
};

/**
 * Floating detail card: photo and status up top, the facts in a single quiet
 * list, and the four actions the barber actually needs along the bottom.
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

  // Lock the page behind the card
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
        .select("full_name")
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
        guests: (guests.data ?? []).map((g) => ({ full_name: g.full_name })),
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
  const canCall = Boolean(extra?.phone) && !isWalkIn;

  const accent = STATUS_COLOR[a.status] ?? "var(--color-brand)";

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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{
        paddingTop: "max(1rem, var(--safe-top))",
        paddingBottom: "max(1rem, var(--safe-bottom))",
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div
        className={cn(
          "relative w-full max-w-[400px] bg-surface rounded-[28px]",
          "max-h-full flex flex-col overflow-hidden animate-sheet-in",
          "shadow-[0_24px_70px_-12px_rgba(0,0,0,0.65)] ring-1 ring-border"
        )}
      >
        {/* A whisper of the status colour along the top edge */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-24 pointer-events-none"
          style={{ background: `linear-gradient(to bottom, ${accent}1a, transparent)` }}
        />

        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-background/80 border border-border backdrop-blur flex items-center justify-center active:scale-95 transition-transform"
        >
          <X size={16} strokeWidth={2.4} />
        </button>

        <div className="overflow-y-auto px-5 pt-6 pb-5 space-y-4">
          {/* ── Identity ─────────────────────────────────────────────── */}
          <div className="relative flex items-center gap-4 pr-10">
            <div
              className="w-[74px] h-[74px] rounded-full shrink-0 relative flex items-center justify-center overflow-hidden"
              style={{ boxShadow: `0 0 0 2.5px ${accent}, 0 0 0 5px var(--surface)` }}
            >
              {photo ? (
                <Image src={photo} alt="" fill sizes="74px" className="object-cover" />
              ) : (
                <span
                  className="w-full h-full flex items-center justify-center text-2xl font-black"
                  style={{ background: `color-mix(in srgb, ${accent} 18%, var(--background))`, color: accent }}
                >
                  {initials}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p
                className="text-[11px] font-bold flex items-center gap-1.5 mb-0.5"
                style={{ color: accent }}
              >
                <span
                  className="w-[7px] h-[7px] rounded-full shrink-0"
                  style={{ background: accent }}
                />
                {STATUS_LABEL[a.status] ?? a.status}
              </p>

              <h2 className="text-[22px] font-extrabold text-foreground leading-tight truncate">
                {displayName}
              </h2>

              <p className="text-sm text-muted truncate leading-tight">{a.service.name}</p>

              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-background border border-border text-[11px] font-bold text-foreground">
                  <Timer size={12} className="text-muted" />
                  <span className="tnum">{durationMins} minutos</span>
                </span>
                <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-background border border-border text-[11px] font-bold text-muted">
                  <User size={11} />
                  {isGuest ? "Invitado" : isWalkIn ? "Walk-in" : "Reservada"}
                </span>
              </div>

              {isGuest && (
                <p className="text-[11px] text-muted mt-1.5 flex items-center gap-1">
                  <UserPlus size={11} />
                  {relationshipLabel(a.guest_relationship)} de {a.client.full_name}
                </p>
              )}
            </div>
          </div>

          {/* ── The facts ────────────────────────────────────────────── */}
          <div className="bg-background rounded-2xl border border-border divide-y divide-border">
            <Row icon={<CalendarDays size={16} />} label="Fecha">
              <span className="capitalize">
                {format(start, "EEEE, d 'de' MMMM yyyy", { locale: es })}
              </span>
            </Row>
            <Row icon={<Clock size={16} />} label="Hora">
              <span className="tnum">
                {format(start, "h:mm a")} – {format(end, "h:mm a")}
              </span>
            </Row>
            <Row icon={<Timer size={16} />} label="Duración">
              <span className="tnum">{durationMins} minutos</span>
            </Row>
            <Row icon={<Scissors size={16} />} label="Servicio">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full inline-block shrink-0"
                  style={{ background: a.service.color }}
                />
                {a.service.name}
              </span>
            </Row>

            {extra && extra.serviceProducts.length > 0 && (
              <Row icon={<Scissors size={16} />} label="Productos">
                {extra.serviceProducts.map((p) => p.name).join(", ")}
              </Row>
            )}

            {extra && extra.buyProducts.length > 0 && (
              <Row icon={<ShoppingBag size={16} />} label="Se lleva">
                {extra.buyProducts.map((p) => `${p.quantity}× ${p.name}`).join(", ")}
              </Row>
            )}

            {extra && extra.guests.length > 0 && (
              <Row icon={<UserPlus size={16} />} label="Invitados">
                {extra.guests.map((g) => g.full_name).join(", ")}
              </Row>
            )}

            <Row icon={<DollarSign size={16} />} label="Precio">
              <span className="tnum">{formatCurrency(a.price)}</span>
            </Row>
            <Row icon={<Wallet size={16} />} label="Pago">
              En el local
            </Row>

            {extra?.notes && (
              <Row icon={<StickyNote size={16} />} label="Notas" wrap>
                {extra.notes}
              </Row>
            )}

            {canCall && (
              <Row icon={<Phone size={16} />} label="Teléfono">
                <a href={`tel:${extra!.phone}`} className="tnum">
                  {extra!.phone}
                </a>
              </Row>
            )}
          </div>

          {loadingExtra && (
            <div className="flex items-center justify-center py-1">
              <Loader2 size={15} className="animate-spin text-muted" />
            </div>
          )}

          {/* ── Actions ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-2">
            <ActionTile
              onClick={() => {
                onClose();
                onReschedule?.(a);
              }}
              disabled={isPending}
              icon={<CalendarClock size={19} />}
              label="Reprogramar"
            />
            <ActionTile
              onClick={() => setStatus("no_show")}
              disabled={isPending || a.status === "no_show"}
              icon={<UserX size={19} />}
              label="No-show"
              tone="danger"
            />
            {canCall ? (
              <ActionTile
                href={`tel:${extra!.phone}`}
                icon={<Phone size={19} />}
                label="Llamar"
              />
            ) : (
              <ActionTile disabled icon={<Phone size={19} />} label="Llamar" />
            )}
            <ActionTile
              onClick={() => {
                if (confirm("¿Cancelar esta cita?")) setStatus("cancelada");
              }}
              disabled={isPending || a.status === "cancelada"}
              icon={<Ban size={19} />}
              label="Cancelar"
              tone="danger"
            />
          </div>

          {/* Completing is the happy path, so it gets its own wide button */}
          <button
            onClick={() => setStatus("completada")}
            disabled={isPending || a.status === "completada"}
            className="w-full h-12 rounded-2xl bg-success-light border border-success/30 text-success text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={17} strokeWidth={2.8} />}
            Marcar como completada
          </button>

          {/* Full profile is one deliberate tap away */}
          <Link
            href={`/clientes/${a.client.id}`}
            className="flex items-center justify-center gap-1 text-[13px] font-semibold text-muted py-0.5"
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
  wrap,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  wrap?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-3.5 py-3">
      <span className="text-muted shrink-0 mt-px">{icon}</span>
      <span className="text-[13px] text-muted w-[74px] shrink-0">{label}</span>
      <span
        className={cn(
          "text-[13px] font-semibold text-foreground text-right flex-1 min-w-0",
          wrap ? "break-words" : "truncate"
        )}
      >
        {children}
      </span>
    </div>
  );
}

function ActionTile({
  onClick,
  href,
  disabled,
  icon,
  label,
  tone,
}: {
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  tone?: "danger";
}) {
  const classes = cn(
    "h-[72px] rounded-2xl bg-background border border-border flex flex-col items-center justify-center gap-1.5",
    "active:scale-95 transition-transform",
    tone === "danger" ? "text-danger" : "text-foreground",
    disabled && "opacity-35 pointer-events-none"
  );

  const content = (
    <>
      {icon}
      <span className="text-[10px] font-bold leading-none text-center px-0.5">{label}</span>
    </>
  );

  if (href && !disabled) {
    return (
      <a href={href} className={classes}>
        {content}
      </a>
    );
  }

  return (
    <button onClick={onClick} disabled={disabled} className={classes}>
      {content}
    </button>
  );
}
