import { Flame, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LearningPath } from "@/components/app/learning-path";
import { DAILY_GOAL, TopBar } from "@/components/app/top-bar";
import { buttonVariants } from "@/components/ui/button";
import { getCatalog } from "@/lib/content";
import { getAuthedContext } from "@/lib/data/auth";
import { getProgress } from "@/lib/data/progress";
import { buildLearningPath } from "@/lib/learning/path";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Inicio" };

export default async function InicioPage({ searchParams }: PageProps<"/inicio">) {
  const params = await searchParams;
  const ctx = await getAuthedContext();
  if (!ctx) redirect("/login");
  const [progress, catalog] = await Promise.all([
    getProgress(ctx.supabase, ctx.userId),
    getCatalog(),
  ]);
  // Una unidad por área (grupo de temas) y solo los casos índice: son los que se practican.
  const units = buildLearningPath({
    specialties: catalog.groups,
    items: catalog.cases,
    unitOf: (i) => i.groupId ?? i.specialtyId,
    stats: progress.byTopic,
    weakTopic: progress.weakTopic?.topic ?? null,
  });
  const weak = progress.weakTopic;
  const isNew = progress.totals.answered === 0;
  const notice =
    params.contrasena === "1"
      ? "Listo: guardamos tu contraseña nueva."
      : params.bienvenida === "1"
        ? "¡Tu cuenta está lista! Empieza con tu primer caso."
        : null;
  const goalPct = Math.min(100, Math.round((progress.totals.answeredToday / DAILY_GOAL) * 100));

  return (
    <div className="space-y-5 pb-4">
      <TopBar
        streak={progress.streak.current}
        activeToday={progress.streak.activeToday}
        answeredToday={progress.totals.answeredToday}
      />

      {notice && (
        <output
          className="block rounded-2xl bg-aqua-200/60 px-4 py-3 text-sm font-semibold text-brand-900"
          data-testid="inicio-notice"
        >
          {notice}
        </output>
      )}

      <section className="relative overflow-hidden rounded-3xl bg-brand-gradient p-5 text-white shadow-[0_6px_0_0_var(--color-brand-800)]">
        <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-14 -left-6 size-32 rounded-full bg-aqua-300/20" />
        <p className="relative text-sm text-brand-50">
          ¡Hola{progress.displayName ? `, ${progress.displayName}` : ""}! Tu foco de hoy
        </p>
        {weak ? (
          <div className="relative">
            <p className="mt-1 text-2xl font-extrabold leading-tight" data-testid="weak-topic-name">
              {weak.topic}
            </p>
            <p className="text-sm text-brand-50">
              Tema débil · {weak.specialtyName} · dominio {Math.round(weak.mastery * 100)} %
            </p>
            <Link
              href="/practicar?topic=weak"
              data-testid="practice-weak-topic"
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-4 w-full bg-white text-base font-extrabold text-brand-700 shadow-[0_4px_0_0_var(--color-brand-200)] hover:bg-brand-50",
              )}
            >
              Practicar mi tema débil
            </Link>
          </div>
        ) : (
          <div className="relative" data-testid={isNew ? "first-steps" : undefined}>
            <p className="mt-1 text-2xl font-extrabold leading-tight">
              {isNew ? "Empieza con tu primer caso" : "Sigue resolviendo casos"}
            </p>
            <p className="text-sm text-brand-50">
              {isNew
                ? "Con tus respuestas descubrimos tu tema débil y armamos tu ruta."
                : "Con unos casos más descubrimos tu tema débil."}
            </p>
            <Link
              href="/practicar"
              data-testid="start-practice"
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-4 w-full bg-white text-base font-extrabold text-brand-700 shadow-[0_4px_0_0_var(--color-brand-200)] hover:bg-brand-50",
              )}
            >
              {isNew ? "Resolver mi primer caso" : "Practicar"}
            </Link>
            {isNew && (
              <Link
                href="/diagnostico"
                className="mt-2 flex min-h-11 items-center justify-center text-sm font-semibold text-white underline underline-offset-4"
              >
                o haz un diagnóstico con IA (10 min)
              </Link>
            )}
          </div>
        )}
        <div className="relative mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2">
            <Flame className="size-5 fill-orange-300 text-orange-200" aria-hidden />
            <span>
              <span className="font-bold">{progress.streak.current}</span> días de racha
            </span>
          </div>
          <div className="rounded-xl bg-white/15 px-3 py-2">
            <div className="flex items-center gap-2">
              <Target className="size-5 text-aqua-200" aria-hidden />
              <span>
                Meta:{" "}
                <span className="font-bold">
                  {Math.min(progress.totals.answeredToday, DAILY_GOAL)}/{DAILY_GOAL}
                </span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-aqua-200" style={{ width: `${goalPct}%` }} />
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-extrabold text-brand-900">Tu ruta ENARM</h2>
        <p className="text-xs text-muted-foreground">Avance por área</p>
      </div>

      <LearningPath units={units} />
    </div>
  );
}
