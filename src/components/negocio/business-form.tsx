"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Store, Check, Loader2, ImageIcon, Mail } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { ImageUploader } from "@/components/ui/image-uploader";
import { updateBusiness } from "@/lib/actions/business";
import { EmailTestButton } from "@/components/negocio/email-test-button";

export function BusinessForm({
  name,
  logoUrl: initialLogo,
  coverUrl: initialCover,
  description,
  instagram,
  address,
  phone,
  notifyEmail,
}: {
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
  description: string;
  instagram: string;
  address: string;
  phone: string;
  notifyEmail: string;
}) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState(initialLogo);
  const [coverUrl, setCoverUrl] = useState(initialCover);
  const [businessName, setBusinessName] = useState(name);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    formData.set("logoUrl", logoUrl ?? "");
    formData.set("coverUrl", coverUrl ?? "");

    startTransition(async () => {
      const result = await updateBusiness(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="px-4 pt-[max(10px,var(--safe-top))] pb-6 space-y-4">
      <header className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-foreground">Negocio</h1>
          <p className="text-sm text-muted">Logo e identidad de la barbería</p>
        </div>
      </header>

      <form action={handleSubmit} className="space-y-4">
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-4">
          <div className="flex items-start gap-2">
            <ImageIcon size={15} className="text-brand shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Logo del negocio</p>
              <p className="text-xs text-muted mt-0.5">
                Se usa en el menú, el login y los correos. Es distinto de tu foto de perfil.
              </p>
            </div>
          </div>

          {/* Preview at the size it actually appears in the sidebar */}
          {logoUrl && (
            <div className="flex items-center gap-3 bg-background rounded-xl border border-border p-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden relative shrink-0">
                <Image src={logoUrl} alt="" fill sizes="40px" className="object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{businessName}</p>
                <p className="text-xs text-muted">Así se verá en el menú</p>
              </div>
            </div>
          )}

          <ImageUploader folder="products" value={logoUrl} onChange={setLogoUrl} />
        </div>

        {/* Cover: the first thing the client sees when they open the app */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-4">
          <div className="flex items-start gap-2">
            <ImageIcon size={15} className="text-brand shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Imagen de portada</p>
              <p className="text-xs text-muted mt-0.5">
                Encabeza la pantalla de inicio de tus clientes. Usa una foto ancha del local
                o de tu trabajo.
              </p>
            </div>
          </div>

          {coverUrl && (
            <div className="relative w-full aspect-[16/7] rounded-xl overflow-hidden border border-border">
              <Image src={coverUrl} alt="" fill sizes="100vw" className="object-cover" />
            </div>
          )}

          <ImageUploader folder="products" value={coverUrl} onChange={setCoverUrl} />
        </div>

        <div className="bg-surface rounded-2xl border border-border p-4 space-y-4">
          <Field label="Nombre del negocio">
            <input
              name="name"
              required
              maxLength={80}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="form-input"
            />
          </Field>

          <Field label="Descripción corta (la ven tus clientes al abrir la app)">
            <textarea
              name="description"
              rows={2}
              maxLength={200}
              defaultValue={description}
              placeholder="Ej. Barbería clásica en Bayamón. Cortes, barba y diseño."
              className="form-input resize-none"
            />
          </Field>

          <Field label="Instagram (opcional)">
            <input
              name="instagram"
              maxLength={60}
              defaultValue={instagram}
              placeholder="@amadoblends"
              className="form-input"
            />
          </Field>

          <Field label="Dirección (aparece en la confirmación del cliente)">
            <input
              name="address"
              maxLength={200}
              defaultValue={address}
              placeholder="Calle, número, ciudad"
              className="form-input"
            />
          </Field>

          <Field label="Teléfono del negocio">
            <input
              name="phone"
              maxLength={30}
              defaultValue={phone}
              placeholder="787-555-0000"
              className="form-input"
            />
          </Field>
        </div>

        {/* Where the shop's copy of every appointment notice lands */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-4">
          <div className="flex items-start gap-2">
            <Mail size={15} className="text-brand shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Correo para notificaciones
              </p>
              <p className="text-xs text-muted mt-0.5">
                Aquí te avisamos cada vez que se crea, cancela o mueve una cita. Puede ser
                tu Gmail personal o el correo de la compañía.
              </p>
            </div>
          </div>

          <Field label="Correo que recibe los avisos">
            <input
              name="notifyEmail"
              type="email"
              maxLength={160}
              defaultValue={notifyEmail}
              placeholder="tucorreo@gmail.com"
              className="form-input"
            />
          </Field>

          {/* Guarda primero: la prueba usa el valor ya guardado */}
          <div className="pt-1 border-t border-border">
            <p className="text-xs text-muted mb-2.5 pt-3">
              Guarda los cambios y luego prueba. Te llegará una cita de ejemplo con su
              archivo de calendario.
            </p>
            <EmailTestButton />
          </div>
        </div>

        {error && <p className="text-sm text-danger bg-danger-light rounded-xl px-3 py-2">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-brand text-white font-bold h-12 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
        >
          {isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : saved ? (
            <Check size={16} />
          ) : (
            <Store size={16} />
          )}
          {isPending ? "Guardando..." : saved ? "¡Guardado!" : "Guardar"}
        </button>

        <style jsx global>{`
          .form-input {
            width: 100%;
            padding: 0.6rem 0.85rem;
            border-radius: 0.75rem;
            border: 1px solid var(--border);
            background: var(--background);
            font-size: 1rem;
            color: var(--foreground);
          }
        `}</style>
      </form>
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
