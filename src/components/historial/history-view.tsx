"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  addDays, subDays, addMonths, subMonths, addYears, subYears, format,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarX2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import type { HistoryRow } from "@/lib/data/appointments";

export type Period = "dia" | "mes" | "ano";

const PERIODS: { key: Period; label: string }[] = [
  { key: "dia", label: "Día" },
  { key: "mes", label: "Mes" },
  { key: "ano", label: "Año" },
];

const STATUSES: { key: string; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "completada", label: "Completadas" },
  { key: "cancelada", label: "Canceladas" },
  { key: "confirmada", label: "Confirmadas" },
  { key: "pendiente", label: "Pendientes" },
];

function localDateKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function HistoryView({
  appointments,
  period,
  dateStr,
  status,
}: {
  appointments: HistoryRow[];
  period: Period;
  dateStr: string;
  status: string;
}) {
  const router = useRouter();
  const anchor = new Date(dateStr + "T00:00:00");

  function go(nextPeriod: Period, nextDate: Date, nextStatus: string) {
    router.push(
      `/historial?period=${nextPeriod}&date=${format(nextDate, "yyyy-MM-dd")}&status=${nextStatus}`
    );
  }

  function shift(dir: 1 | -1) {
    const next =
      period === "dia"
        ? (dir === 1 ? addDays(anchor, 1) : subDays(anchor, 1))
        : period === "mes"
          ? (dir === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1))
          : dir === 1
            ? addYears(anchor, 1)
            : subYears(anchor, 1);
    go(period, next, status);
  }

  const periodLabel =
    period === "dia"
      ? format(anchor, "EEEE d 'de' MMMM yyyy", { locale: es })
      : period === "mes"
        ? format(anchor, "MMMM yyyy", { locale: es })
        : format(anchor, "yyyy");

  // Filter to the exact local period (server fetches a widened UTC window)
  const inPeriod = useMemo(() => {
    return appointments.filter((a) => {
      const d = new Date(a.starts_at);
      if (period === "dia") return localDateKey(a.starts_at) === dateStr;
      if (period === "mes")
        return (
          d.getFullYear() === anchor.getFullYear() && d.getMonth() === anchor.getMonth()
        );
      return d.getFullYear() === anchor.getFullYear();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, period, dateStr]);

  const counts = {
    total: inPeriod.length,
    completada: inPeriod.filter((a) => a.status === "completada").length,
    cancelada: inPeriod.filter((a) => a.status === "cancelada").length,
    ingresos: inPeriod
      .filter((a) => a.status === "completada")
      .reduce((acc, a) => acc + a.price, 0),
  };

  const filtered = status === "todas" ? inPeriod : inPeriod.filter((a) => a.status === status);

  // Group by local day (useful in month/year views)
  const groups = useMemo(() => {
    const map = new Map<string, HistoryRow[]>();
    for (const a of filtered) {
      const key = localDateKey(a.starts_at);
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Period tabs */}
      <div className="flex rounded-xl bg-surface border border-border p-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => go(p.key, anchor, status)}
            className={cn(
              "flex-1 h-9 rounded-lg text-sm font-semibold transition-colors",
              period === p.key ? "bg-brand text-white" : "text-muted"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Period navigation */}
      <div className="flex items-center justify-between bg-surface rounded-xl border border-border px-2 py-2">
        <button
          onClick={() => shift(-1)}
          className="w-9 h-9 rounded-full border border-border flex items-center justify-center"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="font-semibold text-sm text-foreground capitalize">{periodLabel}</p>
        <button
          onClick={() => shift(1)}
          className="w-9 h-9 rounded-full border border-border flex items-center justify-center"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        <SummaryCard label="Citas" value={String(counts.total)} />
        <SummaryCard label="Completadas" value={String(counts.completada)} valueClass="text-success" />
        <SummaryCard label="Canceladas" value={String(counts.cancelada)} valueClass="text-danger" />
        <SummaryCard label="Ingresos" value={formatCurrency(counts.ingresos)} valueClass="text-brand" small />
      </div>

      {/* Status chips */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => go(period, anchor, s.key)}
            className={cn(
              "shrink-0 px-3.5 h-8 rounded-full text-xs font-semibold border transition-colors",
              status === s.key
                ? "bg-brand border-brand text-white"
                : "border-border bg-surface text-muted"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-10 text-center space-y-2">
          <CalendarX2 size={28} className="text-muted mx-auto" />
          <p className="text-sm text-muted">
            No hay citas {status !== "todas" ? STATUSES.find((s) => s.key === status)?.label.toLowerCase() : ""} en este período.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([dayKey, rows]) => (
            <div key={dayKey}>
              {period !== "dia" && (
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5 capitalize">
                  {format(new Date(dayKey + "T00:00:00"), "EEEE d 'de' MMMM", { locale: es })}
                </p>
              )}
              <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
                {rows.map((a) => (
                  <Link
                    key={a.id}
                    href={`/citas/${a.id}`}
                    className="flex items-center gap-3 px-4 py-3 active:bg-background"
                  >
                    <span className="text-xs font-semibold text-muted w-16 shrink-0">
                      {new Date(a.starts_at).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span
                      className="w-1 self-stretch rounded-full shrink-0"
                      style={{ background: a.service_color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {a.client_name}
                      </p>
                      <p className="text-xs text-muted truncate">{a.service_name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={a.status} />
                      <span className="text-xs font-semibold text-muted">
                        {formatCurrency(a.price)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  valueClass,
  small,
}: {
  label: string;
  value: string;
  valueClass?: string;
  small?: boolean;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-2.5 text-center">
      <p className={cn("font-bold text-foreground", small ? "text-sm" : "text-lg", valueClass)}>
        {value}
      </p>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  );
}
