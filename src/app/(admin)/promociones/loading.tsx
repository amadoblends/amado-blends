import { HeaderSkeleton, CardsSkeleton } from "@/components/ui/loading-blocks";

export default function PromocionesLoading() {
  return (
    <div className="px-4 pt-[max(10px,var(--safe-top))] pb-6 space-y-4">
      <HeaderSkeleton withAction />
      <CardsSkeleton cards={3} height={130} />
    </div>
  );
}
