"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface UnseenCounts {
  citas: number;
  feedback: number;
}

const EMPTY: UnseenCounts = { citas: 0, feedback: 0 };

const UnseenContext = createContext<UnseenCounts>(EMPTY);

/** Which inbox a path belongs to, or null if it isn't one. */
function inboxFor(pathname: string): "citas" | "feedback" | null {
  if (pathname.startsWith("/mas/feedback")) return "feedback";
  if (pathname.startsWith("/citas")) return "citas";
  return null;
}

/**
 * Keeps the nav badges honest.
 *
 * The counts come from one RPC rather than from fetching rows, and they clear
 * the moment the barber actually opens the inbox — which is the whole point:
 * a badge that only counts up eventually gets ignored, and then it's worse
 * than nothing.
 */
export function UnseenProvider({
  initial,
  children,
}: {
  initial: UnseenCounts;
  children: React.ReactNode;
}) {
  const [counts, setCounts] = useState<UnseenCounts>(initial);
  const pathname = usePathname();

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("unseen_counts");
    // Before migration 30 the function doesn't exist; no badge is the right
    // answer, not a crash.
    if (error || !data) return;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;
    setCounts({ citas: Number(row.citas ?? 0), feedback: Number(row.feedback ?? 0) });
  }, []);

  // Opening the inbox is what marks it seen
  useEffect(() => {
    const inbox = inboxFor(pathname);
    if (!inbox) return;

    // Clear locally first so the badge disappears with the tap, not after the
    // round trip
    setCounts((c) => ({ ...c, [inbox]: 0 }));

    const supabase = createClient();
    supabase
      .rpc("mark_seen", { p_inbox: inbox })
      .then(() => undefined);
  }, [pathname]);

  /*
   * The server already recomputes these on every render, and the calendar's
   * RealtimeRefresher makes the route re-render whenever an appointment
   * changes — so `initial` arrives fresh without this component asking for
   * anything. Following it is free.
   *
   * This used to open its own socket on `appointments` as well, which meant
   * the dashboard and the calendar each ran TWO channels on the same table:
   * one booking woke both, one doing a full route refresh and the other an
   * RPC for the same numbers.
   */
  useEffect(() => {
    setCounts(initial);
  }, [initial.citas, initial.feedback]);

  /*
   * Only feedback keeps a socket. Nothing else refreshes the route when a
   * client writes one, and they are rare enough that a channel for them costs
   * nothing.
   */
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    const channel = supabase.channel(`unseen-feedback-${Math.random().toString(36).slice(2, 8)}`);

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      channel
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "feedback" },
          () => refetch()
        )
        .subscribe();
    })();

    // Coming back to the tab is the other moment the numbers can be stale
    const onVisible = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return <UnseenContext.Provider value={counts}>{children}</UnseenContext.Provider>;
}

export function useUnseen(): UnseenCounts {
  return useContext(UnseenContext);
}
