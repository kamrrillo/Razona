import { redirect } from "next/navigation";
import { BottomNav } from "@/components/app/bottom-nav";
import { DemoBanner } from "@/components/app/demo-banner";
import { getAuthedContext } from "@/lib/data/auth";
import { getStudyProfile } from "@/lib/data/study-group";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await getAuthedContext();
  if (!ctx) redirect("/login");
  // Participante del estudio que aún no elige modo: primero lo elige en /estudio.
  if (ctx.isAnonymous && !(await getStudyProfile(ctx.supabase, ctx.userId)).chosen) {
    redirect("/estudio");
  }
  // En el estudio no hay navegación: solo las preguntas.
  const showNav = !ctx.isAnonymous;

  return (
    <>
      <DemoBanner />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-[calc(env(safe-area-inset-top)+2.25rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)]">
        {children}
      </main>
      {showNav && <BottomNav />}
    </>
  );
}
