"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Droplet, Wind, Store, Scissors } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/ui/image-uploader";
import { upsertProduct, deleteProduct } from "@/lib/actions/products";
import { cn } from "@/lib/utils";
import { DEFAULT_CATEGORIES } from "@/lib/product-categories";

/** Any id from the product_categories table — see lib/product-categories. */
export type ProductCategory = string | null;

export interface ProductData {
  id: string;
  name: string;
  price: number;
  stock: number;
  low_stock_threshold: number;
  critical_stock_threshold: number;
  image_url: string | null;
  category?: ProductCategory;
  extra_minutes?: number | null;
  is_visible_for_sale?: boolean;
  available_for_services?: boolean;
  description?: string | null;
  purchase_url?: string | null;
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
  const [category, setCategory] = useState<ProductCategory>(product?.category ?? "other");
  const [extraMinutes, setExtraMinutes] = useState(product?.extra_minutes ?? 0);
  const [visibleForSale, setVisibleForSale] = useState(product?.is_visible_for_sale ?? true);
  const [availableForServices, setAvailableForServices] = useState(
    product?.available_for_services ?? true
  );

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("imageUrl", imageUrl ?? "");
    formData.set("category", category ?? "");
    formData.set("extraMinutes", String(extraMinutes));
    formData.set("visibleForSale", String(visibleForSale));
    formData.set("availableForServices", String(availableForServices));

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
          <input
            name="name"
            required
            maxLength={150}
            defaultValue={product?.name}
            className="form-input"
            placeholder="Ej. Pomada mate"
          />
        </Field>

        <Field label="Descripción (opcional)">
          <textarea
            name="description"
            rows={2}
            maxLength={500}
            defaultValue={product?.description ?? ""}
            placeholder="Beneficios, uso, ingredientes..."
            className="form-input resize-none"
          />
        </Field>

        {/* Category — drives how it's grouped when the client picks products */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Categoría
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {DEFAULT_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn(
                  "h-[54px] rounded-xl border text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 px-1 transition-colors",
                  category === c.id
                    ? "bg-foreground border-foreground text-background"
                    : "border-border bg-background text-muted"
                )}
              >
                <span className="text-base leading-none">{c.emoji}</span>
                <span className="leading-tight text-center">{c.label_es}</span>
              </button>
            ))}
          </div>
        </div>

        {/*
          * Extra time. A product that lengthens the visit has to change which
          * slots are offered, not just the receipt — the booking wizard adds
          * this to the service's duration for that appointment only.
          */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Tiempo adicional al servicio
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {[0, 5, 10, 15, 20].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setExtraMinutes(m)}
                className={cn(
                  "h-11 rounded-xl border text-xs font-bold transition-colors",
                  extraMinutes === m
                    ? "bg-brand border-brand text-white"
                    : "border-border bg-background text-muted"
                )}
              >
                {m === 0 ? "—" : `+${m}`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              min={0}
              max={240}
              value={extraMinutes}
              onChange={(e) => setExtraMinutes(Math.max(0, Number(e.target.value) || 0))}
              className="form-input w-24"
            />
            <p className="text-xs text-muted flex-1">
              {extraMinutes > 0
                ? `Si el cliente lo elige, su cita durará ${extraMinutes} min más.`
                : "No cambia la duración de la cita."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio ($)">
            <input
              type="number"
              name="price"
              min={0}
              step="0.01"
              required
              defaultValue={product?.price}
              className="form-input"
            />
          </Field>
          <Field label="Stock actual">
            <input
              type="number"
              name="stock"
              min={0}
              required
              defaultValue={product?.stock ?? 0}
              className="form-input"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Alerta stock bajo">
            <input
              type="number"
              name="lowStockThreshold"
              min={0}
              required
              defaultValue={product?.low_stock_threshold ?? 8}
              className="form-input"
            />
          </Field>
          <Field label="Alerta stock crítico">
            <input
              type="number"
              name="criticalStockThreshold"
              min={0}
              required
              defaultValue={product?.critical_stock_threshold ?? 3}
              className="form-input"
            />
          </Field>
        </div>

        <Field label="Enlace de compra online (opcional)">
          <input
            type="url"
            name="purchaseUrl"
            maxLength={2000}
            defaultValue={product?.purchase_url ?? ""}
            placeholder="https://tutienda.com/producto"
            className="form-input"
          />
          <p className="text-xs text-muted mt-1">
            Si lo dejas vacío, el botón &ldquo;Comprar online&rdquo; no aparece.
          </p>
        </Field>

        {/* Independent visibility switches */}
        <div className="space-y-2">
          <ToggleRow
            icon={<Store size={16} className="text-brand" />}
            title="Visible para venta"
            hint="Aparece en la tienda para que los clientes lo compren."
            checked={visibleForSale}
            onChange={() => setVisibleForSale((v) => !v)}
          />
          <ToggleRow
            icon={<Scissors size={16} className="text-brand" />}
            title="Disponible para servicios"
            hint="El cliente puede pedir que lo uses durante su cita, aunque no esté a la venta."
            checked={availableForServices}
            onChange={() => setAvailableForServices((v) => !v)}
          />
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
            font-size: 1rem;
            color: var(--foreground);
          }
        `}</style>
      </form>
    </Modal>
  );
}

function CategoryButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors",
        active ? "bg-brand border-brand text-white" : "border-border bg-background text-muted"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ToggleRow({
  icon,
  title,
  hint,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-background rounded-xl border border-border px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
          {icon}
          {title}
        </p>
        <p className="text-xs text-muted mt-0.5">{hint}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
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
