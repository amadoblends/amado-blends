"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const COLORS = { confirmada: "#FF6A3D", pendiente: "#7C5CFF", completada: "#2F7BF6" };

export function AppointmentsDonut({
  distribution,
}: {
  distribution: { confirmada: number; pendiente: number; completada: number; total: number };
}) {
  const data = [
    { key: "confirmada", value: distribution.confirmada },
    { key: "pendiente", value: distribution.pendiente },
    { key: "completada", value: distribution.completada },
  ].filter((d) => d.value > 0);

  return (
    <div className="relative w-full h-[150px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data.length ? data : [{ key: "empty", value: 1 }]}
            dataKey="value"
            innerRadius={48}
            outerRadius={70}
            paddingAngle={data.length > 1 ? 3 : 0}
            stroke="none"
          >
            {(data.length ? data : [{ key: "empty", value: 1 }]).map((d) => (
              <Cell
                key={d.key}
                fill={data.length ? COLORS[d.key as keyof typeof COLORS] : "#ecedf0"}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold text-foreground">{distribution.total}</span>
        <span className="text-xs text-muted">Total</span>
      </div>
    </div>
  );
}
