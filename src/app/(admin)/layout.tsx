import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { ThemeProvider, type Theme } from "@/components/theme/theme-provider";
import { UnseenProvider, type UnseenCounts } from "@/components/nav/unseen-provider";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  /*
   * This layout re-runs on every navigation, so nothing here waits on anything
   * else: branding doesn't depend on the user, so it goes out at the same time
   * as the auth check rather than after it.
   */
  const businessPromise = supabase
    .from("business_settings")
    .select("name, logo_url")
    .eq("id", 1)
    .maybeSingle();

  // Shared with every page below via React cache — one verification per request
  const user = await getUser();

  const [{ data: profile }, { data: business }, { data: unseenRows }] = await Promise.all([
    user
      ? supabase.from("profiles").select("theme").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    businessPromise,
    // Rendered server-side so the badge is correct on first paint instead of
    // popping in a moment later
    user ? supabase.rpc("unseen_counts") : Promise.resolve({ data: null }),
  ]);

  const theme: Theme = profile?.theme === "light" ? "light" : "dark";

  const unseenRow = Array.isArray(unseenRows) ? unseenRows[0] : unseenRows;
  const unseen: UnseenCounts = {
    citas: Number(unseenRow?.citas ?? 0),
    feedback: Number(unseenRow?.feedback ?? 0),
  };

  return (
    <ThemeProvider initialTheme={theme}>
      <UnseenProvider initial={unseen}>
        <div className="flex w-full min-h-dvh">
          <Sidebar
            logoUrl={business?.logo_url ?? null}
            businessName={business?.name ?? "Amado Blends"}
          />
          <div className="flex-1 flex flex-col min-w-0">
            <main className="flex-1 pb-6 md:px-8 md:py-8">
              <div className="md:max-w-5xl md:mx-auto w-full">{children}</div>
            </main>
            <BottomNav />
          </div>
        </div>
      </UnseenProvider>
    </ThemeProvider>
  );
}
