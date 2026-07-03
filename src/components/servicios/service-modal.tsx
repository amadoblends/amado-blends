"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { ImageUploader } from "@/components/ui/image-uploader";
import { upsertService, deleteService } from "@/lib/actions/products";
import { cn } from "@/lib/utils";
import type { ServiceKind } from "@/lib/supabase/types";

export interface ServiceData {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  color: string;
  kind: ServiceKind;
  image_url: string | null;
  is_public?: boolean;
  package_item_ids?: string[];
}

export function ServiceModal({
  open,
  onClose,
  service,
  availableServices,
}: {
  open: boolean;
  onClose: () => void;
  service: ServiceData | null;
  availableServices: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(service?.image_url ?? null);
  const [kind, setKind] = useState<ServiceKind>(service?.kind ?? "single");
  const [isPublic, setIsPublic] = useState(service?.is_public ?? true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set(service?.package_item_ids ?? []));

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("imageUrl", imageUrl ?? "");
    formData.set("kind", kind);
    formData.set("isPublic", String(isPublic));

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

  return (
    <Modal open={open} onClose={onClose} title={service ? "Editar servicio" : "Nuevo servicio"}>
      <form action={handleSubmit} className="space-y-4" key={service?.id ?? "new"}>
        <div className="flex gap-2 bg-background rounded-xl p-1">
          {(["single", "package"] as ServiceKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-semibold transition-colors",
                kind === k ? "bg-surface text-foreground shadow-sm" : "text-muted"
              )}
            >
              {k === "single" ? "Individual" : "Paquete"}
            </button>
          ))}
        </div>

        <ImageUploader folder="services" value={imageUrl} onChange={setImageUrl} />

        <Field label="Nombre del servicio">
          <input name="name" required maxLength={150} defaultValue={service?.name} className="form-input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duración (min)">
            <input type="number" name="durationMinutes" min={5} required defaultValue={service?.duration_minutes ?? 30} className="form-input" />
          </Field>
          <Field label="Precio">
            <input type="number" name="price" min={0} step="0.01" required defaultValue={service?.price} className="form-input" />
          </Field>
        </div>
        <Field label="Color">
          <input type="color" name="color" defaultValue={service?.color ?? "#FF6A3D"} className="form-input h-12" />
        </Field>

        {/* Public visibility toggle */}
        <div className="flex items-center justify-between gap-3 bg-background rounded-xl border border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Visible para clientes</p>
            <p className="text-xs text-muted mt-0.5">
              Si lo ocultas, no aparece en la app de reservas pero sigue disponible en paquetes y
              para ti.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPublic((v) => !v)}
            aria-label={isPublic ? "Ocultar de clientes" : "Mostrar a clientes"}
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors shrink-0",
              isPublic ? "bg-brand" : "bg-border"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                isPublic ? "translate-x-[22px]" : "translate-x-0.5"
              )}
            />
          </button>
        </div>

        {kind === "package" && (
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Servicios incluidos en el paquete</label>
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

        {error && <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-brand text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {isPending ? "Guardando..." : service ? "Guardar cambios" : "Crear servicio"}
        </button>

        {service && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="w-full text-danger font-semibold py-2 text-sm"
          >
            Eliminar servicio
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
