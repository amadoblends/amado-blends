import { createClient } from "@/lib/supabase/server";
import { startOfDay, endOfDay } from "date-fns";

export interface AppointmentRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "confirmada" | "pendiente" | "completada" | "cancelada";
  price: number;
  client: { id: string; full_name: string; avatar_url: string | null };
  service: { id: string; name: string; color: string };
}

export async function getAppointmentsForDay(date: Date): Promise<AppointmentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, price, clients(id, full_name, avatar_url), services(id, name, color)"
    )
    .gte("starts_at", startOfDay(date).toISOString())
    .lte("starts_at", endOfDay(date).toISOString())
    .order("starts_at", { ascending: true });

  if (error || !data) return [];

  return data.map((a) => ({
    id: a.id,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    status: a.status,
    price: Number(a.price),
    client: a.clients as unknown as AppointmentRow["client"],
    service: a.services as unknown as AppointmentRow["service"],
  }));
}

export async function getAppointmentCountsByDay(start: Date, end: Date) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("starts_at")
    .gte("starts_at", startOfDay(start).toISOString())
    .lte("starts_at", endOfDay(end).toISOString())
    .neq("status", "cancelada");

  if (error || !data) return new Map<string, number>();

  const counts = new Map<string, number>();
  for (const row of data) {
    const key = row.starts_at.slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
