"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Users, Menu, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/citas", label: "Citas", icon: Calendar },
  { href: "/citas/nueva", label: "+", icon: Plus, isCenter: true },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/mas", label: "Más", icon: Menu },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 left-0 right-0 bg-surface/95 backdrop-blur border-t border-border pb-[max(8px,var(--safe-bottom))] pt-2 px-2 z-30">
      <ul className="flex items-end justify-between">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href.split("/").slice(0, 2).join("/"));
          const Icon = item.icon;

          if (item.isCenter) {
            return (
              <li key={item.href} className="-translate-y-3">
                <Link
                  href={item.href}
                  className="flex items-center justify-center w-14 h-14 rounded-full bg-brand text-white shadow-lg shadow-brand/30 active:scale-95 transition-transform"
                  aria-label="Nueva cita"
                >
                  <Icon size={26} />
                </Link>
              </li>
            );
          }

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-1 text-xs font-medium transition-colors",
                  active ? "text-brand" : "text-muted"
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
