"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { ImageUploader } from "@/components/ui/image-uploader";
import { upsertProduct, deleteProduct } from "@/lib/actions/products";

export interface ProductData {
  id: string;
  name: string;
  price: number;
  stock: number;
  low_stock_threshold: number;
  critical_stock_threshold: number;
  image_url: string | null;
}

export function ProductModal({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product: ProductData | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url ?? null);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("imageUrl", imageUrl ?? "");

    startTransition(async () => {
      const result = await upsertProduct(product?.id ?? null, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function handleDelete() {
    if (!product) return;
    if (!confirm("¿Eliminar este producto?")) return;
    startTransition(async () => {
      const result = await deleteProduct(product.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={product ? "Editar producto" : "Nuevo producto"}>
      <form action={handleSubmit} className="space-y-4" key={product?.id ?? "new"}>
        <ImageUploader folder="products" value={imageUrl} onChange={setImageUrl} />

        <Field label="Nombre del producto">
          <input name="name" required maxLength={150} defaultValue={product?.name} className="form-input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio">
            <input type="number" name="price" min={0} step="0.01" required defaultValue={product?.price} className="form-input" />
          </Field>
          <Field label="Stock actual">
            <input type="number" name="stock" min={0} required defaultValue={product?.stock ?? 0} className="form-input" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Alerta stock bajo">
            <input type="number" name="lowStockThreshold" min={0} required defaultValue={product?.low_stock_threshold ?? 8} className="form-input" />
          </Field>
          <Field label="Alerta stock crítico">
            <input type="number" name="criticalStockThreshold" min={0} required defaultValue={product?.critical_stock_threshold ?? 3} className="form-input" />
          </Field>
        </div>

        {error && <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-brand text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {isPending ? "Guardando..." : product ? "Guardar cambios" : "Crear producto"}
        </button>

        {product && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="w-full text-danger font-semibold py-2 text-sm"
          >
            Eliminar producto
          </button>
        )}

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
    </Modal>
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
