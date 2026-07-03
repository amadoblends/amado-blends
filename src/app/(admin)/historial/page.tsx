import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { getAppointmentsHistory } from "@/lib/data/appointments";
import { HistoryView, type Period } from "@/components/historial/history-view";
import { BackButton } from "@/components/ui/back-button";

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string; status?: string }>;
}) {
  const params = await searchParams;
  const period: Period = params.period === "mes" || params.period === "ano" ? params.period : "dia";
  const dateStr = params.date ?? format(new Date(), "yyyy-MM-dd");
  const anchor = new Date(dateStr + "T00:00:00");
  const status = params.status ?? "todas";

  const [rangeStart, rangeEnd] =
    period === "dia"
      ? [startOfDay(anchor), endOfDay(anchor)]
      : period === "mes"
        ? [startOfMonth(anchor), endOfMonth(anchor)]
        : [startOfYear(anchor), endOfYear(anchor)];

  const appointments = await getAppointmentsHistory(rangeStart, rangeEnd);

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-4">
      <header className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-foreground">Historial</h1>
          <p className="text-sm text-muted">Todas tus citas: completadas, canceladas y más</p>
        </div>
      </header>

      <HistoryView
        appointments={appointments}
        period={period}
        dateStr={dateStr}
        status={status}
      />
    </div>
  );
}
