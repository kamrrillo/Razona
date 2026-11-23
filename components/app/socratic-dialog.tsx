"use client";

import { Flag, Loader2, MessageCircleQuestion, Send } from "lucide-react";
import { useRef, useState } from "react";
import { LogoMark } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { track } from "@/lib/analytics/events";
import {
  type ExplainRequest,
  SOCRATIC_LEVELS,
  SocraticReplySchema,
  type SocraticTurn,
} from "@/lib/schemas/explanation";
import { cn } from "@/lib/utils";

const LEVEL_LABEL: Record<(typeof SOCRATIC_LEVELS)[number], string> = {
  recordar: "Recordar",
  comprender: "Comprender",
  aplicar: "Aplicar",
  analizar: "Analizar",
  transferir: "Transferir",
};

/** Escalera de niveles: muestra cuánto ha profundizado en el tema. */
function LevelLadder({ level, done }: { level: number; done: boolean }) {
  return (
    <ol className="flex gap-1" aria-label={`Nivel ${level} de ${SOCRATIC_LEVELS.length}`}>
      {SOCRATIC_LEVELS.map((name, i) => {
        const reached = done || i + 1 < level;
        const current = !done && i + 1 === level;
        return (
          <li key={name} className="flex-1">
            <span
              className={cn(
                "block h-1.5 rounded-full",
                reached ? "bg-aqua-500" : current ? "bg-brand-500" : "bg-brand-100",
              )}
            />
            <span
              className={cn(
                "mt-1 block text-center text-[10px] font-bold",
                current ? "text-brand-800" : "text-muted-foreground",
              )}
            >
              {LEVEL_LABEL[name]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Cierre de la explicación: una pregunta socrática y un diálogo que sube de nivel poco a poco
 * (recordar → transferir). La conversación vive en el cliente; el servidor valida el reactivo.
 */
export function SocraticDialog({
  target,
  question,
}: {
  target: ExplainRequest;
  /** Primera pregunta (la genera la explicación). */
  question: string;
}) {
  const [turns, setTurns] = useState<(SocraticTurn & { id: number })[]>([
    { id: 0, role: "tutor", text: question },
  ]);
  const [level, setLevel] = useState(1);
  const [done, setDone] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(1);
  const end = useRef<HTMLDivElement>(null);

  async function send() {
    const answer = draft.trim();
    if (!answer || busy || done) return;
    setBusy(true);
    setError(null);
    const history = turns.slice(-15).map(({ role, text }) => ({ role, text }));
    setTurns((t) => [...t, { id: nextId.current++, role: "student", text: answer }]);
    setDraft("");
    try {
      const res = await fetch("/api/explain/socratic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, history, answer, level }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const reply = SocraticReplySchema.parse(await res.json());
      setTurns((t) => [
        ...t,
        { id: nextId.current++, role: "tutor", text: reply.feedback },
        ...(reply.nextQuestion
          ? [{ id: nextId.current++, role: "tutor" as const, text: reply.nextQuestion }]
          : []),
      ]);
      setLevel(reply.level);
      setDone(reply.done);
      track("socratic_turn", { level: reply.level, done: reply.done, source: reply.source });
    } catch {
      setError("El tutor no pudo responder. Intenta de nuevo.");
      setTurns((t) => t.slice(0, -1));
      setDraft(answer);
    } finally {
      setBusy(false);
      requestAnimationFrame(() =>
        end.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
      );
    }
  }

  return (
    <section
      className="space-y-3 rounded-2xl bg-white p-3 ring-2 ring-brand-200"
      data-testid="socratic-dialog"
    >
      <h3 className="flex items-center gap-1.5 text-sm font-extrabold tracking-wide text-brand-800">
        <MessageCircleQuestion className="size-4 text-brand-600" aria-hidden /> Sigue razonando con
        tu tutor
      </h3>
      <LevelLadder level={level} done={done} />

      <div className="space-y-2" aria-live="polite">
        {turns.map((t) =>
          t.role === "tutor" ? (
            <div key={t.id} className="flex gap-2">
              <LogoMark className="mt-0.5 size-6 shrink-0" />
              <p
                className="rounded-2xl rounded-tl-sm bg-[#effcf9] px-3 py-2 text-[15px] leading-relaxed text-brand-950 ring-1 ring-aqua-200"
                data-testid="socratic-tutor"
              >
                {t.text}
              </p>
            </div>
          ) : (
            <p
              key={t.id}
              className="ml-8 rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              {t.text}
            </p>
          ),
        )}
        {busy && (
          <p className="flex items-center gap-1.5 pl-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Tu tutor está leyendo tu
            razonamiento…
          </p>
        )}
      </div>

      {done ? (
        <p className="flex items-center gap-2 rounded-xl bg-aqua-500/10 p-2.5 text-sm font-bold text-aqua-700">
          <Flag className="size-4" aria-hidden /> ¡Completaste la escalera de este tema!
        </p>
      ) : (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Escribe tu razonamiento…"
            rows={2}
            maxLength={1000}
            className="min-h-11 flex-1 resize-none text-base"
            aria-label="Tu respuesta a la pregunta socrática"
            data-testid="socratic-input"
          />
          <Button type="submit" size="icon" disabled={!draft.trim() || busy} aria-label="Enviar">
            <Send aria-hidden />
          </Button>
        </form>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div ref={end} />
    </section>
  );
}
