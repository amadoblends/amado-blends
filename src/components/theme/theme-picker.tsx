"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, type Theme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

const OPTIONS: { key: Theme | "system"; label: string; icon: typeof Sun }[] = [
  { key: "light", label: "Claro", icon: Sun },
  { key: "dark", label: "Oscuro", icon: Moon },
  { key: "system", label: "Sistema", icon: Monitor },
];

export function ThemePicker() {
  const { theme, setTheme, followSystem, setFollowSystem } = useTheme();
  const active = followSystem ? "system" : theme;

  return (
    <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Apariencia</p>
        <p className="text-xs text-muted mt-0.5">Se guarda y se aplica cada vez que abras la app.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const Icon = o.icon;
          const isActive = active === o.key;
          return (
            <button
              key={o.key}
              onClick={() => {
                if (o.key === "system") {
                  setFollowSystem(true);
                } else {
                  setFollowSystem(false);
                  setTheme(o.key);
                }
              }}
              className={cn(
                "h-16 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors",
                isActive
                  ? "bg-foreground border-foreground text-background"
                  : "border-border bg-background text-muted"
              )}
            >
              <Icon size={17} />
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
