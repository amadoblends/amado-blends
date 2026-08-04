"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Pencil, Check } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import { DashboardWidgets } from "@/components/dashboard/dashboard-widgets";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/lib/data/dashboard";

export function DashboardShell({
  data,
  profileName,
  avatarUrl,
  unreadCount,
  initialOrder,
  initialHidden,
}: {
  data: DashboardData;
  profileName: string;
  avatarUrl: string | null;
  unreadCount: number;
  initialOrder: string[];
  initialHidden: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  const firstName = profileName.split(" ")[0];

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            onClick={() => setPhotoOpen(true)}
            aria-label="Ver foto de perfil"
            className="shrink-0 rounded-full ring-2 ring-brand/20 active:scale-95 transition-transform"
          >
            <Avatar src={avatarUrl} name={profileName} size={64} />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] text-muted leading-none">Panel admin</p>
            <p className="text-xl font-bold text-foreground leading-tight truncate mt-0.5">
              {profileName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setEditing((v) => !v)}
            aria-label={editing ? "Terminar edición" : "Personalizar dashboard"}
            title={editing ? "Terminar" : "Personalizar dashboard"}
            className={cn(
              "w-11 h-11 rounded-full border flex items-center justify-center transition-colors",
              editing
                ? "bg-brand border-brand text-white"
                : "bg-surface border-border text-foreground"
            )}
          >
            {editing ? <Check size={19} /> : <Pencil size={18} />}
          </button>

          <Link
            href="/notificaciones"
            className="relative w-11 h-11 rounded-full bg-surface border border-border flex items-center justify-center"
          >
            <Bell size={20} className="text-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      <div>
        <h1 className="text-2xl font-bold text-foreground">¡Buenos días, {firstName}! 👋</h1>
        <p className="text-muted text-sm mt-0.5">Aquí tienes el resumen de tu negocio.</p>
      </div>

      <DashboardWidgets
        data={data}
        initialOrder={initialOrder}
        initialHidden={initialHidden}
        editing={editing}
        onEditingChange={setEditing}
      />

      <PhotoLightbox
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        src={avatarUrl}
        name={profileName}
      />
    </div>
  );
}
