import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

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
