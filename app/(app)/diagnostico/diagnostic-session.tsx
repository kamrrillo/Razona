"use client";

import { Bot, CheckCircle2, Loader2, MicOff, Send, Sparkles, XCircle } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { CitationCard } from "@/components/app/citation-card";
import { LogoMark } from "@/components/app/logo";
import { SampleContentBadge } from "@/components/app/sample-content-badge";
import { SpecialtyBars } from "@/components/app/specialty-bars";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type DiagnosticResponse, DiagnosticResponseSchema } from "@/lib/schemas/diagnostic";
import { cn } from "@/lib/utils";

type ChatLine = { id: number; role: "agent" | "student"; text: string };

async function post(path: string, body: unknown): Promise<DiagnosticResponse> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      json && typeof json === "object" && "error" in json && typeof json.error === "string"
        ? json.error
        : "No se pudo completar la acción.";
    throw new Error(message);
  }
  return DiagnosticResponseSchema.parse(json);
}

export function DiagnosticSession() {
  const [data, setData] = useState<DiagnosticResponse | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [busy, setBusy] = useState<"start" | "answer" | "message" | "grade" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const nextId = useRef(1);

  function apply(response: DiagnosticResponse, studentText?: string) {
    setData(response);
    const lines: ChatLine[] = [];
    if (studentText) lines.push({ id: nextId.current++, role: "student", text: studentText });
    for (const r of response.respuestas) {
      lines.push({ id: nextId.current++, role: "agent", text: r.texto });
    }
    setChat((prev) => [...prev, ...lines]);
  }

  async function run(kind: NonNullable<typeof busy>, fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo salió mal.");
    } finally {
      setBusy(null);
    }
  }

  const start = () =>
    run("start", async () => {
      setChat([]);
      apply(await post("/api/diagnostico/start", {}));
    });

  const answer = (itemId: string, optionId: string) =>
    run("answer", async () => {
      if (!data) return;
      apply(
        await post("/api/diagnostico/answer", { sessionId: data.session_id, itemId, optionId }),
      );
    });

  const grade = () =>
    run("grade", async () => {
      if (!data) return;
      apply(await post("/api/diagnostico/grade", { sessionId: data.session_id }));
    });

  const send = () =>
    run("message", async () => {
      const text = draft.trim();
      if (!data || !text) return;
      setDraft("");
      apply(await post("/api/diagnostico/message", { sessionId: data.session_id, text }), text);
    });

  if (!data) {
    return (
      <div className="space-y-4 py-4">
        <h1 className="text-2xl font-extrabold text-brand-900">Diagnóstico con IA</h1>
        <Card>
          <CardHeader className="space-y-2">
            <SampleContentBadge />
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-5 text-primary" aria-hidden /> Agente de diagnóstico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Un agente con Google ADK arma un examen balanceado por especialidad con reactivos de
              la base de datos, te acompaña sin darte pistas y al final te explica tus resultados
              con la cita de la GPC.
            </p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• 2 reactivos por especialidad</li>
              <li>• Tutor apagado hasta calificar</li>
              <li>• Tus resultados actualizan tu tema débil</li>
            </ul>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              size="lg"
              className="w-full"
              onClick={() => void start()}
              disabled={busy !== null}
              data-testid="start-diagnostic"
            >
              {busy === "start" && <Loader2 className="animate-spin" aria-hidden />}
              Comenzar diagnóstico
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { estado } = data;
  const item = estado.reactivo_actual;
  const result = estado.resultado;
  const pct = Math.round((estado.respondidas / estado.total) * 100);

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-brand-900">Diagnóstico con IA</h1>
        {data.agente_disponible ? (
          <Badge className="gap-1 bg-aqua-500">
            <Sparkles className="size-3" aria-hidden /> Agente ADK
          </Badge>
        ) : (
          <Badge variant="outline" title="Falta la clave de Gemini en el servidor del agente">
            Sin narración del agente
          </Badge>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MicOff className="size-3" aria-hidden /> Tutor apagado
          </span>
          <span data-testid="diagnostic-progress">
            {estado.respondidas}/{estado.total} respondidos
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-brand-100">
          <div
            className="h-full rounded-full bg-brand-gradient transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {chat.length > 0 && (
        <div className="space-y-2" data-testid="agent-chat">
          {chat.slice(-4).map((line) =>
            line.role === "agent" ? (
              <div key={line.id} className="flex items-start gap-2">
                <LogoMark className="size-8 shrink-0" />
                <p className="rounded-2xl rounded-tl-sm border-2 border-brand-100 bg-white px-3 py-2 text-[15px] leading-relaxed whitespace-pre-line">
                  {line.text}
                </p>
              </div>
            ) : (
              <p
                key={line.id}
                className="ml-10 rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
              >
                {line.text}
              </p>
            ),
          )}
        </div>
      )}
      {busy === "message" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> El agente está escribiendo…
        </p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {item && (
        <Card data-testid="diagnostic-item">
          <CardHeader className="space-y-2">
            {item.is_sample && <SampleContentBadge />}
            <p className="text-xs text-muted-foreground">
              Reactivo {item.numero} de {estado.total} · {item.specialty_name}
            </p>
            <CardTitle className="text-base leading-relaxed font-normal">{item.vignette}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-semibold">{item.question}</p>
            {item.options.map((o) => (
              <button
                key={o.id}
                type="button"
                disabled={busy !== null}
                onClick={() => void answer(item.id, o.id)}
                data-testid={`diagnostic-option-${o.id}`}
                className="flex min-h-12 w-full items-start gap-3 rounded-xl border-2 border-border bg-background p-3 text-left text-[15px] shadow-[0_3px_0_0_var(--border)] transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60"
              >
                <span className="font-bold uppercase text-brand-700">{o.id})</span>
                <span>{o.text}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {!result && (
        <Button
          size="lg"
          variant={item ? "outline" : "default"}
          className="w-full"
          onClick={() => void grade()}
          disabled={busy !== null || estado.respondidas === 0}
          data-testid="grade-diagnostic"
        >
          {busy === "grade" && <Loader2 className="animate-spin" aria-hidden />}
          {item ? "Terminar y calificar ahora" : "Calificar diagnóstico"}
        </Button>
      )}

      {result && (
        <div className="space-y-4" data-testid="diagnostic-result">
          <Card>
            <CardContent className="flex items-center gap-4">
              <div
                className={cn(
                  "flex size-20 shrink-0 items-center justify-center rounded-full text-2xl font-extrabold",
                  result.score >= 70 ? "bg-aqua-200 text-aqua-700" : "bg-amber-100 text-amber-900",
                )}
              >
                {Math.round(result.score)}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Calificación del diagnóstico</p>
                <p className="text-xl font-bold">
                  {result.correct}/{result.total} aciertos
                </p>
                {result.overall_weak_topic && (
                  <p className="text-sm text-muted-foreground">
                    Tema débil:{" "}
                    <span className="font-semibold">{result.overall_weak_topic.topic}</span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Por especialidad</CardTitle>
            </CardHeader>
            <CardContent>
              <SpecialtyBars
                items={result.by_specialty.map((s) => ({
                  specialtyId: s.specialty_id,
                  name: s.name,
                  correct: s.correct,
                  total: s.total,
                  accuracy: s.accuracy,
                }))}
              />
            </CardContent>
          </Card>

          <Link
            href="/practicar?topic=weak"
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
            data-testid="practice-weak-topic"
          >
            Practicar mi tema débil
          </Link>

          <section className="space-y-2">
            <h2 className="font-bold text-brand-900">Revisión</h2>
            {result.review.map((r, i) => (
              <details key={r.item_id} className="rounded-xl border bg-card">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 p-3 text-sm">
                  {r.is_correct ? (
                    <CheckCircle2 className="size-5 shrink-0 text-aqua-600" aria-label="Correcto" />
                  ) : (
                    <XCircle className="size-5 shrink-0 text-rose-500" aria-label="Incorrecto" />
                  )}
                  <span>
                    <span className="font-semibold">{i + 1}.</span> {r.question}
                  </span>
                </summary>
                <div className="space-y-2 border-t p-3 text-sm">
                  <p>
                    Tu respuesta: {r.selected_option ?? "sin responder"} · Correcta:{" "}
                    <span className="text-aqua-700">
                      {r.correct_option}) {r.correct_option_text}
                    </span>
                  </p>
                  <p>{r.explanation}</p>
                  <CitationCard
                    gpcId={r.citation.gpc_id}
                    gpcTitle={r.citation.gpc_title}
                    section={r.citation.section}
                    snippet={r.citation.snippet}
                  />
                </div>
              </details>
            ))}
          </section>
          <Button variant="outline" className="w-full" onClick={() => setData(null)}>
            Nuevo diagnóstico
          </Button>
        </div>
      )}

      {data.agente_disponible && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={result ? "Pregúntale al agente por tus resultados…" : "Escribe al agente…"}
            maxLength={1000}
            className="h-11 text-base"
            aria-label="Mensaje para el agente"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!draft.trim() || busy !== null}
            aria-label="Enviar"
          >
            <Send aria-hidden />
          </Button>
        </form>
      )}
    </div>
  );
}
