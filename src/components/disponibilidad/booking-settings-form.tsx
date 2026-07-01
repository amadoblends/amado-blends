"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBookingSettings } from "@/lib/actions/availability";

export function BookingSettingsForm({
  bookingWindowDays,
  minNoticeMinutes,
  bufferMinutes,
}: {
  bookingWindowDays: number;
  minNoticeMinutes: number;
  bufferMinutes: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await updateBookingSettings(formData);
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error ?? "Error al guardar.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="bg-surface rounded-2xl border border-border p-4 space-y-4">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">Ventana de reservas</p>

        <Field
          label="Días con anticipación que se puede reservar"
          hint="Ejemplo: 30 = el cliente puede reservar hasta 30 días hacia adelante"
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              name="bookingWindowDays"
              min={1}
              max={365}
              required
              defaultValue={bookingWindowDays}
              className="form-input flex-1"
            />
            <span className="text-sm text-muted whitespace-nowrap">días</span>
          </div>
        </Field>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-4 space-y-4">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">Antelación mínima</p>

        <Field
          label="Tiempo mínimo antes de poder reservar"
          hint="Ejemplo: 60 = el cliente debe reservar con al menos 1 hora de anticipación"
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              name="minNoticeMinutes"
              min={0}
              max={10080}
              required
              defaultValue={minNoticeMinutes}
              className="form-input flex-1"
            />
            <span className="text-sm text-muted whitespace-nowrap">minutos</span>
          </div>
        </Field>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-4 space-y-4">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">Buffer entre citas</p>

        <Field
          label="Tiempo de preparación entre citas"
          hint="Se agrega después de cada cita para limpieza y preparación. Ej: 10 min"
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              name="bufferMinutes"
              min={0}
              max={120}
              required
              defaultValue={bufferMinutes}
              className="form-input flex-1"
            />
            <span className="text-sm text-muted whitespace-nowrap">minutos</span>
          </div>
        </Field>
      </div>

      {error && (
        <p className="text-sm text-danger bg-danger-light rounded-xl px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-brand text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-60"
      >
        {isPending ? "Guardando..." : saved ? "¡Guardado ✓" : "Guardar configuración"}
      </button>

      <style jsx global>{`
        .form-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          border: 1px solid var(--border);
          background: var(--background);
          font-size: 0.875rem;
          color: var(--foreground);
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground mb-1 block">{label}</label>
      {hint && <p className="text-xs text-muted mb-2">{hint}</p>}
      {children}
    </div>
  );
}
