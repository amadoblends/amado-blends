"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import { addClientNote } from "@/lib/actions/clients";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AppointmentStatus, NoteType } from "@/lib/supabase/types";

type Appointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  price: number;
  service_name: string;
};

type Note = { id: string; type: NoteType; content: string; created_at: string };

const tabs = ["Resumen", "Citas", "Notas", "Preferencias"] as const;

const noteTypeLabels: Record<NoteType, string> = {
  preferencias: "Preferencias",
  productos: "Productos",
  estilo: "Estilo",
  otros: "Otros",
};

const noteTypeStyles: Record<NoteType, string> = {
  preferencias: "border-l-violet bg-violet-light",
  productos: "border-l-warning bg-warning-light",
  estilo: "border-l-success bg-success-light",
  otros: "border-l-border bg-background",
};

export function ClientTabs({
  clientId,
  appointments,
  notes,
  totalSpent,
  favoriteServices,
}: {
  clientId: string;
  appointments: Appointment[];
  notes: Note[];
  totalSpent: number;
  favoriteServices: { name: string; count: number }[];
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Resumen");
  const upcoming = appointments.filter((a) => new Date(a.starts_at) >= new Date() && a.status !== "cancelada");
  const history = appointments.filter((a) => new Date(a.starts_at) < new Date() || a.status === "completada");

  return (
    <div>
      <div className="flex gap-1 bg-background rounded-xl p-1 mb-4">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-semibold transition-colors",
              tab === t ? "bg-surface text-foreground shadow-sm" : "text-muted"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Resumen" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="Total visitas" value={appointments.length} />
            <StatBox label="Próxima cita" value={upcoming[0] ? format(new Date(upcoming[0].starts_at), "d MMM") : "—"} />
            <StatBox label="Gasto total" value={formatCurrency(totalSpent)} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Servicios favoritos</h3>
            <div className="space-y-2">
              {favoriteServices.length === 0 && <p className="text-sm text-muted">Sin historial aún.</p>}
              {favoriteServices.map((s) => (
                <div key={s.name} className="flex justify-between text-sm bg-background rounded-lg px-3 py-2">
                  <span className="text-foreground">{s.name}</span>
                  <span className="text-muted">{s.count} veces</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "Citas" && (
        <div className="space-y-5">
          <div>
            <h3 className="font-semibold text-foreground mb-2">Próximas citas</h3>
            {upcoming.length === 0 && <p className="text-sm text-muted">Sin citas próximas.</p>}
            <ul className="space-y-2">
              {upcoming.map((a) => (
                <AppointmentRow key={a.id} a={a} />
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Historial</h3>
            {history.length === 0 && <p className="text-sm text-muted">Sin historial aún.</p>}
            <ul className="space-y-2">
              {history.map((a) => (
                <AppointmentRow key={a.id} a={a} />
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "Notas" && <NotesTab clientId={clientId} notes={notes} />}

      {tab === "Preferencias" && (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">Servicios favoritos</h3>
          {favoriteServices.map((s) => (
            <div key={s.name} className="flex justify-between text-sm bg-background rounded-lg px-3 py-2">
              <span>{s.name}</span>
              <span className="text-muted">{s.count} veces</span>
            </div>
          ))}
          {favoriteServices.length === 0 && <p className="text-sm text-muted">Aún no hay suficiente historial.</p>}
        </div>
      )}
    </div>
  );
}

function AppointmentRow({ a }: { a: Appointment }) {
  return (
    <li className="flex items-center justify-between bg-background rounded-xl px-3 py-2.5">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {format(new Date(a.starts_at), "EEEE, d 'de' MMMM", { locale: es })}
        </p>
        <p className="text-xs text-muted">
          {format(new Date(a.starts_at), "h:mm a")} – {a.service_name}
        </p>
      </div>
      <StatusBadge status={a.status} />
    </li>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-background rounded-xl p-3 text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted leading-tight mt-0.5">{label}</p>
    </div>
  );
}

function NotesTab({ clientId, notes }: { clientId: string; notes: Note[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addClientNote(formData);
      if (result.ok) {
        setAdding(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-xl py-2.5 text-sm font-semibold text-violet"
        >
          <Plus size={16} /> Agregar nota
        </button>
      )}

      {adding && (
        <form action={handleSubmit} className="bg-background rounded-xl p-3 space-y-2">
          <input type="hidden" name="clientId" value={clientId} />
          <select name="type" className="w-full text-sm rounded-lg border border-border px-2 py-2 bg-surface">
            <option value="preferencias">Preferencias</option>
            <option value="productos">Productos</option>
            <option value="estilo">Estilo</option>
            <option value="otros">Otros</option>
          </select>
          <textarea name="content" required rows={2} maxLength={1000} className="w-full text-sm rounded-lg border border-border px-2 py-2 bg-surface resize-none" placeholder="Escribe la nota..." />
          <div className="flex gap-2">
            <button type="submit" disabled={isPending} className="flex-1 bg-violet text-white rounded-lg py-2 text-sm font-semibold">
              {isPending ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="px-4 text-sm text-muted">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {notes.length === 0 && !adding && <p className="text-sm text-muted text-center py-6">Sin notas aún.</p>}

      <ul className="space-y-2">
        {notes.map((n) => (
          <li key={n.id} className={cn("border-l-4 rounded-lg px-3 py-2.5", noteTypeStyles[n.type])}>
            <p className="text-xs font-semibold text-foreground">{noteTypeLabels[n.type]}</p>
            <p className="text-sm text-foreground mt-0.5">{n.content}</p>
            <p className="text-[11px] text-muted mt-1">{format(new Date(n.created_at), "d MMM yyyy", { locale: es })}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
