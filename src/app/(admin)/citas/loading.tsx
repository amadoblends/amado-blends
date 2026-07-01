import { Skeleton } from "@/components/ui/skeleton";

export default function CitasLoading() {
  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="w-10 h-10 rounded-full" />
      </div>

      {/* Date strip */}
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-12 shrink-0 rounded-2xl" />
        ))}
      </div>

      {/* Day nav */}
      <div className="flex items-center gap-2">
        <Skeleton className="w-10 h-10 rounded-full" />
        <Skeleton className="h-10 flex-1 rounded-2xl" />
        <Skeleton className="w-10 h-10 rounded-full" />
      </div>

      {/* Appointment list */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 w-14 rounded-lg" />
            <Skeleton className="w-1 h-10 rounded-full" />
            <Skeleton className="w-9 h-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
