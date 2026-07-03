"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  Users,
  Package,
  Scissors,
  CalendarClock,
  Bell,
  History,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";

const links = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/citas", label: "Citas", icon: Calendar },
  { href: "/historial", label: "Historial", icon: History },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/servicios", label: "Servicios", icon: Scissors },
  { href: "/disponibilidad", label: "Disponibilidad", icon: CalendarClock },
  { href: "/notificaciones", label: "Notificaciones", icon: Bell },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-border md:bg-surface md:h-dvh md:sticky md:top-0">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white font-bold shrink-0">
          AB
        </div>
        <div className="min-w-0">
          <p className="font-bold text-foreground leading-tight truncate">Amado Blends</p>
          <p className="text-xs text-muted">Panel administrativo</p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                active ? "bg-brand-light text-brand font-semibold" : "text-foreground hover:bg-background"
              )}
            >
              <Icon size={19} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-danger hover:bg-danger-light transition-colors"
          >
            <LogOut size={19} />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
