"use client";

import { CheckCircle2, Lightbulb, Loader2, Send, Sparkles, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CitationCard } from "@/components/app/citation-card";
import { SampleContentBadge } from "@/components/app/sample-content-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { streamTutor } from "@/lib/ai/client-stream";
import { track } from "@/lib/analytics/events";
import {
  type AttemptResponse,
  AttemptResponseSchema,
  type SessionResponse,
  SessionResponseSchema,
} from "@/lib/schemas/api";
import { cn } from "@/lib/utils";

type TutorMessage = {
  id: number;
  role: "student" | "tutor";
  text: string;
  hint?: string;
  citation?: { gpcId: string; section: string; snippet: string };
  error?: string;
  streaming?: boolean;
};

type Solved = Extract<AttemptResponse, { isCorrect: true }>;

export function PracticeSession({ topic }: { topic?: string }) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [solved, setSolved] = useState<Solved | null>(null);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [tutorBusy, setTutorBusy] = useState(false);
  const started = useRef(false);
  const nextId = useRef(1);
  const chatEnd = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const loadSession = useCallback(
    async (opts: { topic?: string; excludeItemId?: string }) => {
      setLoadError(null);
      setSession(null);
      setSelected(null);
      setWrong([]);
      setSolved(null);
      setMessages([]);
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
    },
    [],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void loadSession({ topic });
  }, [loadSession, topic]);

  useEffect(() => {
    if (messages.length > 0) chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (solved) feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [solved]);

  const askTutor = useCallback(
    async (body: { optionId?: string; message?: string }) => {
      if (!session) return;
      setTutorBusy(true);
      const tutorId = nextId.current++;
      setMessages((prev) => [...prev, { id: tutorId, role: "tutor", text: "", streaming: true }]);
      const update = (fn: (m: TutorMessage) => TutorMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === tutorId ? fn(m) : m)));

      try {
        await streamTutor({ sessionId: session.sessionId, ...body }, (event) => {
          switch (event.type) {
            case "text":
              update((m) => ({ ...m, text: m.text + event.delta }));
              break;
            case "hint":
              update((m) => ({ ...m, hint: event.text }));
              track("hint_shown", { itemId: session.item.id });
              break;
            case "citation":
              update((m) => ({
                ...m,
                citation: { gpcId: event.gpcId, section: event.section, snippet: event.snippet },
              }));
              break;
            case "error":
              update((m) => ({ ...m, error: event.message }));
              break;
            case "done":
              break;
          }
        });
      } catch {
        update((m) => ({ ...m, error: "El tutor no está disponible. Intenta de nuevo." }));
      } finally {
        update((m) => ({ ...m, streaming: false }));
        setTutorBusy(false);
      }
    },
    [session],
  );

  async function submitAnswer() {
    if (!session || !selected || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId, optionId: selected }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const result = AttemptResponseSchema.parse(await res.json());
      if (result.isCorrect) {
        setSolved(result);
        track("case_completed", { itemId: session.item.id, attempts: result.attemptNumber });
      } else {
        const optionId = selected;
        setWrong((w) => [...w, optionId]);
        setSelected(null);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId.current++,
            role: "student",
            text: `Elegí ${optionId}) ${session.item.options.find((o) => o.id === optionId)?.text ?? ""}`,
          },
        ]);
        await askTutor({ optionId });
      }
    } catch {
      setLoadError("No se pudo registrar tu respuesta. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text || tutorBusy) return;
    setDraft("");
    setMessages((prev) => [...prev, { id: nextId.current++, role: "student", text }]);
    await askTutor({ message: text });
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

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
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
          {item.isSample && <SampleContentBadge />}
          <CardTitle className="text-lg" data-testid="case-title">
            {item.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="leading-relaxed">{item.vignette}</p>
          <p className="font-semibold">{item.question}</p>
          <fieldset className="space-y-2" disabled={Boolean(solved) || busy}>
            <legend className="sr-only">Opciones</legend>
            {item.options.map((option) => {
              const isWrong = wrong.includes(option.id);
              const isCorrect = solved?.correctOptionId === option.id;
              const isSelected = selected === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  data-testid={`option-${option.id}`}
                  aria-pressed={isSelected}
                  disabled={isWrong || Boolean(solved) || busy}
                  onClick={() => setSelected(option.id)}
                  className={cn(
                    "flex min-h-12 w-full items-start gap-3 rounded-lg border bg-background p-3 text-left text-[15px] transition-colors",
                    isSelected && "border-primary bg-primary/5 ring-2 ring-primary/30",
                    isWrong && "border-rose-300 bg-rose-50 text-rose-900 line-through decoration-rose-400",
                    isCorrect && "border-emerald-400 bg-emerald-50 text-emerald-950",
                  )}
                >
                  <span className="font-semibold uppercase">{option.id})</span>
                  <span className="flex-1">{option.text}</span>
                  {isWrong && <XCircle className="size-5 shrink-0 text-rose-500" aria-label="Incorrecta" />}
                  {isCorrect && (
                    <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-label="Correcta" />
                  )}
                </button>
              );
            })}
          </fieldset>
          {!solved && (
            <Button
              className="w-full"
              size="lg"
              disabled={!selected || busy || tutorBusy}
              onClick={() => void submitAnswer()}
              data-testid="submit-answer"
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Responder
            </Button>
          )}
        </CardContent>
      </Card>

      {messages.length > 0 && (
        <Card data-testid="tutor-chat">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-5 text-primary" aria-hidden /> Tutor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {messages.map((m) =>
              m.role === "student" ? (
                <p
                  key={m.id}
                  className="ml-8 rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                >
                  {m.text}
                </p>
              ) : (
                <div key={m.id} className="mr-4 space-y-2" data-testid="tutor-message">
                  <p className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-[15px] leading-relaxed">
                    {m.text}
                    {m.streaming && !m.text && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" aria-hidden /> Pensando…
                      </span>
                    )}
                    {m.streaming && m.text && <span className="ml-0.5 animate-pulse">▍</span>}
                  </p>
                  {m.hint && (
                    <p
                      className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950"
                      data-testid="tutor-hint"
                    >
                      <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden /> {m.hint}
                    </p>
                  )}
                  {m.citation && (
                    <CitationCard
                      gpcId={m.citation.gpcId}
                      section={m.citation.section}
                      snippet={m.citation.snippet}
                    />
                  )}
                  {m.error && (
                    <Alert variant="destructive">
                      <AlertDescription>{m.error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              ),
            )}
            {!solved && (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage();
                }}
              >
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Responde al tutor…"
                  rows={2}
                  maxLength={1000}
                  className="min-h-11 flex-1 resize-none text-base"
                  aria-label="Mensaje para el tutor"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!draft.trim() || tutorBusy}
                  aria-label="Enviar"
                >
                  <Send aria-hidden />
                </Button>
              </form>
            )}
            <div ref={chatEnd} />
          </CardContent>
        </Card>
      )}

      {solved && (
        <div ref={feedbackRef} className="scroll-mt-14">
          <Card className="border-emerald-300" data-testid="feedback">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-emerald-700">
                <CheckCircle2 className="size-6" aria-hidden /> ¡Correcto!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="leading-relaxed">{solved.explanation}</p>
              <CitationCard
                gpcId={solved.citation.gpcId}
                gpcTitle={solved.citation.gpcTitle}
                section={solved.citation.section}
                snippet={solved.citation.snippet}
              />
              <p className="text-xs text-muted-foreground">
                {solved.attemptNumber === 1
                  ? "Lo resolviste al primer intento."
                  : `Lo resolviste en ${solved.attemptNumber} intentos con ayuda del tutor.`}
              </p>
              <Button
                className="w-full"
                size="lg"
                onClick={() => void loadSession({ excludeItemId: item.id })}
                data-testid="next-case"
              >
                Siguiente caso
              </Button>
              <Link href="/examen" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
                Ir al examen simulado
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
