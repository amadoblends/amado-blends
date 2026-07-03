"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar, Users, Clock, DollarSign, GripVertical, AlertTriangle, Scissors,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { AppointmentsDonut } from "@/components/dashboard/appointments-donut";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { formatCurrency, cn } from "@/lib/utils";
import type { DashboardData } from "@/lib/data/dashboard";

const STORAGE_KEY = "dashboardOrder.v1";

const WIDGET_KEYS = [
  "resumen",
  "proximas",
  "ingresos",
  "stats",
  "grafica",
  "distribucion",
  "productos",
  "alertas",
  "acciones",
] as const;

type WidgetKey = (typeof WIDGET_KEYS)[number];

function fmtBusy(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function DashboardWidgets({ data }: { data: DashboardData }) {
  const [order, setOrder] = useState<WidgetKey[]>([...WIDGET_KEYS]);
  const [dragKey, setDragKey] = useState<WidgetKey | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WidgetKey[];
        const valid = parsed.filter((k) => WIDGET_KEYS.includes(k));
        const missing = WIDGET_KEYS.filter((k) => !valid.includes(k));
        setOrder([...valid, ...missing]);
      }
    } catch {
      // ignore
    }
  }, []);

  function save(next: WidgetKey[]) {
    setOrder(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function handleDragMove(e: React.PointerEvent) {
    if (!dragKey || !containerRef.current) return;
    const sections = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>("[data-widget]")
    );
    let target: WidgetKey | null = null;
    for (const el of sections) {
      const rect = el.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        target = el.dataset.widget as WidgetKey;
        break;
      }
    }
    if (!target || target === dragKey) return;
    const from = order.indexOf(dragKey);
    const to = order.indexOf(target);
    if (from === -1 || to === -1) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, dragKey);
    setOrder(next);
  }

  const completionPct =
    data.todayAppointmentsCount > 0
      ? Math.round((data.todayCompletedCount / data.todayAppointmentsCount) * 100)
      : 0;

  const widgets: Record<WidgetKey, React.ReactNode> = {
    // ── 1. Resumen del día: proyectado vs completado ──
    resumen: (
      <section className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <h2 className="font-bold text-foreground">Resumen del día</h2>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted">Completadas</p>
            <p className="text-2xl font-black text-success">
              {data.todayCompletedCount}
              <span className="text-sm font-semibold text-muted">
                {" "}
                / {data.todayAppointmentsCount} citas
              </span>
            </p>
          </div>
          <p className="text-xs font-bold text-muted">{completionPct}% del día</p>
        </div>
        <div className="h-2.5 rounded-full bg-background overflow-hidden">
          <div
            className="h-full bg-success rounded-full transition-all"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted">
            Proyectado hoy:{" "}
            <span className="font-bold text-foreground">{formatCurrency(data.todayRevenue)}</span>
          </span>
          <span className="text-muted">
            Ya generado:{" "}
            <span className="font-bold text-success">
              {formatCurrency(data.todayCompletedRevenue)}
            </span>
          </span>
        </div>
      </section>
    ),

    // ── 2. Próximas citas ──
    proximas: (
      <section className="bg-surface rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-foreground">Próximas citas</h2>
          <Link href="/citas" className="text-brand text-sm font-semibold">
            Ver agenda →
          </Link>
        </div>
        {data.upcomingAppointments.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">No tienes citas programadas hoy.</p>
        ) : (
          <ul className="space-y-3">
            {data.upcomingAppointments.map((a) => (
              <li key={a.id}>
                <Link href={`/citas/${a.id}`} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-muted w-14 shrink-0">{a.time}</span>
                  <Avatar name={a.clientName} src={a.clientAvatar} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {a.clientName}
                    </p>
                    <p className="text-xs text-muted truncate">{a.serviceName}</p>
                  </div>
                  <StatusBadge
                    status={a.status as "confirmada" | "pendiente" | "completada" | "cancelada"}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    ),

    // ── 3. Ingresos de hoy ──
    ingresos: (
      <section className="bg-surface rounded-2xl border border-border p-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
            <DollarSign size={20} className="text-brand" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted">Ingresos de hoy (completado)</p>
            <p className="text-2xl font-black text-foreground">
              {formatCurrency(data.todayCompletedRevenue)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted">Proyectado</p>
            <p className="text-sm font-bold text-muted">{formatCurrency(data.todayRevenue)}</p>
          </div>
        </div>
      </section>
    ),

    // ── 4. Quick stats: 3 iconos en un solo card ──
    stats: (
      <section className="bg-surface rounded-2xl border border-border p-4">
        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="flex flex-col items-center gap-1.5">
            <Users size={20} className="text-brand" />
            <p className="text-xl font-black text-foreground leading-none">
              {data.activeClientsToday}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Calendar size={20} className="text-brand" />
            <p className="text-xl font-black text-foreground leading-none">
              {data.todayAppointmentsCount}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Clock size={20} className="text-brand" />
            <p className="text-xl font-black text-foreground leading-none">
              {fmtBusy(data.busyMinutesToday)}
            </p>
          </div>
        </div>
      </section>
    ),

    // ── Gráfica semanal ──
    grafica: (
      <section className="bg-surface rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-foreground">Resumen de ingresos</h2>
          <span className="text-xs font-medium text-muted">Esta semana</span>
        </div>
        <p className="text-2xl font-bold text-foreground">
          {formatCurrency(data.weekRevenueTotal)}
        </p>
        <RevenueChart data={data.weekRevenue} />
      </section>
    ),

    // ── Distribución ──
    distribucion: (
      <section className="bg-surface rounded-2xl border border-border p-4">
        <h2 className="font-bold text-foreground mb-2">Distribución de citas</h2>
        <AppointmentsDonut distribution={data.appointmentDistribution} />
        <div className="space-y-2 mt-2">
          <LegendRow
            color="bg-brand"
            label="Confirmadas"
            value={data.appointmentDistribution.confirmada}
            total={data.appointmentDistribution.total}
          />
          <LegendRow
            color="bg-violet"
            label="Pendientes"
            value={data.appointmentDistribution.pendiente}
            total={data.appointmentDistribution.total}
          />
          <LegendRow
            color="bg-info"
            label="Completadas"
            value={data.appointmentDistribution.completada}
            total={data.appointmentDistribution.total}
          />
        </div>
      </section>
    ),

    // ── Productos ──
    productos: (
      <section className="bg-surface rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-foreground">Productos</h2>
          <Link href="/productos" className="text-brand text-sm font-semibold">
            Ver todos
          </Link>
        </div>
        {data.topProducts.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">Aún no tienes productos.</p>
        ) : (
          <ul className="space-y-3">
            {data.topProducts.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className="text-sm font-bold text-muted w-4">{i + 1}</span>
                <div className="w-10 h-10 rounded-lg bg-background border border-border shrink-0 relative overflow-hidden">
                  {p.imageUrl && <Image src={p.imageUrl} alt="" fill className="object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted">{p.unitsSold} unidades</p>
                </div>
                <span className="text-sm font-bold text-foreground">
                  {formatCurrency(p.price)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    ),

    // ── Alertas de inventario ──
    alertas: (
      <section className="bg-surface rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-foreground">Alertas de inventario</h2>
          <Link href="/productos" className="text-brand text-sm font-semibold">
            Ver todas
          </Link>
        </div>
        {data.inventoryAlerts.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">Tu inventario está saludable.</p>
        ) : (
          <ul className="space-y-2">
            {data.inventoryAlerts.map((p) => (
              <li
                key={p.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl p-3",
                  p.level === "critico" ? "bg-danger-light" : "bg-warning-light"
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-white shrink-0 relative overflow-hidden">
                  {p.imageUrl && <Image src={p.imageUrl} alt="" fill className="object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      p.level === "critico" ? "text-danger" : "text-warning"
                    )}
                  >
                    {p.level === "critico" ? "Stock crítico" : "Stock bajo"} · Quedan {p.stock}
                  </p>
                </div>
                <AlertTriangle
                  size={18}
                  className={p.level === "critico" ? "text-danger" : "text-warning"}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    ),

    // ── Acciones rápidas ──
    acciones: (
      <section className="bg-surface rounded-2xl border border-border p-4">
        <h2 className="font-bold text-foreground mb-3">Acciones rápidas</h2>
        <div className="grid grid-cols-4 gap-2">
          <QuickAction href="/citas" label="Nueva cita" icon={Calendar} />
          <QuickAction href="/clientes/nuevo" label="Nuevo cliente" icon={Users} />
          <QuickAction href="/servicios" label="Servicios" icon={Scissors} />
          <QuickAction href="/productos" label="Productos" icon={DollarSign} />
        </div>
      </section>
    ),
  };

  return (
    <div
      ref={containerRef}
      className="space-y-4"
      onPointerMove={handleDragMove}
      onPointerUp={() => {
        if (dragKey) {
          save(order);
          setDragKey(null);
        }
      }}
    >
      <RealtimeRefresher tables={["appointments", "products"]} />
      {order.map((key) => (
        <div
          key={key}
          data-widget={key}
          className={cn(
            "relative transition-opacity",
            dragKey === key && "opacity-60 scale-[0.99]"
          )}
        >
          {/* Drag handle — hold and move to reorder */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              setDragKey(key);
            }}
            className="absolute top-3 right-3 z-10 w-7 h-7 rounded-lg flex items-center justify-center text-muted/40 active:text-brand touch-none cursor-grab active:cursor-grabbing"
            aria-label="Mover widget"
          >
            <GripVertical size={15} />
          </button>
          {widgets[key]}
        </div>
      ))}
      <p className="text-[10px] text-muted/60 text-center">
        Arrastra el icono ⋮⋮ de cada tarjeta para reordenar tu dashboard
      </p>
    </div>
  );
}

function LegendRow({
  color,
  label,
  value,
  total,
}: {
  color: string;
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={cn("w-2.5 h-2.5 rounded-full", color)} />
      <span className="flex-1 text-foreground">{label}</span>
      <span className="text-muted">
        {value} ({pct}%)
      </span>
    </div>
  );
}

function QuickAction({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5">
      <div className="w-12 h-12 rounded-2xl bg-brand-light flex items-center justify-center">
        <Icon size={20} className="text-brand" />
      </div>
      <span className="text-[11px] text-center text-foreground font-medium leading-tight">
        {label}
      </span>
    </Link>
  );
}
