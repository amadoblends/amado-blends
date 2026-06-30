import { BottomNav } from "@/components/bottom-nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="flex-1 pb-4">{children}</main>
      <BottomNav />
    </>
  );
}
