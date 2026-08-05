import { HeaderSkeleton, CardsSkeleton } from "@/components/ui/loading-blocks";

export default function PromocionesLoading() {
  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <HeaderSkeleton withAction />
      <CardsSkeleton cards={3} height={130} />
    </div>
  );
}
