import Link from "next/link";
import { Bell, CalendarPlus, CalendarX, CalendarClock, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/ui/back-button";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { MarkAllRead } from "@/components/notificaciones/mark-all-read";

/** A glanceable icon per kind of notice. */
function iconFor(title: string) {
  const t = title.toLowerCase();
  if (t.includes("cancel") || t.includes("no asist")) return CalendarX;
  if (t.includes("reprogram")) return CalendarClock;
  return CalendarPlus;
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, body, read, created_at, appointment_id")
    .order("created_at", { ascending: false })
    .limit(50);

  const unread = (notifications ?? []).filter((n) => !n.read).length;

  return (
    <div className="px-4 pt-[max(10px,var(--safe-top))] pb-6 space-y-4">
      {/* New bookings land here without a reload — see migration 26 */}
      <RealtimeRefresher tables={["notifications"]} />

      <header className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-xl font-bold text-foreground flex-1">Notificaciones</h1>
        {unread > 0 && <MarkAllRead count={unread} />}
      </header>

      {!notifications || notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <Bell size={32} className="text-muted" />
          <p className="text-sm text-muted">No tienes notificaciones por ahora.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const Icon = iconFor(n.title);
            const body = (
              <>
                <span
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                    n.read ? "bg-background text-muted" : "bg-brand text-white"
                  )}
                >
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-foreground">{n.title}</span>
                  <span className="block text-sm text-muted mt-0.5">{n.body}</span>
                  <span className="block text-[11px] text-muted/70 mt-1">
                    {formatDistanceToNow(new Date(n.created_at), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </span>
                </span>
                {n.appointment_id && (
                  <ChevronRight size={16} className="text-muted shrink-0 self-center" />
                )}
              </>
            );

            return (
              <li key={n.id}>
                {n.appointment_id ? (
                  <Link
                    href={`/citas/${n.appointment_id}`}
                    className={cn(
                      "flex gap-3 rounded-2xl p-3 border active:bg-background",
                      n.read ? "bg-surface border-border" : "bg-brand-light border-brand/20"
                    )}
                  >
                    {body}
                  </Link>
                ) : (
                  <div
                    className={cn(
                      "flex gap-3 rounded-2xl p-3 border",
                      n.read ? "bg-surface border-border" : "bg-brand-light border-brand/20"
                    )}
                  >
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
