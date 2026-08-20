"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Loader2,
  Lock,
  Trash2,
  UserMinus,
  ShieldOff,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { shopShortDate } from "@/lib/timezone";
import { setClientStatus, type DeleteImpact } from "@/lib/actions/client-status";
import { deleteClientRecord } from "@/lib/actions/clients";
import {
  BLOCK_REASONS,
  STATUS_META,
  blockReasonLabel,
  type StoredClientStatus,
} from "@/lib/client-status";

type Panel = null | "block" | "deactivate" | "delete";

/**
 * Managing what a client's account is allowed to do.
 *
 * Deactivating, blocking and deleting are kept visibly apart because they are
 * not degrees of the same thing: the first two keep every appointment,
 * payment and note exactly where it is, and only the third destroys anything.
 * The delete path shows what would actually be lost first — the takings a
 * report is built on are precisely what nobody pictures while tapping
 * through a confirmation.
 */
export function ClientStatusCard({
  clientId,
  clientName,
  status,
  blockReason,
  blockNote,
  statusChangedAt,
  impact,
}: {
  clientId: string;
  clientName: string;
  status: StoredClientStatus;
  blockReason: string | null;
  blockNote: string | null;
  statusChangedAt: string | null;
  /** What deleting would destroy; null when it couldn't be read. */
  impact: DeleteImpact | null;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [reason, setReason] = useState<string>(BLOCK_REASONS[0].value);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const meta = STATUS_META[status];

  function change(next: StoredClientStatus, extra?: { reason?: string; note?: string }) {
    setError(null);
    startTransition(async () => {
      const result = await setClientStatus({ clientId, status: next, ...extra });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPanel(null);
      setNote("");
      router.refresh();
    });
  }

  function destroy() {
    setError(null);
    startTransition(async () => {
      const result = await deleteClientRecord(clientId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/clientes");
      router.refresh();
    });
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
            status === "blocked" ? "bg-danger-light text-danger" : "bg-background text-muted"
          )}
        >
          {status === "blocked" ? <Ban size={17} /> : <ShieldOff size={17} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-foreground">Estado de la cuenta</p>
            <span
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                meta.className
              )}
            >
              {meta.label}
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">{meta.hint}</p>
          {statusChangedAt && status !== "active" && (
            <p className="text-[11px] text-muted/70 mt-0.5">
              Desde el {shopShortDate(statusChangedAt)}
            </p>
          )}
        </div>
      </div>

      {/* The internal reason, which the client is never shown */}
      {status === "blocked" && (
        <div className="bg-danger-light/60 border border-danger/20 rounded-xl px-3.5 py-2.5">
          <p className="text-[11px] font-bold text-danger uppercase tracking-wide flex items-center gap-1.5">
            <Lock size={11} /> Motivo interno · solo tú lo ves
          </p>
          <p className="text-sm text-foreground mt-1">{blockReasonLabel(blockReason)}</p>
          {blockNote && <p className="text-xs text-muted mt-0.5">{blockNote}</p>}
        </div>
      )}

      {error && (
        <p className="text-xs text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>
      )}

      {/* ── Confirmations ─────────────────────────────────────────────── */}

      {panel === "block" && (
        <div className="bg-background border border-border rounded-xl p-3.5 space-y-3">
          <p className="text-sm font-bold text-foreground">¿Bloquear a {clientName}?</p>
          <p className="text-xs text-muted">
            No podrá reservar ni reagendar. Sus citas, pagos y notas se conservan, y tú sigues
            viendo su perfil.
          </p>

          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5">Motivo interno</p>
            <div className="grid grid-cols-2 gap-1.5">
              {BLOCK_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={cn(
                    "rounded-lg border p-2 text-left transition-colors",
                    reason === r.value
                      ? "border-danger bg-danger-light"
                      : "border-border bg-surface"
                  )}
                >
                  <span className="block text-xs font-bold text-foreground">{r.label}</span>
                  <span className="block text-[10px] text-muted">{r.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <textarea
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota privada (opcional)"
            className="w-full p-2.5 rounded-lg border border-border bg-surface text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-danger"
          />

          <p className="text-[11px] text-muted flex gap-1.5">
            <Lock size={11} className="shrink-0 mt-0.5" />
            Si intenta reservar solo verá un mensaje neutral. Nunca se le muestra este motivo.
          </p>

          <Actions
            onCancel={() => setPanel(null)}
            onConfirm={() => change("blocked", { reason, note: note.trim() || undefined })}
            confirmLabel="Bloquear"
            pending={isPending}
            danger
          />
        </div>
      )}

      {panel === "deactivate" && (
        <div className="bg-background border border-border rounded-xl p-3.5 space-y-3">
          <p className="text-sm font-bold text-foreground">¿Desactivar a {clientName}?</p>
          <p className="text-xs text-muted">
            La cuenta queda inactiva y no podrá reservar. No se borra nada: citas anteriores,
            transacciones, notas e historial se conservan íntegros.
          </p>
          <Actions
            onCancel={() => setPanel(null)}
            onConfirm={() => change("deactivated")}
            confirmLabel="Desactivar"
            pending={isPending}
          />
        </div>
      )}

      {panel === "delete" && (
        <div className="bg-danger-light border border-danger/25 rounded-xl p-3.5 space-y-3">
          <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <AlertTriangle size={15} className="text-danger" />
            Esto no se puede deshacer
          </p>

          {impact ? (
            <>
              <p className="text-xs text-foreground">Se eliminará de forma permanente:</p>
              <ul className="text-xs text-foreground space-y-1 bg-surface rounded-lg p-3">
                <Impact label="Citas" value={String(impact.appointments)} />
                <Impact label="Citas completadas" value={String(impact.completed)} />
                <Impact
                  label="Ingresos registrados"
                  value={formatCurrency(impact.totalSpent)}
                  warn={impact.totalSpent > 0}
                />
                <Impact label="Notas" value={String(impact.notes)} />
                <Impact label="Comentarios" value={String(impact.feedback)} />
                {impact.firstVisit && (
                  <Impact
                    label="Historial desde"
                    value={shopShortDate(impact.firstVisit)}
                  />
                )}
              </ul>
              {impact.totalSpent > 0 && (
                <p className="text-[11px] text-danger font-semibold">
                  Esos ingresos desaparecerán de tus reportes. Si solo quieres que deje de
                  reservar, desactívalo o bloquéalo.
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted">
              No se pudo calcular qué se perdería. Considera desactivar en su lugar.
            </p>
          )}

          <Actions
            onCancel={() => setPanel(null)}
            onConfirm={destroy}
            confirmLabel="Eliminar definitivamente"
            pending={isPending}
            danger
          />
        </div>
      )}

      {/* ── The buttons ───────────────────────────────────────────────── */}

      {panel === null && (
        <div className="grid grid-cols-2 gap-2">
          {status === "blocked" ? (
            <Button
              onClick={() => change("active")}
              icon={<CheckCircle2 size={14} />}
              label="Desbloquear"
              pending={isPending}
              tone="success"
            />
          ) : (
            <Button
              onClick={() => setPanel("block")}
              icon={<Ban size={14} />}
              label="Bloquear"
              pending={isPending}
              tone="danger"
            />
          )}

          {status === "deactivated" ? (
            <Button
              onClick={() => change("active")}
              icon={<CheckCircle2 size={14} />}
              label="Reactivar"
              pending={isPending}
              tone="success"
            />
          ) : (
            <Button
              onClick={() => setPanel("deactivate")}
              icon={<UserMinus size={14} />}
              label="Desactivar"
              pending={isPending}
            />
          )}

          <button
            onClick={() => setPanel("delete")}
            disabled={isPending}
            className="col-span-2 h-10 rounded-xl text-xs font-bold text-danger flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Trash2 size={13} /> Eliminar cliente
          </button>
        </div>
      )}
    </div>
  );
}

function Impact({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className={cn("font-bold", warn ? "text-danger" : "text-foreground")}>{value}</span>
    </li>
  );
}

function Button({
  onClick,
  icon,
  label,
  pending,
  tone,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  pending: boolean;
  tone?: "danger" | "success";
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={cn(
        "h-10 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50",
        tone === "danger"
          ? "border-danger/30 bg-danger-light text-danger"
          : tone === "success"
            ? "border-success/30 bg-success-light text-success"
            : "border-border bg-background text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Actions({
  onCancel,
  onConfirm,
  confirmLabel,
  pending,
  danger,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  pending: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onCancel}
        disabled={pending}
        className="flex-1 h-10 rounded-xl border border-border bg-surface text-xs font-bold text-foreground"
      >
        Cancelar
      </button>
      <button
        onClick={onConfirm}
        disabled={pending}
        className={cn(
          "flex-1 h-10 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-60",
          danger ? "bg-danger" : "bg-foreground text-background"
        )}
      >
        {pending && <Loader2 size={13} className="animate-spin" />}
        {confirmLabel}
      </button>
    </div>
  );
}
