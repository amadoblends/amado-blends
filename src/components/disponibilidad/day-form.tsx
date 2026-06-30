"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAvailabilityDay } from "@/lib/actions/availability";
import { cn } from "@/lib/utils";

export function DayForm({
  weekday,
  defaults,
}: {
  weekday: number;
  defaults: {
    isActive: boolean;
    startTime: string;
    endTime: string;
    breakStartTime: string;
    breakEndTime: string;
    slotMinutes: number;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState(defaults.isActive);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("weekday", String(weekday));
    formData.set("isActive", active ? "true" : "false");

    startTransition(async () => {
      const result = await updateAvailabilityDay(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/disponibilidad");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="bg-surface rounded-2xl border border-border p-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Día laboral</p>
        <button
          type="button"
          onClick={() => setActive((v) => !v)}
          className={cn("relative h-6 w-11 rounded-full transition-colors", active ? "bg-brand" : "bg-border")}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              active ? "translate-x-[22px]" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Horario de trabajo</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde">
            <input type="time" name="startTime" required defaultValue={defaults.startTime} className="form-input" />
          </Field>
          <Field label="Hasta">
            <input type="time" name="endTime" required defaultValue={defaults.endTime} className="form-input" />
          </Field>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Descanso (opcional)</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde">
            <input type="time" name="breakStartTime" defaultValue={defaults.breakStartTime} className="form-input" />
          </Field>
          <Field label="Hasta">
            <input type="time" name="breakEndTime" defaultValue={defaults.breakEndTime} className="form-input" />
          </Field>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-4">
        <Field label="Tiempo entre citas">
          <select name="slotMinutes" defaultValue={defaults.slotMinutes} className="form-input">
            {[15, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-brand text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-60"
      >
        {isPending ? "Guardando..." : "Guardar"}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
