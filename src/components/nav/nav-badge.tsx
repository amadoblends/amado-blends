import { cn } from "@/lib/utils";

/**
 * The little count that sits on a nav icon.
 *
 * Renders nothing at zero — an empty circle reads as "something is wrong"
 * rather than "nothing new".
 */
export function NavBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;

  return (
    <span
      aria-label={`${count} sin ver`}
      className={cn(
        "absolute -top-1 -right-2 min-w-[17px] h-[17px] px-1 rounded-full",
        "bg-brand text-white text-[10px] font-bold leading-[17px] text-center",
        "ring-2 ring-surface pointer-events-none",
        className
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
