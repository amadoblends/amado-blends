import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import Link from "next/link";
import {
  Package,
  Scissors,
  Bell,
  LogOut,
  ChevronRight,
  ShieldCheck,
  CalendarClock,
  UserCircle,
  BadgePercent,
  BarChart3,
} from "lucide-react";

const menu = [
  { href: "/perfil", label: "Mi perfil", icon: UserCircle },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/productos", label: "Productos e inventario", icon: Package },
  { href: "/servicios", label: "Servicios", icon: Scissors },
  { href: "/promociones", label: "Promociones", icon: BadgePercent },
  { href: "/disponibilidad", label: "Disponibilidad", icon: CalendarClock },
  { href: "/notificaciones", label: "Notificaciones", icon: Bell },
];

export default async function MorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single()
    : { data: null };

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-6">
      <header className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-xl font-bold text-foreground">Más</h1>
      </header>

      <Link
        href="/perfil"
        className="flex items-center gap-3 bg-surface rounded-2xl border border-border p-4 active:bg-background"
      >
        <Avatar name={profile?.full_name ?? "Admin"} src={profile?.avatar_url} size={52} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{profile?.full_name ?? "Admin"}</p>
          <p className="text-sm text-muted truncate">{user?.email}</p>
        </div>
        <ChevronRight size={16} className="text-muted shrink-0" />
      </Link>

      <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
        {menu.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3.5 active:bg-background"
          >
            <item.icon size={19} className="text-muted shrink-0" />
            <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
            <ChevronRight size={16} className="text-muted" />
          </Link>
        ))}
      </div>

      <div className="bg-surface rounded-2xl border border-border p-4 flex items-start gap-3">
        <ShieldCheck size={20} className="text-success shrink-0 mt-0.5" />
        <p className="text-xs text-muted">
          Tu sesión está protegida con autenticación segura. Solo tú, como administrador, puedes
          acceder a la información de tu negocio.
        </p>
      </div>

      <form action={signOut}>
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 text-danger font-semibold py-3 rounded-xl border border-danger/20 bg-danger-light"
        >
          <LogOut size={18} /> Cerrar sesión
        </button>
      </form>
    </div>
  );
}
