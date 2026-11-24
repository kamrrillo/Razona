import { CheckCircle2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CitationCard } from "@/components/app/citation-card";
import { LearningResources } from "@/components/app/learning-resources";
import { SpecialtyBars } from "@/components/app/specialty-bars";
import { TutorExplanation } from "@/components/app/tutor-explanation";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { rubricFor } from "@/lib/ai/fallback-engine";
import { getAuthedContext } from "@/lib/data/auth";
import { examItemsFor, loadExam } from "@/lib/data/exam";
import { getProgress } from "@/lib/data/progress";
import { getStudyGroup } from "@/lib/data/study-group";
import { orderResources } from "@/lib/learning/resources";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Resultados" };

const ERROR_LABEL = {
  lectura: "error de lectura",
  dato_omitido: "dato omitido",
  razonamiento: "error de razonamiento",
  conocimiento: "error de conocimiento",
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ResultadosPage({ params }: PageProps<"/examen/[examId]/resultados">) {
  const { examId } = await params;
  if (!UUID.test(examId)) notFound();
  const ctx = await getAuthedContext();
  if (!ctx) redirect("/login");
  const [loaded, progress, group] = await Promise.all([
    loadExam(ctx.supabase, ctx.userId, examId),
    getProgress(ctx.supabase, ctx.userId),
    getStudyGroup(ctx.supabase, ctx.userId),
  ]);
  // Grupo control (solo cuestionario): respuesta, explicación fija y cita; nada de IA ni rúbrica.
  const withAi = group === "ia";
  if (!loaded) notFound();
  if (!loaded.exam.finishedAt) redirect(`/examen/${examId}`);

  const { answers, exam } = loaded;
  const examItems = await examItemsFor(exam);
  const score = exam.score ?? 0;
  // Aciertos por área (grupo de temas); si el examen es de una sola área, por tema.
  const areaIds = new Set(examItems.map((i) => i.groupId ?? i.specialtyId));
  const keyOf = (i: (typeof examItems)[number]) =>
    areaIds.size > 1 ? (i.groupId ?? i.specialtyId) : i.topic;
  const nameOf = (i: (typeof examItems)[number]) =>
    areaIds.size > 1 ? (i.groupName ?? i.specialtyId) : i.topic;
  const byArea = [...new Set(examItems.map(keyOf))].map((key) => {
    const its = examItems.filter((i) => keyOf(i) === key);
    const correct = its.filter((i) => answers[i.id] === i.correctOptionId).length;
    return {
      specialtyId: key,
      name: nameOf(its[0]),
      correct,
      total: its.length,
      accuracy: its.length === 0 ? 0 : correct / its.length,
    };
  });

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
          <CardTitle className="text-base">
            {areaIds.size > 1 ? "Aciertos por área" : "Aciertos por tema"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SpecialtyBars items={byArea} />
        </CardContent>
      </Card>

      {progress.weakTopic && (
        <Link
          href="/practicar?topic=weak"
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-auto min-h-12 w-full whitespace-normal py-2",
          )}
          data-testid="practice-weak-topic"
        >
          Practicar mi tema débil: {progress.weakTopic.topic}
        </Link>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Revisión de reactivos</h2>
        {examItems.map((item, i) => {
          const chosen = answers[item.id];
          const ok = chosen === item.correctOptionId;
          const chosenText = item.options.find((o) => o.id === chosen)?.text;
          const correctText = item.options.find((o) => o.id === item.correctOptionId)?.text;
          const error = withAi && chosen && !ok ? rubricFor(item, chosen) : undefined;
          return (
            <details
              key={item.id}
              className="group rounded-xl border bg-card"
              data-testid="review-item"
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 p-3">
                {ok ? (
                  <CheckCircle2
                    className="size-5 shrink-0 text-emerald-600"
                    aria-label="Correcto"
                  />
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
                {error && (
                  <div className="space-y-2 rounded-lg bg-amber-50 p-3" data-testid="error-type">
                    <p className="font-semibold text-amber-950">
                      Por qué te desviaste · {ERROR_LABEL[error.errorType]}
                    </p>
                    <p className="text-amber-950">{error.explanation}</p>
                    <CitationCard
                      gpcId={error.citation.gpcId}
                      gpcTitle={error.citation.gpcTitle}
                      section={error.citation.section}
                      page={error.citation.page}
                      snippet={error.citation.snippet}
                      pdfUrl={error.citation.pdfUrl}
                    />
                  </div>
                )}
                <p className="leading-relaxed">{item.explanation}</p>
                <CitationCard
                  gpcId={item.citation.gpcId}
                  gpcTitle={item.citation.gpcTitle}
                  section={item.citation.section}
                  page={item.citation.page}
                  snippet={item.citation.snippet}
                  pdfUrl={item.citation.pdfUrl}
                />
                {withAi && (
                  <>
                    <TutorExplanation
                      request={{ examId, itemId: item.id }}
                      showCitation={false}
                      correctLabel={`${item.correctOptionId}) ${correctText}`}
                    />
                    <LearningResources
                      resources={orderResources(
                        item.resources ?? [],
                        error ? [error.errorType] : [],
                      )}
                      errorTypes={error ? [error.errorType] : []}
                    />
                  </>
                )}
              </div>
            </details>
          );
        })}
      </section>

      <Link
        href="/progreso"
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
      >
        Ver mi progreso
      </Link>
    </div>
  );
}
