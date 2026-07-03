"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Date/time rendered in the BROWSER's timezone. Server components on Vercel
 * run in UTC, so formatting there shows times 4-5 hours off — these render
 * after hydration with the user's local clock.
 */

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function LocalLongDate({ iso }: { iso: string }) {
  const mounted = useMounted();
  if (!mounted) return <span>…</span>;
  return (
    <span className="capitalize">
      {format(new Date(iso), "EEEE, d 'de' MMMM yyyy", { locale: es })}
    </span>
  );
}

export function LocalTime({ iso }: { iso: string }) {
  const mounted = useMounted();
  if (!mounted) return <span>…</span>;
  return <span>{format(new Date(iso), "h:mm a")}</span>;
}

export function LocalTimeRange({ startIso, endIso }: { startIso: string; endIso: string }) {
  const mounted = useMounted();
  if (!mounted) return <span>…</span>;
  return (
    <span>
      {format(new Date(startIso), "h:mm a")} – {format(new Date(endIso), "h:mm a")}
    </span>
  );
}
