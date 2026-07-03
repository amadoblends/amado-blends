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
  // Widen the window ±14h: the server runs in UTC but users live in another
  // timezone, so a strict UTC day-cut drops evening appointments. The client
  // component filters to the exact local day.
  const from = new Date(startOfDay(date).getTime() - 14 * 3600_000);
  const to = new Date(endOfDay(date).getTime() + 14 * 3600_000);
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, price, clients(id, full_name, avatar_url), services(id, name, color)"
    )
    .gte("starts_at", from.toISOString())
    .lte("starts_at", to.toISOString())
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

// Returns raw ISO timestamps; the client component groups them by LOCAL date
// (grouping on the server would use UTC and shift evening appointments a day).
export async function getAppointmentStarts(start: Date, end: Date): Promise<string[]> {
  const supabase = await createClient();
  const from = new Date(startOfDay(start).getTime() - 14 * 3600_000);
  const to = new Date(endOfDay(end).getTime() + 14 * 3600_000);
  const { data, error } = await supabase
    .from("appointments")
    .select("starts_at")
    .gte("starts_at", from.toISOString())
    .lte("starts_at", to.toISOString())
    .neq("status", "cancelada");

  if (error || !data) return [];
  return data.map((r) => r.starts_at);
}
