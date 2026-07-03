"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign, Calendar, Users, Scissors, Sparkles, ShoppingBag, Package,
  BadgePercent, XCircle, Download, Printer, TrendingUp, TrendingDown,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { ReportPeriod } from "@/app/(admin)/reportes/page";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReportAppointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price: number;
  clientName: string;
  serviceName: string;
  serviceKind: "servicio" | "combo";
}

interface Props {
  periodo: ReportPeriod;
  desde: string;
  hasta: string;
  rangeStartISO: string;
  rangeEndISO: string;
  prevStartISO: string;
  prevEndISO: string;
  appointments: ReportAppointment[];
  prevAppointments: { starts_at: string; status: string; price: number }[];
  newClients: number;
  prevNewClients: number;
  requestedProducts: { quantity: number; name: string; price: number }[];
  inventory: { name: string; price: number; stock: number; low: boolean }[];
  promotions: { title: string; discount: number; active: boolean }[];
}

const PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: "dia", label: "Hoy" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
  { key: "ano", label: "Año" },
  { key: "rango", label: "Rango" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ReportsView(props: Props) {
  const router = useRouter();
  const [desde, setDesde] = useState(props.desde);
  const [hasta, setHasta] = useState(props.hasta);

  // Keep only appointments inside the exact range (server widened for TZ)
  const inRange = useMemo(() => {
    const s = new Date(props.rangeStartISO).getTime();
    const e = new Date(props.rangeEndISO).getTime();
    return props.appointments.filter((a) => {
      const t = new Date(a.starts_at).getTime();
      return t >= s && t <= e;
    });
  }, [props.appointments, props.rangeStartISO, props.rangeEndISO]);

  const prevInRange = useMemo(() => {
    const s = new Date(props.prevStartISO).getTime();
    const e = new Date(props.prevEndISO).getTime();
    return props.prevAppointments.filter((a) => {
      const t = new Date(a.starts_at).getTime();
      return t >= s && t <= e;
    });
  }, [props.prevAppointments, props.prevStartISO, props.prevEndISO]);

  // ── Aggregations ───────────────────────────────────────────────────────────
  const completed = inRange.filter((a) => a.status === "completada");
  const cancelled = inRange.filter((a) => a.status === "cancelada");
  const active = inRange.filter((a) => a.status !== "cancelada");

  const revenue = completed.reduce((s, a) => s + a.price, 0);
  const prevRevenue = prevInRange
    .filter((a) => a.status === "completada")
    .reduce((s, a) => s + a.price, 0);
  const revChange = pctChange(revenue, prevRevenue);

  const prevActive = prevInRange.filter((a) => a.status !== "cancelada").length;
  const aptChange = pctChange(active.length, prevActive);

  const cancelRate = inRange.length > 0 ? Math.round((cancelled.length / inRange.length) * 100) : 0;

  // Top services / combos by revenue
  const byService = useMemo(() => {
    const map = new Map<string, { kind: string; count: number; revenue: number }>();
    for (const a of completed) {
      const cur = map.get(a.serviceName) ?? { kind: a.serviceKind, count: 0, revenue: 0 };
      cur.count++;
      cur.revenue += a.price;
      map.set(a.serviceName, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  }, [completed]);

  // Top clients by spend
  const byClient = useMemo(() => {
    const map = new Map<string, { count: number; spend: number }>();
    for (const a of completed) {
      const cur = map.get(a.clientName) ?? { count: 0, spend: 0 };
      cur.count++;
      cur.spend += a.price;
      map.set(a.clientName, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].spend - a[1].spend).slice(0, 10);
  }, [completed]);

  // Requested products
  const byProduct = useMemo(() => {
    const map = new Map<string, { units: number; revenue: number }>();
    for (const p of props.requestedProducts) {
      const cur = map.get(p.name) ?? { units: 0, revenue: 0 };
      cur.units += p.quantity;
      cur.revenue += p.price * p.quantity;
      map.set(p.name, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].units - a[1].units);
  }, [props.requestedProducts]);

  const invUnits = props.inventory.reduce((s, p) => s + p.stock, 0);
  const invValue = props.inventory.reduce((s, p) => s + p.stock * p.price, 0);
  const invLow = props.inventory.filter((p) => p.low).length;

  function goPeriod(p: ReportPeriod) {
    if (p === "rango") {
      router.push(`/reportes?periodo=rango&desde=${desde}&hasta=${hasta}`);
    } else {
      router.push(`/reportes?periodo=${p}`);
    }
  }

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="print:hidden space-y-2">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => goPeriod(p.key)}
              className={cn(
                "shrink-0 px-3.5 h-8 rounded-full text-xs font-semibold border transition-colors",
                props.periodo === p.key
                  ? "bg-brand border-brand text-white"
                  : "border-border bg-surface text-muted"
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => window.print()}
            className="shrink-0 px-3.5 h-8 rounded-full text-xs font-semibold border border-border bg-surface text-muted flex items-center gap-1 ml-auto"
          >
            <Printer size={12} /> Imprimir
          </button>
        </div>

        {props.periodo === "rango" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="flex-1 h-10 px-3 rounded-xl border border-border bg-surface text-sm text-foreground"
            />
            <span className="text-xs text-muted">a</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="flex-1 h-10 px-3 rounded-xl border border-border bg-surface text-sm text-foreground"
            />
            <button
              onClick={() => goPeriod("rango")}
              className="h-10 px-4 rounded-xl bg-brand text-white text-sm font-semibold"
            >
              Ver
            </button>
          </div>
        )}
      </div>

      {/* ── Ingresos + comparativa ── */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          icon={<DollarSign size={16} className="text-brand" />}
          label="Ingresos (completadas)"
          value={formatCurrency(revenue)}
          change={revChange}
        />
        <SummaryCard
          icon={<Calendar size={16} className="text-brand" />}
          label="Citas activas"
          value={String(active.length)}
          change={aptChange}
        />
        <SummaryCard
          icon={<XCircle size={16} className="text-danger" />}
          label="Cancelaciones"
          value={`${cancelled.length} (${cancelRate}%)`}
        />
        <SummaryCard
          icon={<Users size={16} className="text-success" />}
          label="Clientes nuevos"
          value={String(props.newClients)}
          change={pctChange(props.newClients, props.prevNewClients)}
        />
      </div>

      {/* ── Servicios y combos ── */}
      <ReportTable
        title="Servicios y combos"
        icon={<Scissors size={15} className="text-brand" />}
        onExport={() =>
          downloadCSV(
            "reporte-servicios.csv",
            ["Servicio", "Tipo", "Citas", "Ingresos"],
            byService.map(([name, s]) => [name, s.kind, s.count, s.revenue.toFixed(2)])
          )
        }
        empty={byService.length === 0}
        emptyText="Sin citas completadas en este período."
      >
        {byService.map(([name, s]) => (
          <div key={name} className="flex items-center gap-2 py-2 text-sm">
            {s.kind === "combo" ? (
              <Sparkles size={13} className="text-brand shrink-0" />
            ) : (
              <Scissors size={13} className="text-muted shrink-0" />
            )}
            <span className="flex-1 text-foreground font-medium truncate">{name}</span>
            <span className="text-muted text-xs">{s.count} citas</span>
            <span className="font-bold text-foreground w-20 text-right">
              {formatCurrency(s.revenue)}
            </span>
          </div>
        ))}
      </ReportTable>

      {/* ── Top clientes ── */}
      <ReportTable
        title="Top clientes"
        icon={<Users size={15} className="text-brand" />}
        onExport={() =>
          downloadCSV(
            "reporte-clientes.csv",
            ["Cliente", "Citas", "Gasto"],
            byClient.map(([name, c]) => [name, c.count, c.spend.toFixed(2)])
          )
        }
        empty={byClient.length === 0}
        emptyText="Sin datos de clientes en este período."
      >
        {byClient.map(([name, c], i) => (
          <div key={name} className="flex items-center gap-2 py-2 text-sm">
            <span className="text-xs font-bold text-muted w-4">{i + 1}</span>
            <span className="flex-1 text-foreground font-medium truncate">{name}</span>
            <span className="text-muted text-xs">{c.count} citas</span>
            <span className="font-bold text-foreground w-20 text-right">
              {formatCurrency(c.spend)}
            </span>
          </div>
        ))}
      </ReportTable>

      {/* ── Productos solicitados ── */}
      <ReportTable
        title="Productos solicitados en citas"
        icon={<ShoppingBag size={15} className="text-brand" />}
        onExport={() =>
          downloadCSV(
            "reporte-productos.csv",
            ["Producto", "Unidades", "Ingresos"],
            byProduct.map(([name, p]) => [name, p.units, p.revenue.toFixed(2)])
          )
        }
        empty={byProduct.length === 0}
        emptyText="Ningún producto solicitado en este período."
      >
        {byProduct.map(([name, p]) => (
          <div key={name} className="flex items-center gap-2 py-2 text-sm">
            <span className="flex-1 text-foreground font-medium truncate">{name}</span>
            <span className="text-muted text-xs">{p.units} uds</span>
            <span className="font-bold text-foreground w-20 text-right">
              {formatCurrency(p.revenue)}
            </span>
          </div>
        ))}
      </ReportTable>

      {/* ── Inventario ── */}
      <ReportTable
        title="Inventario"
        icon={<Package size={15} className="text-brand" />}
        onExport={() =>
          downloadCSV(
            "reporte-inventario.csv",
            ["Producto", "Stock", "Precio", "Valor"],
            props.inventory.map((p) => [p.name, p.stock, p.price.toFixed(2), (p.stock * p.price).toFixed(2)])
          )
        }
        empty={props.inventory.length === 0}
        emptyText="Sin productos en inventario."
      >
        <div className="flex justify-between py-2 text-sm">
          <span className="text-muted">Unidades totales</span>
          <span className="font-bold text-foreground">{invUnits}</span>
        </div>
        <div className="flex justify-between py-2 text-sm">
          <span className="text-muted">Valor del inventario</span>
          <span className="font-bold text-foreground">{formatCurrency(invValue)}</span>
        </div>
        <div className="flex justify-between py-2 text-sm">
          <span className="text-muted">Productos con stock bajo</span>
          <span className={cn("font-bold", invLow > 0 ? "text-warning" : "text-success")}>
            {invLow}
          </span>
        </div>
      </ReportTable>

      {/* ── Promociones ── */}
      <ReportTable
        title="Promociones"
        icon={<BadgePercent size={15} className="text-brand" />}
        onExport={() =>
          downloadCSV(
            "reporte-promociones.csv",
            ["Promoción", "Descuento", "Estado"],
            props.promotions.map((p) => [p.title, `${p.discount}%`, p.active ? "Activa" : "Inactiva"])
          )
        }
        empty={props.promotions.length === 0}
        emptyText="Sin promociones creadas."
      >
        {props.promotions.map((p) => (
          <div key={p.title} className="flex items-center gap-2 py-2 text-sm">
            <span className="flex-1 text-foreground font-medium truncate">{p.title}</span>
            <span className="text-brand font-bold text-xs">−{p.discount}%</span>
            <span
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                p.active ? "bg-success-light text-success" : "bg-border text-muted"
              )}
            >
              {p.active ? "Activa" : "Inactiva"}
            </span>
          </div>
        ))}
      </ReportTable>
    </div>
  );
}

// ── Building blocks ────────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  change,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change?: number | null;
}) {
  return (
    <div className="bg-surface rounded-2xl border border-border p-4">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="text-[11px] text-muted">{label}</p>
      </div>
      <p className="text-xl font-black text-foreground">{value}</p>
      {change !== null && change !== undefined && (
        <p
          className={cn(
            "text-[11px] font-bold flex items-center gap-0.5 mt-0.5",
            change >= 0 ? "text-success" : "text-danger"
          )}
        >
          {change >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {change >= 0 ? "+" : ""}
          {change}% vs período anterior
        </p>
      )}
    </div>
  );
}

function ReportTable({
  title,
  icon,
  onExport,
  empty,
  emptyText,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onExport: () => void;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-bold text-foreground text-sm">{title}</h2>
        </div>
        {!empty && (
          <button
            onClick={onExport}
            className="print:hidden flex items-center gap-1 text-[11px] font-semibold text-brand"
          >
            <Download size={11} /> CSV
          </button>
        )}
      </div>
      {empty ? (
        <p className="text-sm text-muted text-center py-4">{emptyText}</p>
      ) : (
        <div className="divide-y divide-border">{children}</div>
      )}
    </section>
  );
}
