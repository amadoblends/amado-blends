"use client";

import { useState, useTransition } from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isBefore,
  startOfDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2, User, Users, Check, Search } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { createAppointment } from "@/lib/actions/appointments";
import { createClientRecord, searchClients } from "@/lib/actions/clients";
import type { AvailabilityDay } from "@/lib/data/availability";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEEK_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMins(t: number) {
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
function fmtSlot(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const p = h >= 12 ? "PM" : "AM";
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${dh}:${String(m).padStart(2, "0")} ${p}`;
}
function generateSlots(day: AvailabilityDay, durMins: number): string[] {
  if (!day.is_active) return [];
  const start = toMins(day.start_time);
  const end = toMins(day.end_time);
  const step = day.slot_minutes;
  const bS = day.break_start_time ? toMins(day.break_start_time) : null;
  const bE = day.break_end_time ? toMins(day.break_end_time) : null;
  const out: string[] = [];
  for (let t = start; t + durMins <= end; t += step) {
    if (bS !== null && bE !== null && t < bE && t + durMins > bS) continue;
    out.push(fromMins(t));
  }
  return out;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "type" | "walkin" | "search" | "service" | "datetime" | "confirm";

export interface ServiceOption {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  color: string;
}

interface ClientResult {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
}

interface WizData {
  clientType: "walkin" | "existing" | null;
  walkinName: string;
  client: ClientResult | null;
  service: ServiceOption | null;
  date: string;
  time: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AppointmentWizard({
  open,
  onClose,
  onSuccess,
  services,
  availability,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  services: ServiceOption[];
  availability: AvailabilityDay[];
  defaultDate: string;
}) {
  const initData: WizData = {
    clientType: null,
    walkinName: "",
    client: null,
    service: null,
    date: defaultDate,
    time: "",
  };

  const [step, setStep] = useState<Step>("type");
  const [data, setData] = useState<WizData>(initData);
  const [searchQ, setSearchQ] = useState("");
  const [searchRes, setSearchRes] = useState<ClientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [calCursor, setCalCursor] = useState(() =>
    startOfMonth(new Date(defaultDate + "T00:00:00"))
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeWeekdays = new Set(availability.filter((d) => d.is_active).map((d) => d.weekday));

  function getDayAvail(dateStr: string): AvailabilityDay | null {
    const wd = new Date(dateStr + "T00:00:00").getDay();
    return availability.find((d) => d.weekday === wd && d.is_active) ?? null;
  }

  const dayAvail = getDayAvail(data.date);
  const slots =
    data.service && dayAvail ? generateSlots(dayAvail, data.service.duration_minutes) : [];

  function reset() {
    setStep("type");
    setData({ ...initData, date: defaultDate });
    setSearchQ("");
    setSearchRes([]);
    setCalCursor(startOfMonth(new Date(defaultDate + "T00:00:00")));
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function goBack() {
    const prev: Record<Step, Step | null> = {
      type: null,
      walkin: "type",
      search: "type",
      service: data.clientType === "walkin" ? "walkin" : "search",
      datetime: "service",
      confirm: "datetime",
    };
    const p = prev[step];
    if (p) setStep(p);
  }

  async function handleSearch(q: string) {
    setSearchQ(q);
    if (q.trim().length < 2) {
      setSearchRes([]);
      return;
    }
    setSearching(true);
    const res = await searchClients(q.trim());
    setSearchRes(res);
    setSearching(false);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        let clientId = data.client?.id ?? null;

        if (data.clientType === "walkin") {
          const fd = new FormData();
          fd.set("fullName", data.walkinName.trim());
          fd.set("phone", "walk-in");
          const res = await createClientRecord(fd);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          clientId = res.id!;
        }

        if (!clientId || !data.service || !data.time) {
          setError("Completa todos los pasos.");
          return;
        }

        // Build starts_at in local timezone so 9:00 AM stays 9:00 AM
        const [y, mo, d] = data.date.split("-").map(Number);
        const [h, mi] = data.time.split(":").map(Number);
        const startsAt = new Date(y, mo - 1, d, h, mi, 0).toISOString();

        const fd = new FormData();
        fd.set("clientId", clientId);
        fd.set("serviceId", data.service.id);
        fd.set("startsAt", startsAt);
        fd.set("durationMinutes", String(data.service.duration_minutes));
        fd.set("price", String(data.service.price));

        const res = await createAppointment(fd);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        reset();
        onSuccess();
      } catch {
        setError("Error inesperado. Intenta de nuevo.");
      }
    });
  }

  const titles: Record<Step, string> = {
    type: "Nueva cita",
    walkin: "Cliente walk-in",
    search: "Buscar cliente",
    service: "Selecciona servicio",
    datetime: "Fecha y hora",
    confirm: "Confirmar cita",
  };

  const backButton =
    step !== "type" ? (
      <button
        onClick={goBack}
        className="w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center shrink-0"
      >
        <ChevronLeft size={14} />
      </button>
    ) : undefined;

  return (
    <Modal open={open} onClose={handleClose} title={titles[step]} headerLeft={backButton}>

      {/* ── Step: type ─────────────────────────────────────────── */}
      {step === "type" && (
        <div className="space-y-3 mt-2">
          <button
            onClick={() => {
              setData((d) => ({ ...d, clientType: "walkin" }));
              setStep("walkin");
            }}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-background active:bg-surface text-left"
          >
            <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <User size={20} className="text-brand" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Walk-in</p>
              <p className="text-xs text-muted">Cliente sin cuenta previa</p>
            </div>
          </button>
          <button
            onClick={() => {
              setData((d) => ({ ...d, clientType: "existing" }));
              setStep("search");
            }}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-background active:bg-surface text-left"
          >
            <div className="w-10 h-10 rounded-full bg-violet/10 flex items-center justify-center shrink-0">
              <Users size={20} className="text-violet" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Cliente existente</p>
              <p className="text-xs text-muted">Busca por nombre, teléfono o correo</p>
            </div>
          </button>
        </div>
      )}

      {/* ── Step: walkin name ──────────────────────────────────── */}
      {step === "walkin" && (
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Nombre del cliente
            </label>
            <input
              type="text"
              autoFocus
              value={data.walkinName}
              onChange={(e) => setData((d) => ({ ...d, walkinName: e.target.value }))}
              placeholder="Ej. Miguel López"
              className="w-full h-12 px-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <button
            disabled={data.walkinName.trim().length < 2}
            onClick={() => setStep("service")}
            className="w-full h-12 rounded-xl bg-brand text-white font-semibold text-sm disabled:opacity-40"
          >
            Continuar →
          </button>
        </div>
      )}

      {/* ── Step: search client ────────────────────────────────── */}
      {step === "search" && (
        <div className="space-y-3 mt-2">
          <div className="relative">
            <input
              type="text"
              autoFocus
              value={searchQ}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Nombre, teléfono o correo..."
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            {searching ? (
              <Loader2
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted animate-spin"
              />
            ) : (
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            )}
          </div>

          {searchRes.length > 0 && (
            <div className="bg-background rounded-xl border border-border divide-y divide-border overflow-hidden max-h-64 overflow-y-auto">
              {searchRes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setData((d) => ({ ...d, client: c }));
                    setStep("service");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 active:bg-surface text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-brand">{c.full_name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.full_name}</p>
                    <p className="text-xs text-muted truncate">{c.phone}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {searchQ.length >= 2 && !searching && searchRes.length === 0 && (
            <p className="text-sm text-muted text-center py-4">Sin resultados.</p>
          )}
        </div>
      )}

      {/* ── Step: service ──────────────────────────────────────── */}
      {step === "service" && (
        <div className="space-y-2 mt-2 max-h-[58vh] overflow-y-auto -mx-1 px-1">
          {services.length === 0 && (
            <p className="text-sm text-muted text-center py-6">
              No tienes servicios. Crea uno en Servicios.
            </p>
          )}
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setData((d) => ({ ...d, service: s, time: "" }));
                setStep("datetime");
              }}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border active:bg-surface text-left"
            >
              <div className="w-3 h-10 rounded-full shrink-0" style={{ background: s.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{s.name}</p>
                <p className="text-xs text-muted">{s.duration_minutes} min</p>
              </div>
              <p className="text-sm font-bold text-foreground shrink-0">${s.price.toFixed(2)}</p>
            </button>
          ))}
        </div>
      )}

      {/* ── Step: datetime ─────────────────────────────────────── */}
      {step === "datetime" && (
        <div className="space-y-4 mt-2">
          {/* Inline calendar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setCalCursor((c) => subMonths(c, 1))}
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center"
              >
                <ChevronLeft size={14} />
              </button>
              <p className="font-semibold text-sm text-foreground capitalize">
                {format(calCursor, "MMMM yyyy", { locale: es })}
              </p>
              <button
                onClick={() => setCalCursor((c) => addMonths(c, 1))}
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 mb-0.5">
              {WEEK_LABELS.map((w, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-muted py-1">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {eachDayOfInterval({
                start: startOfWeek(startOfMonth(calCursor), { weekStartsOn: 1 }),
                end: endOfWeek(endOfMonth(calCursor), { weekStartsOn: 1 }),
              }).map((d) => {
                const wd = d.getDay();
                const inMonth = isSameMonth(d, calCursor);
                const disabled =
                  !activeWeekdays.has(wd) ||
                  isBefore(startOfDay(d), startOfDay(new Date()));
                const isSelected = isSameDay(d, new Date(data.date + "T00:00:00"));
                const isToday = isSameDay(d, new Date());

                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => {
                      if (disabled) return;
                      setData((dd) => ({
                        ...dd,
                        date: format(d, "yyyy-MM-dd"),
                        time: "",
                      }));
                    }}
                    className={cn(
                      "aspect-square rounded-lg text-xs font-medium flex items-center justify-center",
                      !inMonth && "text-muted/30",
                      disabled && "text-muted/25 cursor-not-allowed",
                      !disabled && inMonth && "text-foreground",
                      isSelected && "bg-brand text-white font-bold",
                      !isSelected && isToday && "border border-brand text-brand font-bold"
                    )}
                  >
                    {format(d, "d")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time slots */}
          {!dayAvail ? (
            <p className="text-xs text-muted text-center py-2 bg-background rounded-xl border border-border px-3">
              No hay horario configurado para este día. Selecciona otro día.
            </p>
          ) : slots.length === 0 ? (
            <p className="text-xs text-muted text-center py-2 bg-background rounded-xl border border-border px-3">
              Sin disponibilidad para &ldquo;{data.service?.name}&rdquo; en este día.
            </p>
          ) : (
            <div>
              <p className="text-[11px] font-semibold text-muted mb-2 uppercase tracking-wide">
                Horas disponibles
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {slots.map((s) => (
                  <button
                    key={s}
                    onClick={() => setData((d) => ({ ...d, time: s }))}
                    className={cn(
                      "h-9 rounded-lg text-xs font-semibold border transition-colors",
                      data.time === s
                        ? "bg-brand border-brand text-white"
                        : "border-border text-foreground bg-background active:bg-surface"
                    )}
                  >
                    {fmtSlot(s)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            disabled={!data.time}
            onClick={() => setStep("confirm")}
            className="w-full h-12 rounded-xl bg-brand text-white font-semibold text-sm disabled:opacity-40"
          >
            Continuar →
          </button>
        </div>
      )}

      {/* ── Step: confirm ──────────────────────────────────────── */}
      {step === "confirm" && (
        <div className="space-y-4 mt-2">
          <div className="bg-background rounded-2xl border border-border divide-y divide-border overflow-hidden">
            <SummaryRow
              label="Cliente"
              value={
                data.clientType === "walkin"
                  ? `${data.walkinName} (walk-in)`
                  : (data.client?.full_name ?? "")
              }
            />
            <SummaryRow
              label="Servicio"
              value={`${data.service?.name} · ${data.service?.duration_minutes} min`}
            />
            <SummaryRow
              label="Fecha"
              value={format(new Date(data.date + "T00:00:00"), "EEEE d 'de' MMMM yyyy", {
                locale: es,
              })}
            />
            <SummaryRow label="Hora" value={fmtSlot(data.time)} />
            <SummaryRow label="Precio" value={`$${(data.service?.price ?? 0).toFixed(2)}`} />
          </div>

          {error && <p className="text-sm text-danger text-center">{error}</p>}

          <button
            disabled={isPending}
            onClick={handleSubmit}
            className="w-full h-12 rounded-xl bg-brand text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Check size={17} />
            )}
            {isPending ? "Creando..." : "Crear cita"}
          </button>
        </div>
      )}
    </Modal>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-3">
      <span className="text-sm text-muted shrink-0">{label}</span>
      <span className="text-sm font-semibold text-foreground text-right truncate capitalize">
        {value}
      </span>
    </div>
  );
}
