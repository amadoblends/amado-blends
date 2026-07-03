"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAvailabilityDay } from "@/lib/actions/availability";
import { Switch } from "@/components/ui/switch";

// 6:00 AM – 11:00 PM in 15-minute steps, formatted for display
const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let mins = 6 * 60; mins <= 23 * 60; mins += 15) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  TIME_OPTIONS.push({
    value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    label: `${displayH}:${String(m).padStart(2, "0")} ${period}`,
  });
}

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
      <div className="bg-surface rounded-2xl border border-border p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">Día laboral</p>
          <p className="text-sm text-muted mt-0.5">
            {active ? "Aceptas citas este día" : "Día libre, sin citas"}
          </p>
        </div>
        <Switch checked={active} onChange={() => setActive((v) => !v)} label="Día laboral" />
      </div>

      <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <p className="text-base font-semibold text-foreground">Horario de trabajo</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde">
            <TimeSelect name="startTime" defaultValue={defaults.startTime} required />
          </Field>
          <Field label="Hasta">
            <TimeSelect name="endTime" defaultValue={defaults.endTime} required />
          </Field>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <p className="text-base font-semibold text-foreground">Descanso (opcional)</p>
        <p className="text-sm text-muted -mt-1.5">Ej. hora de almuerzo. Déjalo vacío si no aplica.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde">
            <TimeSelect name="breakStartTime" defaultValue={defaults.breakStartTime} allowEmpty />
          </Field>
          <Field label="Hasta">
            <TimeSelect name="breakEndTime" defaultValue={defaults.breakEndTime} allowEmpty />
          </Field>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <p className="text-base font-semibold text-foreground">Tiempo entre citas</p>
        <p className="text-sm text-muted -mt-1.5">
          Cada cuántos minutos se ofrecen turnos. Escribe el número que quieras (5 a 240).
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            name="slotMinutes"
            min={5}
            max={240}
            step={5}
            required
            defaultValue={defaults.slotMinutes}
            inputMode="numeric"
            className="form-input !w-28 text-center font-semibold"
          />
          <span className="text-sm text-muted">minutos</span>
        </div>
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
          font-size: 1rem;
          color: var(--foreground);
          appearance: none;
          -webkit-appearance: none;
        }
      `}</style>
    </form>
  );
}

function TimeSelect({
  name,
  defaultValue,
  required,
  allowEmpty,
}: {
  name: string;
  defaultValue: string;
  required?: boolean;
  allowEmpty?: boolean;
}) {
  return (
    <select name={name} defaultValue={defaultValue} required={required} className="form-input">
      {allowEmpty && <option value="">— Sin definir —</option>}
      {TIME_OPTIONS.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
