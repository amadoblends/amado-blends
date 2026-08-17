"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";

import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/ui/image-uploader";
import { upsertService, deleteService } from "@/lib/actions/products";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CATEGORIES,
  categoryLabel,
  categoryEmoji,
} from "@/lib/product-categories";
import type { ServiceKind } from "@/lib/supabase/types";
import { useConfirm } from "@/components/ui/confirm-dialog";

export interface ProductOption {
  id: string;
  name: string;
  /** Any id from product_categories — see lib/product-categories. */
  category: string | null;
}

export interface ServiceData {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  color: string;
  kind: ServiceKind;
  image_url: string | null;
  description?: string | null;
  is_public?: boolean;
  package_item_ids?: string[];
  product_ids?: string[];
}

// Colors are assigned automatically from this palette (no manual picker)
const COLOR_PALETTE = [
  "#FF6A3D", "#7C5CFF", "#1EA672", "#2F7BF6", "#E8A000",
  "#E0473E", "#0EA5B7", "#D946EF", "#84CC16", "#F97316",
];

function autoColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

export function ServiceModal({
  open,
  onClose,
  service,
  initialKind = "single",
  availableServices,
  availableProducts = [],
}: {
  open: boolean;
  onClose: () => void;
  service: ServiceData | null;
  initialKind?: ServiceKind;
  availableServices: { id: string; name: string }[];
  availableProducts?: ProductOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(service?.image_url ?? null);
  const [isPublic, setIsPublic] = useState(service?.is_public ?? true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(
    new Set(service?.package_item_ids ?? [])
  );
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set(service?.product_ids ?? [])
  );

  const kind: ServiceKind = service?.kind ?? initialKind;
  /** Bucketed by category, in the catalogue's own order, unknowns last. */
  const groupedProducts = useMemo(() => {
    const map = new Map<string, ProductOption[]>();
    for (const p of availableProducts) {
      const key = p.category ?? "other";
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    const order = DEFAULT_CATEGORIES.map((c) => c.id);
    const rank = (id: string) => (order.indexOf(id) === -1 ? 999 : order.indexOf(id));
    return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [availableProducts]);

  function toggleProduct(id: string) {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    const name = String(formData.get("name") ?? "");
    formData.set("imageUrl", imageUrl ?? "");
    formData.set("kind", kind);
    formData.set("isPublic", String(isPublic));
    // Keep the existing color when editing; auto-assign for new services
    formData.set("color", service?.color ?? autoColor(name));
    formData.delete("serviceProducts");
    for (const productId of selectedProducts) formData.append("serviceProducts", productId);

    startTransition(async () => {
      const result = await upsertService(service?.id ?? null, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  async function handleDelete() {
    if (!service) return;
    if (!(await confirm({ title: "¿Eliminar este servicio?", message: "Tus clientes ya no podrán reservarlo.", destructive: true, confirmLabel: "Eliminar" }))) return;
    startTransition(async () => {
      const result = await deleteService(service.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function toggleItem(id: string) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const singleOptions = availableServices.filter((s) => s.id !== service?.id);
  const title = service
    ? kind === "package" ? "Editar combo" : "Editar servicio"
    : kind === "package" ? "Armar combo" : "Nuevo servicio";

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form action={handleSubmit} className="space-y-4" key={service?.id ?? `new-${kind}`}>
        <ImageUploader folder="services" value={imageUrl} onChange={setImageUrl} />

        <Field label={kind === "package" ? "Nombre del combo" : "Nombre del servicio"}>
          <input name="name" required maxLength={150} defaultValue={service?.name} className="form-input" placeholder={kind === "package" ? "Ej. Corte + Barba" : "Ej. Corte clásico"} />
        </Field>

        <Field label="Descripción (visible para clientes)">
          <textarea
            name="description"
            maxLength={500}
            rows={2}
            defaultValue={service?.description ?? ""}
            placeholder="Ej. Corte personalizado con acabado a navaja..."
            className="form-input resize-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Duración (min)">
            <input type="number" name="durationMinutes" min={5} required defaultValue={service?.duration_minutes ?? 30} className="form-input" />
          </Field>
          <Field label="Precio ($)">
            <input type="number" name="price" min={0} step="0.01" required defaultValue={service?.price} className="form-input" placeholder="35.00" />
          </Field>
        </div>

        {kind === "package" && (
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Servicios incluidos en el combo
            </label>
            {singleOptions.length === 0 ? (
              <p className="text-xs text-muted">Primero crea servicios individuales para poder agruparlos.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto border border-border rounded-xl p-2">
                {singleOptions.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm py-1 px-1">
                    <input
                      type="checkbox"
                      name="packageItems"
                      value={s.id}
                      checked={selectedItems.has(s.id)}
                      onChange={() => toggleItem(s.id)}
                      className="accent-brand"
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Products the client can request for this service */}
        {availableProducts.length > 0 && (
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Productos disponibles para este servicio
            </label>
            <p className="text-xs text-muted mb-2">
              El cliente podrá elegir cuáles quiere que uses durante su cita.
            </p>
            {/*
              * Grouped by whatever categories the products actually carry.
              * This used to filter for the hardcoded "dry" / "wet" / no
              * category — once categories became Pelo, Barba, Tinte and the
              * rest, all three buckets came out empty and the whole picker
              * rendered blank.
              */}
            <div className="space-y-3 max-h-56 overflow-y-auto border border-border rounded-xl p-3">
              {groupedProducts.map(([categoryId, items]) => (
                <ProductGroup
                  key={categoryId}
                  title={`${categoryEmoji(categoryId)} ${categoryLabel(categoryId)}`}
                  products={items}
                  selected={selectedProducts}
                  onToggle={toggleProduct}
                />
              ))}
            </div>
            {selectedProducts.size > 0 && (
              <p className="text-xs text-brand font-semibold mt-1.5">
                {selectedProducts.size} producto{selectedProducts.size > 1 ? "s" : ""} seleccionado
                {selectedProducts.size > 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {/* Public visibility toggle */}
        <div className="flex items-center justify-between gap-3 bg-background rounded-xl border border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Visible para clientes</p>
            <p className="text-xs text-muted mt-0.5">
              Si lo ocultas, no aparece en la app de reservas pero sigue disponible en combos y para ti.
            </p>
          </div>
          <Switch
            checked={isPublic}
            onChange={() => setIsPublic((v) => !v)}
            label={isPublic ? "Ocultar de clientes" : "Mostrar a clientes"}
          />
        </div>

        {error && <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-brand text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {isPending ? "Guardando..." : service ? "Guardar cambios" : kind === "package" ? "Crear combo" : "Crear servicio"}
        </button>

        {service && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="w-full text-danger font-semibold py-2 text-sm"
          >
            Eliminar {kind === "package" ? "combo" : "servicio"}
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

function ProductGroup({
  title,
  icon,
  products,
  selected,
  onToggle,
}: {
  title: string;
  icon?: React.ReactNode;
  products: ProductOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (products.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-bold text-muted uppercase tracking-wide mb-1 flex items-center gap-1">
        {icon}
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {products.map((p) => {
          const active = selected.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onToggle(p.id)}
              className={cn(
                "px-2.5 h-8 rounded-full text-xs font-semibold border transition-colors",
                active
                  ? "bg-brand border-brand text-white"
                  : "border-border bg-background text-foreground"
              )}
            >
              {p.name}
            </button>
          );
        })}
      </div>
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
