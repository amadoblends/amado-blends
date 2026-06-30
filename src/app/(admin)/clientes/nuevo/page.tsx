import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ClientForm } from "@/components/clientes/client-form";

export default function NewClientPage() {
  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <Link href="/clientes" className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Nuevo cliente</h1>
      </header>
      <ClientForm mode="create" />
    </div>
  );
}
