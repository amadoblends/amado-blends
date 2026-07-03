import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/data/dashboard";
import { autoCompletePastAppointments } from "@/lib/data/appointments";
import { Bell } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { DashboardWidgets } from "@/components/dashboard/dashboard-widgets";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Past appointments become "completada" so stats reflect reality
  await autoCompletePastAppointments();

  const [{ data: profile }, data, { count: unreadCount }] = await Promise.all([
    user
      ? supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    getDashboardData(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false),
  ]);

  const firstName = profile?.full_name?.split(" ")[0] || "Admin";

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-6">
      <header className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar src={profile?.avatar_url} name={profile?.full_name ?? "Admin"} size={52} />
          <div>
            <p className="font-bold text-foreground leading-tight">
              {profile?.full_name ?? "Admin"}
            </p>
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

      <DashboardWidgets data={data} />
    </div>
  );
}
