import { LogOut } from "lucide-react";
import { signOut } from "@/lib/actions/auth";

/** Signing out from a dead end, so a retry doesn't land in the same place. */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="w-full h-12 rounded-xl border border-border bg-surface text-sm font-bold text-foreground flex items-center justify-center gap-2"
      >
        <LogOut size={16} /> Cerrar sesión
      </button>
    </form>
  );
}
