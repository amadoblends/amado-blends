import { Sidebar } from "@/components/sidebar";
import { BottomNav } from "@/components/bottom-nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full min-h-dvh">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 pb-6 md:px-8 md:py-8">
          <div className="md:max-w-5xl md:mx-auto w-full">{children}</div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
