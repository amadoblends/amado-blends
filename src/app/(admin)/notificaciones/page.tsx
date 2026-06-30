import Link from "next/link";
import { ChevronLeft, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-4">
      <header className="flex items-center gap-3">
        <Link href="/" className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Notificaciones</h1>
      </header>

      {(!notifications || notifications.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <Bell size={32} className="text-muted" />
          <p className="text-sm text-muted">No tienes notificaciones por ahora.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li key={n.id} className={cn("rounded-xl p-3 border", n.read ? "bg-surface border-border" : "bg-brand-light border-brand/20")}>
              <p className="text-sm font-semibold text-foreground">{n.title}</p>
              <p className="text-sm text-muted mt-0.5">{n.body}</p>
              <p className="text-[11px] text-muted mt-1">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
