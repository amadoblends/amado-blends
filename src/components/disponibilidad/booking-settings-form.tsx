"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBookingSettings } from "@/lib/actions/availability";

export function BookingSettingsForm({
  bookingWindowDays,
  minNoticeMinutes,
}: {
  bookingWindowDays: number;
  minNoticeMinutes: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSubmit(formData: FormData) {
    setSaved(false);
    startTransition(async () => {
      const result = await updateBookingSettings(formData);
      if (result.ok) {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <form action={handleSubmit} className="bg-surface rounded-2xl border border-border p-4 space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          Días que el cliente puede ver/reservar por adelantado
        </label>
        <input
          type="number"
          name="bookingWindowDays"
          min={1}
          max={365}
          required
          defaultValue={bookingWindowDays}
          className="form-input"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Antelación mínima (minutos)</label>
        <input
          type="number"
          name="minNoticeMinutes"
          min={0}
          max={10080}
          required
          defaultValue={minNoticeMinutes}
          className="form-input"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-foreground text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-60"
      >
        {isPending ? "Guardando..." : saved ? "Guardado ✓" : "Guardar configuración"}
      </button>
      <style jsx global>{`
        .form-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          border: 1px solid var(--border);
          background: var(--background);
          font-size: 0.875rem;
        }
      `}</style>
    </form>
  );
}
