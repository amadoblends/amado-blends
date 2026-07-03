"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleAvailabilityDay } from "@/lib/actions/availability";
import { Switch } from "@/components/ui/switch";

export function DayToggle({ weekday, isActive }: { weekday: number; isActive: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(isActive);
  const [isPending, startTransition] = useTransition();

  // Re-sync with the server value whenever it changes (router.refresh,
  // realtime updates, another device) so the toggle never drifts.
  useEffect(() => {
    if (!isPending) setChecked(isActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  function handleToggle() {
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
    <Switch
      checked={checked}
      onChange={handleToggle}
      disabled={isPending}
      label={checked ? "Desactivar día" : "Activar día"}
    />
  );
}
