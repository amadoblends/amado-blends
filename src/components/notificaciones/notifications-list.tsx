"use client";

import { useEffect, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarPlus, CalendarX, CalendarClock, ChevronRight, CheckCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { shopDateStr, shopTime } from "@/lib/timezone";

export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  appointment_id: string | null;
}

/** A glanceable icon per kind of notice. */
function iconFor(title: string) {
  const t = title.toLowerCase();
  if (t.includes("cancel") || t.includes("no asist")) return CalendarX;
  if (t.includes("reprogram")) return CalendarClock;
  return CalendarPlus;
}

/**
 * Grouped by the shop's calendar day, newest first.
 *
 * Opening the screen marks everything on it as read: the barber has now seen
 * these, so leaving them bold would make the badge meaningless. The rows stay
 * in the list either way — read is not the same as gone.
 */
export function NotificationsList({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const unreadIds = useMemo(
    () => notifications.filter((n) => !n.read).map((n) => n.id),
    [notifications]
  );

  useEffect(() => {
    if (unreadIds.length === 0) return;
    let cancelled = false;

    // A short delay so the unread highlight is actually seen before it fades
    const id = setTimeout(async () => {
      const supabase = createClient();
      await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
      if (!cancelled) startTransition(() => router.refresh());
    }, 1200);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadIds.join(",")]);

  const groups = useMemo(() => {
    const map = new Map<string, NotificationRow[]>();
    for (const n of notifications) {
      // Bucketed by the shop's day, so a late-evening booking doesn't jump
      const key = shopDateStr(n.created_at);
      const list = map.get(key) ?? [];
      list.push(n);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [notifications]);

  function label(dayKey: string) {
    const d = new Date(dayKey + "T12:00:00");
    if (isToday(d)) return "Hoy";
    if (isYesterday(d)) return "Ayer";
    return format(d, "d 'de' MMMM", { locale: es });
  }

  return (
    <div className="space-y-5">
      {isPending && (
        <p className="text-[11px] text-muted flex items-center gap-1.5">
          <Loader2 size={11} className="animate-spin" />
          Marcando como leídas...
        </p>
      )}

      {groups.map(([dayKey, items]) => (
        <section key={dayKey} className="space-y-2">
          <h2 className="text-[11px] font-bold text-muted uppercase tracking-wide flex items-center gap-2">
            {label(dayKey)}
            <span className="flex-1 h-px bg-border" />
            <span className="font-semibold normal-case tracking-normal">{items.length}</span>
          </h2>

          <ul className="space-y-2">
            {items.map((n) => {
              const Icon = iconFor(n.title);
              const inner = (
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
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-foreground">{n.title}</span>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />}
                    </span>
                    <span className="block text-sm text-muted mt-0.5">{n.body}</span>
                    <span className="block text-[11px] text-muted/70 mt-1 tnum">
                      {shopTime(n.created_at)}
                    </span>
                  </span>
                  {n.appointment_id && (
                    <ChevronRight size={16} className="text-muted shrink-0 self-center" />
                  )}
                </>
              );

              const classes = cn(
                "flex gap-3 rounded-2xl p-3 border transition-colors",
                n.read ? "bg-surface border-border" : "bg-brand-light border-brand/20"
              );

              return (
                <li key={n.id}>
                  {n.appointment_id ? (
                    <Link href={`/citas/${n.appointment_id}`} className={cn(classes, "active:bg-background")}>
                      {inner}
                    </Link>
                  ) : (
                    <div className={classes}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Kept for the header; marking read happens automatically on open. */
export function MarkAllReadButton({ count }: { count: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function markAll() {
    const supabase = createClient();
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    startTransition(() => router.refresh());
  }

  return (
    <button
      onClick={markAll}
      disabled={isPending}
      className="h-9 px-3 rounded-xl bg-surface border border-border flex items-center gap-1.5 text-xs font-bold text-foreground shrink-0 active:scale-95 transition-transform"
    >
      {isPending ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <CheckCheck size={14} className="text-brand" />
      )}
      Leídas ({count})
    </button>
  );
}
