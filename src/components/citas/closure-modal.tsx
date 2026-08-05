"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarOff, Loader2, AlertTriangle, Megaphone, Check, ArrowRight,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CLOSURE_REASONS } from "@/lib/closures";
import {
  createClosure,
  findClosureConflicts,
  buildAnnouncement,
  type ConflictingAppointment,
} from "@/lib/actions/closures";

type Announce = "no" | "publicar" | "borrador";

export function ClosureModal({
  open,
  onClose,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  defaultDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [startsOn, setStartsOn] = useState(defaultDate);
  const [endsOn, setEndsOn] = useState(defaultDate);
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [reason, setReason] = useState<string>("vacaciones");
  const [description, setDescription] = useState("");

  const [announce, setAnnounce] = useState<Announce>("publicar");
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [returnISO, setReturnISO] = useState<string | null>(null);
  const [returnPost, setReturnPost] = useState(false);

  const [conflicts, setConflicts] = useState<ConflictingAppointment[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the end date from drifting before the start
  useEffect(() => {
    if (endsOn < startsOn) setEndsOn(startsOn);
  }, [startsOn, endsOn]);

  // Prefill the announcement whenever the range changes
  useEffect(() => {
    if (!open) return;
    let alive = true;
    buildAnnouncement(startsOn, endsOn).then((a) => {
      if (!alive) return;
      setAnnounceTitle(a.title);
      setAnnounceBody(a.body);
      setReturnISO(a.returnISO);
    });
    return () => {
      alive = false;
    };
  }, [open, startsOn, endsOn]);

  // Look for appointments caught inside the range
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setChecking(true);
    findClosureConflicts(
      startsOn,
      endsOn,
      allDay,
      allDay ? undefined : startTime,
      allDay ? undefined : endTime
    ).then((rows) => {
      if (!alive) return;
      setConflicts(rows);
      setChecking(false);
    });
    return () => {
      alive = false;
    };
  }, [open, startsOn, endsOn, allDay, startTime, endTime]);

  const hasConflicts = (conflicts?.length ?? 0) > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("startsOn", startsOn);
    fd.set("endsOn", endsOn);
    fd.set("allDay", String(allDay));
    fd.set("startTime", allDay ? "" : startTime);
    fd.set("endTime", allDay ? "" : endTime);
    fd.set("reason", reason);
    fd.set("description", description);
    fd.set("announce", announce);
    fd.set("announceTitle", announceTitle);
    fd.set("announceBody", announceBody);
    fd.set("announceReturnPost", String(returnPost && announce !== "no"));

    startTransition(async () => {
      const result = await createClosure(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  const dayCount =
    Math.round(
      (new Date(endsOn + "T00:00:00").getTime() - new Date(startsOn + "T00:00:00").getTime()) /
        86400000
    ) + 1;

  return (
    <Modal open={open} onClose={onClose} title="Cerrar días">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Range */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde">
            <input
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              required
              className="form-input"
            />
          </Field>
          <Field label="Hasta">
            <input
              type="date"
              value={endsOn}
              min={startsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              required
              className="form-input"
            />
          </Field>
        </div>

        <p className="text-xs text-muted -mt-2">
          {dayCount === 1 ? "Cerrarás 1 día." : `Cerrarás ${dayCount} días seguidos.`}
        </p>

        {/* All day vs partial */}
        <div className="flex items-center justify-between gap-3 bg-background rounded-xl border border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Cerrado todo el día</p>
            <p className="text-xs text-muted mt-0.5">
              Apágalo para cerrar solo unas horas de cada día.
            </p>
          </div>
          <Switch checked={allDay} onChange={() => setAllDay((v) => !v)} label="Todo el día" />
        </div>

        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cerrado desde">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="Cerrado hasta">
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="form-input"
              />
            </Field>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Motivo</label>
          <div className="grid grid-cols-4 gap-1">
            {CLOSURE_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={cn(
                  "h-[52px] rounded-xl border text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 px-1 transition-colors",
                  reason === r.value
                    ? "bg-foreground border-foreground text-background"
                    : "border-border bg-background text-muted"
                )}
              >
                <span className="text-base leading-none">{r.emoji}</span>
                <span className="leading-tight text-center">{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Descripción (opcional)">
          <textarea
            rows={2}
            maxLength={400}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notas internas o detalle del cierre..."
            className="form-input resize-none"
          />
        </Field>

        {/* Conflicts */}
        {checking ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Loader2 size={13} className="animate-spin" /> Revisando citas en esas fechas...
          </div>
        ) : hasConflicts ? (
          <div className="bg-danger-light rounded-xl border border-danger/25 p-3 space-y-2">
            <p className="text-sm font-semibold text-danger flex items-center gap-1.5">
              <AlertTriangle size={15} />
              {conflicts!.length} cita(s) en esas fechas
            </p>
            <p className="text-xs text-muted">
              Reagéndalas o cancélalas antes de cerrar. Toca una para abrirla.
            </p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {conflicts!.map((c) => (
                <Link
                  key={c.id}
                  href={`/citas/${c.id}`}
                  className="flex items-center gap-2 bg-surface rounded-lg px-2.5 py-2 active:opacity-70"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {c.guestName ?? c.clientName}
                    </p>
                    <p className="text-[11px] text-muted">
                      {format(new Date(c.starts_at), "d MMM · h:mm a", { locale: es })} ·{" "}
                      {c.serviceName}
                    </p>
                  </div>
                  <ArrowRight size={13} className="text-muted shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        ) : (
          conflicts !== null && (
            <p className="text-xs text-success flex items-center gap-1.5">
              <Check size={13} /> No hay citas en esas fechas.
            </p>
          )
        )}

        {/* Announcement */}
        <div className="bg-background rounded-xl border border-border p-3 space-y-2.5">
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Megaphone size={15} className="text-brand" />
            ¿Anunciar este cierre a tus clientes?
          </p>

          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { key: "publicar", label: "Sí, publicar" },
                { key: "borrador", label: "Borrador" },
                { key: "no", label: "No publicar" },
              ] as { key: Announce; label: string }[]
            ).map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setAnnounce(o.key)}
                className={cn(
                  "h-10 rounded-lg border text-[11px] font-semibold transition-colors",
                  announce === o.key
                    ? "bg-brand border-brand text-white"
                    : "border-border bg-surface text-muted"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          {announce !== "no" && (
            <>
              <Field label="Título del anuncio">
                <input
                  value={announceTitle}
                  onChange={(e) => setAnnounceTitle(e.target.value)}
                  maxLength={120}
                  className="form-input"
                />
              </Field>
              <Field label="Mensaje">
                <textarea
                  rows={3}
                  maxLength={400}
                  value={announceBody}
                  onChange={(e) => setAnnounceBody(e.target.value)}
                  className="form-input resize-none"
                />
              </Field>

              {returnISO && (
                <div className="flex items-center justify-between gap-3 bg-surface rounded-lg border border-border px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      Aviso de regreso el día antes
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">
                      Vuelves el{" "}
                      {format(new Date(returnISO), "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                  </div>
                  <Switch
                    checked={returnPost}
                    onChange={() => setReturnPost((v) => !v)}
                    label="Aviso de regreso"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {error && <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>}

        <button
          type="submit"
          disabled={isPending || hasConflicts || checking}
          className="w-full bg-brand text-white font-bold h-12 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-40 flex items-center justify-center gap-2 text-sm"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <CalendarOff size={16} />}
          {hasConflicts ? "Resuelve las citas primero" : "Cerrar estos días"}
        </button>

        <style jsx global>{`
          .form-input {
            width: 100%;
            padding: 0.6rem 0.85rem;
            border-radius: 0.75rem;
            border: 1px solid var(--border);
            background: var(--surface);
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
