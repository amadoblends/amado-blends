"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { format, isAfter, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Images, Trash2, Pause, Play, Pencil, Clock, CalendarRange } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/ui/image-uploader";
import {
  upsertCarouselPost,
  toggleCarouselPost,
  deleteCarouselPost,
  CAROUSEL_TYPES,
} from "@/lib/actions/carousel";
import { cn } from "@/lib/utils";

export interface CarouselPost {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  type: string;
  button_label: string | null;
  button_href: string | null;
  starts_on: string | null;
  ends_on: string | null;
  sort_order: number;
  is_active: boolean;
}

type Status = "activa" | "programada" | "vencida" | "pausada";

function statusOf(p: CarouselPost): Status {
  if (!p.is_active) return "pausada";
  const today = startOfDay(new Date());
  if (p.starts_on && isAfter(new Date(p.starts_on + "T00:00:00"), today)) return "programada";
  if (p.ends_on && isBefore(new Date(p.ends_on + "T23:59:59"), today)) return "vencida";
  return "activa";
}

const STATUS_STYLE: Record<Status, string> = {
  activa: "bg-success-light text-success",
  programada: "bg-info-light text-info",
  vencida: "bg-border text-muted",
  pausada: "bg-warning-light text-warning",
};

export function CarouselManager({ posts }: { posts: CarouselPost[] }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CarouselPost | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(p: CarouselPost) {
    setEditing(p);
    setModalOpen(true);
  }

  function togglePost(p: CarouselPost) {
    startTransition(async () => {
      await toggleCarouselPost(p.id, !p.is_active);
      router.refresh();
    });
  }

  function removePost(p: CarouselPost) {
    if (!confirm(`¿Eliminar «${p.title}»?`)) return;
    startTransition(async () => {
      await deleteCarouselPost(p.id);
      router.refresh();
    });
  }

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <BackButton />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground">Carrusel del cliente</h1>
          <p className="text-sm text-muted">Anuncios que verán en su pantalla de inicio</p>
        </div>
        <button
          onClick={openCreate}
          className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center shrink-0"
          aria-label="Nueva publicación"
        >
          <Plus size={20} />
        </button>
      </header>

      {posts.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-10 text-center space-y-3">
          <Images size={30} className="text-muted mx-auto" />
          <div>
            <p className="text-sm font-semibold text-foreground">Sin publicaciones</p>
            <p className="text-xs text-muted mt-0.5">
              Crea anuncios de promociones, vacaciones o días cerrados.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="bg-brand text-white text-sm font-semibold px-4 py-2 rounded-xl"
          >
            Crear publicación
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => {
            const status = statusOf(p);
            const meta = CAROUSEL_TYPES.find((t) => t.value === p.type);
            return (
              <div
                key={p.id}
                className={cn(
                  "bg-surface rounded-2xl border border-border overflow-hidden",
                  status === "vencida" && "opacity-60"
                )}
              >
                <div className="flex gap-3 p-3">
                  <div className="w-16 h-16 rounded-xl bg-background border border-border shrink-0 relative overflow-hidden flex items-center justify-center">
                    {p.image_url ? (
                      <Image src={p.image_url} alt="" fill className="object-cover" />
                    ) : (
                      <span className="text-xl">{meta?.emoji ?? "📢"}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-bold text-foreground truncate">{p.title}</p>
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                          STATUS_STYLE[status]
                        )}
                      >
                        {status}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      {meta?.emoji} {meta?.label}
                    </p>
                    {p.description && (
                      <p className="text-xs text-muted line-clamp-2 mt-0.5">{p.description}</p>
                    )}
                    <p className="text-[11px] text-muted mt-1 flex items-center gap-1">
                      <CalendarRange size={10} />
                      {p.starts_on
                        ? format(new Date(p.starts_on + "T00:00:00"), "d MMM", { locale: es })
                        : "Desde ya"}
                      {" → "}
                      {p.ends_on
                        ? format(new Date(p.ends_on + "T00:00:00"), "d MMM yyyy", { locale: es })
                        : "sin fin"}
                    </p>
                  </div>
                </div>

                <div className="flex border-t border-border divide-x divide-border">
                  <button
                    onClick={() => openEdit(p)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-foreground active:bg-background"
                  >
                    <Pencil size={13} /> Editar
                  </button>
                  <button
                    onClick={() => togglePost(p)}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-foreground active:bg-background disabled:opacity-50"
                  >
                    {p.is_active ? (
                      <>
                        <Pause size={13} /> Pausar
                      </>
                    ) : (
                      <>
                        <Play size={13} /> Activar
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => removePost(p)}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-danger active:bg-danger-light disabled:opacity-50"
                  >
                    <Trash2 size={13} /> Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PostModal
        key={editing?.id ?? `new-${modalOpen}`}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        post={editing}
      />
    </div>
  );
}

// ── Create / edit modal ───────────────────────────────────────────────────

function PostModal({
  open,
  onClose,
  post,
}: {
  open: boolean;
  onClose: () => void;
  post: CarouselPost | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(post?.image_url ?? null);
  const [type, setType] = useState(post?.type ?? "promocion");
  const [isActive, setIsActive] = useState(post?.is_active ?? true);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("imageUrl", imageUrl ?? "");
    formData.set("type", type);
    formData.set("isActive", String(isActive));

    startTransition(async () => {
      const result = await upsertCarouselPost(post?.id ?? null, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={post ? "Editar publicación" : "Nueva publicación"}>
      <form action={handleSubmit} className="space-y-4">
        <ImageUploader folder="products" value={imageUrl} onChange={setImageUrl} />

        <Field label="Título">
          <input
            name="title"
            required
            maxLength={120}
            defaultValue={post?.title}
            placeholder="Ej. 20% OFF en cortes clásicos"
            className="form-input"
          />
        </Field>

        <Field label="Descripción">
          <textarea
            name="description"
            rows={2}
            maxLength={400}
            defaultValue={post?.description ?? ""}
            placeholder="Detalles del anuncio..."
            className="form-input resize-none"
          />
        </Field>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Tipo de publicación
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {CAROUSEL_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  "h-14 rounded-xl border text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 px-1 transition-colors",
                  type === t.value
                    ? "bg-brand border-brand text-white"
                    : "border-border bg-background text-muted"
                )}
              >
                <span className="text-base leading-none">{t.emoji}</span>
                <span className="leading-tight text-center">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde (opcional)">
            <input
              type="date"
              name="startsOn"
              defaultValue={post?.starts_on ?? ""}
              className="form-input"
            />
          </Field>
          <Field label="Hasta (opcional)">
            <input
              type="date"
              name="endsOn"
              defaultValue={post?.ends_on ?? ""}
              className="form-input"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Texto del botón">
            <input
              name="buttonLabel"
              maxLength={40}
              defaultValue={post?.button_label ?? ""}
              placeholder="Reservar"
              className="form-input"
            />
          </Field>
          <Field label="Enlace del botón">
            <input
              name="buttonHref"
              maxLength={300}
              defaultValue={post?.button_href ?? ""}
              placeholder="/reservar"
              className="form-input"
            />
          </Field>
        </div>

        <Field label="Orden de aparición">
          <input
            type="number"
            name="sortOrder"
            min={0}
            max={999}
            defaultValue={post?.sort_order ?? 0}
            className="form-input"
          />
        </Field>

        <div className="flex items-center justify-between gap-3 bg-background rounded-xl border border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Publicación activa</p>
            <p className="text-xs text-muted mt-0.5">
              Si la pausas, deja de mostrarse aunque esté dentro de fechas.
            </p>
          </div>
          <Switch checked={isActive} onChange={() => setIsActive((v) => !v)} label="Activa" />
        </div>

        <div className="bg-brand-light rounded-xl p-3 border border-brand/20 flex items-start gap-2">
          <Clock size={14} className="text-brand shrink-0 mt-0.5" />
          <p className="text-xs text-brand">
            Sin fechas se muestra de inmediato. Con fechas aparece y desaparece sola.
          </p>
        </div>

        {error && <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-brand text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {isPending ? "Guardando..." : post ? "Guardar cambios" : "Publicar"}
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
