"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, ImageIcon, Loader2, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { setClientAvatar } from "@/lib/actions/clients";
import { cn } from "@/lib/utils";

const MAX_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/**
 * The client's photo, which only the barber can set.
 *
 * The client's own app can't touch it — a database trigger reverts any avatar
 * change that doesn't come from an admin — so this is the single place the
 * picture is decided, and it's here rather than in the client's profile on
 * purpose: it's the barber's reference for who is sitting in the chair.
 *
 * Two ways in, because on a phone they are genuinely different actions:
 * `capture` opens the camera straight away, without it the gallery.
 */
export function ClientPhoto({
  clientId,
  clientName,
  avatarUrl,
}: {
  clientId: string;
  clientName: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [, startTransition] = useTransition();

  async function upload(file: File) {
    setError(null);

    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      setError("Solo se permiten imágenes JPG, PNG, WEBP o HEIC.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("La foto no debe superar 8MB.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `clients/${clientId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setError(`No se pudo subir: ${uploadError.message}`);
      setBusy(false);
      return;
    }

    const { data } = supabase.storage.from("media").getPublicUrl(path);
    const result = await setClientAvatar(clientId, data.publicUrl);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function remove() {
    const yes = await confirm({
      title: "¿Quitar la foto?",
      message: "El cliente se quedará con sus iniciales.",
      destructive: true,
      confirmLabel: "Quitar",
    });
    if (!yes) return;

    setBusy(true);
    const result = await setClientAvatar(clientId, null);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={() => avatarUrl && setPreview(true)}
          disabled={!avatarUrl}
          className="relative shrink-0 rounded-full"
          aria-label={avatarUrl ? "Ver foto" : undefined}
        >
          <Avatar name={clientName} src={avatarUrl} size={68} />
          {busy && (
            <span className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-white" />
            </span>
          )}
        </button>

        <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
          <PhotoButton
            onClick={() => cameraRef.current?.click()}
            disabled={busy}
            icon={<Camera size={15} />}
            label={avatarUrl ? "Cambiar" : "Tomar foto"}
          />
          <PhotoButton
            onClick={() => galleryRef.current?.click()}
            disabled={busy}
            icon={<ImageIcon size={15} />}
            label="Galería"
          />
          {avatarUrl && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="col-span-2 h-9 rounded-xl border border-danger/25 bg-danger-light text-danger text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 size={14} />
              Quitar foto
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {/* `capture` is what makes the phone open the camera instead of the
          picker; the second input deliberately omits it. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />

      {preview && avatarUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreview(false)}
        >
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute top-[max(16px,var(--safe-top))] right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center"
          >
            <X size={20} />
          </button>
          <div className="relative w-full max-w-sm aspect-square">
            <Image src={avatarUrl} alt={clientName} fill className="object-contain rounded-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoButton({
  onClick,
  disabled,
  icon,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-9 rounded-xl border border-border bg-background text-xs font-bold text-foreground",
        "flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform",
        "disabled:opacity-50"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
