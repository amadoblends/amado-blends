"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { X, UserSearch, Footprints, Lock } from "lucide-react";
import { fmtHHMM } from "@/lib/time";

export type SlotAction = "search" | "walkin" | "block";

/**
 * Opens after the barber taps the placeholder they just placed on the
 * calendar. Icon-led on purpose: three choices, no reading required, and each
 * one drops straight into its flow rather than asking the same question again.
 */
export function SlotActionsCard({
  slot,
  onClose,
  onPick,
}: {
  slot: { date: string; time: string } | null;
  onClose: () => void;
  onPick: (action: SlotAction) => void;
}) {
  useEffect(() => {
    if (!slot) return;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [slot, onClose]);

  if (!slot || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center p-4"
      style={{
        paddingTop: "max(1rem, var(--safe-top))",
        paddingBottom: "max(1rem, var(--safe-bottom))",
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-[330px] bg-surface rounded-[28px] ring-1 ring-border shadow-2xl animate-sheet-in p-5">
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-background flex items-center justify-center"
        >
          <X size={15} strokeWidth={2.6} />
        </button>

        <div className="text-center mb-5 pt-1">
          <p className="text-[26px] font-extrabold text-foreground leading-none tnum">
            {fmtHHMM(slot.time)}
          </p>
          <p className="text-xs text-muted capitalize mt-1.5">
            {format(new Date(slot.date + "T00:00:00"), "EEEE d 'de' MMMM", { locale: es })}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <Tile
            onClick={() => onPick("search")}
            icon={<UserSearch size={26} strokeWidth={1.8} />}
            label="Cliente"
            tone="brand"
          />
          <Tile
            onClick={() => onPick("walkin")}
            icon={<Footprints size={26} strokeWidth={1.8} />}
            label="Walk-in"
            tone="brand"
          />
          <Tile
            onClick={() => onPick("block")}
            icon={<Lock size={24} strokeWidth={1.9} />}
            label="Bloquear"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

function Tile({
  onClick,
  icon,
  label,
  tone,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone?: "brand";
}) {
  return (
    <button
      onClick={onClick}
      className="h-[92px] rounded-2xl bg-background flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
    >
      <span className={tone === "brand" ? "text-brand" : "text-muted"}>{icon}</span>
      <span className="text-[11px] font-bold text-foreground">{label}</span>
    </button>
  );
}
