"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClientRecord, updateClientRecord, deleteClientRecord } from "@/lib/actions/clients";

interface ClientFormProps {
  mode: "create" | "edit";
  clientId?: string;
  defaults?: {
    fullName: string;
    phone: string;
    email: string;
    birthDate: string;
    quickNotes: string;
  };
}

export function ClientForm({ mode, clientId, defaults }: ClientFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createClientRecord(formData)
          : await updateClientRecord(clientId!, formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (mode === "create" && "id" in result) {
        router.push(`/clientes/${result.id}`);
      } else {
        router.push(`/clientes/${clientId}`);
      }
      router.refresh();
    });
  }

  function handleDelete() {
    if (!clientId) return;
    if (!confirm("¿Eliminar este cliente? Esta acción no se puede deshacer.")) return;
    startTransition(async () => {
      const result = await deleteClientRecord(clientId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/clientes");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <Field label="Nombre">
        <input name="fullName" required maxLength={120} defaultValue={defaults?.fullName} className="form-input" />
      </Field>
      <Field label="Teléfono">
        <input name="phone" required maxLength={20} defaultValue={defaults?.phone} className="form-input" />
      </Field>
      <Field label="Correo electrónico">
        <input type="email" name="email" maxLength={150} defaultValue={defaults?.email} className="form-input" />
      </Field>
      <Field label="Fecha de nacimiento">
        <input type="date" name="birthDate" defaultValue={defaults?.birthDate} className="form-input" />
      </Field>
      <Field label="Notas rápidas">
        <textarea name="quickNotes" rows={3} maxLength={1000} defaultValue={defaults?.quickNotes} className="form-input resize-none" />
      </Field>

      {error && <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-violet text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-60"
      >
        {isPending ? "Guardando..." : mode === "create" ? "Crear cliente" : "Guardar cambios"}
      </button>

      {mode === "edit" && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="w-full text-danger font-semibold py-2 text-sm"
        >
          Eliminar cliente
        </button>
      )}

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
