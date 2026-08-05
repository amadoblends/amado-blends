"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
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
  BarChart3,
  BadgePercent,
  Images,
  LogOut,
  Search,
  Moon,
  Sun,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import { SearchModal, useSearchHotkey } from "@/components/search-modal";
import { useTheme } from "@/components/theme/theme-provider";

const links = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/citas", label: "Citas", icon: Calendar },
  { href: "/historial", label: "Historial", icon: History },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/servicios", label: "Servicios", icon: Scissors },
  { href: "/promociones", label: "Promociones", icon: BadgePercent },
  { href: "/carrusel", label: "Carrusel", icon: Images },
  { href: "/disponibilidad", label: "Disponibilidad", icon: CalendarClock },
  { href: "/notificaciones", label: "Notificaciones", icon: Bell },
];

const STORAGE_KEY = "sidebarPinned.v1";
const HIDDEN_KEY = "sidebarHidden.v1";

export function Sidebar({
  logoUrl = null,
  businessName = "Amado Blends",
}: {
  logoUrl?: string | null;
  businessName?: string;
}) {
  const pathname = usePathname();
  const [pinned, setPinned] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  const openSearch = useCallback(() => setSearchOpen(true), []);
  useSearchHotkey(openSearch);

  // Restore the user's choice before first paint of the nav labels
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) setPinned(saved === "true");
      const savedHidden = localStorage.getItem(HIDDEN_KEY);
      if (savedHidden !== null) setHidden(savedHidden === "true");
    } catch {
      // storage blocked — fall back to expanded
    }
  }, []);

  function setHiddenPersisted(next: boolean) {
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, String(next));
    } catch {
      // ignore
    }
  }

  // Collapsed rail widens while the pointer is over it
  const expanded = pinned || hovering;

  // Fully hidden: only the hamburger stays, on tablet and desktop alike
  if (hidden) {
    return (
      <>
        <button
          onClick={() => setHiddenPersisted(false)}
          aria-label="Abrir menú"
          className="hidden md:flex fixed top-4 left-4 z-50 w-11 h-11 rounded-xl bg-surface border border-border shadow-md items-center justify-center active:bg-background"
        >
          <Menu size={19} className="text-foreground" />
        </button>
        <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      </>
    );
  }

  return (
    <>
      {/* Reserves layout space; the panel itself floats so hover-expand
          never pushes the page content around. */}
      <div
        className={cn(
          "hidden md:block shrink-0 transition-[width] duration-200",
          pinned ? "w-64" : "w-[68px]"
        )}
      />

      <aside
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className={cn(
          "hidden md:flex fixed left-0 top-0 bottom-0 z-40 flex-col bg-surface border-r border-border",
          "transition-[width] duration-200 ease-out overflow-hidden",
          expanded ? "w-64" : "w-[68px]",
          !pinned && hovering && "shadow-2xl"
        )}
      >
        {/* Brand — the business logo, not the barber's photo */}
        <div className="flex items-center gap-2.5 px-4 py-5 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center shrink-0 relative overflow-hidden">
            {logoUrl ? (
              <Image src={logoUrl} alt={businessName} fill sizes="40px" className="object-cover" />
            ) : (
              <>
                <span className="text-background font-black text-sm tracking-tight">
                  {businessName.slice(0, 2).toUpperCase()}
                </span>
                <span className="absolute bottom-0 inset-x-0 h-[3px] bg-brand" />
              </>
            )}
          </div>

          <div
            className={cn(
              "min-w-0 flex-1 transition-opacity duration-150",
              expanded ? "opacity-100" : "opacity-0"
            )}
          >
            <p className="font-bold text-foreground leading-tight truncate">{businessName}</p>
            <p className="text-xs text-muted truncate">Panel administrativo</p>
          </div>

          {/* Single close control, top-right of the panel */}
          {expanded && (
            <button
              onClick={() => setHiddenPersisted(true)}
              aria-label="Cerrar menú"
              title="Cerrar menú"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-background hover:text-foreground transition-colors shrink-0"
            >
              <X size={17} />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="px-3 pb-3 shrink-0">
          <button
            onClick={openSearch}
            className={cn(
              "w-full h-10 rounded-xl border border-border bg-background flex items-center text-muted hover:border-brand/40 hover:text-foreground transition-colors",
              expanded ? "px-3 gap-2.5" : "justify-center"
            )}
            title="Buscar (Ctrl+K)"
          >
            <Search size={17} className="shrink-0" />
            {expanded && (
              <>
                <span className="text-sm flex-1 text-left">Buscar...</span>
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border">
                  ⌘K
                </kbd>
              </>
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto overflow-x-hidden no-scrollbar">
          {links.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                title={expanded ? undefined : link.label}
                className={cn(
                  "flex items-center gap-3 h-11 rounded-xl text-sm font-medium transition-colors",
                  expanded ? "px-3" : "justify-center px-0",
                  active
                    ? "bg-brand-light text-brand font-semibold"
                    : "text-foreground hover:bg-background"
                )}
              >
                <Icon size={19} className="shrink-0" />
                <span
                  className={cn(
                    "truncate transition-opacity duration-150",
                    expanded ? "opacity-100" : "opacity-0 w-0"
                  )}
                >
                  {link.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-border space-y-1 shrink-0">
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className={cn(
              "w-full flex items-center gap-3 h-10 rounded-xl text-sm font-medium text-muted hover:bg-background transition-colors",
              expanded ? "px-3" : "justify-center px-0"
            )}
          >
            {theme === "dark" ? (
              <Sun size={18} className="shrink-0" />
            ) : (
              <Moon size={18} className="shrink-0" />
            )}
            <span
              className={cn(
                "truncate transition-opacity duration-150",
                expanded ? "opacity-100" : "opacity-0 w-0"
              )}
            >
              {theme === "dark" ? "Modo claro" : "Modo oscuro"}
            </span>
          </button>

          <form action={signOut}>
            <button
              type="submit"
              title="Cerrar sesión"
              className={cn(
                "w-full flex items-center gap-3 h-10 rounded-xl text-sm font-medium text-danger hover:bg-danger-light transition-colors",
                expanded ? "px-3" : "justify-center px-0"
              )}
            >
              <LogOut size={18} className="shrink-0" />
              <span
                className={cn(
                  "truncate transition-opacity duration-150",
                  expanded ? "opacity-100" : "opacity-0 w-0"
                )}
              >
                Cerrar sesión
              </span>
            </button>
          </form>
        </div>
      </aside>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
