import { Bell, Info } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { ReminderRules } from "@/components/notificaciones/reminder-rules";
import { getReminderRules } from "@/lib/actions/reminder-rules";

export const dynamic = "force-dynamic";

export default async function RecordatoriosPage() {
  const { rules, missing } = await getReminderRules();

  return (
    <div className="px-4 pt-[max(10px,var(--safe-top))] pb-6 space-y-4">
      <header className="flex items-center gap-3">
        <BackButton />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">Recordatorios</h1>
          <p className="text-xs text-muted">Cuándo avisar a tus clientes antes de su cita</p>
        </div>
      </header>

      <ReminderRules rules={rules} missing={missing} />

      {!missing && (
        <div className="bg-surface rounded-2xl border border-border p-4 flex items-start gap-3">
          <Info size={16} className="text-muted shrink-0 mt-0.5" />
          <div className="text-xs text-muted space-y-1.5">
            <p>
              Encender un canal es un permiso, no una promesa: también tiene que estar
              aceptado por el cliente y existir un correo, un teléfono o un dispositivo al
              que llegar. Lo que no se pudo enviar queda registrado con el motivo.
            </p>
            <p>
              Si reagendas una cita, sus recordatorios pendientes se recalculan con la hora
              nueva. Si la cancelas, no se envía ninguno.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
