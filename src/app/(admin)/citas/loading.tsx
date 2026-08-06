import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the real calendar's geometry (header → day strip → action pills →
 * timeline) so nothing shifts when the data arrives.
 */
export default function CitasLoading() {
  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="flex-1 flex justify-center">
          <Skeleton className="h-6 w-36 rounded-lg" />
        </div>
        <Skeleton className="w-10 h-10 rounded-xl" />
      </div>

      {/* Day strip */}
      <div className="flex gap-1 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="w-11 shrink-0 flex flex-col items-center gap-1 pt-0.5">
            <Skeleton className="h-2.5 w-6 rounded" />
            <Skeleton className="w-9 h-9 rounded-2xl" />
          </div>
        ))}
      </div>

      {/* Action pills */}
      <div className="flex gap-2 overflow-hidden">
        <Skeleton className="h-10 w-28 rounded-full shrink-0" />
        <Skeleton className="h-10 w-32 rounded-full shrink-0" />
        <Skeleton className="h-10 w-32 rounded-full shrink-0" />
      </div>

      {/* Timeline */}
      <div className="flex gap-2 pt-1">
        <div className="w-[52px] shrink-0 space-y-[76px] pt-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-2.5 w-12 rounded ml-auto" />
          ))}
        </div>
        <div className="flex-1 space-y-3">
          {[92, 60, 92, 60, 92].map((h, i) => (
            <Skeleton key={i} className="w-full rounded-2xl" style={{ height: h }} />
          ))}
        </div>
      </div>
    </div>
  );
}
