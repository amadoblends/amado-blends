"use server";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { sendAll, emailConfigured } from "@/lib/email/send";
import { resolveBarberInbox } from "@/lib/email/recipients";
import {
  clientBookingConfirmed,
  barberNewBooking,
  bookingCancelled,
  bookingRescheduled,
  type AppointmentEmailData,
} from "@/lib/email/templates";

/**
 * Emails for the things the *barber* does: booking someone in, moving a
 * appointment, cancelling one.
 *
 * The client app has its own twin of this for the things clients do. They
 * share the templates and the recipient rules, but each app triggers from its
 * own actions — a booking made at the chair and one made on a phone should
 * produce the same email.
 *
 * Same rule as the client side: the row is committed first and nothing here
 * is allowed to fail the operation. A bounced address must not stop the
 * barber from running their day.
 */

/** Everything one appointment needs for an email. */
async function loadAppointment(appointmentId: string): Promise<
  { data: AppointmentEmailData; clientEmail: string | null } | null
> {
  const supabase = await createClient();

  const [{ data: apt }, { data: business }, { data: products }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, starts_at, ends_at, price, notes, guest_name, clients(full_name, email), services(name, duration_minutes)"
      )
      .eq("id", appointmentId)
      .maybeSingle(),
    supabase
      .from("business_settings")
      .select("name, address, phone")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("appointment_products")
      .select("quantity, products(name)")
      .eq("appointment_id", appointmentId),
  ]);

  if (!apt) return null;

  const client = apt.clients as unknown as { full_name: string; email: string | null } | null;
  const service = apt.services as unknown as { name: string; duration_minutes: number } | null;
  const address = business?.address ?? null;
  const shopName = business?.name ?? "Amado Blends";

  // The barber signed in is the one doing the service
  const user = await getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
    : { data: null };

  return {
    clientEmail: client?.email ?? null,
    data: {
      clientName: client?.full_name ?? "Cliente",
      serviceName: service?.name ?? "Servicio",
      startsAt: apt.starts_at,
      endsAt: apt.ends_at,
      durationMinutes: service?.duration_minutes ?? 30,
      price: Number(apt.price),
      confirmationCode: apt.id.replace(/-/g, "").slice(0, 6).toUpperCase(),
      barberName: profile?.full_name ?? "Amado",
      shopName,
      shopAddress: address,
      shopPhone: business?.phone ?? null,
      mapsUrl: address
        ? `https://maps.google.com/?q=${encodeURIComponent(`${shopName} ${address}`)}`
        : null,
      guestName: apt.guest_name,
      notes: apt.notes,
      products: (products ?? []).map((p) => ({
        quantity: p.quantity,
        name: (p.products as unknown as { name: string } | null)?.name ?? "",
      })),
    },
  };
}

/** The barber's own copy — settings, then env, then their login address. */
async function barberInbox(): Promise<string | null> {
  const supabase = await createClient();
  const user = await getUser();
  return resolveBarberInbox(supabase, user?.email ?? null);
}

/** The barber booked someone in from the panel. */
export async function notifyCreatedByBarber(appointmentId: string): Promise<void> {
  if (!emailConfigured()) return;
  const loaded = await loadAppointment(appointmentId);
  if (!loaded) return;
  const { data, clientEmail } = loaded;

  const to = await barberInbox();
  const mails = [];

  // Worth sending: the client may not have been watching when it was booked
  if (clientEmail) {
    const m = clientBookingConfirmed(data);
    mails.push({ to: clientEmail, subject: m.subject, html: m.html, text: m.text });
  }
  if (to) {
    const m = barberNewBooking(data);
    mails.push({
      to,
      subject: m.subject,
      html: m.html,
      text: m.text,
      replyTo: clientEmail ?? undefined,
    });
  }

  await sendAll(mails);
}

/** The barber cancelled or marked a no-show. */
export async function notifyCancelledByBarber(
  appointmentId: string,
  reason: "cancelada" | "no_show" = "cancelada"
): Promise<void> {
  if (!emailConfigured()) return;
  const loaded = await loadAppointment(appointmentId);
  if (!loaded) return;
  const { data, clientEmail } = loaded;

  const to = await barberInbox();
  const mails = [];

  // A no-show is for the shop's records — telling the client off by email
  // isn't the app's job, so only the barber gets that one.
  if (clientEmail && reason === "cancelada") {
    const m = bookingCancelled(data, { forBarber: false });
    mails.push({ to: clientEmail, subject: m.subject, html: m.html, text: m.text });
  }
  if (to) {
    const m = bookingCancelled(data, { forBarber: true });
    mails.push({ to, subject: m.subject, html: m.html, text: m.text });
  }

  await sendAll(mails);
}

/** The barber moved an appointment. */
export async function notifyRescheduledByBarber(
  appointmentId: string,
  previousStartsAt: string
): Promise<void> {
  if (!emailConfigured()) return;
  const loaded = await loadAppointment(appointmentId);
  if (!loaded) return;
  const { data, clientEmail } = loaded;

  const to = await barberInbox();
  const mails = [];

  if (clientEmail) {
    const m = bookingRescheduled(data, { startsAt: previousStartsAt }, { forBarber: false });
    mails.push({ to: clientEmail, subject: m.subject, html: m.html, text: m.text });
  }
  if (to) {
    const m = bookingRescheduled(data, { startsAt: previousStartsAt }, { forBarber: true });
    mails.push({ to, subject: m.subject, html: m.html, text: m.text });
  }

  await sendAll(mails);
}
