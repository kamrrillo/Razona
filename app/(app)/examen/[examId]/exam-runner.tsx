"use client";

import { ChevronLeft, ChevronRight, Clock, Loader2, MicOff, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SampleContentBadge } from "@/components/app/sample-content-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { track } from "@/lib/analytics/events";
import { ExamGradeResponseSchema } from "@/lib/schemas/api";
import type { PublicItem } from "@/lib/schemas/content";
import { cn } from "@/lib/utils";

type Props = {
  examId: string;
  title: string;
  items: PublicItem[];
  initialAnswers: Record<string, string>;
  endsAt: number;
  demoMode: boolean;
};

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ExamRunner({ examId, title, items, initialAnswers, endsAt, demoMode }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(() => {
    const firstUnanswered = items.findIndex((i) => !(i.id in initialAnswers));
    return firstUnanswered === -1 ? 0 : firstUnanswered;
  });
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [remaining, setRemaining] = useState(() => endsAt - Date.now());
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gradingRef = useRef(false);

  const grade = useCallback(
    async (fillDemo: boolean) => {
      if (gradingRef.current) return;
      gradingRef.current = true;
      setGrading(true);
      setError(null);
      try {
        const res = await fetch("/api/exam/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ examId, fillDemo }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const result = ExamGradeResponseSchema.parse(await res.json());
        track("exam_finished", { examId, score: result.score, fillDemo });
        router.replace(`/examen/${examId}/resultados`);
      } catch {
        gradingRef.current = false;
        setGrading(false);
        setError("No se pudo calificar el examen. Intenta de nuevo.");
      }
    },
    [examId, router],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const left = endsAt - Date.now();
      setRemaining(left);
      if (left <= 0) {
        clearInterval(timer);
        void grade(false);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [endsAt, grade]);

  async function choose(itemId: string, optionId: string) {
    const previous = answers[itemId];
    setAnswers((a) => ({ ...a, [itemId]: optionId }));
    setError(null);
    try {
      const res = await fetch("/api/exam/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, itemId, optionId }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setAnswers((a) => {
        const next = { ...a };
        if (previous) next[itemId] = previous;
        else delete next[itemId];
        return next;
      });
      setError("No se guardó tu respuesta. Vuelve a elegirla.");
    }
  }

  const item = items[index];
  const answeredCount = Object.keys(answers).length;
  const lowTime = remaining < 60_000;

  return (
    <div className="space-y-4 py-4">
      <div className="sticky top-[calc(env(safe-area-inset-top)+2.25rem)] z-30 -mx-4 flex items-center justify-between gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MicOff className="size-3" aria-hidden /> Tutor apagado · {answeredCount}/{items.length}{" "}
            respondidos
          </p>
        </div>
        <Badge
          variant={lowTime ? "destructive" : "secondary"}
          className="h-9 gap-1 px-3 text-base tabular-nums"
          data-testid="exam-timer"
        >
          <Clock className="size-4" aria-hidden /> {formatClock(remaining)}
        </Badge>
      </div>

      <nav aria-label="Reactivos" className="grid grid-cols-5 gap-2">
        {items.map((it, i) => (
          <button
            key={it.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-current={i === index ? "step" : undefined}
            aria-label={`Reactivo ${i + 1}${answers[it.id] ? ", respondido" : ""}`}
            className={cn(
              "h-11 rounded-lg border text-sm font-semibold",
              answers[it.id] ? "border-primary/40 bg-primary/10 text-primary" : "bg-background",
              i === index && "ring-2 ring-primary",
            )}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      <Card>
        <CardHeader className="space-y-2">
          <SampleContentBadge />
          <p className="text-xs text-muted-foreground">
            Reactivo {index + 1} de {items.length} · {item.specialtyName}
          </p>
          <CardTitle className="text-base leading-relaxed font-normal">{item.vignette}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="font-semibold" data-testid="exam-question">
            {item.question}
          </p>
          {item.options.map((option) => {
            const selected = answers[item.id] === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={grading}
                aria-pressed={selected}
                data-testid={`exam-option-${option.id}`}
                onClick={() => void choose(item.id, option.id)}
                className={cn(
                  "flex min-h-12 w-full items-start gap-3 rounded-lg border bg-background p-3 text-left text-[15px]",
                  selected && "border-primary bg-primary/5 ring-2 ring-primary/30",
                )}
              >
                <span className="font-semibold uppercase">{option.id})</span>
                <span>{option.text}</span>
              </button>
            );
          })}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
            >
              <ChevronLeft aria-hidden /> Anterior
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={index === items.length - 1}
              onClick={() => setIndex((i) => i + 1)}
              data-testid="exam-next"
            >
              Siguiente <ChevronRight aria-hidden />
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        {demoMode && answeredCount < items.length && (
          <Button
            size="lg"
            className="w-full"
            onClick={() => void grade(true)}
            disabled={grading}
            data-testid="complete-exam-demo"
          >
            {grading ? <Loader2 className="animate-spin" aria-hidden /> : <Wand2 aria-hidden />}
            Completar examen (demo)
          </Button>
        )}
        <Button
          size="lg"
          variant={answeredCount === items.length ? "default" : "outline"}
          className="w-full"
          onClick={() => void grade(false)}
          disabled={grading}
          data-testid="finish-exam"
        >
          Terminar y calificar
        </Button>
      </div>
    </div>
  );
}
