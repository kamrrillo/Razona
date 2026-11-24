import { ListChecks, MessageCircleQuestion } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/app/logo";
import { getAuthedContext } from "@/lib/data/auth";
import { getStudyProfile } from "@/lib/data/study-group";
import { chooseMode } from "./actions";
import { NameForm } from "./name-form";

export const metadata: Metadata = { title: "Estudio" };

/**
 * Entrada del estudio: 1) nombre (sesión anónima) → 2) modo con IA o sin IA (queda fijo) →
 * la app. Las respuestas se guardan como las de cualquier cuenta, ligadas a su nombre.
 */
export default async function EstudioPage({ searchParams }: PageProps<"/estudio">) {
  const params = await searchParams;
  const ctx = await getAuthedContext();
  const profile = ctx ? await getStudyProfile(ctx.supabase, ctx.userId) : null;
  const participant = ctx?.isAnonymous && profile;
  if (participant && profile.chosen) redirect("/inicio");

  return (
    <main className="flex min-h-dvh flex-col">
      <section className="bg-brand-gradient px-6 pt-[calc(env(safe-area-inset-top)+2rem)] pb-14 text-center text-white">
        <span className="mx-auto inline-flex rounded-[26px] bg-white/90 p-2">
          <LogoMark className="size-14" />
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Estudio Razona</h1>
        <p className="mt-1 text-brand-50">Casos clínicos tipo ENARM de pediatría</p>
      </section>

      <div className="relative mx-auto -mt-8 w-full max-w-md flex-1 px-4 pb-safe">
        <div className="space-y-5 rounded-3xl border-2 border-brand-100 bg-white p-5 shadow-[0_6px_0_0_var(--color-brand-100)]">
          {participant ? (
            <div className="space-y-4" data-testid="estudio-modes">
              <div>
                <p className="text-sm text-muted-foreground">Hola, {profile.name}</p>
                <h2 className="text-xl font-extrabold text-brand-900">
                  Elige cómo vas a practicar
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Solo puedes elegir una vez: el modo queda fijo para todo el estudio.
                </p>
              </div>
              {params.error === "1" && (
                <p role="alert" className="text-sm text-destructive">
                  No se pudo guardar tu elección. Inténtalo de nuevo.
                </p>
              )}
              <form action={chooseMode} className="space-y-3">
                <ModeButton
                  value="ia"
                  title="Con IA"
                  text="Un tutor te hace preguntas cuando te equivocas y te explica cada caso."
                  icon={<MessageCircleQuestion className="size-6" aria-hidden />}
                />
                <ModeButton
                  value="control"
                  title="Sin IA"
                  text="Solo el cuestionario: respondes y ves la respuesta correcta con su explicación."
                  icon={<ListChecks className="size-6" aria-hidden />}
                />
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-extrabold text-brand-900">
                Te damos la bienvenida al estudio
              </h2>
              <NameForm
                signedInAs={ctx ? profile?.name || ctx.email || "otra cuenta" : undefined}
              />
            </div>
          )}
        </div>
        <footer className="py-6 text-center text-xs text-muted-foreground">
          Uso educativo: no sustituye el criterio clínico.
        </footer>
      </div>
    </main>
  );
}

function ModeButton({
  value,
  title,
  text,
  icon,
}: {
  value: "ia" | "control";
  title: string;
  text: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      name="mode"
      value={value}
      data-testid={`estudio-mode-${value}`}
      className="flex min-h-20 w-full items-center gap-3 rounded-2xl border-2 border-brand-100 bg-white p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-aqua-700">
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-lg font-bold text-brand-900">{title}</span>
        <span className="block text-sm text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}
