import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getBookingSettings } from "@/lib/data/availability";
import { BookingSettingsForm } from "@/components/disponibilidad/booking-settings-form";

export default async function BookingConfigPage() {
  const settings = await getBookingSettings();

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href="/disponibilidad"
          className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center shrink-0"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Configuración de reservas</h1>
      </header>

      <BookingSettingsForm
        bookingWindowDays={settings.booking_window_days}
        minNoticeMinutes={settings.min_notice_minutes}
        bufferMinutes={settings.buffer_minutes}
      />
    </div>
  );
}
