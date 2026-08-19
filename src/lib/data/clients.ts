import { createClient } from "@/lib/supabase/server";
import { isNewClient, DEFAULT_NEW_CLIENT } from "@/lib/client-rules";

export type ClientFilter = "todos" | "frecuentes" | "nuevos" | "inactivos";

/** Windows used to classify a client. Kept here so the labels in the UI and
 *  the query stay in sync. */
export const SEGMENT_RULES = {
  newWithinDays: DEFAULT_NEW_CLIENT.new_client_days, // registered in the last N days
  newMaxVisits: DEFAULT_NEW_CLIENT.new_client_visits, // and fewer than N visits
  frequentWindowDays: 90, // look-back window for counting visits
  frequentMinVisits: 3, // visits inside that window to count as frequent
  inactiveAfterDays: 90, // no visit in N days
};

export interface ClientRow {
  id: string;
  full_name: string;
  phone: string;
  avatar_url: string | null;
  created_at: string;
  visits: number; // completed/confirmed visits in the frequent window
  lastVisit: string | null;
  /** null when the client fits none of the three buckets. */
  segment: Exclude<ClientFilter, "todos"> | null;
}

/**
 * Clients with their segment derived from real appointment history rather
 * than the stale `segment` column.
 */
export async function getClientsWithSegments(
  filter: ClientFilter,
  search?: string
): Promise<{ clients: ClientRow[]; counts: Record<Exclude<ClientFilter, "todos">, number> }> {
  const supabase = await createClient();

  let query = supabase
    .from("clients")
    .select("id, full_name, phone, avatar_url, created_at")
    .order("full_name");

  if (search) query = query.ilike("full_name", `%${search}%`);

  const now = Date.now();
  const windowStart = new Date(
    now - SEGMENT_RULES.frequentWindowDays * 24 * 3600_000
  ).toISOString();

  const [{ data: clients }, { data: appointments }] = await Promise.all([
    query,
    // Every non-cancelled appointment; enough history to judge inactivity
    supabase
      .from("appointments")
      .select("client_id, starts_at, status")
      .neq("status", "cancelada")
      .lte("starts_at", new Date(now).toISOString())
      .order("starts_at", { ascending: false })
      .limit(10000),
  ]);

  const visitsInWindow = new Map<string, number>();
  // All-time count: "nuevo" expires on total visits, not on the 90-day window
  const totalVisits = new Map<string, number>();
  const lastVisitAt = new Map<string, string>();

  for (const a of appointments ?? []) {
    if (!a.client_id) continue;
    if (!lastVisitAt.has(a.client_id)) lastVisitAt.set(a.client_id, a.starts_at);
    totalVisits.set(a.client_id, (totalVisits.get(a.client_id) ?? 0) + 1);
    if (a.starts_at >= windowStart) {
      visitsInWindow.set(a.client_id, (visitsInWindow.get(a.client_id) ?? 0) + 1);
    }
  }

  const counts = { frecuentes: 0, nuevos: 0, inactivos: 0 };

  const rows: ClientRow[] = (clients ?? []).map((c) => {
    const visits = visitsInWindow.get(c.id) ?? 0;
    const lastVisit = lastVisitAt.get(c.id) ?? null;

    const daysSinceVisit = lastVisit
      ? (now - new Date(lastVisit).getTime()) / (24 * 3600_000)
      : Infinity;

    /*
     * "Nuevo" has to be able to stop being true.
     *
     * The old rule fell through to "nuevos" for anyone who wasn't frequent
     * and wasn't inactive, so a client of two years with a couple of visits
     * still read as new — the badge never expired and stopped meaning
     * anything. Now it's the shared rule from client-rules: recent *and*
     * few visits, whichever runs out first. Someone who is none of the three
     * simply has no segment; they still show under "Todos".
     */
    let segment: Exclude<ClientFilter, "todos"> | null;
    if (visits >= SEGMENT_RULES.frequentMinVisits) {
      // Regulars stay regulars even if they signed up recently
      segment = "frecuentes";
    } else if (isNewClient(c.created_at, totalVisits.get(c.id) ?? 0)) {
      segment = "nuevos";
    } else if (daysSinceVisit > SEGMENT_RULES.inactiveAfterDays) {
      segment = "inactivos";
    } else {
      segment = null;
    }

    if (segment) counts[segment]++;
    return {
      id: c.id,
      full_name: c.full_name,
      phone: c.phone,
      avatar_url: c.avatar_url,
      created_at: c.created_at,
      visits,
      lastVisit,
      segment,
    };
  });

  const filtered = filter === "todos" ? rows : rows.filter((r) => r.segment === filter);
  return { clients: filtered, counts };
}
