"use client";

import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

export function RevenueChart({ data }: { data: { day: string; total: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-muted">
        Aún no hay datos de ingresos esta semana.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF6A3D" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#FF6A3D" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#6b7280" }}
          dy={8}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value ?? 0))}
          contentStyle={{ borderRadius: 12, border: "1px solid #ecedf0", fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="#FF6A3D"
          strokeWidth={2.5}
          fill="url(#revenueFill)"
          dot={{ r: 4, fill: "#FF6A3D", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
