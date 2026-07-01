import { Skeleton } from "@/components/ui/skeleton";

export default function DisponibilidadLoading() {
  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <Skeleton className="h-7 w-36" />
      </div>

      <div>
        <Skeleton className="h-3 w-28 mb-2 ml-1" />
        <div className="bg-surface rounded-2xl border border-border overflow-hidden divide-y divide-border">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
              <Skeleton className="h-4 w-20" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="w-10 h-6 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Skeleton className="h-3 w-36 mb-2 ml-1" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    </div>
  );
}
