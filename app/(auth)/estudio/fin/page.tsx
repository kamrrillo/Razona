import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BackToLogin } from "@/components/app/back-to-login";
import { StudyAgreement } from "@/components/app/study-agreement";
import { Button } from "@/components/ui/button";
import { getAuthedContext } from "@/lib/data/auth";
import { getStudyProgress } from "@/lib/data/study";
import { getStudyProfile } from "@/lib/data/study-group";

export const metadata: Metadata = { title: "Gracias" };

/** Final del estudio: agradecimiento, el acuerdo otra vez y salida para la siguiente persona. */
export default async function EstudioFinPage() {
  const ctx = await getAuthedContext();
  if (!ctx?.isAnonymous) redirect("/estudio");
  const [progress, profile] = await Promise.all([
    getStudyProgress(ctx.supabase, ctx.userId),
    getStudyProfile(ctx.supabase, ctx.userId),
  ]);
  if (!progress.done) redirect("/practicar");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div
        className="space-y-5 rounded-3xl border-2 border-brand-100 bg-white p-5 shadow-[0_6px_0_0_var(--color-brand-100)]"
        data-testid="study-done"
      >
        <div className="space-y-2 text-center">
          <CheckCircle2 className="mx-auto size-12 text-emerald-600" aria-hidden />
          <h1 className="text-2xl font-extrabold text-brand-900">
            ¡Gracias{profile.name ? `, ${profile.name}` : ""}!
          </h1>
          <p className="text-sm leading-relaxed">
            Respondiste las {progress.total} preguntas. Tus respuestas ya quedaron guardadas para el
            estudio.
          </p>
        </div>

        <details className="rounded-2xl border bg-muted/40 p-4">
          <summary className="min-h-11 cursor-pointer font-bold text-brand-900">
            Recordatorio del acuerdo que aceptaste
          </summary>
          <div className="pt-2">
            <StudyAgreement />
          </div>
        </details>

        <form action="/auth/logout" method="post">
          <Button
            type="submit"
            size="lg"
            className="h-12 w-full text-base"
            data-testid="study-exit"
          >
            Terminar
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          Al terminar, este teléfono queda listo para la siguiente persona.
        </p>
        <BackToLogin signOut />
      </div>
    </main>
  );
}
