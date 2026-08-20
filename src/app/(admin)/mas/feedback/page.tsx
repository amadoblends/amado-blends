import { createClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/back-button";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { FeedbackInbox, type FeedbackItem } from "@/components/feedback/feedback-inbox";
import { diagnose } from "@/lib/supabase/schema-errors";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const supabase = await createClient();

  /*
   * The visit link arrives with migration 36. Naming a column that isn't
   * there fails the WHOLE query, which would empty the inbox rather than
   * show it without the visit line — so it falls back to the older shape.
   */
  const BASE = "id, area, category, message, rating, status, created_at, clients(full_name)";
  const WITH_VISIT = `${BASE}, appointment_id, appointments(starts_at, services(name))`;

  // The two shapes differ, so the rows are read defensively below
  const first = await supabase
    .from("feedback")
    .select(WITH_VISIT)
    .order("created_at", { ascending: false })
    .limit(200);

  const fallback =
    first.error && diagnose(first.error).kind === "missing-column"
      ? await supabase
          .from("feedback")
          .select(BASE)
          .order("created_at", { ascending: false })
          .limit(200)
      : null;

  const data = (fallback ?? first).data as Record<string, unknown>[] | null;
  const error = (fallback ?? first).error;

  // The table arrives with migration 29; until it's run, say so plainly
  // instead of rendering an empty inbox that looks like silence.
  const missing = error ? diagnose(error).kind === "missing-table" : false;

  const items: FeedbackItem[] = (data ?? []).map((row) => {
    // PostgREST types the embed as an array even though the FK is to one row
    const joined = row.clients as
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null;
    const client = Array.isArray(joined) ? joined[0] : joined;
    return {
      id: row.id as string,
      area: row.area as FeedbackItem["area"],
      // Categories arrive with migration 32; older rows read as "other"
      category: (row.category as string | null) ?? null,
      // Which visit the stars are about — see migration 36
      visit: (() => {
        const a = row.appointments as
          | { starts_at: string; services: { name: string } | { name: string }[] | null }
          | null;
        if (!a) return null;
        const svc = Array.isArray(a.services) ? a.services[0] : a.services;
        return { startsAt: a.starts_at, serviceName: svc?.name ?? null };
      })(),
      message: row.message as string,
      rating: row.rating as number | null,
      status: row.status as FeedbackItem["status"],
      created_at: row.created_at as string,
      client_name: client?.full_name ?? null,
    };
  });

  return (
    <div className="px-4 pt-[max(10px,var(--safe-top))] pb-6 space-y-4">
      <RealtimeRefresher tables={["feedback"]} />

      <header className="flex items-center gap-3">
        <BackButton />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">Comentarios</h1>
          <p className="text-xs text-muted">Lo que te escriben tus clientes</p>
        </div>
      </header>

      {missing ? (
        <div className="bg-surface rounded-2xl border border-border p-5 text-center space-y-1.5">
          <p className="text-sm font-bold text-foreground">Falta la tabla de comentarios</p>
          <p className="text-xs text-muted">
            Corre <code className="font-mono">migration_29</code> en Supabase para activar el buzón.
          </p>
        </div>
      ) : (
        <FeedbackInbox items={items} />
      )}
    </div>
  );
}
