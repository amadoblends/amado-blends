"use client";

import { useState, useCallback, useEffect, useRef, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, addDays, subDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarPlus, UserPlus, Users, Lock, X, Plus, Clock, CalendarOff, Info,
} from "lucide-react";
import { DayTimeline } from "./timeline";
import { AppointmentWizard, type ServiceOption } from "./wizard";
import { BlockHoursModal } from "./block-hours";
import { BlockHourQuick } from "./block-hour-quick";
import { ClosureModal } from "./closure-modal";
import { CalendarToolbar, type CalendarView } from "./calendar-toolbar";
import { WeekView, MonthView, YearView, closureFor } from "./calendar-views";
import { DayStripScroller } from "./day-strip-scroller";
import { AppointmentSheet } from "./appointment-sheet";
import { RescheduleModal } from "./reschedule-modal";
import { FullCalendarSheet } from "./full-calendar-sheet";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { SearchModal } from "@/components/search-modal";
import { Modal } from "@/components/ui/modal";
import { reasonLabel } from "@/lib/closures";
import { cn } from "@/lib/utils";
import type { SlotVerdict } from "@/lib/slot-availability";
import type {
  AppointmentRow,
  BlockedRange,
  ClosureRange,
  LiteAppointment,
} from "@/lib/data/appointments";
import type { AvailabilityDay } from "@/lib/data/availability";

/** Horizontal travel needed before a drag counts as a day swipe. */
const SWIPE_PX = 55;

