"use client";

import { useState, useCallback, useEffect, useRef, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, addDays, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { Info, Pencil, Rows2 } from "lucide-react";
import { DayTimeline } from "./timeline";
import { AppointmentWizard, type ServiceOption } from "./wizard";
import { BlockHourQuick } from "./block-hour-quick";
import { CalendarToolbar, ViewSwitcher, type CalendarView } from "./calendar-toolbar";
import { WeekView, MonthView, YearView, closureFor } from "./calendar-views";
import { DayStripScroller } from "./day-strip-scroller";
import { AppointmentSheet } from "./appointment-sheet";
import { RescheduleModal } from "./reschedule-modal";
import { FullCalendarSheet } from "./full-calendar-sheet";
import { SlotActionsCard, type SlotAction } from "./slot-actions-card";
import { BlockDetailModal, type TimeOff } from "./block-detail-modal";
import {
  useDensity, HOUR_HEIGHT, DENSITIES, DENSITY_LABEL,
} from "@/lib/calendar-density";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { Modal } from "@/components/ui/modal";
import { reasonLabel } from "@/lib/closures";
import type { SlotVerdict } from "@/lib/slot-availability";
import type {
  AppointmentRow,
  BlockedRange,
  ClosureRange,
  LiteAppointment,
} from "@/lib/data/appointments";
import type { AvailabilityDay, BookingSettings } from "@/lib/data/availability";

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
  bookingSettings,
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
  bookingSettings: BookingSettings;
  blockedTimes?: BlockedRange[];
  closures?: ClosureRange[];
  dayCounts?: Record<string, number>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardEntry, setWizardEntry] = useState<"type" | "walkin" | "search">("type");
  const [pickerOpen, setPickerOpen] = useState(false);

  /*
   * Booking from the calendar is two deliberate taps: the first pencils a
   * placeholder into the slot, the second opens the action card. That way a
   * stray tap while scrolling never launches a form.
   */
  const [draft, setDraft] = useState<{ date: string; time: string } | null>(null);
  const [actionsFor, setActionsFor] = useState<{ date: string; time: string } | null>(null);

  const [wizardSeed, setWizardSeed] = useState<{ date: string; time: string } | null>(null);
  const [quickBlock, setQuickBlock] = useState<{ date: string; time: string } | null>(null);
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const [rescheduling, setRescheduling] = useState<AppointmentRow | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date | undefined>(undefined);
  const [rejected, setRejected] = useState<SlotVerdict | null>(null);
  // A block or closure opened from the calendar for editing / removal
  const [timeOff, setTimeOff] = useState<TimeOff | null>(null);

  // Purely visual: how many hours fit on screen
  const [density, setDensity] = useDensity();
  const hourH = HOUR_HEIGHT[density];

  /*
   * The selected day and view are mirrored locally so a tap paints
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
      setDraft(null);
      if (nextView !== "day") setVisibleMonth(undefined);
      startTransition(() => {
        router.push(`/citas?view=${nextView}&date=${nextDate}`, { scroll: false });
      });
    },
    [router, pendingDate, pendingView]
  );

  /*
   * Warm the other three views for the current day the moment the page is
   * idle. Switching then costs a cached RSC payload instead of a cold fetch,
   * which is what the delay between Día / Semana / Mes / Año really was.
   */
  useEffect(() => {
    const warm = () => {
      for (const v of ["day", "week", "month", "year"] as CalendarView[]) {
        if (v !== view) router.prefetch(`/citas?view=${v}&date=${dateStr}`);
      }
    };
    const idle = window.requestIdleCallback;
    if (typeof idle === "function") {
      const id = idle(warm, { timeout: 2000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = setTimeout(warm, 500);
    return () => clearTimeout(id);
  }, [router, view, dateStr]);

  const handleNavigate = useCallback(
    (d: Date, v: CalendarView) => navigate(format(d, "yyyy-MM-dd"), v),
    [navigate]
  );

  const handleSetView = useCallback(
    (v: CalendarView) => navigate(pendingDate, v),
    [navigate, pendingDate]
  );

  const handlePickDay = useCallback(
    (dateKey: string) => {
      const dir = dateKey > pendingDate ? "left" : dateKey < pendingDate ? "right" : null;
      navigate(dateKey, "day", dir);
    },
    [navigate, pendingDate]
  );

  const handlePickFromCalendar = useCallback(
    (dateKey: string) => {
      setVisibleMonth(undefined);
      navigate(dateKey, pendingView);
    },
    [navigate, pendingView]
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
      const next = dx < 0 ? addDays(base, 1) : subDays(base, 1);
      navigate(format(next, "yyyy-MM-dd"), "day", dx < 0 ? "left" : "right");
    },
    [navigate, pendingDate]
  );

  // ── Slot flow ────────────────────────────────────────────────────────────
  const handleSlotTap = useCallback((d: string, t: string) => {
    // Tapping a different slot just moves the placeholder
    setDraft({ date: d, time: t });
  }, []);

  const handleDraftTap = useCallback(() => setActionsFor(draft), [draft]);

  const handleSlotAction = useCallback(
    (action: SlotAction) => {
      const slot = actionsFor;
      setActionsFor(null);
      if (!slot) return;

      if (action === "block") {
        setQuickBlock(slot);
        setDraft(null);
        return;
      }
      setWizardSeed(slot);
      setWizardEntry(action === "walkin" ? "walkin" : "search");
      setWizardOpen(true);
    },
    [actionsFor]
  );

  // The toolbar's own button starts from scratch, so it asks the type question
  const handleNewAppointment = useCallback(() => {
    setWizardSeed(null);
    setWizardEntry("type");
    setWizardOpen(true);
  }, []);

  const handleOpenPicker = useCallback(() => setPickerOpen(true), []);
  const handleSlotRejected = useCallback((v: SlotVerdict) => setRejected(v), []);
  const handleSelect = useCallback((a: AppointmentRow) => setSelected(a), []);
  const handleBlockTap = useCallback(
    (block: BlockedRange) => setTimeOff({ kind: "block", block }),
    []
  );
  const handleClosureTap = useCallback(
    (closure: ClosureRange) => setTimeOff({ kind: "closure", closure }),
    []
  );

  const todaysClosure = closureFor(date, closures);

  // A gap has to fit at least the shortest service to be worth offering
  const shortestServiceMins = useMemo(() => {
    const durations = services
      .map((s) => s.duration_minutes)
      .filter((d): d is number => typeof d === "number" && d > 0);
    return durations.length ? Math.min(...durations) : 15;
  }, [services]);

  const headerDate = useMemo(() => new Date(pendingDate + "T00:00:00"), [pendingDate]);

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
        onSetView={handleSetView}
        onOpenPicker={handleOpenPicker}
        onNewAppointment={handleNewAppointment}
      />

      {pendingView === "day" && (
        <DayStripScroller
          selected={pendingDate}
          counts={dayCounts}
          onPick={handlePickDay}
          onVisibleMonthChange={setVisibleMonth}
        />
      )}

      {/* Always visible, never inside a menu */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <ViewSwitcher view={pendingView} onSetView={handleSetView} />
        </div>
        {/* Density cycles compact → normal → amplia; visual only */}
        {pendingView === "day" && (
          <button
            onClick={() =>
              setDensity(DENSITIES[(DENSITIES.indexOf(density) + 1) % DENSITIES.length])
            }
            title={`Densidad: ${DENSITY_LABEL[density]}`}
            aria-label={`Densidad del calendario: ${DENSITY_LABEL[density]}`}
            className="h-[52px] w-12 rounded-2xl bg-surface flex flex-col items-center justify-center gap-0.5 shrink-0 active:scale-95 transition-transform"
          >
            <Rows2 size={16} className="text-muted" />
            <span className="text-[8px] font-bold text-muted uppercase leading-none">
              {DENSITY_LABEL[density].slice(0, 4)}
            </span>
          </button>
        )}
      </div>

      {/* Tap the banner to edit or lift the closure */}
      {todaysClosure && view === "day" && (
        <button
          onClick={() => handleClosureTap(todaysClosure)}
          className="w-full text-left bg-danger-light rounded-2xl border border-danger/20 px-4 py-3 flex items-center gap-3 active:scale-[0.99] transition-transform"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-danger">
              Cerrado · {reasonLabel(todaysClosure.reason)}
            </span>
            <span className="block text-xs text-muted mt-0.5">
              {todaysClosure.description ||
                `Del ${format(new Date(todaysClosure.starts_on + "T00:00:00"), "d MMM", { locale: es })} al ${format(new Date(todaysClosure.ends_on + "T00:00:00"), "d MMM", { locale: es })}`}
            </span>
          </span>
          <Pencil size={15} className="text-danger shrink-0" />
        </button>
      )}

      {/*
       * One container for every view with a floor on its height, so switching
       * never collapses the page or bounces the scroll position.
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
              draft={draft}
              hourH={hourH}
              onSelect={handleSelect}
              onSlotTap={handleSlotTap}
              onDraftTap={handleDraftTap}
              onSlotRejected={handleSlotRejected}
              onBlockTap={handleBlockTap}
              onClosureTap={handleClosureTap}
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
              draft={draft}
              onSlotTap={handleSlotTap}
              onDraftTap={handleDraftTap}
              onSlotRejected={handleSlotRejected}
              onBlockTap={handleBlockTap}
              onClosureTap={handleClosureTap}
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

      {/* Edit or lift a block / closure straight from the calendar */}
      <BlockDetailModal target={timeOff} onClose={() => setTimeOff(null)} />

      {/* Second tap on the placeholder */}
      <SlotActionsCard
        slot={actionsFor}
        onClose={() => setActionsFor(null)}
        onPick={handleSlotAction}
      />

      <AppointmentWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={() => {
          setWizardOpen(false);
          setDraft(null);
          router.refresh();
        }}
        services={services}
        availability={availability}
        bookingSettings={bookingSettings}
        defaultDate={wizardSeed?.date ?? dateStr}
        defaultTime={wizardSeed?.time}
        entry={wizardEntry}
      />

      {/* Blocking a slot picked on the calendar: date and time already known */}
      {quickBlock && (
        <BlockHourQuick
          open
          onClose={() => setQuickBlock(null)}
          dateStr={quickBlock.date}
          startTime={quickBlock.time}
        />
      )}

      <FullCalendarSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={pendingDate}
        dayCounts={dayCounts}
        closures={closures}
        onPick={handlePickFromCalendar}
      />

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
            <p className="text-sm text-foreground leading-relaxed pt-1.5">{rejected?.detail}</p>
          </div>
          <button
            onClick={() => setRejected(null)}
            className="w-full h-11 rounded-xl bg-foreground text-background text-sm font-bold"
          >
            Entendido
          </button>
        </div>
      </Modal>
    </div>
  );
}
