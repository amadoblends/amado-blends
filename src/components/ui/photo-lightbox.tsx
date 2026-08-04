"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X } from "lucide-react";

/** Full-screen view of a client photo, opened by tapping their avatar. */
export function PhotoLightbox({
  open,
  onClose,
  src,
  name,
}: {
  open: boolean;
  onClose: () => void;
  src: string | null;
  name: string;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center p-6 bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-[max(16px,var(--safe-top))] right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center"
      >
        <X size={20} />
      </button>

      <div
        className="relative w-full max-w-sm aspect-square rounded-3xl overflow-hidden bg-white/10 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {src ? (
          <Image src={src} alt={name} fill className="object-cover" sizes="384px" />
        ) : (
          <span className="text-6xl font-black text-white/70">{initials}</span>
        )}
      </div>

      <p className="text-white font-semibold mt-4 text-center">{name}</p>
    </div>,
    document.body
  );
}
