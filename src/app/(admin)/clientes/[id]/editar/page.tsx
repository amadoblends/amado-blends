import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ClientForm } from "@/components/clientes/client-form";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, phone, email, birth_date, quick_notes")
    .eq("id", id)
    .single();

  if (!client) notFound();

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <Link href={`/clientes/${id}`} className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Editar cliente</h1>
      </header>
      <ClientForm
        mode="edit"
        clientId={client.id}
        defaults={{
          fullName: client.full_name,
          phone: client.phone,
          email: client.email ?? "",
          birthDate: client.birth_date ?? "",
          quickNotes: client.quick_notes ?? "",
        }}
      />
    </div>
  );
}
