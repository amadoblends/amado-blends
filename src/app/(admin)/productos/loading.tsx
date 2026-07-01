import { Skeleton } from "@/components/ui/skeleton";

export default function ProductosLoading() {
  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <Skeleton className="h-7 w-28" />
        <div className="ml-auto">
          <Skeleton className="w-10 h-10 rounded-full" />
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
