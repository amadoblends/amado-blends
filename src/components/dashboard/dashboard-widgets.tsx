"use client";

import dynamic from "next/dynamic";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar, Users, Clock, DollarSign, GripVertical, AlertTriangle, Scissors,
  Eye, EyeOff, Check, RotateCcw,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
/*
 * Recharts is around 200KB, and it sits on the dashboard — the screen the
 * barber lands on. Loading it with the route meant the numbers, today's
 * appointments and the whole page waited on a charting library to arrive
 * before anything could paint.
 *
 * Split out, the dashboard renders immediately and the two charts fade in a
 * moment later behind a placeholder of their own height, so nothing jumps.
 */
const RevenueChart = dynamic(
  () => import("@/components/dashboard/revenue-chart").then((m) => m.RevenueChart),
  { loading: () => <ChartSkeleton height={180} /> }
);
const AppointmentsDonut = dynamic(
  () => import("@/components/dashboard/appointments-donut").then((m) => m.AppointmentsDonut),
  { loading: () => <ChartSkeleton height={160} /> }
);

/** Holds the chart's exact space so the layout doesn't shift when it lands. */
function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      aria-hidden
      className="w-full rounded-xl bg-background animate-pulse"
      style={{ height }}
    />
  );
}
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { saveDashboardLayout } from "@/lib/actions/dashboard";
import { formatCurrency, cn } from "@/lib/utils";
import type { DashboardData } from "@/lib/data/dashboard";

const WIDGETS = [
  { key: "resumen", label: "Resumen del día" },
  { key: "proximas", label: "Próximas citas" },
  { key: "ingresos", label: "Ingresos de hoy" },
  { key: "stats", label: "Estadísticas rápidas" },
  { key: "grafica", label: "Gráfica de ingresos" },
  { key: "distribucion", label: "Distribución de citas" },
  { key: "productos", label: "Productos" },
  { key: "alertas", label: "Alertas de inventario" },
  { key: "acciones", label: "Acciones rápidas" },
] as const;

type WidgetKey = (typeof WIDGETS)[number]["key"];
const ALL_KEYS = WIDGETS.map((w) => w.key) as WidgetKey[];

function fmtBusy(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function DashboardWidgets({
  data,
  initialOrder,
  initialHidden,
  editing,
  onEditingChange,
}: {
  data: DashboardData;
  initialOrder: string[];
  initialHidden: string[];
  editing: boolean;
  onEditingChange: (v: boolean) => void;
}) {
  // Saved order first, then any widget added since the layout was stored
  const [order, setOrder] = useState<WidgetKey[]>(() => {
    const valid = initialOrder.filter((k): k is WidgetKey => ALL_KEYS.includes(k as WidgetKey));
    return [...valid, ...ALL_KEYS.filter((k) => !valid.includes(k))];
  });
  const [hidden, setHidden] = useState<Set<WidgetKey>>(
    () => new Set(initialHidden.filter((k): k is WidgetKey => ALL_KEYS.includes(k as WidgetKey)))
  );
  const [dragKey, setDragKey] = useState<WidgetKey | null>(null);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist whenever the layout settles (not on every drag frame)
  const persist = (nextOrder: WidgetKey[], nextHidden: Set<WidgetKey>) => {
    startTransition(async () => {
      await saveDashboardLayout(nextOrder, [...nextHidden]);
    });
  };

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

  function toggleHidden(key: WidgetKey) {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setHidden(next);
    persist(order, next);
  }

  function resetLayout() {
    setOrder(ALL_KEYS);
    setHidden(new Set());
    persist(ALL_KEYS, new Set());
  }

  const completionPct =
    data.todayAppointmentsCount > 0
      ? Math.round((data.todayCompletedCount / data.todayAppointmentsCount) * 100)
      : 0;

  const widgets: Record<WidgetKey, React.ReactNode> = {
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
                  <Avatar name={a.clientName} src={a.clientAvatar} size={40} />
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

  const visible = order.filter((k) => !hidden.has(k));
  const hiddenList = order.filter((k) => hidden.has(k));

  return (
    <div
      ref={containerRef}
      className="space-y-4"
      onPointerMove={handleDragMove}
      onPointerUp={() => {
        if (dragKey) {
          persist(order, hidden);
          setDragKey(null);
        }
      }}
    >
      <RealtimeRefresher tables={["appointments", "products"]} />

      {editing && (
        <div className="bg-brand-light rounded-2xl border border-brand/25 p-3 flex items-center gap-2">
          <p className="text-xs text-brand flex-1">
            Arrastra ⋮⋮ para reordenar y usa el ojo para ocultar tarjetas.
            {isPending && " Guardando..."}
          </p>
          <button
            onClick={resetLayout}
            className="flex items-center gap-1 text-[11px] font-semibold text-brand px-2 py-1 rounded-lg border border-brand/30"
          >
            <RotateCcw size={11} /> Restablecer
          </button>
          <button
            onClick={() => onEditingChange(false)}
            className="flex items-center gap-1 text-[11px] font-bold text-white bg-brand px-3 py-1.5 rounded-lg"
          >
            <Check size={12} /> Listo
          </button>
        </div>
      )}

      {visible.map((key) => (
        <div
          key={key}
          data-widget={key}
          className={cn(
            "relative transition-opacity",
            dragKey === key && "opacity-60 scale-[0.99]"
          )}
        >
          {editing && (
            <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1">
              <button
                onClick={() => toggleHidden(key)}
                aria-label="Ocultar widget"
                title="Ocultar"
                className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center text-muted active:text-danger"
              >
                <EyeOff size={14} />
              </button>
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  setDragKey(key);
                }}
                aria-label="Mover widget"
                title="Arrastrar para reordenar"
                className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center text-muted touch-none cursor-grab active:cursor-grabbing active:text-brand"
              >
                <GripVertical size={14} />
              </button>
            </div>
          )}
          {widgets[key]}
        </div>
      ))}

      {/* Hidden widgets can be brought back from here */}
      {editing && hiddenList.length > 0 && (
        <div className="bg-surface rounded-2xl border border-dashed border-border p-4 space-y-2">
          <p className="text-xs font-bold text-muted uppercase tracking-wide">
            Widgets ocultos ({hiddenList.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {hiddenList.map((key) => (
              <button
                key={key}
                onClick={() => toggleHidden(key)}
                className="flex items-center gap-1.5 px-3 h-9 rounded-xl border border-border bg-background text-xs font-semibold text-foreground active:border-brand"
              >
                <Eye size={12} className="text-brand" />
                {WIDGETS.find((w) => w.key === key)?.label}
              </button>
            ))}
          </div>
        </div>
      )}
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
