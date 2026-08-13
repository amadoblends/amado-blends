"use server";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { sendMail } from "@/lib/email/send";
import { resolveBarberInbox } from "@/lib/email/recipients";
import { clientBookingConfirmed } from "@/lib/email/templates";
import { calendarInvite } from "@/lib/email/invite";

export interface EmailDiagnosis {
  ok: boolean;
  /** What to fix, in the barber's words. */
  message: string;
  checks: { label: string; pass: boolean; detail?: string }[];
}

/**
 * Sends a real test email and reports exactly what went wrong.
 *
 * "The emails don't work" has half a dozen possible causes — no API key, an
 * unverified sender domain, a typo in the address, a Resend account still in
 * sandbox. Guessing between them from the outside is miserable, so this runs
 * the actual send path and turns the provider's answer into something
 * actionable.
 */
export async function sendTestEmail(): Promise<EmailDiagnosis> {
  const checks: EmailDiagnosis["checks"] = [];

  const user = await getUser();
  if (!user) {
    return { ok: false, message: "No autenticado.", checks };
  }

  const hasKey = Boolean(process.env.RESEND_API_KEY);
  checks.push({
    label: "RESEND_API_KEY",
    pass: hasKey,
    detail: hasKey ? "configurada" : "falta en las variables de Vercel",
  });

  const from = process.env.EMAIL_FROM ?? "";
  checks.push({
    label: "EMAIL_FROM",
    pass: Boolean(from),
    detail: from || "falta en las variables de Vercel",
  });

  const supabase = await createClient();
  const to = await resolveBarberInbox(supabase, user.email ?? null);
  checks.push({
    label: "Correo de destino",
    pass: Boolean(to),
    detail: to ?? "sin destinatario: ponlo en Negocio → Correo para notificaciones",
  });

  if (!hasKey || !from) {
    return {
      ok: false,
      message:
        "Faltan las variables de Resend en Vercel. Mira la sección 3 de CONFIGURACION.md, y acuérdate de volver a desplegar después de guardarlas.",
      checks,
    };
  }
  if (!to) {
    return {
      ok: false,
      message:
        "No hay a quién enviarle. Escribe tu correo en Negocio → Correo para notificaciones.",
      checks,
    };
  }

  // A realistic message, so what arrives is what a real booking would look like
  const inOneHour = new Date(Date.now() + 3600_000);
  const data = {
    clientName: "Cliente de prueba",
    serviceName: "Corte + Barba",
    startsAt: inOneHour.toISOString(),
    endsAt: new Date(inOneHour.getTime() + 45 * 60000).toISOString(),
    durationMinutes: 45,
    price: 25,
    confirmationCode: "PRUEBA",
    barberName: "Amado",
    shopName: "Amado Blends",
    shopAddress: null,
    shopPhone: null,
    mapsUrl: null,
    guestName: null,
    products: [],
    notes: "Este es un correo de prueba. Nadie tiene una cita ahora mismo.",
  };

  const m = clientBookingConfirmed(data);
  const result = await sendMail({
    to,
    subject: "[Prueba] " + m.subject,
    html: m.html,
    text: m.text,
    attachments: [calendarInvite("test-" + Date.now(), data, { method: "REQUEST" })],
  });

  checks.push({
    label: "Envío",
    pass: result.ok,
    detail: result.ok ? "aceptado por Resend" : result.error,
  });

  if (result.ok) {
    return {
      ok: true,
      message: `Enviado a ${to}. Si no aparece en un minuto, mira en Spam.`,
      checks,
    };
  }

  // Turn the provider's raw answer into the actual fix
  const err = result.error ?? "";
  let message = `Resend rechazó el envío: ${err}`;

  if (/domain is not verified|not verified/i.test(err)) {
    message =
      "El dominio del remitente no está verificado en Resend. Verifícalo en Resend → Domains, o usa onboarding@resend.dev mientras tanto (ese solo te deja escribirte a ti mismo).";
  } else if (/401|unauthorized|invalid.*api.*key/i.test(err)) {
    message = "La RESEND_API_KEY no es válida. Genera otra en Resend → API Keys.";
  } else if (/403/.test(err)) {
    message =
      "Resend permite escribir solo a tu propia dirección hasta que verifiques un dominio. Verifícalo en Resend → Domains.";
  } else if (/422|invalid.*from/i.test(err)) {
    message =
      "EMAIL_FROM tiene un formato inválido. Debe ser así: Amado Blends <citas@tudominio.com>";
  } else if (/timeout|aborted/i.test(err)) {
    message = "Resend no respondió a tiempo. Inténtalo otra vez.";
  }

  return { ok: false, message, checks };
}
