import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/perfil/profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single()
    : { data: null };

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href="/mas"
          className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center shrink-0"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Mi perfil</h1>
      </header>

      <ProfileForm
        fullName={profile?.full_name ?? ""}
        avatarUrl={profile?.avatar_url ?? null}
        email={user?.email ?? ""}
      />
    </div>
  );
}