export function CalendarShell({
  view,
  date,
  dateStr,
  appointments,
  liteAppointments = [],
  dayAvail,
  availability,
  services,
  blockedTimes = [],
  closures = [],
  dayCounts = {},
}: {
  view: CalendarView;
  date: Date;
  dateStr: string;
  appointments: AppointmentRow[];
  /** Month and year views only need name, colour and status. */
  liteAppointments?: LiteAppointment[];
  dayAvail: AvailabilityDay | null;
  availability: AvailabilityDay[];
  services: ServiceOption[];
  blockedTimes?: BlockedRange[];
  closures?: ClosureRange[];
  dayCounts?: Record<string, number>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [closureOpen, setClosureOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [fullCalendarOpen, setFullCalendarOpen] = useState(false);
  // Why a tapped hour can't take an appointment
  const [rejected, setRejected] = useState<SlotVerdict | null>(null);

  // Tapping an empty slot opens a small menu with the seed date/time
  const [slot, setSlot] = useState<{ date: string; time: string } | null>(null);
  const [wizardSeed, setWizardSeed] = useState<{ date: string; time: string } | null>(null);
  // Blocking a slot picked on the calendar keeps its date and start time
  const [quickBlock, setQuickBlock] = useState<{ date: string; time: string } | null>(null);
  // Tapping a block opens the card; the profile stays a further tap away
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const [rescheduling, setRescheduling] = useState<AppointmentRow | null>(null);
  // Title follows the day strip while it's being swiped
  const [visibleMonth, setVisibleMonth] = useState<Date | undefined>(undefined);

  /*
   * The selected day and view are mirrored locally so a tap or a swipe paints
   * immediately instead of waiting for the server round trip. Both re-sync
   * whenever the server sends new props.
   */
  const [pendingDate, setPendingDate] = useState(dateStr);
  const [pendingView, setPendingView] = useState<CalendarView>(view);
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);

  useEffect(() => setPendingDate(dateStr), [dateStr]);
  useEffect(() => setPendingView(view), [view]);

  const navigate = useCallback(
    (nextDate: string, nextView: CalendarView, dir: "left" | "right" | null = null) => {
      if (nextDate === pendingDate && nextView === pendingView) return;
      setSlideDir(dir);
      setPendingDate(nextDate);
      setPendingView(nextView);
      // Leaving the day view drops the scroll-driven title override
      if (nextView !== "day") setVisibleMonth(undefined);
      startTransition(() => {
        router.push(`/citas?view=${nextView}&date=${nextDate}`, { scroll: false });
      });
    },
    [router, pendingDate, pendingView]
  );

  const handleNavigate = useCallback(
    (d: Date, v: CalendarView) => navigate(format(d, "yyyy-MM-dd"), v),
    [navigate]
  );

  const handlePickDay = useCallback(
    (dateKey: string) => {
      const dir = dateKey > pendingDate ? "left" : dateKey < pendingDate ? "right" : null;
      navigate(dateKey, "day", dir);
    },
    [navigate, pendingDate]
  );

  // The header's calendar button opens the whole calendar, not just "today"
  const handleOpenFullCalendar = useCallback(() => setFullCalendarOpen(true), []);

  const handleFullCalendarPick = useCallback(
    (nextDate: string, nextView: CalendarView) => {
      setVisibleMonth(undefined);
      navigate(nextDate, nextView);
    },
    [navigate]
  );

  // ── Swipe left / right on the day view ───────────────────────────────────
  const touch = useRef<{ x: number; y: number; locked: boolean | null } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, locked: null };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const t = touch.current;
    if (!t || t.locked === false) return;
    const dx = e.touches[0].clientX - t.x;
    const dy = e.touches[0].clientY - t.y;
    // Decide once whether this gesture is a horizontal swipe or a vertical
    // scroll, so scrolling the timeline never flips the day by accident.
    if (t.locked === null && Math.hypot(dx, dy) > 12) {
      t.locked = Math.abs(dx) > Math.abs(dy) * 1.4;
    }
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const t = touch.current;
      touch.current = null;
      if (!t || !t.locked) return;
      const dx = e.changedTouches[0].clientX - t.x;
      if (Math.abs(dx) < SWIPE_PX) return;

      const base = new Date(pendingDate + "T00:00:00");
      // Drag left → next day, drag right → previous day
      const next = dx < 0 ? addDays(base, 1) : subDays(base, 1);
      navigate(format(next, "yyyy-MM-dd"), "day", dx < 0 ? "left" : "right");
    },
    [navigate, pendingDate]
  );

  // ── Everything else ──────────────────────────────────────────────────────
  const openWizardAt = useCallback((seed: { date: string; time: string } | null) => {
    setWizardSeed(seed);
    setSlot(null);
    setWizardOpen(true);
  }, []);

  const handleNewAppointment = useCallback(() => openWizardAt(null), [openWizardAt]);
  const handleBlockHours = useCallback(() => setBlockOpen(true), []);
  const handleCloseDays = useCallback(() => setClosureOpen(true), []);
  const handleSearch = useCallback(() => setSearchOpen(true), []);
  const handleSlotClick = useCallback(
    (d: string, t: string) => setSlot({ date: d, time: t }),
    []
  );
  const handleSlotRejected = useCallback((v: SlotVerdict) => setRejected(v), []);
  const handleSelect = useCallback((a: AppointmentRow) => setSelected(a), []);

  const todaysClosure = closureFor(date, closures);

  // A gap has to fit at least the shortest service to be worth offering
  const shortestServiceMins = useMemo(() => {
    const durations = services
      .map((s) => s.duration_minutes)
      .filter((d): d is number => typeof d === "number" && d > 0);
    return durations.length ? Math.min(...durations) : 15;
  }, [services]);

  // The server is still catching up, so drive the header off the local value
  const headerDate = useMemo(
    () => new Date(pendingDate + "T00:00:00"),
    [pendingDate]
  );

  // Only animate once the props for the new day have actually arrived
  const settled = pendingDate === dateStr && pendingView === view;
  const enterClass =
    settled && slideDir === "left"
      ? "animate-day-in-left"
      : settled && slideDir === "right"
        ? "animate-day-in-right"
        : "animate-view-in";

  return (
    <div className="space-y-3">
      <RealtimeRefresher tables={["appointments", "blocked_times", "closures"]} />

      <CalendarToolbar
        view={pendingView}
        date={headerDate}
        displayDate={pendingView === "day" ? visibleMonth : undefined}
        onNavigate={handleNavigate}
        onSearch={handleSearch}
        onToday={handleOpenFullCalendar}
      />

      {/* Day strip sits between the header and the actions */}
      {pendingView === "day" && (
        <DayStripScroller
          selected={pendingDate}
          counts={dayCounts}
          onPick={handlePickDay}
          onVisibleMonthChange={setVisibleMonth}
        />
      )}

      {/* Primary actions, as pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        <ActionPill onClick={handleNewAppointment} primary icon={<Plus size={15} strokeWidth={3} />}>
          Nueva cita
        </ActionPill>
        <ActionPill onClick={handleBlockHours} icon={<Clock size={14} strokeWidth={2.4} />}>
          Bloquear hora
        </ActionPill>
        <ActionPill onClick={handleCloseDays} icon={<CalendarOff size={14} strokeWidth={2.4} />}>
          Bloquear días
        </ActionPill>
      </div>

      {/* Closure banner on the day being viewed */}
      {todaysClosure && view === "day" && (
        <div className="bg-danger-light rounded-2xl border border-danger/20 px-4 py-3">
          <p className="text-sm font-bold text-danger">
            Cerrado · {reasonLabel(todaysClosure.reason)}
          </p>
          <p className="text-xs text-muted mt-0.5">
            {todaysClosure.description ||
              `Del ${format(new Date(todaysClosure.starts_on + "T00:00:00"), "d MMM", { locale: es })} al ${format(new Date(todaysClosure.ends_on + "T00:00:00"), "d MMM", { locale: es })}`}
          </p>
        </div>
      )}

      {/*
       * One container for every view with a floor on its height: switching
       * between day / week / month / year no longer collapses the page and
       * bounces the scroll position.
       */}
      <div
        className="min-h-[62vh]"
        onTouchStart={view === "day" ? onTouchStart : undefined}
        onTouchMove={view === "day" ? onTouchMove : undefined}
        onTouchEnd={view === "day" ? onTouchEnd : undefined}
      >
        <div key={`${view}-${dateStr}`} className={enterClass}>
          {view === "day" && (
            <DayTimeline
              appointments={appointments}
              dayAvail={dayAvail}
              dateStr={dateStr}
              blockedTimes={blockedTimes}
              closure={todaysClosure}
              shortestServiceMins={shortestServiceMins}
              onSelect={handleSelect}
              onSlotPick={handleSlotClick}
              onSlotRejected={handleSlotRejected}
            />
          )}

          {view === "week" && (
            <WeekView
              date={date}
              appointments={appointments}
              blockedTimes={blockedTimes}
              closures={closures}
              availability={availability}
              shortestServiceMins={shortestServiceMins}
              onSlotClick={handleSlotClick}
              onSlotRejected={handleSlotRejected}
            />
          )}

          {view === "month" && (
            <MonthView
              date={date}
              appointments={liteAppointments}
              closures={closures}
              availability={availability}
            />
          )}

          {view === "year" && (
            <YearView date={date} appointments={liteAppointments} closures={closures} />
          )}
        </div>
      </div>

      {/* Slot menu */}
      <Modal
        open={slot !== null}
        onClose={() => setSlot(null)}
        title={
          slot
            ? `${format(new Date(slot.date + "T00:00:00"), "EEEE d MMM", { locale: es })} · ${slot.time}`
            : ""
        }
      >
        <div className="space-y-2">
          <SlotAction
            icon={<CalendarPlus size={19} className="text-brand" />}
            title="Crear cita"
            hint="Cliente existente o nuevo"
            onClick={() => openWizardAt(slot)}
          />
          <SlotAction
            icon={<UserPlus size={19} className="text-brand" />}
            title="Agregar walk-in"
            hint="Cliente sin cuenta previa"
            onClick={() => openWizardAt(slot)}
          />
          <SlotAction
            icon={<Users size={19} className="text-brand" />}
            title="Buscar cliente existente"
            hint="Por nombre, teléfono o correo"
            onClick={() => openWizardAt(slot)}
          />
          <SlotAction
            icon={<Lock size={19} className="text-foreground" />}
            title="Bloquear esta hora"
            hint={slot ? `Desde las ${slot.time}` : "Nadie podrá reservarla"}
            onClick={() => {
              // Carry the tapped slot straight through — no re-picking
              setQuickBlock(slot);
              setSlot(null);
            }}
          />
          <button
            onClick={() => setSlot(null)}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-border text-sm font-semibold text-muted"
          >
            <X size={15} /> Cancelar
          </button>
        </div>
      </Modal>

      <AppointmentWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={() => {
          setWizardOpen(false);
          router.refresh();
        }}
        services={services}
        availability={availability}
        defaultDate={wizardSeed?.date ?? dateStr}
        defaultTime={wizardSeed?.time}
      />

      {/*
       * Toolbar version: pick any hours of the day. It reuses the data the
       * calendar already has, so it opens with the grid drawn.
       */}
      <BlockHoursModal
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        dateStr={dateStr}
        dayAvail={dayAvail}
        appointments={appointments}
        blockedTimes={blockedTimes}
      />

      {/* Slot version: date and start time already known */}
      {quickBlock && (
        <BlockHourQuick
          open
          onClose={() => setQuickBlock(null)}
          dateStr={quickBlock.date}
          startTime={quickBlock.time}
        />
      )}

      <ClosureModal
        open={closureOpen}
        onClose={() => setClosureOpen(false)}
        defaultDate={dateStr}
      />

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Full calendar: any date, and which view to land in */}
      <FullCalendarSheet
        open={fullCalendarOpen}
        onClose={() => setFullCalendarOpen(false)}
        selected={pendingDate}
        view={pendingView}
        dayCounts={dayCounts}
        closures={closures}
        onPick={handleFullCalendarPick}
      />

      {/* Why that hour can't take an appointment */}
      <Modal
        open={rejected !== null}
        onClose={() => setRejected(null)}
        title={rejected?.title ?? ""}
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <span className="w-9 h-9 rounded-full bg-warning-light flex items-center justify-center shrink-0">
              <Info size={17} className="text-warning" />
            </span>
            <p className="text-sm text-foreground leading-relaxed pt-1.5">
              {rejected?.detail}
            </p>
          </div>

          {/* A blocked hour is the one case the barber can undo right here */}
          {rejected?.reason === "blocked" && (
            <button
              onClick={() => {
                setRejected(null);
                setBlockOpen(true);
              }}
              className="w-full h-11 rounded-xl border border-border text-sm font-semibold text-foreground active:bg-background"
            >
              Administrar horas bloqueadas
            </button>
          )}

          <button
            onClick={() => setRejected(null)}
            className="w-full h-11 rounded-xl bg-foreground text-background text-sm font-bold"
          >
            Entendido
          </button>
        </div>
      </Modal>

      <AppointmentSheet
        appointment={selected}
        onClose={() => setSelected(null)}
        onReschedule={setRescheduling}
      />

      {rescheduling && (
        <RescheduleModal
          open
          onClose={() => setRescheduling(null)}
          appointmentId={rescheduling.id}
          currentServiceId={rescheduling.service.id}
          currentStartsAt={rescheduling.starts_at}
          currentEndsAt={rescheduling.ends_at}
          services={services}
          availability={availability}
        />
      )}
    </div>
  );
}

function ActionPill({
  onClick,
  icon,
  primary,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-10 px-3.5 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap",
        "active:scale-95 transition-transform",
        primary
          ? "bg-foreground text-background"
          : "bg-surface border border-border text-foreground"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function SlotAction({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl border border-border bg-background active:bg-surface text-left"
    >
      <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm text-foreground">{title}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
    </button>
  );
}
