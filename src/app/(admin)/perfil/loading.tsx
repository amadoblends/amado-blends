import { Skeleton } from "@/components/ui/skeleton";

export default function PerfilLoading() {
  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <Skeleton className="h-7 w-28" />
      </div>
      <div className="bg-surface rounded-2xl border border-border p-4 space-y-4">
        <Skeleton className="h-3 w-36" />
        <div className="flex items-center gap-4">
          <Skeleton className="w-24 h-24 rounded-xl" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
      <div className="bg-surface rounded-2xl border border-border p-4 space-y-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
    </div>
  );
}
