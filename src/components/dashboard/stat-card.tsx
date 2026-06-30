import { cn, formatCurrency } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowUp, ArrowDown } from "lucide-react";

export function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  change,
  changeTone = "success",
  format = "number",
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string | number;
  change?: number;
  changeTone?: "success" | "info";
  format?: "number" | "currency";
}) {
  const displayValue = format === "currency" && typeof value === "number" ? formatCurrency(value) : value;
  const positive = (change ?? 0) >= 0;

  return (
    <div className="bg-surface rounded-2xl p-4 border border-border flex flex-col gap-3 min-w-[150px]">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center"
        style={{ background: iconBg, color: iconColor }}
      >
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-muted leading-tight">{label}</p>
        <p className="text-xl font-bold text-foreground mt-1">{displayValue}</p>
      </div>
      {change !== undefined && (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit",
            changeTone === "success" ? "bg-success-light text-success" : "bg-info-light text-info"
          )}
        >
          {positive ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
          {Math.abs(change)}% vs ayer
        </span>
      )}
    </div>
  );
}
