import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageHeader({
  title,
  backHref,
  right,
}: {
  title: string;
  backHref?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center shrink-0"
          >
            <ChevronLeft size={20} />
          </Link>
        )}
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </header>
  );
}

export function HeaderIconButton({
  href,
  onClick,
  children,
  ariaLabel,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const className =
    "w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center";

  if (href) {
    return (
      <Link href={href} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
