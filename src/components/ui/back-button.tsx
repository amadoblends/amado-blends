"use client";

import { ChevronLeft } from "lucide-react";
import { useAppNavigation } from "@/components/nav/navigation-history";

/**
 * Goes back the way the barber actually came.
 *
 * The decision lives in NavigationHistoryProvider, which records the route
 * path as it's walked. This button only asks it to step back — and when there
 * is nothing of ours behind, that provider lands on the dashboard rather than
 * out of the app.
 *
 * `fallback` is kept for the few screens that want somewhere other than the
 * dashboard when there's no history, but it is deliberately the exception:
 * the point of the provider is that Back doesn't need to be told.
 */
export function BackButton({ fallback }: { fallback?: string }) {
  const { back } = useAppNavigation();

  return (
    <button
      onClick={() => back(fallback)}
      aria-label="Volver"
      className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center shrink-0 active:bg-background"
    >
      <ChevronLeft size={20} />
    </button>
  );
}
