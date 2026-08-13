import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/data/dashboard";
import { getDashboardLayout } from "@/lib/actions/dashboard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getUser();

  const [{ data: profile }, data, { count: unreadCount }, layout] = await Promise.all([
    user
      ? supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    getDashboardData(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false),
    getDashboardLayout(),
  ]);

  return (
    <DashboardShell
      data={data}
      profileName={profile?.full_name ?? "Admin"}
      avatarUrl={profile?.avatar_url ?? null}
      unreadCount={unreadCount ?? 0}
      initialOrder={layout.cardOrder}
      initialHidden={layout.hiddenCards}
    />
  );
}
