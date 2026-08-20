"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Clock, Loader2, Mail, MessageSquare, Plus, Smartphone, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  saveReminderRule,
  deleteReminderRule,
  type ReminderRule,
} from "@/lib/actions/reminder-rules";

/** The lead times worth one tap. Anything else goes in "Otro". */
const PRESETS = [
  { minutes: 1440, label: "24 horas" },
  { minutes: 720, label: "12 horas" },
  { minutes: 120, label: "2 horas" },
  { minutes: 60, label: "1 hora" },
  { minutes: 30, label: "30 minutos" },
  { minutes: 15, label: "15 minutos" },
];

/** 1440 → "24 horas antes". */
export function leadLabel(minutes: number): string {
  if (minutes % 1440 === 0) {
    const d = minutes / 1440;
    return `${d} ${d === 1 ? "día" : "días"} antes`;
  }
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return `${h} ${h === 1 ? "hora" : "horas"} antes`;
  }
  return `${minutes} minutos antes`;
}

type Channel = "email" | "sms" | "push";

/**
 * When the client gets reminded, and on which channels.
 *
 * ── What this is and isn't ───────────────────────────────────────────────
 * Nothing here is a time hardcoded in the app: these rows *are* the schedule.
 * Saving one re-plans every future appointment's reminders, which a database
 * trigger does — so the queue can't drift from what this screen shows,
 * whether the change came from here or anywhere else.
 *
 * A channel switched on is permission, not a promise: the client's own
 * preferences still apply, and so does whether there is an address, a phone
 * or a registered device to reach them on.
 */
export function ReminderRules({
  rules,
  missing,
}: {
  rules: ReminderRule[];
  missing: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("45");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(input: Parameters<typeof saveReminderRule>[0]) {
    setError(null);
    startTransition(async () => {
      const result = await saveReminderRule(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAdding(false);
      router.refresh();
    });
  }

  function toggleChannel(rule: ReminderRule, channel: Channel) {
    save({
      id: rule.id,
      minutesBefore: rule.minutes_before,
      email: channel === "email" ? !rule.email : rule.email,
      sms: channel === "sms" ? !rule.sms : rule.sms,
      push: channel === "push" ? !rule.push : rule.push,
      isActive: rule.is_active,
    });
  }

  async function remove(rule: ReminderRule) {
    const yes = await confirm({
      title: `¿Eliminar el recordatorio de ${leadLabel(rule.minutes_before)}?`,
      message: "Los que ya se enviaron se conservan en el historial.",
      destructive: true,
      confirmLabel: "Eliminar",
    });
    if (!yes) return;

    startTransition(async () => {
      const result = await deleteReminderRule(rule.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (missing) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-5 text-center space-y-1.5">
        <p className="text-sm font-bold text-foreground">Faltan los recordatorios</p>
        <p className="text-xs text-muted">
          Corre <code className="font-mono text-brand">migration_35</code> en Supabase para
          configurarlos.
        </p>
      </div>
    );
  }

  const used = new Set(rules.map((r) => r.minutes_before));

  return (
    <div className="space-y-3">
      {rules.length === 0 && !adding && (
        <div className="bg-surface rounded-2xl border border-border p-6 text-center space-y-2">
          <Bell size={26} className="text-muted mx-auto" />
          <p className="text-sm text-muted">
            Sin recordatorios. Tus clientes no recibirán ningún aviso antes de su cita.
          </p>
        </div>
      )}

      {rules.map((rule) => (
        <div
          key={rule.id}
          className={cn(
            "bg-surface rounded-2xl border p-4 space-y-3",
            rule.is_active ? "border-border" : "border-border opacity-60"
          )}
        >
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-brand-light text-brand flex items-center justify-center shrink-0">
              <Clock size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">
                {leadLabel(rule.minutes_before)}
              </p>
              <p className="text-[11px] text-muted">
                {rule.is_active
                  ? channelSummary(rule)
                  : "Desactivado — no se envía nada"}
              </p>
            </div>
            <Switch
              on={rule.is_active}
              disabled={isPending}
              onToggle={() =>
                save({
                  id: rule.id,
                  minutesBefore: rule.minutes_before,
                  email: rule.email,
                  sms: rule.sms,
                  push: rule.push,
                  isActive: !rule.is_active,
                })
              }
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <ChannelButton
              on={rule.email}
              disabled={isPending || !rule.is_active}
              onClick={() => toggleChannel(rule, "email")}
              icon={<Mail size={14} />}
              label="Email"
            />
            <ChannelButton
              on={rule.sms}
              disabled={isPending || !rule.is_active}
              onClick={() => toggleChannel(rule, "sms")}
              icon={<MessageSquare size={14} />}
              label="SMS"
            />
            <ChannelButton
              on={rule.push}
              disabled={isPending || !rule.is_active}
              onClick={() => toggleChannel(rule, "push")}
              icon={<Smartphone size={14} />}
              label="Push"
            />
          </div>

          <button
            onClick={() => remove(rule)}
            disabled={isPending}
            className="w-full h-9 rounded-xl text-xs font-bold text-danger flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Trash2 size={13} /> Eliminar
          </button>
        </div>
      ))}

      {error && (
        <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>
      )}

      {adding ? (
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
          <p className="text-sm font-bold text-foreground">¿Cuánto antes?</p>

          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.minutes}
                type="button"
                disabled={used.has(p.minutes) || isPending}
                onClick={() =>
                  save({
                    minutesBefore: p.minutes,
                    email: true,
                    sms: false,
                    push: true,
                    isActive: true,
                  })
                }
                className={cn(
                  "h-11 rounded-xl border text-xs font-bold transition-colors",
                  used.has(p.minutes)
                    ? "border-border bg-background text-muted/40"
                    : "border-border bg-background text-foreground active:border-brand"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5">Tiempo personalizado</p>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={43200}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                className="flex-1 h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground"
                placeholder="Minutos"
              />
              <button
                type="button"
                disabled={isPending || !customMinutes}
                onClick={() =>
                  save({
                    minutesBefore: Number(customMinutes),
                    email: true,
                    sms: false,
                    push: true,
                    isActive: true,
                  })
                }
                className="px-4 h-11 rounded-xl bg-brand text-white text-xs font-bold disabled:opacity-50"
              >
                Añadir
              </button>
            </div>
            <p className="text-[11px] text-muted mt-1">
              En minutos. 1440 son 24 horas.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setAdding(false)}
            className="w-full h-10 rounded-xl border border-border text-xs font-bold text-muted"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={isPending}
          className="w-full h-12 rounded-2xl border border-dashed border-border text-sm font-bold text-foreground flex items-center justify-center gap-2"
        >
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />}
          Añadir recordatorio
        </button>
      )}
    </div>
  );
}

function channelSummary(rule: ReminderRule): string {
  const on = [rule.email && "Email", rule.sms && "SMS", rule.push && "Push"].filter(
    Boolean
  ) as string[];
  return on.length > 0 ? on.join(" · ") : "Ningún canal encendido";
}

function ChannelButton({
  on,
  disabled,
  onClick,
  icon,
  label,
}: {
  on: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={cn(
        "h-10 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50",
        on
          ? "border-brand bg-brand-light text-brand"
          : "border-border bg-background text-muted"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Switch({
  on,
  disabled,
  onToggle,
}: {
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "w-11 h-6 rounded-full shrink-0 relative transition-colors disabled:opacity-50",
        on ? "bg-brand" : "bg-border"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform",
          on ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
