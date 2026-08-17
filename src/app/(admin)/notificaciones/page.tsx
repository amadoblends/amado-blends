import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/back-button";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import {
  NotificationsList,
  type NotificationRow,
} from "@/components/notificaciones/notifications-list";

export default async function NotificationsPage() {
  const supabase = await createClient();

  /*
   * appointment_id arrives with migration 26. Asking for a column that isn't
   * there fails the whole query, so fall back to the older shape rather than
   * showing an empty screen.
   */
  let rows: NotificationRow[] = [];
  const full = await supabase
    .from("notifications")
    .select("id, title, body, read, created_at, appointment_id")
    .order("created_at", { ascending: false })
    .limit(100);

  if (full.data) {
    rows = full.data as NotificationRow[];
  } else {
    const legacy = await supabase
      .from("notifications")
      .select("id, title, body, read, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    rows = (legacy.data ?? []).map((n) => ({ ...n, appointment_id: null }));
  }

  return (
    <div className="px-4 pt-[max(10px,var(--safe-top))] pb-6 space-y-4">
      {/* New bookings land here without a reload — see migration 26 */}
      <RealtimeRefresher tables={["notifications"]} />

      <header className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-xl font-bold text-foreground flex-1">Notificaciones</h1>
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <Bell size={32} className="text-muted" />
          <p className="text-sm text-muted">No tienes notificaciones por ahora.</p>
        </div>
      ) : (
        <NotificationsList notifications={rows} />
      )}
    </div>
  );
}
