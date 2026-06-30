"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertService } from "@/lib/actions/products";

export function ServiceForm({
  serviceId,
  defaults,
}: {
  serviceId?: string;
  defaults?: { name: string; durationMinutes: number; price: number; color: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await upsertService(serviceId ?? null, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/servicios");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <Field label="Nombre del servicio">
        <input name="name" required maxLength={150} defaultValue={defaults?.name} className="form-input" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duración (min)">
          <input type="number" name="durationMinutes" min={5} required defaultValue={defaults?.durationMinutes ?? 30} className="form-input" />
        </Field>
        <Field label="Precio">
          <input type="number" name="price" min={0} step="0.01" required defaultValue={defaults?.price} className="form-input" />
        </Field>
      </div>
      <Field label="Color">
        <input type="color" name="color" defaultValue={defaults?.color ?? "#FF6A3D"} className="form-input h-12" />
      </Field>

      {error && <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-brand text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-60"
      >
        {isPending ? "Guardando..." : serviceId ? "Guardar cambios" : "Crear servicio"}
      </button>

      <style jsx global>{`
        .form-input {
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
