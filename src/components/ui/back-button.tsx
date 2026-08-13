"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Goes back the way the barber actually came.
 *
 * `router.back()` alone walks raw browser history, which sends you somewhere
 * unrelated when the page was opened directly, after a refresh, or from a
 * notification — there is no in-app entry behind it to return to. When that's
 * the case we go to `fallback` instead, which is the section this screen
 * genuinely belongs under.
 */
export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(true);

  useEffect(() => {
    // A fresh tab or a hard load leaves nothing of ours to pop back to
    const entries = window.history.length;
    const cameFromApp =
      document.referrer === "" ? entries > 1 : document.referrer.startsWith(window.location.origin);
    setCanGoBack(entries > 1 && cameFromApp);
  }, []);

  return (
    <button
      onClick={() => (canGoBack ? router.back() : router.push(fallback))}
      aria-label="Volver"
      className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center shrink-0 active:bg-background"
    >
      <ChevronLeft size={20} />
    </button>
  );
}
