"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/ui/image-uploader";
import { upsertService, deleteService } from "@/lib/actions/products";
import type { ServiceKind } from "@/lib/supabase/types";

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
}: {
  open: boolean;
  onClose: () => void;
  service: ServiceData | null;
  initialKind?: ServiceKind;
  availableServices: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(service?.image_url ?? null);
  const [isPublic, setIsPublic] = useState(service?.is_public ?? true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(
    new Set(service?.package_item_ids ?? [])
  );

  const kind: ServiceKind = service?.kind ?? initialKind;

  function handleSubmit(formData: FormData) {
    setError(null);
    const name = String(formData.get("name") ?? "");
    formData.set("imageUrl", imageUrl ?? "");
    formData.set("kind", kind);
    formData.set("isPublic", String(isPublic));
    // Keep the existing color when editing; auto-assign for new services
    formData.set("color", service?.color ?? autoColor(name));

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

  function handleDelete() {
    if (!service) return;
    if (!confirm("¿Eliminar este servicio?")) return;
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
