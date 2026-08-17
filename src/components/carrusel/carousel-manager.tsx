"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { format, isAfter, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import {
  Plus, Images, Trash2, Pause, Play, Pencil, CalendarRange, Eye,
  ArrowUp, ArrowDown, FileEdit, Send, Scissors, AlertTriangle,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/ui/image-uploader";
import {
  upsertCarouselPost,
  setCarouselFlags,
  moveCarouselPost,
  deleteCarouselPost,
} from "@/lib/actions/carousel";
import { CAROUSEL_TYPES } from "@/lib/carousel-types";
import { cn } from "@/lib/utils";

import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  carouselStatus,
  STATUS_LABEL,
  type CarouselStatus,
} from "@/lib/carousel-status";

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
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  is_active: boolean;
  is_draft: boolean;
  is_permanent: boolean;
}

/*
 * Status comes from the shared module the client's carousel uses, so the
 * barber's panel and the client can never disagree about what "finalizada"
 * means. The old local copy read a post with no end date as permanently
 * active — which is exactly how a finished vacation notice stayed on screen.
 */
type Status = CarouselStatus;
const statusOf = (p: CarouselPost): Status => carouselStatus(p);

const STATUS_STYLE: Record<Status, string> = {
  draft: "bg-border text-muted",
  scheduled: "bg-info-light text-info",
  active: "bg-success-light text-success",
  paused: "bg-warning-light text-warning",
  expired: "bg-border text-muted",
  permanent: "bg-brand-light text-brand",
};

