"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Lock, CalendarOff, Trash2, Loader2, Save, Megaphone, AlertTriangle,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CLOSURE_REASONS, reasonLabel } from "@/lib/closures";
import { createClient } from "@/lib/supabase/client";
import {
  localMins, fromMins, toMins, dateAt, fmtHHMM, durationMins, localDateStr,
} from "@/lib/time";
import { shopDateAt, endOfShopDay } from "@/lib/timezone";
import type { BlockedRange, ClosureRange } from "@/lib/data/appointments";

/** Either kind of time-off, so one modal can present both. */
export type TimeOff =
  | { kind: "block"; block: BlockedRange }
  | { kind: "closure"; closure: ClosureRange };

/**
 * Everything about one blocked stretch or closure, with the controls to change
 * or remove it. Deleting frees the time immediately — the calendar re-reads
 * availability from the remaining rows, so any other block still covering
 * those hours keeps them closed.
 */
export function BlockDetailModal({
  target,
  onClose,
}: {
  target: TimeOff | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Editable fields, seeded from whatever was tapped ────────────────────
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [reason, setReason] = useState("otro");
  const [description, setDescription] = useState("");
  const [inCarousel, setInCarousel] = useState(false);

  useEffect(() => {
    if (!target) return;
    setError(null);
    setConfirmDelete(false);

    if (target.kind === "block") {
      const b = target.block;
      const s = localMins(b.starts_at);
      /*
       * The shop's day, not the first ten characters of the ISO string —
       * that is the UTC date, so an evening block opened as the next day and
       * saving it moved the block twenty-four hours.
       */
      const day = localDateStr(b.starts_at);
      setStartDate(day);
      setEndDate(day);
      setStartTime(fromMins(s));
      setEndTime(fromMins(s + durationMins(b.starts_at, b.ends_at)));
      // Blocks store their motive as free text in `reason`
      setDescription(b.reason ?? "");
      setReason("otro");
      setInCarousel(false);
    } else {
      const c = target.closure;
      setStartDate(c.starts_on);
      setEndDate(c.ends_on);
      setStartTime(c.start_time?.slice(0, 5) ?? "09:00");
      setEndTime(c.end_time?.slice(0, 5) ?? "18:00");
      setReason(c.reason);
      setDescription(c.description ?? "");
      setInCarousel(false);
    }
  }, [target]);

  // A closure owns its announcement through closures.carousel_post_id
  const carouselPostId = target?.kind === "closure" ? target.closure.carousel_post_id : null;
  useEffect(() => {
    setInCarousel(Boolean(carouselPostId));
  }, [carouselPostId]);

  if (!target) return null;

  const isBlock = target.kind === "block";
  const allDay = !isBlock && target.closure.all_day;

  async function save() {
    setError(null);
    setSaving(true);
    const supabase = createClient();

    if (target!.kind === "block") {
      const starts = dateAt(startDate, toMins(startTime));
      const ends = dateAt(startDate, toMins(endTime));
      if (ends <= starts) {
        setSaving(false);
        setError("La hora de fin debe ser después de la de inicio.");
        return;
      }
      const { error: err } = await supabase
        .from("blocked_times")
        .update({
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          reason: description.trim() || "Bloqueado",
        })
        .eq("id", target!.block.id);
      if (err) {
        setSaving(false);
        setError(`No se pudo guardar: ${err.message}`);
        return;
      }
    } else {
      const c = target!.closure;
      if (endDate < startDate) {
        setSaving(false);
        setError("La fecha final no puede ser antes de la inicial.");
        return;
      }
      const { error: err } = await supabase
        .from("closures")
        .update({
          starts_on: startDate,
          ends_on: endDate,
          reason,
          description: description.trim() || null,
          start_time: c.all_day ? null : startTime,
          end_time: c.all_day ? null : endTime,
        })
        .eq("id", c.id);
      if (err) {
        setSaving(false);
        setError(`No se pudo guardar: ${err.message}`);
        return;
      }

      // Keep the client-facing announcement in step with the switch
      if (inCarousel && !carouselPostId) {
        const { data: post } = await supabase
          .from("carousel_posts")
          .insert({
            type: "vacaciones",
            title: reasonLabel(reason).toUpperCase(),
            description: description.trim() || null,
            starts_on: startDate,
            ends_on: endDate,
            // The exact instant it stops — without this it never expires
            starts_at: shopDateAt(startDate, "00:00").toISOString(),
            ends_at: endOfShopDay(endDate).toISOString(),
            is_active: true,
          })
          .select("id")
          .single();
        if (post) {
          await supabase
            .from("closures")
            .update({ carousel_post_id: post.id })
            .eq("id", c.id);
        }
      } else if (!inCarousel && carouselPostId) {
        // Drop the link first so the closure never points at a deleted row
        await supabase.from("closures").update({ carousel_post_id: null }).eq("id", c.id);
        await supabase.from("carousel_posts").delete().eq("id", carouselPostId);
      } else if (inCarousel && carouselPostId) {
        await supabase
          .from("carousel_posts")
          .update({
            title: reasonLabel(reason).toUpperCase(),
            description: description.trim() || null,
            starts_on: startDate,
            ends_on: endDate,
            starts_at: shopDateAt(startDate, "00:00").toISOString(),
            ends_at: endOfShopDay(endDate).toISOString(),
          })
          .eq("id", carouselPostId);
      }
    }

    setSaving(false);
    onClose();
    startTransition(() => router.refresh());
  }

  async function remove() {
    setError(null);
    setSaving(true);
    const supabase = createClient();

    if (target!.kind === "block") {
      const { error: err } = await supabase
        .from("blocked_times")
        .delete()
        .eq("id", target!.block.id);
      if (err) {
        setSaving(false);
        setError(`No se pudo eliminar: ${err.message}`);
        return;
      }
    } else {
      // The announcement goes with it; a closure that no longer exists
      // shouldn't keep telling clients the shop is shut.
      const { error: err } = await supabase
        .from("closures")
        .delete()
        .eq("id", target!.closure.id);
      if (!err && target!.closure.carousel_post_id) {
        await supabase
          .from("carousel_posts")
          .delete()
          .eq("id", target!.closure.carousel_post_id);
      }
      if (err) {
        setSaving(false);
        setError(`No se pudo eliminar: ${err.message}`);
        return;
      }
    }

    setSaving(false);
    onClose();
    startTransition(() => router.refresh());
  }

  const dayCount =
    Math.round(
      (new Date(endDate + "T00:00:00").getTime() -
        new Date(startDate + "T00:00:00").getTime()) /
        86400000
    ) + 1;

  return (
    <Modal
      open
      onClose={onClose}
      title={isBlock ? "Hora bloqueada" : `Cierre · ${reasonLabel(reason)}`}
    >
      <div className="space-y-4">
        {/* What this is */}
        <div className="flex items-center gap-3 bg-background rounded-2xl border border-border px-3.5 py-3">
          <span className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center shrink-0">
            {isBlock ? (
              <Lock size={18} className="text-muted" />
            ) : (
              <CalendarOff size={18} className="text-danger" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground capitalize">
              {isBlock || startDate === endDate
                ? format(new Date(startDate + "T00:00:00"), "EEEE d 'de' MMMM", { locale: es })
                : `${format(new Date(startDate + "T00:00:00"), "d MMM", { locale: es })} – ${format(new Date(endDate + "T00:00:00"), "d MMM yyyy", { locale: es })}`}
            </p>
            <p className="text-xs text-muted">
              {isBlock
                ? `${fmtHHMM(startTime)} – ${fmtHHMM(endTime)}`
                : allDay
                  ? `${dayCount === 1 ? "Todo el día" : `${dayCount} días completos`}`
                  : `${fmtHHMM(startTime)} – ${fmtHHMM(endTime)} cada día`}
            </p>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={isBlock ? "Fecha" : "Desde"}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-input"
            />
          </Field>
          {!isBlock && (
            <Field label="Hasta">
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="form-input"
              />
            </Field>
          )}
        </div>

        {/* Hours — a block always has them; a closure only when partial */}
        {(isBlock || !allDay) && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde las">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="Hasta las">
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="form-input"
              />
            </Field>
          </div>
        )}

        {/* Reason — closures pick from the shared list */}
        {!isBlock && (
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
        )}

        <Field label={isBlock ? "Motivo" : "Descripción"}>
          <textarea
            rows={2}
            maxLength={400}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isBlock ? "Ej. cita médica" : "Lo que verán tus clientes"}
            className="form-input resize-none"
          />
        </Field>

        {/* Carousel link, closures only */}
        {!isBlock && (
          <div className="flex items-center justify-between gap-3 bg-background rounded-xl border border-border px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Megaphone size={14} className="text-brand" />
                Mostrar en el carrusel
              </p>
              <p className="text-xs text-muted mt-0.5">
                {inCarousel
                  ? "Tus clientes ven este cierre anunciado."
                  : "Nadie verá este cierre en la app del cliente."}
              </p>
            </div>
            <Switch
              checked={inCarousel}
              onChange={() => setInCarousel((v) => !v)}
              label="Mostrar en el carrusel"
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Actions */}
        {confirmDelete ? (
          <div className="bg-danger-light border border-danger/25 rounded-2xl p-3.5 space-y-3">
            <p className="text-sm text-foreground flex gap-2">
              <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" />
              {isBlock
                ? "Esas horas volverán a estar disponibles de inmediato."
                : "Esos días volverán a estar disponibles y se quitará el aviso del carrusel."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={remove}
                disabled={saving}
                className="flex-1 h-11 rounded-xl bg-danger text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Eliminar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
              className="w-12 h-12 rounded-xl border border-danger/30 bg-danger-light text-danger flex items-center justify-center shrink-0"
              aria-label="Eliminar"
            >
              <Trash2 size={17} />
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 h-12 rounded-xl bg-foreground text-background text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar cambios
            </button>
          </div>
        )}
      </div>
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
