import { Skeleton } from "@/components/ui/skeleton";
import { HeaderSkeleton, StatsSkeleton, CardsSkeleton } from "@/components/ui/loading-blocks";

export default function ReportesLoading() {
  return (
    <div className="px-4 pt-[max(10px,var(--safe-top))] pb-6 space-y-4">
      <HeaderSkeleton />
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-16 rounded-full" />
        ))}
      </div>
      <StatsSkeleton tiles={4} />
      <CardsSkeleton cards={3} height={160} />
    </div>
  );
}
