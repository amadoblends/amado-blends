"use client";

import { useState, useTransition } from "react";
import { Send, Loader2, Check, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendTestEmail, type EmailDiagnosis } from "@/lib/actions/email-test";

/**
 * Sends a real email through the real path and shows what happened.
 *
 * "The emails don't arrive" is a question with several answers — no key, an
 * unverified domain, a typo, a sandboxed account. Rather than have the barber
 * guess, this runs the send and translates the provider's response into the
 * next thing to do.
 */
export function EmailTestButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<EmailDiagnosis | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      setResult(await sendTestEmail());
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        className="w-full h-11 rounded-xl border border-border bg-background text-sm font-bold text-foreground flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Send size={15} className="text-brand" />
        )}
        {isPending ? "Enviando..." : "Enviar correo de prueba"}
      </button>

      {result && (
        <div
          className={cn(
            "rounded-xl border p-3.5 space-y-3",
            result.ok
              ? "bg-success-light border-success/25"
              : "bg-warning-light border-warning/25"
          )}
        >
          <p className="text-sm font-semibold text-foreground flex gap-2">
            {result.ok ? (
              <Check size={16} className="text-success shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
            )}
            <span>{result.message}</span>
          </p>

          {/* Each step, so the failing one is obvious */}
          <ul className="space-y-1.5">
            {result.checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2 text-xs">
                {c.pass ? (
                  <Check size={13} className="text-success shrink-0 mt-0.5" />
                ) : (
                  <X size={13} className="text-danger shrink-0 mt-0.5" />
                )}
                <span className="min-w-0">
                  <span className="font-semibold text-foreground">{c.label}</span>
                  {c.detail && (
                    <span className="text-muted break-words"> — {c.detail}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
