"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function CarruselError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Carrusel:", error);
  }, [error]);

  return (
    <div className="px-4 pt-[max(10px,var(--safe-top))] pb-6">
      <div className="bg-surface rounded-2xl border border-border p-6 space-y-4 text-center">
        <div className="w-14 h-14 rounded-full bg-danger-light flex items-center justify-center mx-auto">
          <AlertTriangle size={24} className="text-danger" />
        </div>
        <div>
          <p className="font-bold text-foreground">No se pudo abrir el carrusel</p>
          <p className="text-sm text-muted mt-1">
            Si es la primera vez, corre <code className="text-brand">migration_16</code> en
            Supabase. Si ya la corriste, reintenta.
          </p>
          {error.message && (
            <p className="text-xs text-muted mt-2 break-words bg-background rounded-lg px-3 py-2">
              {error.message}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl bg-brand text-white text-sm font-semibold"
          >
            <RotateCcw size={15} /> Reintentar
          </button>
          <Link
            href="/mas"
            className="flex-1 flex items-center justify-center h-11 rounded-xl border border-border text-sm font-semibold text-foreground"
          >
            Volver
          </Link>
        </div>
      </div>
    </div>
  );
}
