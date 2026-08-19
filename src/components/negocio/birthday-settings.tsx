"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cake, Check, Loader2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { updateBirthdaySettings } from "@/lib/actions/birthday";
import { birthdayDiscount, type BirthdaySettings } from "@/lib/client-rules";
import { shopToday } from "@/lib/timezone";

export interface ServiceOption {
  id: string;
  name: string;
  price: number;
}

/**
 * The birthday discount, set once and applied everywhere.
 *
 * The preview at the bottom is the point of the card: percentage-versus-fixed
 * is easy to get backwards, so the barber sees the actual price a real service
 * would come to before saving.
 */
export function BirthdaySettingsCard({
  initial,
  services,
}: {
  initial: BirthdaySettings;
  services: ServiceOption[];
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.birthday_enabled);
  const [kind, setKind] = useState(initial.birthday_kind);
  const [amount, setAmount] = useState(String(initial.birthday_amount));
  const [windowDays, setWindowDays] = useState(String(initial.birthday_window_days));
  const [serviceIds, setServiceIds] = useState<string[]>(initial.birthday_service_ids);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const amountNum = Number(amount) || 0;
  const windowNum = Number(windowDays) || 0;

  const preview: BirthdaySettings = {
    birthday_enabled: true,
    birthday_kind: kind,
    birthday_amount: amountNum,
    birthday_window_days: windowNum,
    birthday_service_ids: serviceIds,
  };

  // Priced against a real service so the number means something
  const sample = services.find((s) => serviceIds.length === 0 || serviceIds.includes(s.id));
  const off = sample
    ? // The 1970 birthday is today's date, so the window never hides the preview
      birthdayDiscount(sample.price, sample.id, todayBirthday(), preview)
    : 0;

  function toggleService(id: string) {
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateBirthdaySettings({
        enabled,
        kind,
        amount: amountNum,
        windowDays: windowNum,
        serviceIds,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-4 space-y-4">
      <div className="flex items-start gap-2.5">
        <Cake size={16} className="text-brand shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground text-sm">Descuento de cumpleaños</p>
          <p className="text-xs text-muted">
            Se aplica solo a clientes que tengan su fecha de nacimiento guardada.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={cn(
            "w-11 h-6 rounded-full shrink-0 relative transition-colors",
            enabled ? "bg-brand" : "bg-border"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform",
              enabled ? "translate-x-[22px]" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      {enabled && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <KindButton
              active={kind === "percent"}
              onClick={() => setKind("percent")}
              label="Porcentaje"
              hint="% del precio"
            />
            <KindButton
              active={kind === "fixed"}
              onClick={() => setKind("fixed")}
              label="Monto fijo"
              hint="Cantidad exacta"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-foreground block mb-1.5">
                {kind === "percent" ? "Porcentaje" : "Monto"}
              </span>
              <div className="relative">
                {kind === "fixed" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                    $
                  </span>
                )}
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={kind === "percent" ? 100 : undefined}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={cn(
                    "w-full h-11 rounded-xl border border-border bg-background text-sm text-foreground",
                    kind === "fixed" ? "pl-7 pr-8" : "px-3 pr-8"
                  )}
                />
                {kind === "percent" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                    %
                  </span>
                )}
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-foreground block mb-1.5">
                Días alrededor
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={60}
                value={windowDays}
                onChange={(e) => setWindowDays(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground"
              />
            </label>
          </div>

          <p className="text-[11px] text-muted -mt-1.5">
            {windowNum === 0
              ? "Solo el día exacto del cumpleaños."
              : `Vale desde ${windowNum} ${windowNum === 1 ? "día" : "días"} antes hasta ${windowNum} después.`}
          </p>

          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5">Servicios incluidos</p>
            <p className="text-[11px] text-muted mb-2">
              {serviceIds.length === 0
                ? "Sin seleccionar ninguno, aplica a todos los servicios."
                : `${serviceIds.length} ${serviceIds.length === 1 ? "servicio" : "servicios"}.`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {services.map((s) => {
                const on = serviceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    className={cn(
                      "px-2.5 h-8 rounded-lg text-xs font-semibold border transition-colors",
                      on
                        ? "border-brand bg-brand-light text-brand"
                        : "border-border bg-background text-muted"
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          {sample && off > 0 && (
            <div className="bg-background rounded-xl border border-border p-3">
              <p className="text-[11px] text-muted mb-0.5">Ejemplo</p>
              <p className="text-sm text-foreground">
                <span className="font-semibold">{sample.name}</span>{" "}
                <span className="line-through text-muted">{formatCurrency(sample.price)}</span>{" "}
                <span className="font-bold text-brand">{formatCurrency(sample.price - off)}</span>
              </p>
            </div>
          )}
        </>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="w-full h-11 rounded-xl bg-brand text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 size={15} className="animate-spin" />
        ) : saved ? (
          <Check size={15} />
        ) : null}
        {isPending ? "Guardando..." : saved ? "Guardado" : "Guardar cumpleaños"}
      </button>
    </div>
  );
}

/**
 * Today's month and day in the shop's timezone, so the preview is never
 * outside the window it is previewing.
 */
function todayBirthday(): string {
  return `1990${shopToday().slice(4)}`;
}

function KindButton({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-2.5 text-left transition-colors",
        active ? "border-brand bg-brand-light" : "border-border bg-background"
      )}
    >
      <span className="block text-xs font-bold text-foreground">{label}</span>
      <span className="block text-[10px] text-muted">{hint}</span>
    </button>
  );
}
