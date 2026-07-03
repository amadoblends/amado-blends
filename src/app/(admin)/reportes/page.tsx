import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, format,
} from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { autoCompletePastAppointments } from "@/lib/data/appointments";
import { BackButton } from "@/components/ui/back-button";
import { ReportsView } from "@/components/reportes/reports-view";

export type ReportPeriod = "dia" | "semana" | "mes" | "ano" | "rango";

function getRange(periodo: ReportPeriod, desde?: string, hasta?: string): [Date, Date] {
  const now = new Date();
  switch (periodo) {
    case "dia":
      return [startOfDay(now), endOfDay(now)];
    case "semana":
      return [startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 })];
    case "ano":
      return [startOfYear(now), endOfYear(now)];
    case "rango": {
      const from = desde ? new Date(desde + "T00:00:00") : startOfMonth(now);
      const to = hasta ? new Date(hasta + "T23:59:59") : endOfDay(now);
      return [from, to];
    }
    case "mes":
    default:
      return [startOfMonth(now), endOfMonth(now)];
  }
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }>;
}) {
  const params = await searchParams;
  const periodo = (["dia", "semana", "mes", "ano", "rango"].includes(params.periodo ?? "")
    ? params.periodo
    : "mes") as ReportPeriod;

  await autoCompletePastAppointments();

  const [rangeStart, rangeEnd] = getRange(periodo, params.desde, params.hasta);
  // Previous period of equal length, for comparisons
  const spanMs = rangeEnd.getTime() - rangeStart.getTime();
  const prevStart = new Date(rangeStart.getTime() - spanMs - 1);
  const prevEnd = new Date(rangeStart.getTime() - 1);

  const supabase = await createClient();
  // Widen ±14h: server UTC vs local days
  const pad = 14 * 3600_000;

  const [
    { data: apts },
    { data: prevApts },
    { count: newClients },
    { count: prevNewClients },
    { data: aptProducts },
    { data: products },
    { data: promotions },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at, ends_at, status, price, clients(full_name), services(name, kind)")
      .gte("starts_at", new Date(rangeStart.getTime() - pad).toISOString())
      .lte("starts_at", new Date(rangeEnd.getTime() + pad).toISOString())
      .limit(5000),
    supabase
      .from("appointments")
      .select("starts_at, status, price")
      .gte("starts_at", new Date(prevStart.getTime() - pad).toISOString())
      .lte("starts_at", new Date(prevEnd.getTime() + pad).toISOString())
      .limit(5000),
    supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .gte("created_at", rangeStart.toISOString())
      .lte("created_at", rangeEnd.toISOString()),
    supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .gte("created_at", prevStart.toISOString())
      .lte("created_at", prevEnd.toISOString()),
    supabase
      .from("appointment_products")
      .select("quantity, created_at, products(name, price)")
      .gte("created_at", rangeStart.toISOString())
      .lte("created_at", rangeEnd.toISOString())
      .limit(5000),
    supabase.from("products").select("name, price, stock, low_stock_threshold"),
    supabase.from("promotions").select("title, discount_percent, is_active"),
  ]);

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-4">
      <header className="flex items-center gap-3 print:hidden">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-foreground">Reportes</h1>
          <p className="text-sm text-muted">Analiza tu negocio por período</p>
        </div>
      </header>

      <ReportsView
        periodo={periodo}
        desde={params.desde ?? format(rangeStart, "yyyy-MM-dd")}
        hasta={params.hasta ?? format(rangeEnd, "yyyy-MM-dd")}
        rangeStartISO={rangeStart.toISOString()}
        rangeEndISO={rangeEnd.toISOString()}
        prevStartISO={prevStart.toISOString()}
        prevEndISO={prevEnd.toISOString()}
        appointments={(apts ?? []).map((a) => ({
          id: a.id,
          starts_at: a.starts_at,
          ends_at: a.ends_at,
          status: a.status,
          price: Number(a.price),
          clientName: (a.clients as unknown as { full_name: string } | null)?.full_name ?? "—",
          serviceName: (a.services as unknown as { name: string } | null)?.name ?? "—",
          serviceKind:
            (a.services as unknown as { kind: string } | null)?.kind === "package"
              ? "combo"
              : "servicio",
        }))}
        prevAppointments={(prevApts ?? []).map((a) => ({
          starts_at: a.starts_at,
          status: a.status,
          price: Number(a.price),
        }))}
        newClients={newClients ?? 0}
        prevNewClients={prevNewClients ?? 0}
        requestedProducts={(aptProducts ?? []).map((ap) => ({
          quantity: ap.quantity,
          name: (ap.products as unknown as { name: string } | null)?.name ?? "—",
          price: Number((ap.products as unknown as { price: number } | null)?.price ?? 0),
        }))}
        inventory={(products ?? []).map((p) => ({
          name: p.name,
          price: Number(p.price),
          stock: p.stock,
          low: p.stock <= p.low_stock_threshold,
        }))}
        promotions={(promotions ?? []).map((p) => ({
          title: p.title,
          discount: p.discount_percent,
          active: p.is_active,
        }))}
      />
    </div>
  );
}
