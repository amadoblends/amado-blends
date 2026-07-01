"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, Mail, Loader2 } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("Correo o contraseña incorrectos.");
      return;
    }

    const redirectTo = searchParams.get("redirectTo") || "/";
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-12 w-full max-w-sm mx-auto">
      <div className="flex flex-col items-center mb-10">
        <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-brand/30">
          AB
        </div>
        <h1 className="mt-4 text-xl font-bold text-foreground">Amado Blends</h1>
        <p className="text-muted text-sm">Panel administrativo</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Correo electrónico</label>
          <div className="relative">
            <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              placeholder="tucorreo@ejemplo.com"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Contraseña</label>
          <div className="relative">
            <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              placeholder="••••••••"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-brand text-white font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          Iniciar sesión
        </button>
      </form>
    </div>
  );
}
