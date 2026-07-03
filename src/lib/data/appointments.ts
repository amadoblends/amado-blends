import { createClient } from "@/lib/supabase/server";
import { startOfDay, endOfDay } from "date-fns";

export interface AppointmentProduct {
  quantity: number;
  name: string;
  image_url: string | null;
}

export interface AppointmentRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "confirmada" | "pendiente" | "completada" | "cancelada";
  price: number;
  client: { id: string; full_name: string; avatar_url: string | null };
  service: { id: string; name: string; color: string };
  products: AppointmentProduct[];
  guests: string[]; // guest full names
}

// Appointments whose end time already passed get marked as completed
// automatically, so day stats always reflect reality.
export async function autoCompletePastAppointments(): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("appointments")
    .update({ status: "completada" })
    .in("status", ["pendiente", "confirmada"])
    .lt("ends_at", new Date().toISOString());
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
      "id, starts_at, ends_at, status, price, clients(id, full_name, avatar_url), services(id, name, color), appointment_products(quantity, products(name, image_url)), appointment_guests(full_name)"
    )
    .gte("starts_at", from.toISOString())
    .lte("starts_at", to.toISOString())
    .neq("status", "cancelada")
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
    products: ((a.appointment_products as unknown as {
      quantity: number;
      products: { name: string; image_url: string | null };
    }[]) ?? []).map((ap) => ({
      quantity: ap.quantity,
      name: ap.products?.name ?? "",
      image_url: ap.products?.image_url ?? null,
    })),
    guests: ((a.appointment_guests as unknown as { full_name: string }[]) ?? []).map(
      (g) => g.full_name
    ),
  }));
}

export interface HistoryRow {
  id: string;
  starts_at: string;
  status: "confirmada" | "pendiente" | "completada" | "cancelada";
  price: number;
  client_name: string;
  service_name: string;
  service_color: string;
}

// History of ALL appointments (including cancelled) in a range.
// Window is widened ±14h; the client component filters by local date.
export async function getAppointmentsHistory(start: Date, end: Date): Promise<HistoryRow[]> {
  const supabase = await createClient();
  const from = new Date(startOfDay(start).getTime() - 14 * 3600_000);
  const to = new Date(endOfDay(end).getTime() + 14 * 3600_000);
  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, status, price, clients(full_name), services(name, color)")
    .gte("starts_at", from.toISOString())
    .lte("starts_at", to.toISOString())
    .order("starts_at", { ascending: false })
    .limit(2000);

  if (error || !data) return [];

  return data.map((a) => {
    const client = a.clients as unknown as { full_name: string } | null;
    const service = a.services as unknown as { name: string; color: string } | null;
    return {
      id: a.id,
      starts_at: a.starts_at,
      status: a.status,
      price: Number(a.price),
      client_name: client?.full_name ?? "Cliente",
      service_name: service?.name ?? "Servicio",
      service_color: service?.color ?? "#999999",
    };
  });
}

export interface BlockedRange {
  id: string;
  starts_at: string;
  ends_at: string;
}

export async function getBlockedTimesForDay(date: Date): Promise<BlockedRange[]> {
  const supabase = await createClient();
  const from = new Date(startOfDay(date).getTime() - 14 * 3600_000);
  const to = new Date(endOfDay(date).getTime() + 14 * 3600_000);
  const { data, error } = await supabase
    .from("blocked_times")
    .select("id, starts_at, ends_at")
    .lt("starts_at", to.toISOString())
    .gt("ends_at", from.toISOString());
  if (error || !data) return [];
  return data;
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
