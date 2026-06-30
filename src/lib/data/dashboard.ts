import { createClient } from "@/lib/supabase/server";
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, format } from "date-fns";
import { es } from "date-fns/locale";

export interface DashboardData {
  todayRevenue: number;
  yesterdayRevenue: number;
  todayAppointmentsCount: number;
  yesterdayAppointmentsCount: number;
  activeClientsToday: number;
  weekRevenue: { day: string; total: number }[];
  weekRevenueTotal: number;
  appointmentDistribution: { confirmada: number; pendiente: number; completada: number; total: number };
  upcomingAppointments: {
    id: string;
    time: string;
    clientName: string;
    clientAvatar: string | null;
    serviceName: string;
    status: string;
  }[];
  topProducts: {
    id: string;
    name: string;
    unitsSold: number;
    price: number;
    imageUrl: string | null;
  }[];
  inventoryAlerts: {
    id: string;
    name: string;
    stock: number;
    level: "bajo" | "critico";
    imageUrl: string | null;
  }[];
}

const empty: DashboardData = {
  todayRevenue: 0,
  yesterdayRevenue: 0,
  todayAppointmentsCount: 0,
  yesterdayAppointmentsCount: 0,
  activeClientsToday: 0,
  weekRevenue: [],
  weekRevenueTotal: 0,
  appointmentDistribution: { confirmada: 0, pendiente: 0, completada: 0, total: 0 },
  upcomingAppointments: [],
  topProducts: [],
  inventoryAlerts: [],
};

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const yesterdayStart = startOfDay(subDays(now, 1));
  const yesterdayEnd = endOfDay(subDays(now, 1));
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const [todayApts, yesterdayApts, weekApts, productsRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, price, status, starts_at, client_id, clients(full_name, avatar_url), services(name)")
      .gte("starts_at", todayStart.toISOString())
      .lte("starts_at", todayEnd.toISOString()),
    supabase
      .from("appointments")
      .select("id, price")
      .gte("starts_at", yesterdayStart.toISOString())
      .lte("starts_at", yesterdayEnd.toISOString())
      .neq("status", "cancelada"),
    supabase
      .from("appointments")
      .select("id, price, starts_at, status")
      .gte("starts_at", weekStart.toISOString())
      .lte("starts_at", weekEnd.toISOString())
      .neq("status", "cancelada"),
    supabase
      .from("products")
      .select("id, name, units_sold, price, image_url, stock, low_stock_threshold, critical_stock_threshold")
      .order("units_sold", { ascending: false })
      .limit(5),
  ]);

  if (todayApts.error || yesterdayApts.error || weekApts.error || productsRes.error) {
    return empty;
  }

  const today = todayApts.data ?? [];
  const nonCancelledToday = today.filter((a) => a.status !== "cancelada");

  const todayRevenue = nonCancelledToday.reduce((sum, a) => sum + Number(a.price), 0);
  const yesterdayRevenue = (yesterdayApts.data ?? []).reduce((sum, a) => sum + Number(a.price), 0);

  const distribution = { confirmada: 0, pendiente: 0, completada: 0, total: 0 };
  for (const a of today) {
    if (a.status === "confirmada") distribution.confirmada++;
    else if (a.status === "pendiente") distribution.pendiente++;
    else if (a.status === "completada") distribution.completada++;
  }
  distribution.total = distribution.confirmada + distribution.pendiente + distribution.completada;

  const dayBuckets = new Map<string, number>();
  for (const a of weekApts.data ?? []) {
    const key = format(new Date(a.starts_at), "EEEEEE", { locale: es });
    dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + Number(a.price));
  }
  const weekRevenue = Array.from(dayBuckets.entries()).map(([day, total]) => ({ day, total }));
  const weekRevenueTotal = weekRevenue.reduce((s, d) => s + d.total, 0);

  const upcomingAppointments = today
    .filter((a) => a.status !== "cancelada")
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 4)
    .map((a) => ({
      id: a.id,
      time: format(new Date(a.starts_at), "h:mm a"),
      clientName: (a.clients as unknown as { full_name: string })?.full_name ?? "Cliente",
      clientAvatar: (a.clients as unknown as { avatar_url: string | null })?.avatar_url ?? null,
      serviceName: (a.services as unknown as { name: string })?.name ?? "",
      status: a.status,
    }));

  const topProducts = (productsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    unitsSold: p.units_sold,
    price: Number(p.price),
    imageUrl: p.image_url,
  }));

  const inventoryAlerts = (productsRes.data ?? [])
    .filter((p) => p.stock <= p.low_stock_threshold)
    .map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      level: (p.stock <= p.critical_stock_threshold ? "critico" : "bajo") as "bajo" | "critico",
      imageUrl: p.image_url,
    }));

  return {
    todayRevenue,
    yesterdayRevenue,
    todayAppointmentsCount: today.length,
    yesterdayAppointmentsCount: yesterdayApts.data?.length ?? 0,
    activeClientsToday: new Set(today.map((a) => a.client_id)).size,
    weekRevenue,
    weekRevenueTotal,
    appointmentDistribution: distribution,
    upcomingAppointments,
    topProducts,
    inventoryAlerts,
  };
}

export function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}
