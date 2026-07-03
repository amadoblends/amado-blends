"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Plus, Package, Scissors, EyeOff, BadgePercent } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ServiceModal, type ServiceData } from "@/components/servicios/service-modal";

export function ServicesManager({ services }: { services: ServiceData[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceData | null>(null);
  const [createKind, setCreateKind] = useState<"single" | "package">("single");

  function openCreate(kind: "single" | "package") {
    setEditing(null);
    setCreateKind(kind);
    setModalOpen(true);
  }

  function openEdit(s: ServiceData) {
    setEditing(s);
    setCreateKind(s.kind);
    setModalOpen(true);
  }

  const singles = services.filter((s) => s.kind === "single");
  const packages = services.filter((s) => s.kind === "package");
  const singleOptions = singles.map((s) => ({ id: s.id, name: s.name }));
  const singleNameById = new Map(singles.map((s) => [s.id, s.name]));

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href="/mas"
          className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-foreground flex-1">Servicios</h1>
        <Link
          href="/promociones"
          className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center"
          title="Promociones y descuentos"
        >
          <BadgePercent size={18} className="text-brand" />
        </Link>
      </header>

      {/* ── Individual services ── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors size={16} className="text-brand" />
            <h2 className="font-bold text-foreground">Servicios individuales</h2>
          </div>
          <button
            onClick={() => openCreate("single")}
            className="flex items-center gap-1 text-sm font-semibold text-brand"
          >
            <Plus size={15} /> Nuevo
          </button>
        </div>

        <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
          {singles.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">
              Crea tu primer servicio con el botón &ldquo;Nuevo&rdquo;.
            </p>
          ) : (
            singles.map((s) => <ServiceRow key={s.id} service={s} onEdit={openEdit} />)
          )}
        </div>
      </section>

      {/* ── Packages / combos ── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-violet" />
            <h2 className="font-bold text-foreground">Paquetes y combos</h2>
          </div>
          <button
            onClick={() => openCreate("package")}
            disabled={singles.length === 0}
            className="flex items-center gap-1 text-sm font-semibold text-violet disabled:opacity-40"
          >
            <Plus size={15} /> Armar combo
          </button>
        </div>

        <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
          {packages.length === 0 ? (
            <p className="text-sm text-muted text-center py-8 px-4">
              {singles.length === 0
                ? "Primero crea servicios individuales para poder combinarlos."
                : "Combina tus servicios individuales en un combo con precio especial."}
            </p>
          ) : (
            packages.map((s) => (
              <ServiceRow
                key={s.id}
                service={s}
                onEdit={openEdit}
                includedNames={(s.package_item_ids ?? [])
                  .map((id) => singleNameById.get(id))
                  .filter(Boolean) as string[]}
              />
            ))
          )}
        </div>
      </section>

      {/* key forces a fresh modal per service — otherwise the toggle/image
          state of the previous service leaks into the next one */}
      <ServiceModal
        key={editing?.id ?? `new-${createKind}-${modalOpen}`}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        service={editing}
        initialKind={createKind}
        availableServices={singleOptions}
      />
    </div>
  );
}

function ServiceRow({
  service: s,
  onEdit,
  includedNames,
}: {
  service: ServiceData;
  onEdit: (s: ServiceData) => void;
  includedNames?: string[];
}) {
  return (
    <button
      onClick={() => onEdit(s)}
      className="w-full flex items-start gap-3 px-4 py-3.5 active:bg-background text-left"
    >
      <div className="w-12 h-12 rounded-xl bg-background border border-border shrink-0 relative overflow-hidden flex items-center justify-center">
        {s.image_url ? (
          <Image src={s.image_url} alt="" fill className="object-cover" />
        ) : s.kind === "package" ? (
          <Package size={18} style={{ color: s.color }} />
        ) : (
          <Scissors size={18} style={{ color: s.color }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
          {s.is_public === false && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted bg-background border border-border px-1.5 py-0.5 rounded-full shrink-0">
              <EyeOff size={9} /> Oculto
            </span>
          )}
        </div>
        {s.description ? (
          <p className="text-xs text-muted line-clamp-2 mt-0.5">{s.description}</p>
        ) : includedNames && includedNames.length > 0 ? (
          <p className="text-xs text-muted line-clamp-2 mt-0.5">
            Incluye: {includedNames.join(" + ")}
          </p>
        ) : null}
        <p className="text-xs text-muted mt-0.5">⏱ {s.duration_minutes} min</p>
      </div>
      <p className="text-base font-bold text-brand shrink-0">{formatCurrency(Number(s.price))}</p>
    </button>
  );
}
