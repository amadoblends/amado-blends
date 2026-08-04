import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { ThemeProvider, type Theme } from "@/components/theme/theme-provider";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("theme").eq("id", user.id).single()
    : { data: null };

  const theme: Theme = profile?.theme === "light" ? "light" : "dark";

  return (
    <ThemeProvider initialTheme={theme}>
      <div className="flex w-full min-h-dvh">
        <Sidebar />
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
