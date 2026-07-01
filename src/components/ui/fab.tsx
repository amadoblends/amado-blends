import Link from "next/link";
import { Plus } from "lucide-react";

export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="fixed z-30 bottom-[calc(72px+max(12px,var(--safe-bottom)))] right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-brand text-white shadow-lg shadow-brand/30 flex items-center justify-center active:scale-95 transition-transform"
    >
      <Plus size={26} />
    </Link>
  );
}
