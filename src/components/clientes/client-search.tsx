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

export function ClientSearch({ defaultValue, activeFilter }: { defaultValue: string; activeFilter: string }) {
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
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-violet/40"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => go(value, f.key)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap border",
              activeFilter === f.key ? "bg-violet text-white border-violet" : "bg-surface text-foreground border-border"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
