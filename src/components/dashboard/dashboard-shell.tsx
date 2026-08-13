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

  return (
    <div className="px-4 pt-[max(10px,var(--safe-top))] pb-6 space-y-4">
      {/* Profile card — dark surface, no border, actions on the right */}
      <header className="rounded-3xl bg-[#15171c] px-4 py-4 sm:px-5 sm:py-5 flex items-center gap-4">
        <button
          onClick={() => setPhotoOpen(true)}
          aria-label="Ver foto de perfil"
          className="shrink-0 rounded-full ring-2 ring-white/15 active:scale-95 transition-transform"
        >
          <Avatar src={avatarUrl} name={profileName} size={60} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-lg sm:text-xl font-bold text-white leading-tight truncate">
            {profileName}
          </p>
          <p className="text-[11px] text-white/45 leading-none mt-1 tracking-wide">Panel Admin</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setEditing((v) => !v)}
            aria-label={editing ? "Terminar edición" : "Personalizar dashboard"}
            title={editing ? "Terminar" : "Personalizar dashboard"}
            className={cn(
              "w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-colors",
              editing ? "bg-brand text-white" : "bg-white/10 text-white active:bg-white/20"
            )}
          >
            {editing ? <Check size={19} /> : <Pencil size={18} />}
          </button>

          <Link
            href="/notificaciones"
            aria-label="Notificaciones"
            className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20 transition-colors"
          >
            <Bell size={19} className="text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#15171c]">
                {unreadCount}
              </span>
            )}
          </Link>
        </div>
      </header>

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
