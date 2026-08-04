"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Search, X, Loader2, User, Calendar, Package, Scissors, BarChart3, History,
  CalendarClock, BadgePercent,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface ClientHit {
  id: string;
  full_name: string;
  phone: string;
}

const PAGES = [
  { href: "/citas", label: "Citas", icon: Calendar },
  { href: "/historial", label: "Historial", icon: History },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/clientes", label: "Clientes", icon: User },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/servicios", label: "Servicios", icon: Scissors },
  { href: "/promociones", label: "Promociones", icon: BadgePercent },
  { href: "/disponibilidad", label: "Disponibilidad", icon: CalendarClock },
];

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
      return;
    }
    document.body.style.overflow = "hidden";
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = "";
      clearTimeout(id);
    };
  }, [open]);

  // Debounced client lookup
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let alive = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, phone")
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
        .order("full_name")
        .limit(6);
      if (!alive) return;
      setHits(data ?? []);
      setLoading(false);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  function go(href: string) {
    router.push(href);
    onClose();
  }

  const pageHits = query.trim()
    ? PAGES.filter((p) => p.label.toLowerCase().includes(query.trim().toLowerCase()))
    : PAGES.slice(0, 5);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-surface rounded-2xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
          <Search size={18} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar clientes o páginas..."
            className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted focus:outline-none"
          />
          {loading && <Loader2 size={15} className="animate-spin text-muted shrink-0" />}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-background flex items-center justify-center shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {/* Clients */}
          {hits.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wide px-2 py-1.5">
                Clientes
              </p>
              {hits.map((c) => (
                <button
                  key={c.id}
                  onClick={() => go(`/clientes/${c.id}`)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-background text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-brand">{c.full_name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.full_name}</p>
                    <p className="text-xs text-muted">{c.phone}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {query.trim().length >= 2 && !loading && hits.length === 0 && (
            <p className="text-sm text-muted text-center py-4">Sin clientes con ese nombre.</p>
          )}

          {/* Pages */}
          {pageHits.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted uppercase tracking-wide px-2 py-1.5">
                Ir a
              </p>
              {pageHits.map((p) => (
                <button
                  key={p.href}
                  onClick={() => go(p.href)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-background text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0">
                    <p.icon size={15} className="text-muted" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{p.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-border">
          <p className="text-[10px] text-muted">
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono">
              Esc
            </kbd>{" "}
            para cerrar
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Global ⌘K / Ctrl+K listener so search works from any admin page. */
export function useSearchHotkey(onOpen: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen]);
}
