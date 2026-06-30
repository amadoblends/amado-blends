"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleAvailabilityDay } from "@/lib/actions/availability";
import { cn } from "@/lib/utils";

export function DayToggle({ weekday, isActive }: { weekday: number; isActive: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(isActive);
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !checked;
    setChecked(next);
    startTransition(async () => {
      const result = await toggleAvailabilityDay(weekday, next);
      if (!result.ok) {
        setChecked(!next);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={checked ? "Desactivar día" : "Activar día"}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors shrink-0 disabled:opacity-60",
        checked ? "bg-brand" : "bg-border"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
