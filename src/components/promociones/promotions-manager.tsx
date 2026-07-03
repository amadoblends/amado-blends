"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, BadgePercent, Trash2, Clock, CalendarDays } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { createPromotion, togglePromotion, deletePromotion } from "@/lib/actions/promotions";

const WEEKDAYS = [
  { value: 1, label: "L" },
  { value: 2, label: "M" },
  { value: 3, label: "M" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 0, label: "D" },
];

const WEEKDAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

interface Promotion {
  id: string;
  title: string;
  description: string | null;
  discount_percent: number;
  service_id: string | null;
  weekdays: number[];
  start_time: string | null;
  end_time: string | null;
  ends_on: string | null;
  is_active: boolean;
}

function fmtTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const p = h >= 12 ? "PM" : "AM";
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${dh}:${String(m).padStart(2, "0")} ${p}`;
}

export function PromotionsManager({
  promotions,
  services,
}: {
  promotions: Promotion[];
  services: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 0]));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleDay(d: number) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    if (selectedDays.size === 0) {
      setError("Selecciona al menos un día.");
      return;
    }
    selectedDays.forEach((d) => formData.append("weekdays", String(d)));
    startTransition(async () => {
      const result = await createPromotion(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setModalOpen(false);
      setSelectedDays(new Set([1, 2, 3, 4, 5, 6, 0]));
      router.refresh();
    });
  }

  function handleToggle(id: string, next: boolean) {
    startTransition(async () => {
      await togglePromotion(id, next);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta promoción?")) return;
    startTransition(async () => {
      await deletePromotion(id);
      router.refresh();
    });
  }

  const serviceName = (id: string | null) =>
    id ? services.find((s) => s.id === id)?.name ?? "Servicio" : "Todos los servicios";

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href="/servicios"
          className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-foreground flex-1">Promociones</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center"
          aria-label="Nueva promoción"
        >
          <Plus size={20} />
        </button>
      </header>

      <p className="text-sm text-muted">
        Crea descuentos para días y horas específicas. Al crear una, todos tus clientes reciben una
        notificación.
      </p>

      <div className="space-y-3">
        {promotions.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-10 text-center space-y-2">
            <BadgePercent size={28} className="text-muted mx-auto" />
            <p className="text-sm text-muted">Aún no tienes promociones.</p>
          </div>
        ) : (
          promotions.map((p) => (
            <div key={p.id} className="bg-surface rounded-2xl border border-border p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
                  <span className="text-brand font-black text-sm">{p.discount_percent}%</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{p.title}</p>
                  {p.description && <p className="text-xs text-muted">{p.description}</p>}
                  <p className="text-xs text-muted mt-0.5">{serviceName(p.service_id)}</p>
                </div>
                <Switch
                  checked={p.is_active}
                  onChange={() => handleToggle(p.id, !p.is_active)}
                  disabled={isPending}
                  label={p.is_active ? "Desactivar" : "Activar"}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] text-muted bg-background border border-border rounded-full px-2 py-1">
                  <CalendarDays size={11} />
                  {p.weekdays.length === 7
                    ? "Todos los días"
                    : p.weekdays
                        .slice()
                        .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
                        .map((d) => WEEKDAY_NAMES[d])
                        .join(", ")}
                </span>
                {p.start_time && p.end_time && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted bg-background border border-border rounded-full px-2 py-1">
                    <Clock size={11} />
                    {fmtTime(p.start_time)} – {fmtTime(p.end_time)}
                  </span>
                )}
                <button
                  onClick={() => handleDelete(p.id)}
                  className="inline-flex items-center gap-1 text-[11px] text-danger bg-danger-light rounded-full px-2 py-1 ml-auto"
                >
                  <Trash2 size={11} /> Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva promoción">
        <form action={handleSubmit} className="space-y-4">
          <Field label="Título">
            <input name="title" required maxLength={120} placeholder="Ej. Martes de descuento" className="form-input" />
          </Field>

          <Field label="Descripción (opcional)">
            <input name="description" maxLength={300} placeholder="Ej. En cortes clásicos" className="form-input" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Descuento (%)">
              <input type="number" name="discountPercent" min={1} max={100} required placeholder="20" className="form-input" />
            </Field>
            <Field label="Aplica a">
              <select name="serviceId" className="form-input">
                <option value="">Todos</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Días</label>
            <div className="flex gap-1.5">
              {WEEKDAYS.map((d) => (
                <button
                  key={`${d.value}-${d.label}`}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`w-9 h-9 rounded-full text-sm font-semibold border transition-colors ${
                    selectedDays.has(d.value)
                      ? "bg-brand border-brand text-white"
                      : "border-border text-muted bg-background"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde hora (opcional)">
              <input type="time" name="startTime" className="form-input" />
            </Field>
            <Field label="Hasta hora (opcional)">
              <input type="time" name="endTime" className="form-input" />
            </Field>
          </div>

          <Field label="Válida hasta (opcional)">
            <input type="date" name="endsOn" className="form-input" />
          </Field>

          {error && <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-brand text-white font-semibold py-3 rounded-xl disabled:opacity-60"
          >
            {isPending ? "Creando..." : "Crear y notificar a clientes"}
          </button>

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
