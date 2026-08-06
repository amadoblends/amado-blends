"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarPlus, UserPlus, Users, Lock, X } from "lucide-react";
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
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { SearchModal } from "@/components/search-modal";
import { Modal } from "@/components/ui/modal";
import { reasonLabel } from "@/lib/closures";
import type {
  AppointmentRow,
  BlockedRange,
  ClosureRange,
} from "@/lib/data/appointments";
import type { AvailabilityDay } from "@/lib/data/availability";

export function CalendarShell({
  view,
  date,
  dateStr,
  appointments,
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
  dayAvail: AvailabilityDay | null;
  availability: AvailabilityDay[];
  services: ServiceOption[];
  blockedTimes?: BlockedRange[];
  closures?: ClosureRange[];
  dayCounts?: Record<string, number>;
}) {
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [closureOpen, setClosureOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Tapping an empty slot opens a small menu with the seed date/time
  const [slot, setSlot] = useState<{ date: string; time: string } | null>(null);
  const [wizardSeed, setWizardSeed] = useState<{ date: string; time: string } | null>(null);
  // Blocking a slot picked on the calendar keeps its date and start time
  const [quickBlock, setQuickBlock] = useState<{ date: string; time: string } | null>(null);
  // Tapping a block opens the sheet; the profile stays a further tap away
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const [rescheduling, setRescheduling] = useState<AppointmentRow | null>(null);
  // Title follows the day strip while it's being swiped
  const [visibleMonth, setVisibleMonth] = useState<Date | undefined>(undefined);

  const todaysClosure = closureFor(date, closures);

  function openWizardAt(seed: { date: string; time: string } | null) {
    setWizardSeed(seed);
    setSlot(null);
    setWizardOpen(true);
  }

  return (
    <div className="space-y-4">
      <RealtimeRefresher tables={["appointments", "blocked_times", "closures"]} />

      <CalendarToolbar
        view={view}
        date={date}
        displayDate={view === "day" ? visibleMonth : undefined}
        onNewAppointment={() => openWizardAt(null)}
        onBlockHours={() => setBlockOpen(true)}
        onCloseDays={() => setClosureOpen(true)}
        onSearch={() => setSearchOpen(true)}
        onToday={() => {
          setVisibleMonth(undefined);
          router.push(`/citas?view=day&date=${format(new Date(), "yyyy-MM-dd")}`);
        }}
      />

      {/* Day strip sits between the header and the timeline */}
      {view === "day" && (
        <DayStripScroller
          selected={dateStr}
          counts={dayCounts}
          onVisibleMonthChange={setVisibleMonth}
        />
      )}

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

      {view === "day" && (
        <DayTimeline
          appointments={appointments}
          dayAvail={dayAvail}
          dateStr={dateStr}
          blockedTimes={blockedTimes}
          onSelect={setSelected}
        />
      )}

      {view === "week" && (
        <WeekView
          date={date}
          appointments={appointments}
          blockedTimes={blockedTimes}
          closures={closures}
          availability={availability}
          onSlotClick={(d, t) => setSlot({ date: d, time: t })}
        />
      )}

      {view === "month" && (
        <MonthView
          date={date}
          appointments={appointments}
          closures={closures}
          availability={availability}
        />
      )}

      {view === "year" && (
        <YearView date={date} appointments={appointments} closures={closures} />
      )}

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

      {/* Toolbar version: pick any hours of the day */}
      <BlockHoursModal
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        dateStr={dateStr}
        dayAvail={dayAvail}
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
