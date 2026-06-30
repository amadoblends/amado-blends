"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertProduct } from "@/lib/actions/products";

export function ProductForm({
  productId,
  defaults,
}: {
  productId?: string;
  defaults?: { name: string; price: number; stock: number; lowStockThreshold: number; criticalStockThreshold: number };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await upsertProduct(productId ?? null, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/productos");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <Field label="Nombre del producto">
        <input name="name" required maxLength={150} defaultValue={defaults?.name} className="form-input" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio">
          <input type="number" name="price" min={0} step="0.01" required defaultValue={defaults?.price} className="form-input" />
        </Field>
        <Field label="Stock actual">
          <input type="number" name="stock" min={0} required defaultValue={defaults?.stock} className="form-input" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Alerta stock bajo">
          <input type="number" name="lowStockThreshold" min={0} required defaultValue={defaults?.lowStockThreshold ?? 8} className="form-input" />
        </Field>
        <Field label="Alerta stock crítico">
          <input type="number" name="criticalStockThreshold" min={0} required defaultValue={defaults?.criticalStockThreshold ?? 3} className="form-input" />
        </Field>
      </div>

      {error && <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-brand text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-60"
      >
        {isPending ? "Guardando..." : productId ? "Guardar cambios" : "Crear producto"}
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
