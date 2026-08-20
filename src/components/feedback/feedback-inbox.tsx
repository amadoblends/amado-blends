"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  MessageSquare,
  Scissors,
  Smartphone,
  Star,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { shopLongDate, shopTime } from "@/lib/timezone";
import { setFeedbackStatus } from "@/lib/actions/feedback";
import {
  feedbackCategoryEmoji,
  feedbackCategoryLabel,
  type FeedbackArea,
} from "@/lib/feedback-categories";

export interface FeedbackItem {
  id: string;
  area: FeedbackArea;
  category: string | null;
  message: string;
  rating: number | null;
  status: "new" | "read" | "archived";
  created_at: string;
  client_name: string | null;
}

type Tab = "new" | "read" | "archived";

const TABS: { key: Tab; label: string }[] = [
  { key: "new", label: "Nuevos" },
  { key: "read", label: "Leídos" },
  { key: "archived", label: "Archivados" },
];

export function FeedbackInbox({ items }: { items: FeedbackItem[] }) {
  const [tab, setTab] = useState<Tab>("new");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  /*
   * The status change is applied here first so a tap on "Leído" moves the
   * card immediately. The server action then confirms it; if it fails the
   * refresh puts the card back where it was.
   */
  const [optimistic, applyOptimistic] = useOptimistic(
    items,
    (state: FeedbackItem[], change: { id: string; status: Tab }) =>
      state.map((f) => (f.id === change.id ? { ...f, status: change.status } : f))
  );

  const byTab = useMemo(() => {
    const groups: Record<Tab, FeedbackItem[]> = { new: [], read: [], archived: [] };
    for (const f of optimistic) groups[f.status].push(f);
    return groups;
  }, [optimistic]);

  /*
   * Opening a message marks it read, which is the whole point of the "new"
   * count: it should mean "not yet looked at", not "not yet tidied up".
   */
  function toggleOpen(f: FeedbackItem) {
    const next = expanded === f.id ? null : f.id;
    setExpanded(next);
    if (next && f.status === "new") move(f.id, "read");
  }

  function move(id: string, status: Tab) {
    startTransition(async () => {
      applyOptimistic({ id, status });
      await setFeedbackStatus({ id, status });
    });
  }

  const shown = byTab[tab];

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 p-1 bg-background rounded-xl border border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 h-9 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5",
              tab === t.key ? "bg-surface text-foreground shadow-sm" : "text-muted"
            )}
          >
            {t.label}
            {byTab[t.key].length > 0 && (
              <span
                className={cn(
                  "min-w-[18px] h-[18px] px-1 rounded-full text-[10px] leading-[18px]",
                  t.key === "new" && byTab.new.length > 0
                    ? "bg-brand text-white"
                    : "bg-border text-muted"
                )}
              >
                {byTab[t.key].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="text-center py-14 space-y-2">
          <MessageSquare size={30} className="text-muted mx-auto" />
          <p className="text-sm text-muted">
            {tab === "new"
              ? "No hay comentarios sin leer."
              : tab === "read"
                ? "Nada leído todavía."
                : "No has archivado nada."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((f) => (
            <li
              key={f.id}
              className="bg-surface rounded-2xl border border-border p-4 space-y-2.5"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                    f.area === "app" ? "bg-background text-muted" : "bg-brand-light text-brand"
                  )}
                >
                  {f.area === "app" ? <Smartphone size={14} /> : <Scissors size={14} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                    <User size={12} className="text-muted shrink-0" />
                    {f.client_name ?? "Cliente"}
                    {f.status === "new" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                    )}
                  </p>
                  <p className="text-[11px] text-muted flex items-center gap-1 flex-wrap">
                    <span className="font-semibold text-foreground/80">
                      {feedbackCategoryEmoji(f.area, f.category)}{" "}
                      {feedbackCategoryLabel(f.area, f.category)}
                    </span>
                    <span>·</span>
                    <span>{f.area === "app" ? "App" : "Servicio"}</span>
                    <span>·</span>
                    <span>
                      {shopLongDate(f.created_at)} · {shopTime(f.created_at)}
                    </span>
                  </p>
                </div>
                {f.rating !== null && (
                  <span className="flex items-center gap-0.5 shrink-0">
                    <Star size={13} className="text-brand fill-brand" />
                    <span className="text-sm font-bold text-foreground">{f.rating}</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => toggleOpen(f)}
                className="w-full text-left"
              >
                <p
                  className={cn(
                    "text-sm text-foreground whitespace-pre-wrap break-words",
                    expanded !== f.id && "line-clamp-2"
                  )}
                >
                  {f.message}
                </p>
              </button>

              <div className="flex gap-2 pt-0.5">
                {f.status !== "read" && (
                  <Action
                    onClick={() => move(f.id, "read")}
                    icon={<Check size={13} />}
                    label="Marcar leído"
                  />
                )}
                {f.status !== "archived" ? (
                  <Action
                    onClick={() => move(f.id, "archived")}
                    icon={<Archive size={13} />}
                    label="Archivar"
                  />
                ) : (
                  <Action
                    onClick={() => move(f.id, "read")}
                    icon={<ArchiveRestore size={13} />}
                    label="Restaurar"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Action({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 h-9 rounded-xl border border-border bg-background text-xs font-bold text-foreground flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
    >
      {icon}
      {label}
    </button>
  );
}
