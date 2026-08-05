import { Skeleton } from "@/components/ui/skeleton";

/** Header with a back button and a title, used by most detail pages. */
export function HeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3.5 w-56" />
      </div>
      {withAction && <Skeleton className="w-10 h-10 rounded-full shrink-0" />}
    </div>
  );
}

/** Repeated rows inside a bordered card, like the product and service lists. */
export function ListSkeleton({
  rows = 5,
  height = 72,
}: {
  rows?: number;
  height?: number;
}) {
  return (
    <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3" style={{ height }}>
          <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-14 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Free-standing cards, like the carousel and promotions managers. */
export function CardsSkeleton({ cards = 3, height = 150 }: { cards?: number; height?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: cards }).map((_, i) => (
        <Skeleton key={i} className="rounded-2xl" style={{ height }} />
      ))}
    </div>
  );
}

/** Grid of small stat tiles. */
export function StatsSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: tiles }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  );
}