export function CarouselManager({
  posts,
  loadError,
}: {
  posts: CarouselPost[];
  loadError?: string | null;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CarouselPost | null>(null);
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirm();

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="px-4 pt-[max(10px,var(--safe-top))] pb-6 space-y-4">
      <header className="flex items-center gap-3">
        <BackButton />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground">Carrusel</h1>
          <p className="text-sm text-muted">Lo que verán tus clientes al abrir la app</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center shrink-0"
          aria-label="Nueva publicación"
        >
          <Plus size={20} />
        </button>
      </header>

      {loadError && (
        <div className="bg-danger-light rounded-2xl border border-danger/20 p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-danger">No se pudo cargar el carrusel</p>
            <p className="text-xs text-muted mt-1">{loadError}</p>
          </div>
        </div>
      )}

      {!loadError && posts.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-10 text-center space-y-3">
          <Images size={30} className="text-muted mx-auto" />
          <div>
            <p className="text-sm font-semibold text-foreground">Sin publicaciones</p>
            <p className="text-xs text-muted mt-0.5">
              Anuncia promociones, vacaciones o días cerrados.
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="bg-brand text-white text-sm font-semibold px-4 py-2 rounded-xl"
          >
            Crear publicación
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((p, i) => {
            const status = statusOf(p);
            const meta = CAROUSEL_TYPES.find((t) => t.value === p.type);
            const dimmed = status === "expired" || status === "draft";

            return (
              <div
                key={p.id}
                className={cn(
                  "bg-surface rounded-2xl border border-border overflow-hidden",
                  dimmed && "opacity-70"
                )}
              >
                <div className="flex gap-3 p-3">
                  {/* Order controls */}
                  <div className="flex flex-col justify-center gap-1 shrink-0">
                    <button
                      onClick={() => run(() => moveCarouselPost(p.id, "up"))}
                      disabled={i === 0 || isPending}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted disabled:opacity-30"
                      aria-label="Subir"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      onClick={() => run(() => moveCarouselPost(p.id, "down"))}
                      disabled={i === posts.length - 1 || isPending}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted disabled:opacity-30"
                      aria-label="Bajar"
                    >
                      <ArrowDown size={13} />
                    </button>
                  </div>

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
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize",
                          STATUS_STYLE[status]
                        )}
                      >
                        {STATUS_LABEL[status].es}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      {meta?.emoji} {meta?.label}
                    </p>
                    {p.description && (
                      <p className="text-xs text-muted line-clamp-2 mt-0.5">{p.description}</p>
                    )}
                    {p.is_permanent ? (
                      <p className="text-[11px] text-brand mt-1 flex items-center gap-1">
                        <CalendarRange size={10} />
                        Contenido permanente · se muestra cuando no hay nada activo
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted mt-1 flex items-center gap-1">
                        <CalendarRange size={10} />
                        {p.starts_on
                          ? format(new Date(p.starts_on + "T00:00:00"), "d MMM", { locale: es })
                          : "Desde ya"}
                        {" → "}
                        {p.ends_on ? (
                          format(new Date(p.ends_on + "T00:00:00"), "d MMM yyyy", { locale: es })
                        ) : (
                          // No end date is what kept finished notices on screen
                          <span className="text-warning font-semibold">
                            falta fecha de fin
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex border-t border-border divide-x divide-border">
                  <button
                    onClick={() => {
                      setEditing(p);
                      setModalOpen(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-foreground active:bg-background"
                  >
                    <Pencil size={13} /> Editar
                  </button>

                  {p.is_draft ? (
                    <button
                      onClick={() => run(() => setCarouselFlags(p.id, { isDraft: false }))}
                      disabled={isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-brand active:bg-background disabled:opacity-50"
                    >
                      <Send size={13} /> Publicar
                    </button>
                  ) : (
                    <button
                      onClick={() => run(() => setCarouselFlags(p.id, { isActive: !p.is_active }))}
                      disabled={isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-foreground active:bg-background disabled:opacity-50"
                    >
                      {p.is_active ? (
                        <>
                          <Pause size={13} /> Pausar
                        </>
                      ) : (
                        <>
                          <Play size={13} /> Reanudar
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={async () => {
                      const yes = await confirm({
                        title: `¿Eliminar «${p.title}»?`,
                        message: "Tus clientes dejarán de verla al instante.",
                        destructive: true,
                        confirmLabel: "Eliminar",
                      });
                      if (yes) run(() => deleteCarouselPost(p.id));
                    }}
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

// ── Create / edit ──────────────────────────────────────────────────────────

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
  // Saved, but something still needs the barber's attention
  const [warning, setWarning] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [imageUrl, setImageUrl] = useState<string | null>(post?.image_url ?? null);
  const [type, setType] = useState<string>(post?.type ?? "promocion");
  const [isActive, setIsActive] = useState(post?.is_active ?? true);
  const [isPermanent, setIsPermanent] = useState(post?.is_permanent ?? false);
  const [title, setTitle] = useState(post?.title ?? "");
  const [description, setDescription] = useState(post?.description ?? "");
  const [buttonLabel, setButtonLabel] = useState(post?.button_label ?? "");

  function submit(formData: FormData, asDraft: boolean) {
    setError(null);
    setWarning(null);
    formData.set("imageUrl", imageUrl ?? "");
    formData.set("type", type);
    formData.set("isActive", String(isActive));
    formData.set("isDraft", String(asDraft));

    startTransition(async () => {
      const result = await upsertCarouselPost(post?.id ?? null, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      /*
       * Saved, but the database is behind on a migration. Keep the editor open
       * so the note is actually read — closing it would hide the one thing
       * that still needs doing.
       */
      if (result.warning) {
        setWarning(result.warning);
        return;
      }
      onClose();
    });
  }

  const meta = CAROUSEL_TYPES.find((t) => t.value === type);

  return (
    <Modal open={open} onClose={onClose} title={post ? "Editar publicación" : "Nueva publicación"}>
      <form
        action={(fd) => submit(fd, false)}
        id="carousel-form"
        className="space-y-4"
      >
        <ImageUploader folder="products" value={imageUrl} onChange={setImageUrl} />

        <Field label="Título">
          <input
            name="title"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. 20% OFF en cortes clásicos"
            className="form-input"
          />
        </Field>

        <Field label="Descripción">
          <textarea
            name="description"
            rows={2}
            maxLength={400}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalles del anuncio..."
            className="form-input resize-none"
          />
        </Field>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Tipo de publicación
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {CAROUSEL_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  "h-16 rounded-xl border text-[10px] font-semibold flex flex-col items-center justify-center gap-1 px-1 transition-colors",
                  type === t.value
                    ? "bg-brand border-brand text-white"
                    : "border-border bg-background text-muted"
                )}
              >
                <span className="text-lg leading-none">{t.emoji}</span>
                <span className="leading-tight text-center">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/*
          * Permanent content has no window: it's the brand material that
          * fills the carousel whenever nothing is running.
          */}
        <label className="flex items-center justify-between gap-3 bg-background rounded-xl border border-border px-4 py-3 cursor-pointer">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">
              Contenido permanente
            </span>
            <span className="block text-xs text-muted mt-0.5">
              Se muestra solo cuando no hay ninguna promoción o aviso activo.
            </span>
          </span>
          <input
            type="checkbox"
            name="isPermanent"
            checked={isPermanent}
            onChange={(e) => setIsPermanent(e.target.checked)}
            className="w-5 h-5 accent-[var(--color-brand)] shrink-0"
          />
        </label>

        {!isPermanent && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Aparece desde">
              <input
                type="date"
                name="startsOn"
                defaultValue={post?.starts_on ?? ""}
                className="form-input"
              />
            </Field>
            <Field label="Deja de mostrarse">
              <input
                type="date"
                name="endsOn"
                required
                defaultValue={post?.ends_on ?? ""}
                className="form-input"
              />
              {/* Required on purpose: a post with no end never stopped showing */}
              <span className="text-[11px] text-muted mt-1 block">
                Obligatoria. Al llegar esta fecha desaparece sola del carrusel.
              </span>
            </Field>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Texto del botón">
            <input
              name="buttonLabel"
              maxLength={40}
              value={buttonLabel}
              onChange={(e) => setButtonLabel(e.target.value)}
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

        {/* Preview */}
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-border bg-background text-sm font-semibold text-foreground"
        >
          <Eye size={15} /> {showPreview ? "Ocultar vista previa" : "Ver vista previa"}
        </button>

        {showPreview && (
          <div className="rounded-2xl overflow-hidden">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wide mb-1.5">
              Así lo verá el cliente
            </p>
            <div
              className="relative rounded-3xl overflow-hidden"
              style={
                imageUrl
                  ? {
                      backgroundImage: `linear-gradient(100deg, rgba(11,11,13,0.94) 5%, rgba(11,11,13,0.7) 55%, rgba(11,11,13,0.35) 100%), url('${imageUrl}')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : {
                      backgroundImage:
                        "linear-gradient(100deg, rgba(11,11,13,0.95) 5%, rgba(11,11,13,0.6) 50%, rgba(255,106,61,0.35) 130%)",
                    }
              }
            >
              <div className="p-5 pr-20 min-h-[150px] flex flex-col justify-center">
                <span className="inline-flex self-start items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand bg-brand/15 px-2 py-1 rounded-full mb-2">
                  {meta?.emoji} {meta?.label}
                </span>
                <p className="text-[20px] leading-[1.15] font-black text-white uppercase">
                  {title || "Título de tu publicación"}
                </p>
                {description && (
                  <p className="text-xs text-white/70 mt-1.5 line-clamp-2">{description}</p>
                )}
                {buttonLabel && (
                  <span className="mt-3 inline-flex self-start bg-brand text-white text-xs font-bold px-4 py-2 rounded-xl">
                    {buttonLabel}
                  </span>
                )}
              </div>
              {!imageUrl && (
                <Scissors
                  size={80}
                  className="absolute -right-3 top-1/2 -translate-y-1/2 text-brand/15 rotate-[-20deg]"
                />
              )}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>}

        {warning && (
          <div className="text-sm bg-warning-light border border-warning/25 rounded-lg px-3 py-2.5 space-y-2">
            <p className="text-foreground">{warning}</p>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-warning underline underline-offset-2"
            >
              Entendido, cerrar
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            formAction={(fd) => submit(fd, true)}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-1.5 border border-border text-foreground font-semibold py-3 rounded-xl disabled:opacity-60"
          >
            <FileEdit size={15} /> Borrador
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-[2] bg-brand text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {isPending ? "Guardando..." : post ? "Guardar cambios" : "Publicar"}
          </button>
        </div>

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
