import { Skeleton } from "@/components/ui/skeleton";

export default function MasLoading() {
  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-6">
      <Skeleton className="h-7 w-16" />

      <div className="bg-surface rounded-2xl border border-border overflow-hidden divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-4">
            <Skeleton className="w-9 h-9 rounded-xl" />
            <Skeleton className="h-4 flex-1 max-w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
