"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

const filters = [
  { key: "todos", label: "Todos" },
  { key: "frecuentes", label: "Frecuentes" },
  { key: "nuevos", label: "Nuevos" },
  { key: "inactivos", label: "Inactivos" },
];

export function ClientSearch({
  defaultValue,
  activeFilter,
  counts,
}: {
  defaultValue: string;
  activeFilter: string;
  counts?: Record<string, number>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function go(q: string, filter: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filter !== "todos") params.set("filter", filter);
    router.push(`/clientes${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go(value, activeFilter)}
          onBlur={() => go(value, activeFilter)}
          placeholder="Buscar cliente..."
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {filters.map((f) => {
          const count = counts?.[f.key];
          return (
            <button
              key={f.key}
              onClick={() => go(value, f.key)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap border flex items-center gap-1.5",
                activeFilter === f.key
                  ? "bg-foreground text-background border-foreground"
                  : "bg-surface text-foreground border-border"
              )}
            >
              {f.label}
              {count !== undefined && (
                <span
                  className={cn(
                    "text-[10px] font-bold",
                    activeFilter === f.key ? "text-white/70" : "text-muted"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
