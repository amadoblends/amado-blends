import { ShieldAlert } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";

/**
 * Shown when a real, correctly authenticated account signs in to the wrong
 * app.
 *
 * Deliberately not a 404 or a bare "access denied": the password was right
 * and the account exists, so the only useful thing to say is which app it
 * belongs to. Signing out is offered because otherwise the session sits there
 * and every retry lands back here.
 */
export function WrongApp({ message }: { message: string }) {
  return (
    <div className="min-h-dvh flex items-center justify-center px-5">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-warning-light flex items-center justify-center mx-auto">
          <ShieldAlert size={26} className="text-warning" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Cuenta incorrecta</h1>
          <p className="text-sm text-muted mt-1.5 leading-relaxed">{message}</p>
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}
