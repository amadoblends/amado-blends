import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { ThemeProvider, type Theme } from "@/components/theme/theme-provider";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: business }] = await Promise.all([
    user
      ? supabase.from("profiles").select("theme").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    // Business branding is separate from the barber's own photo
    supabase.from("business_settings").select("name, logo_url").eq("id", 1).maybeSingle(),
  ]);

  const theme: Theme = profile?.theme === "light" ? "light" : "dark";

  return (
    <ThemeProvider initialTheme={theme}>
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
    </ThemeProvider>
  );
}
