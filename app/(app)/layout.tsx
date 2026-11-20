import { redirect } from "next/navigation";
import { BottomNav } from "@/components/app/bottom-nav";
import { DemoBanner } from "@/components/app/demo-banner";
import { getAuthedContext } from "@/lib/data/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await getAuthedContext();
  if (!ctx) redirect("/login");

  return (
    <>
      <DemoBanner />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-[calc(env(safe-area-inset-top)+2.25rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)]">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
