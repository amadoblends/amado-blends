import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ClientForm } from "@/components/clientes/client-form";

export default function NewClientPage() {
  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <Link href="/clientes" className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold text-foreground">Nuevo cliente</h1>
      </header>
      <ClientForm mode="create" />
    </div>
  );
}
