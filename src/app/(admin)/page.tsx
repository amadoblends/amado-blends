import { createClient } from "@/lib/supabase/server";
import { getDashboardData, percentChange } from "@/lib/data/dashboard";
import { DollarSign, Calendar, Users, Clock, Bell, AlertTriangle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { StatCard } from "@/components/dashboard/stat-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { AppointmentsDonut } from "@/components/dashboard/appointments-donut";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, data, { count: unreadCount }] = await Promise.all([
    user
      ? supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    getDashboardData(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false),
  ]);

  const firstName = profile?.full_name?.split(" ")[0] || "Admin";
  const revenueChange = percentChange(data.todayRevenue, data.yesterdayRevenue);
  const apptChange = percentChange(data.todayAppointmentsCount, data.yesterdayAppointmentsCount);

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-6">
      <header className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar src={profile?.avatar_url} name={profile?.full_name ?? "Admin"} size={52} />
          <div>
            <p className="font-bold text-foreground leading-tight">{profile?.full_name ?? "Admin"}</p>
            <p className="text-sm text-muted">Panel administrativo</p>
          </div>
        </div>
        <Link
          href="/notificaciones"
          className="relative w-11 h-11 rounded-full bg-surface border border-border flex items-center justify-center"
        >
          <Bell size={20} className="text-foreground" />
          {!!unreadCount && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Link>
      </header>

      <div>
        <h1 className="text-2xl font-bold text-foreground">¡Buenos días, {firstName}! 👋</h1>
        <p className="text-muted text-sm mt-0.5">Aquí tienes el resumen de tu negocio.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={DollarSign}
          iconBg="var(--color-brand-light)"
          iconColor="var(--color-brand)"
          label="Ingresos hoy"
          value={data.todayRevenue}
          format="currency"
          change={revenueChange}
        />
        <StatCard
          icon={Calendar}
          iconBg="var(--color-violet-light)"
          iconColor="var(--color-violet)"
          label="Citas hoy"
          value={data.todayAppointmentsCount}
          change={apptChange}
        />
        <StatCard
          icon={Users}
          iconBg="var(--color-success-light)"
          iconColor="var(--color-success)"
          label="Clientes activos en citas hoy"
          value={data.activeClientsToday}
        />
        <StatCard
          icon={Clock}
          iconBg="var(--color-info-light)"
          iconColor="var(--color-info)"
          label="Tiempo ocupado"
          value="—"
          changeTone="info"
        />
      </div>

      <section className="bg-surface rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-foreground">Resumen de ingresos</h2>
          <span className="text-xs font-medium text-muted">Esta semana</span>
        </div>
        <p className="text-xs text-muted">Ingresos totales</p>
        <p className="text-2xl font-bold text-foreground">{formatCurrency(data.weekRevenueTotal)}</p>
        <RevenueChart data={data.weekRevenue} />
      </section>

      <section className="bg-surface rounded-2xl border border-border p-4">
        <h2 className="font-bold text-foreground mb-2">Distribución de citas</h2>
        <AppointmentsDonut distribution={data.appointmentDistribution} />
        <div className="space-y-2 mt-2">
          <LegendRow color="bg-brand" label="Confirmadas" value={data.appointmentDistribution.confirmada} total={data.appointmentDistribution.total} />
          <LegendRow color="bg-violet" label="Pendientes" value={data.appointmentDistribution.pendiente} total={data.appointmentDistribution.total} />
          <LegendRow color="bg-info" label="Completadas" value={data.appointmentDistribution.completada} total={data.appointmentDistribution.total} />
        </div>
      </section>

      <section className="bg-surface rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-foreground">Próximas citas</h2>
          <Link href="/citas" className="text-brand text-sm font-semibold">Ver agenda →</Link>
        </div>
        {data.upcomingAppointments.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">No tienes citas programadas hoy.</p>
        ) : (
          <ul className="space-y-3">
            {data.upcomingAppointments.map((a) => (
              <li key={a.id} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-muted w-14 shrink-0">{a.time}</span>
                <Avatar name={a.clientName} src={a.clientAvatar} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{a.clientName}</p>
                  <p className="text-xs text-muted truncate">{a.serviceName}</p>
                </div>
                <StatusBadge status={a.status as "confirmada" | "pendiente" | "completada" | "cancelada"} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-surface rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-foreground">Productos más vendidos</h2>
          <Link href="/productos" className="text-brand text-sm font-semibold">Ver todos</Link>
        </div>
        {data.topProducts.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">Aún no hay ventas registradas.</p>
        ) : (
          <ul className="space-y-3">
            {data.topProducts.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className="text-sm font-bold text-muted w-4">{i + 1}</span>
                <div className="w-10 h-10 rounded-lg bg-background border border-border shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted">{p.unitsSold} unidades</p>
                </div>
                <span className="text-sm font-bold text-foreground">{formatCurrency(p.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-surface rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-foreground">Alertas de inventario</h2>
          <Link href="/productos" className="text-brand text-sm font-semibold">Ver todas</Link>
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
                <div className="w-10 h-10 rounded-lg bg-white shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <p className={cn("text-xs font-semibold", p.level === "critico" ? "text-danger" : "text-warning")}>
                    {p.level === "critico" ? "Stock crítico" : "Stock bajo"}
                  </p>
                  <p className="text-xs text-muted">Quedan {p.stock} unidades</p>
                </div>
                <AlertTriangle size={18} className={p.level === "critico" ? "text-danger" : "text-warning"} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-bold text-foreground mb-3">Acciones rápidas</h2>
        <div className="grid grid-cols-4 gap-2">
          <QuickAction href="/citas/nueva" label="Nueva cita" icon={Calendar} color="text-brand" bg="bg-brand-light" />
          <QuickAction href="/clientes/nuevo" label="Nuevo cliente" icon={Users} color="text-violet" bg="bg-violet-light" />
          <QuickAction href="/servicios/nuevo" label="Nuevo servicio" icon={Clock} color="text-success" bg="bg-success-light" />
          <QuickAction href="/productos/nuevo" label="Nuevo producto" icon={DollarSign} color="text-info" bg="bg-info-light" />
        </div>
      </section>
    </div>
  );
}

function LegendRow({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={cn("w-2.5 h-2.5 rounded-full", color)} />
      <span className="flex-1 text-foreground">{label}</span>
      <span className="text-muted">{value} ({pct}%)</span>
    </div>
  );
}

function QuickAction({
  href,
  label,
  icon: Icon,
  color,
  bg,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  color: string;
  bg: string;
}) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", bg, color)}>
        <Icon size={20} />
      </div>
      <span className="text-[11px] text-center text-foreground font-medium leading-tight">{label}</span>
    </Link>
  );
}
