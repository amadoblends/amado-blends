"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUploader } from "@/components/ui/image-uploader";
import { updateProfile, updatePassword } from "@/lib/actions/profile";

export function ProfileForm({
  fullName,
  avatarUrl,
  email,
}: {
  fullName: string;
  avatarUrl: string | null;
  email: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pwPending, startPwTransition] = useTransition();
  const [avatar, setAvatar] = useState<string | null>(avatarUrl);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  function handleProfile(formData: FormData) {
    setProfileError(null);
    setProfileSaved(false);
    formData.set("avatarUrl", avatar ?? "");
    startTransition(async () => {
      const result = await updateProfile(formData);
      if (!result.ok) {
        setProfileError(result.error ?? "Error.");
      } else {
        setProfileSaved(true);
        router.refresh();
      }
    });
  }

  function handlePassword(formData: FormData) {
    setPwError(null);
    setPwSaved(false);
    startPwTransition(async () => {
      const result = await updatePassword(formData);
      if (!result.ok) {
        setPwError(result.error ?? "Error.");
      } else {
        setPwSaved(true);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Profile info */}
      <form action={handleProfile} className="bg-surface rounded-2xl border border-border p-4 space-y-4">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">Información del perfil</p>

        <div className="flex items-center gap-4">
          <ImageUploader folder="products" value={avatar} onChange={setAvatar} />
          <p className="text-sm text-muted">Toca para cambiar tu foto</p>
        </div>

        <Field label="Nombre completo">
          <input
            name="fullName"
            required
            maxLength={120}
            defaultValue={fullName}
            className="form-input"
          />
        </Field>

        <Field label="Correo electrónico">
          <input
            type="email"
            value={email}
            disabled
            className="form-input opacity-60 cursor-not-allowed"
          />
          <p className="text-xs text-muted mt-1">El correo no se puede cambiar desde aquí.</p>
        </Field>

        {profileError && (
          <p className="text-sm text-danger bg-danger-light rounded-xl px-3 py-2">{profileError}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-brand text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {isPending ? "Guardando..." : profileSaved ? "¡Guardado ✓" : "Guardar cambios"}
        </button>
      </form>

      {/* Password change */}
      <form action={handlePassword} className="bg-surface rounded-2xl border border-border p-4 space-y-4">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">Cambiar contraseña</p>

        <Field label="Nueva contraseña">
          <input
            type="password"
            name="newPassword"
            minLength={8}
            required
            placeholder="Mínimo 8 caracteres"
            className="form-input"
          />
        </Field>

        <Field label="Confirmar contraseña">
          <input
            type="password"
            name="confirmPassword"
            required
            placeholder="Repite la contraseña"
            className="form-input"
          />
        </Field>

        {pwError && (
          <p className="text-sm text-danger bg-danger-light rounded-xl px-3 py-2">{pwError}</p>
        )}
        {pwSaved && (
          <p className="text-sm text-success bg-success-light rounded-xl px-3 py-2">
            Contraseña actualizada correctamente ✓
          </p>
        )}

        <button
          type="submit"
          disabled={pwPending}
          className="w-full bg-foreground text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {pwPending ? "Actualizando..." : "Actualizar contraseña"}
        </button>
      </form>

      <style jsx global>{`
        .form-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          border: 1px solid var(--border);
          background: var(--background);
          font-size: 0.875rem;
          color: var(--foreground);
        }
      `}</style>
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
