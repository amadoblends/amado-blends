"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAppointment } from "@/lib/actions/appointments";

export function NewAppointmentForm({
  clients,
  services,
  defaultDate,
}: {
  clients: { id: string; full_name: string }[];
  services: { id: string; name: string; duration_minutes: number; price: number }[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<typeof services[number] | undefined>(services[0]);

  function handleSubmit(formData: FormData) {
    setError(null);
    const date = formData.get("date") as string;
    const time = formData.get("time") as string;
    formData.set("startsAt", new Date(`${date}T${time}:00`).toISOString());
    formData.set("durationMinutes", String(selectedService?.duration_minutes ?? 30));
    formData.set("price", String(selectedService?.price ?? 0));

    startTransition(async () => {
      const result = await createAppointment(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/citas?date=${date}`);
      router.refresh();
    });
  }

  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted bg-surface border border-border rounded-xl p-4">
        Primero registra al menos un cliente para poder crear citas.
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <Field label="Cliente">
        <select name="clientId" required className="form-select">
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Servicio">
        <select
          name="serviceId"
          required
          className="form-select"
          onChange={(e) => setSelectedService(services.find((s) => s.id === e.target.value))}
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.duration_minutes} min · ${s.price}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha">
          <input type="date" name="date" required defaultValue={defaultDate} className="form-select" />
        </Field>
        <Field label="Hora">
          <input type="time" name="time" required defaultValue="10:00" className="form-select" />
        </Field>
      </div>

      <Field label="Notas (opcional)">
        <textarea name="notes" maxLength={500} rows={3} className="form-select resize-none" />
      </Field>

      {error && <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-brand text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-60"
      >
        {isPending ? "Guardando..." : "Crear cita"}
      </button>

      <style jsx global>{`
        .form-select {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          border: 1px solid var(--border);
          background: var(--surface);
          font-size: 0.875rem;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
