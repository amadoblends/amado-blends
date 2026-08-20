import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import { NO_ROLES, type AccountRoles } from "@/lib/account-role";

/**
 * The signed-in user, fetched at most once per request.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * `supabase.auth.getUser()` is not a local read: it calls Supabase's
 * /auth/v1/user endpoint to validate the token. Every call is a round trip
 * from Vercel to Supabase, typically 100–250ms.
 *
 * A single navigation was paying that several times over — middleware, then
 * the admin layout, then the page, then any server action. React's `cache()`
 * de-duplicates them within one request, so the layout and every page below
 * it share a single verified result.
 *
 * Server actions still call it themselves: they run in their own request and
 * must verify independently.
 */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The roles the signed-in account actually holds.
 *
 * Read from the database, not from the email and not from the session — the
 * grant lives in `user_roles`, gated by an allowlist, and the same answer is
 * what RLS uses on every row below.
 *
 * Cached per request like getUser(), so the layout and the pages under it
 * share one round trip.
 */
export const getRoles = cache(async (): Promise<AccountRoles> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_roles");

  /*
   * Before migration 34 there is no my_roles(). Returning "no roles" would
   * lock the barber out of their own panel, so this falls back to the old
   * behaviour — a profile row means admin — and the migration is what
   * actually closes the hole.
   */
  if (error) {
    const user = await getUser();
    if (!user) return NO_ROLES;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    return { isBarber: Boolean(profile), isClient: !profile };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    isBarber: Boolean(row?.is_barber),
    isClient: Boolean(row?.is_client),
  };
});
