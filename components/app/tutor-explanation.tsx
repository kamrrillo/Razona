"use client";

import { Compass, Lightbulb, Loader2, Sparkles, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import {
  type TutorExplanation as Explanation,
  TutorExplanationSchema,
} from "@/lib/schemas/explanation";
import { cn } from "@/lib/utils";
import { ConceptDiagram } from "./concept-diagram";

type ExplainRequest = { sessionId: string } | { examId: string; itemId: string };

export function TutorExplanationView({
  explanation: e,
  correctLabel,
}: {
  explanation: Explanation;
  /** "c) Medidas de soporte…" */
  correctLabel?: string;
}) {
  return (
    <div className="space-y-4" data-testid="tutor-explanation" data-source={e.source}>
      <div className="flex gap-2.5">
        <LogoMark className="mt-0.5 size-8 shrink-0" />
        <div
          className="rounded-2xl rounded-tl-sm bg-[#effcf9] px-3.5 py-2.5 text-[15px] leading-relaxed text-brand-950 ring-1 ring-aqua-200"
          data-testid="tutor-personal"
        >
          {e.personal}
        </div>
      </div>

      <section className="space-y-1.5">
        <h3 className="text-sm font-extrabold tracking-wide text-brand-800">
          ¿Por qué es {correctLabel ? `la ${correctLabel}` : "la respuesta correcta"}?
        </h3>
        <p className="leading-relaxed" data-testid="tutor-why">
          {e.why}
        </p>
      </section>

      <ConceptDiagram diagram={e.diagram} />

      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-sm font-extrabold tracking-wide text-brand-800">
          <Lightbulb className="size-4 text-amber-500" aria-hidden /> Fundamentos
        </h3>
        <ol className="space-y-2" data-testid="tutor-fundamentals">
          {e.fundamentals.map((f, i) => (
            <li
              key={f.title}
              className="flex gap-2.5 rounded-xl bg-white p-2.5 ring-1 ring-brand-100"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-extrabold text-white">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed">
                <span className="font-bold text-brand-950">{f.title}. </span>
                {f.text}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {e.distractors.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-extrabold tracking-wide text-brand-800">
            ¿Por qué no las otras?
          </h3>
          <ul className="space-y-2" data-testid="tutor-distractors">
            {e.distractors.map((d) => (
              <li
                key={d.optionId}
                className={cn(
                  "rounded-xl p-2.5 text-sm leading-relaxed ring-1",
                  d.chosen ? "bg-rose-50 ring-rose-200" : "bg-white ring-brand-100",
                )}
              >
                <p className="mb-0.5 flex flex-wrap items-center gap-1.5 font-bold text-brand-950">
                  <XCircle className="size-4 text-rose-500" aria-hidden />
                  {d.optionId}) {d.optionText}
                  {d.chosen && (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                      TU ELECCIÓN
                    </span>
                  )}
                </p>
                {d.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-2 rounded-xl bg-brand-900 p-3 text-sm leading-relaxed text-white">
        <Compass className="mt-0.5 size-4 shrink-0 text-aqua-300" aria-hidden />
        <p>
          <span className="font-bold">Tu siguiente paso: </span>
          {e.nextStep}
        </p>
      </div>

      <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
        {e.source === "adk" ? (
          <>
            <Sparkles className="mt-px size-3 shrink-0" aria-hidden /> Explicación generada con IA a
            partir del reactivo, la GPC y tu historial. Las recomendaciones clínicas salen solo de
            la GPC citada.
          </>
        ) : (
          "Explicación construida con el reactivo, la GPC y tu historial."
        )}
      </p>
    </div>
  );
}

/** Pide la explicación personalizada a /api/explain. Con `autoLoad` la carga al montarse. */
export function TutorExplanation({
  request,
  autoLoad = false,
  placeholder,
  correctLabel,
  className,
}: {
  request: ExplainRequest;
  autoLoad?: boolean;
  /** Texto a mostrar mientras llega la explicación (la explicación base del reactivo). */
  placeholder?: string;
  correctLabel?: string;
  className?: string;
}) {
  const [data, setData] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);
  const body = JSON.stringify(request);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) throw new Error(String(res.status));
      setData(TutorExplanationSchema.parse(await res.json()));
    } catch {
      setError("No se pudo preparar la explicación.");
    } finally {
      setLoading(false);
    }
  }, [body]);

  useEffect(() => {
    if (autoLoad && !requested.current) {
      requested.current = true;
      void load();
    }
  }, [autoLoad, load]);

  if (data) {
    return (
      <div className={className}>
        <TutorExplanationView explanation={data} correctLabel={correctLabel} />
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {placeholder && <p className="leading-relaxed">{placeholder}</p>}
      {loading ? (
        <div
          className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/60 px-4 text-center text-sm text-brand-700"
          data-testid="explanation-loading"
        >
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Tu tutor está revisando tu respuesta y armando el diagrama del tema…
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => void load()}
          data-testid="load-explanation"
        >
          <Sparkles aria-hidden /> {error ? "Reintentar explicación" : "Explícamelo, tutor"}
        </Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
