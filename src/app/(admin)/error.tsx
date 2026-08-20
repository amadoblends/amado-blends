"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

/**
 * The last stop before Vercel's error screen.
 *
 * Anything a page or a component throws lands here and stays inside the app:
 * the barber gets a card they can read and retry from, still in the panel,
 * instead of a white page with a reload button and no way back.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Keeps the real cause reachable in the console and in Vercel's logs
    console.error("Panel:", error);
  }, [error]);

  return (
    <div className="px-4 pt-[max(10px,var(--safe-top))] pb-6">
      <div className="bg-surface rounded-2xl border border-border p-6 space-y-4 text-center">
        <div className="w-14 h-14 rounded-full bg-danger-light flex items-center justify-center mx-auto">
          <AlertTriangle size={24} className="text-danger" />
        </div>
        <div>
          <p className="font-bold text-foreground">Algo salió mal en esta pantalla</p>
          <p className="text-sm text-muted mt-1">
            Tus datos están a salvo. Reintenta, o vuelve al inicio.
          </p>
          {error.message && (
            <p className="text-xs text-muted mt-2 break-words bg-background rounded-lg px-3 py-2 text-left">
              {error.message}
            </p>
          )}
          {error.digest && (
            <p className="text-[10px] text-muted/60 mt-1.5 font-mono">{error.digest}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl bg-brand text-white text-sm font-semibold"
          >
            <RotateCcw size={15} /> Reintentar
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border border-border text-sm font-semibold text-foreground"
          >
            <Home size={15} /> Inicio
          </button>
        </div>
      </div>
    </div>
  );
}
