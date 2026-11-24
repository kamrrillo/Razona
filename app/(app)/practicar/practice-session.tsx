"use client";

import { CheckCircle2, Loader2, Sparkles, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LearningResources } from "@/components/app/learning-resources";
import { TutorExplanation } from "@/components/app/tutor-explanation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { track } from "@/lib/analytics/events";
import {
  type AttemptResponse,
  AttemptResponseSchema,
  type SessionResponse,
  SessionResponseSchema,
} from "@/lib/schemas/api";
import { cn } from "@/lib/utils";

/**
 * Caso de práctica. Se responde una vez: acierte o no, se revela la respuesta y el tutor explica
 * (GPC primero, widget interactivo y pregunta socrática). Si se equivocó, la explicación corrige
 * su idea; si acertó, la refuerza y la lleva un paso más allá.
 *
 * `quizOnly` (modo sin IA del estudio): solo dice si acertó y, si no, cuál era la correcta.
 * Sin explicación, cita, tutor ni recursos: así se compara el efecto de explicar.
 *
 * En el estudio (`session.study`) las preguntas son fijas y al terminar la última se va a
 * /estudio/fin.
 */
export function PracticeSession({
  topic,
  quizOnly = false,
}: {
  topic?: string;
  quizOnly?: boolean;
}) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<AttemptResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const loadSession = useCallback(async (opts: { topic?: string; excludeItemId?: string }) => {
    setLoadError(null);
    setSession(null);
    setSelected(null);
    setResult(null);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = SessionResponseSchema.parse(await res.json());
      setSession(data);
      track("case_started", { itemId: data.item.id, topic: data.item.topic, reason: data.reason });
      if (opts.topic === "weak") track("practice_weak_topic", { topic: data.item.topic });
    } catch {
      setLoadError("No se pudo cargar el caso. Intenta de nuevo.");
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void loadSession({ topic });
  }, [loadSession, topic]);

  useEffect(() => {
    if (result) feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  async function submitAnswer() {
    if (!session || !selected || busy) return;
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId, optionId: selected }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = AttemptResponseSchema.parse(await res.json());
      setResult(data);
      track("case_completed", {
        itemId: session.item.id,
        attempts: data.attemptNumber,
        correct: data.isCorrect,
      });
    } catch {
      setLoadError("No se pudo registrar tu respuesta. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (loadError && !session) {
    return (
      <div className="space-y-4 py-6">
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Button className="w-full" onClick={() => void loadSession({ topic })}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden /> Preparando tu caso…
      </div>
    );
  }

  const { item } = session;
  const optionLabel = (id: string) => `${id}) ${item.options.find((o) => o.id === id)?.text ?? ""}`;

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        {session.study && (
          <Badge className="bg-brand-700" data-testid="study-progress">
            Pregunta {session.study.index} de {session.study.total}
          </Badge>
        )}
        <Badge variant="secondary">{item.specialtyName}</Badge>
        <Badge variant="outline">{item.topic}</Badge>
        {session.reason === "weak" && <Badge className="bg-rose-600">Tema débil</Badge>}
        {session.reason === "thompson" && (
          <Badge variant="outline" className="gap-1">
            <Sparkles className="size-3" aria-hidden /> Recomendado para ti
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg" data-testid="case-title">
            {item.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="leading-relaxed">{item.vignette}</p>
          <p className="font-semibold">{item.question}</p>
          <fieldset className="space-y-2" disabled={Boolean(result) || busy}>
            <legend className="sr-only">Opciones</legend>
            {item.options.map((option) => {
              const isCorrect = result?.correctOptionId === option.id;
              const isWrong =
                result !== null && !result.isCorrect && result.selectedOptionId === option.id;
              const isSelected = !result && selected === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  data-testid={`option-${option.id}`}
                  aria-pressed={isSelected}
                  disabled={Boolean(result) || busy}
                  onClick={() => setSelected(option.id)}
                  className={cn(
                    "flex min-h-12 w-full items-start gap-3 rounded-lg border bg-background p-3 text-left text-[15px] transition-colors",
                    isSelected && "border-primary bg-primary/5 ring-2 ring-primary/30",
                    isWrong &&
                      "border-rose-300 bg-rose-50 text-rose-900 line-through decoration-rose-400",
                    isCorrect && "border-emerald-400 bg-emerald-50 text-emerald-950",
                  )}
                >
                  <span className="font-semibold uppercase">{option.id})</span>
                  <span className="flex-1">{option.text}</span>
                  {isWrong && (
                    <XCircle className="size-5 shrink-0 text-rose-500" aria-label="Tu respuesta" />
                  )}
                  {isCorrect && (
                    <CheckCircle2
                      className="size-5 shrink-0 text-emerald-600"
                      aria-label="Correcta"
                    />
                  )}
                </button>
              );
            })}
          </fieldset>
          {!result && (
            <Button
              className="w-full"
              size="lg"
              disabled={!selected || busy}
              onClick={() => void submitAnswer()}
              data-testid="submit-answer"
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Responder
            </Button>
          )}
          {loadError && (
            <Alert variant="destructive">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && (
        <div ref={feedbackRef} className="scroll-mt-14">
          <Card
            className={result.isCorrect ? "border-emerald-300" : "border-rose-300"}
            data-testid={quizOnly ? "quiz-feedback" : "feedback"}
            data-correct={result.isCorrect}
          >
            <CardHeader className="space-y-1">
              {result.isCorrect ? (
                <CardTitle className="flex items-center gap-2 text-lg text-emerald-700">
                  <CheckCircle2 className="size-6" aria-hidden /> ¡Correcto!
                </CardTitle>
              ) : (
                <>
                  <CardTitle className="flex items-center gap-2 text-lg text-rose-700">
                    <XCircle className="size-6" aria-hidden />{" "}
                    {quizOnly ? "Incorrecto" : "No es la correcta"}
                  </CardTitle>
                  {!quizOnly && (
                    <p className="text-sm text-muted-foreground" data-testid="wrong-summary">
                      Elegiste{" "}
                      <span className="font-semibold">{optionLabel(result.selectedOptionId)}</span>.
                      La respuesta es{" "}
                      <span className="font-semibold text-emerald-700">
                        {optionLabel(result.correctOptionId)}
                      </span>
                      . Tu tutor te explica por qué.
                    </p>
                  )}
                </>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {quizOnly ? (
                !result.isCorrect && (
                  <p data-testid="quiz-correct-answer">
                    Respuesta correcta:{" "}
                    <span className="font-semibold text-emerald-700">
                      {optionLabel(result.correctOptionId)}
                    </span>
                  </p>
                )
              ) : (
                <>
                  <TutorExplanation
                    request={{ sessionId: session.sessionId }}
                    autoLoad
                    placeholder={result.explanation ?? ""}
                    correctLabel={optionLabel(result.correctOptionId)}
                  />
                  <LearningResources resources={result.resources} errorTypes={result.errorTypes} />
                </>
              )}
              {session.study && session.study.index >= session.study.total ? (
                <Link
                  href="/estudio/fin"
                  className={cn(buttonVariants({ size: "lg" }), "w-full")}
                  data-testid="finish-study"
                >
                  Terminar
                </Link>
              ) : (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => void loadSession({ excludeItemId: item.id })}
                  data-testid="next-case"
                >
                  {session.study ? "Siguiente pregunta" : "Siguiente caso"}
                </Button>
              )}
              {!session.study && (
                <Link
                  href="/examen"
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                >
                  Ir al examen simulado
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
