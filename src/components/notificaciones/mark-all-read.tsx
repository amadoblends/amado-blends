"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Clears the unread badge in one tap. */
export function MarkAllRead({ count }: { count: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function markAll() {
    const supabase = createClient();
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    startTransition(() => router.refresh());
  }

  return (
    <button
      onClick={markAll}
      disabled={isPending}
      className="h-9 px-3 rounded-xl bg-surface border border-border flex items-center gap-1.5 text-xs font-bold text-foreground shrink-0 active:scale-95 transition-transform"
    >
      {isPending ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <CheckCheck size={14} className="text-brand" />
      )}
      Leídas ({count})
    </button>
  );
}
