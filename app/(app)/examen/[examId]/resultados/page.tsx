import { CheckCircle2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CitationCard } from "@/components/app/citation-card";
import { SampleContentBadge } from "@/components/app/sample-content-badge";
import { SpecialtyBars } from "@/components/app/specialty-bars";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { examItems, specialties } from "@/lib/content";
import { getAuthedContext } from "@/lib/data/auth";
import { loadExam } from "@/lib/data/exam";
import { getProgress } from "@/lib/data/progress";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Resultados" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ResultadosPage({ params }: PageProps<"/examen/[examId]/resultados">) {
  const { examId } = await params;
  if (!UUID.test(examId)) notFound();
  const ctx = await getAuthedContext();
  if (!ctx) redirect("/login");
  const [loaded, progress] = await Promise.all([
    loadExam(ctx.supabase, ctx.userId, examId),
    getProgress(ctx.supabase, ctx.userId),
  ]);
  if (!loaded) notFound();
  if (!loaded.exam.finishedAt) redirect(`/examen/${examId}`);

  const { answers, exam } = loaded;
  const score = exam.score ?? 0;
  const bySpecialty = specialties
    .map((s) => {
      const its = examItems.filter((i) => i.specialtyId === s.id);
      const correct = its.filter((i) => answers[i.id] === i.correctOptionId).length;
      return {
        specialtyId: s.id,
        name: s.name,
        correct,
        total: its.length,
        accuracy: its.length === 0 ? 0 : correct / its.length,
      };
    })
    .filter((s) => s.total > 0);

  return (
    <div className="space-y-4 py-4">
      <h1 className="text-2xl font-bold">Resultados</h1>

      <Card data-testid="exam-score">
        <CardContent className="flex items-center gap-4">
          <div
            className={cn(
              "flex size-20 shrink-0 items-center justify-center rounded-full text-2xl font-bold",
              score >= 70 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900",
            )}
          >
            {Math.round(score)}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Calificación</p>
            <p className="text-xl font-semibold">
              {exam.correct}/{exam.total} aciertos
            </p>
            <p className="text-xs text-muted-foreground">Sobre 100 · tutor apagado</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aciertos por especialidad</CardTitle>
        </CardHeader>
        <CardContent>
          <SpecialtyBars items={bySpecialty} />
        </CardContent>
      </Card>

      {progress.weakTopic && (
        <Link
          href="/practicar?topic=weak"
          className={cn(buttonVariants({ size: "lg" }), "h-auto min-h-12 w-full whitespace-normal py-2")}
          data-testid="practice-weak-topic"
        >
          Practicar mi tema débil: {progress.weakTopic.topic}
        </Link>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Revisión de reactivos</h2>
        <SampleContentBadge />
        {examItems.map((item, i) => {
          const chosen = answers[item.id];
          const ok = chosen === item.correctOptionId;
          const chosenText = item.options.find((o) => o.id === chosen)?.text;
          const correctText = item.options.find((o) => o.id === item.correctOptionId)?.text;
          return (
            <details
              key={item.id}
              className="group rounded-xl border bg-card"
              data-testid="review-item"
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 p-3">
                {ok ? (
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-label="Correcto" />
                ) : (
                  <XCircle className="size-5 shrink-0 text-rose-500" aria-label="Incorrecto" />
                )}
                <span className="flex-1 text-sm">
                  <span className="font-semibold">{i + 1}.</span> {item.question}
                </span>
              </summary>
              <div className="space-y-3 border-t p-3 text-sm">
                <p className="text-muted-foreground">{item.vignette}</p>
                <p>
                  Tu respuesta:{" "}
                  <span className={ok ? "text-emerald-700" : "text-rose-700"}>
                    {chosen ? `${chosen}) ${chosenText}` : "Sin responder"}
                  </span>
                </p>
                {!ok && (
                  <p>
                    Respuesta correcta:{" "}
                    <span className="text-emerald-700">
                      {item.correctOptionId}) {correctText}
                    </span>
                  </p>
                )}
                <p className="leading-relaxed">{item.explanation}</p>
                <CitationCard
                  gpcId={item.citation.gpcId}
                  gpcTitle={item.citation.gpcTitle}
                  section={item.citation.section}
                  snippet={item.citation.snippet}
                />
              </div>
            </details>
          );
        })}
      </section>

      <Link href="/progreso" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
        Ver mi progreso
      </Link>
    </div>
  );
}
