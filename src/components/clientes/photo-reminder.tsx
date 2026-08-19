"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, X } from "lucide-react";

const DISMISSED_KEY = "photoReminderDismissed.v1";
/** How long "Más tarde" holds before the reminder can come back. */
const SNOOZE_MS = 3 * 24 * 3600_000;

export interface PhotoReminderClient {
  id: string;
  full_name: string;
}

/**
 * A nudge to photograph the clients who don't have a picture yet.
 *
 * It appears at most once every few days and never blocks anything: the point
 * is a face on the calendar card, which is worth a reminder but not worth
 * standing between the barber and their day.
 */
export function PhotoReminder({ clients }: { clients: PhotoReminderClient[] }) {
  const [ready, setReady] = useState(false);

  // Read on the client only, so the server render doesn't disagree with it
  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
      setReady(Date.now() > until);
    } catch {
      // storage blocked — showing it is the safer default
      setReady(true);
    }
  }, []);

  function snooze() {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      // ignore
    }
    setReady(false);
  }

  if (!ready || clients.length === 0) return null;

  const first = clients[0];
  const others = clients.length - 1;

  return (
    <div className="bg-surface rounded-2xl border border-border p-3.5 flex items-start gap-3">
      <span className="w-9 h-9 rounded-xl bg-brand-light text-brand flex items-center justify-center shrink-0">
        <Camera size={17} />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">Falta la foto de {first.full_name}</p>
        <p className="text-xs text-muted">
          {others > 0
            ? `Y ${others} cliente${others === 1 ? "" : "s"} más sin foto.`
            : "Con foto es más fácil reconocerlo en el calendario."}
        </p>

        <div className="flex gap-2 mt-2.5">
          <Link
            href={`/clientes/${first.id}`}
            className="flex-1 h-9 rounded-xl bg-brand text-white text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Camera size={13} />
            Tomar foto
          </Link>
          <button
            onClick={snooze}
            className="flex-1 h-9 rounded-xl border border-border bg-background text-xs font-bold text-muted"
          >
            Más tarde
          </button>
        </div>
      </div>

      <button
        onClick={snooze}
        aria-label="Cerrar recordatorio"
        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted shrink-0"
      >
        <X size={15} />
      </button>
    </div>
  );
}
