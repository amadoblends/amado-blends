"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createAppointment } from "@/lib/actions/appointments";
import type { AvailabilityDay } from "@/lib/data/availability";

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatSlot(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, "0")} ${period}`;
}

function generateSlots(day: AvailabilityDay | undefined): string[] {
  if (!day || !day.is_active) return [];
  const start = toMinutes(day.start_time);
  const end = toMinutes(day.end_time);
  const slot = day.slot_minutes;
  const breakStart = day.break_start_time ? toMinutes(day.break_start_time) : null;
  const breakEnd = day.break_end_time ? toMinutes(day.break_end_time) : null;

  const result: string[] = [];
  for (let t = start; t + slot <= end; t += slot) {
    if (breakStart !== null && breakEnd !== null && t < breakEnd && t + slot > breakStart) continue;
    result.push(fromMinutes(t));
  }
  return result;
}

export function NewAppointmentForm({
  clients,
  services,
  defaultDate,
  availability,
}: {
  clients: { id: string; full_name: string }[];
  services: { id: string; name: string; duration_minutes: number; price: number }[];
  defaultDate: string;
  availability: AvailabilityDay[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [selectedService, setSelectedService] = useState<typeof services[number] | undefined>(services[0]);

  const slots = useMemo(() => {
    // getDay() returns 0=Sun…6=Sat, matches our weekday column
    const weekday = new Date(selectedDate + "T00:00:00").getDay();
    const day = availability.find((d) => d.weekday === weekday);
    return generateSlots(day);
  }, [selectedDate, availability]);

  function handleSubmit(formData: FormData) {
    setError(null);
    const date = formData.get("date") as string;
    const time = formData.get("time") as string;
    if (!time) {
      setError("Este día no tiene horario configurado. Ve a Disponibilidad para activarlo.");
      return;
    }
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

      <Field label="Fecha">
        <input
          type="date"
          name="date"
          required
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="form-select"
        />
      </Field>

      <Field label="Hora">
        {slots.length > 0 ? (
          <select name="time" required className="form-select">
            {slots.map((slot) => (
              <option key={slot} value={slot}>
                {formatSlot(slot)}
              </option>
            ))}
          </select>
        ) : (
          <div className="bg-warning-light rounded-xl px-3 py-2.5">
            <p className="text-sm text-warning font-medium">
              Sin horario para este día.{" "}
              <a href="/disponibilidad" className="underline">
                Configura la disponibilidad
              </a>{" "}
              primero.
            </p>
          </div>
        )}
      </Field>

      <Field label="Notas (opcional)">
        <textarea name="notes" maxLength={500} rows={3} className="form-select resize-none" />
      </Field>

      {error && <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={isPending || slots.length === 0}
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
          color: var(--foreground);
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
