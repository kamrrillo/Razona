"use client";

import { ChevronLeft, ChevronRight, Layers, Loader2, Sparkles, Workflow } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { wrapTitle } from "@/lib/ai/diagram";
import {
  type ExplanationDiagram as Diagram,
  type DiagramStepKind,
  ExplanationDiagramSchema,
} from "@/lib/schemas/diagram";
import { cn } from "@/lib/utils";

const W = 320;
const NODE_W = 252;
const NODE_H = 66;
const GAP = 30;
const ROW = NODE_H + GAP;
const PAD = 8;
const OFFSETS = [-18, 18];

const KIND: Record<
  DiagramStepKind,
  { label: string; fill: string; stroke: string; badge: string; text: string; sub: string }
> = {
  dato: {
    label: "DATO CLAVE",
    fill: "#ecfbfd",
    stroke: "#0f9bb8",
    badge: "#0f9bb8",
    text: "#0b2a3c",
    sub: "#0d647d",
  },
  razonamiento: {
    label: "RAZONAMIENTO",
    fill: "#e6fbf6",
    stroke: "#14b8a6",
    badge: "#0d9488",
    text: "#0b2a3c",
    sub: "#0f766e",
  },
  descarte: {
    label: "DESCARTE",
    fill: "#fff1f2",
    stroke: "#f43f5e",
    badge: "#e11d48",
    text: "#4c0519",
    sub: "#be123c",
  },
  decision: {
    label: "DECISIÓN",
    fill: "#0b7d9a",
    stroke: "#0d647d",
    badge: "#ffffff",
    text: "#ffffff",
    sub: "#cff4f9",
  },
  gpc: {
    label: "GPC",
    fill: "#082c3b",
    stroke: "#134457",
    badge: "#5eead4",
    text: "#ffffff",
    sub: "#a7f3e4",
  },
};

function nodeX(i: number) {
  return (W - NODE_W) / 2 + OFFSETS[i % OFFSETS.length];
}

export function ExplanationDiagram({ diagram }: { diagram: Diagram }) {
  const [step, setStep] = useState(0);
  const titleId = useId();
  const n = diagram.steps.length;
  // El lienzo crece con cada paso: el diagrama "se construye" hacia abajo.
  const height = (step + 1) * ROW - GAP + PAD * 2 + 6;
  const current = diagram.steps[step];
  const kind = KIND[current.kind];

  return (
    <div className="space-y-3" data-testid="explanation-diagram">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-bold text-brand-900">
          <Workflow className="size-4 text-primary" aria-hidden /> {diagram.title}
        </p>
        <span
          className="text-xs font-semibold tabular-nums text-muted-foreground"
          data-testid="diagram-step"
        >
          Paso {step + 1} de {n}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="mx-auto block w-full max-w-[360px]"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>
          {`${diagram.title}: ${diagram.steps.map((s, i) => `${i + 1}. ${s.title}`).join(". ")}`}
        </title>
        <defs>
          <marker
            id={`${titleId}-arrow`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="#67d4e6" />
          </marker>
        </defs>

        {diagram.steps.slice(1).map((s, idx) => {
          const i = idx + 1;
          const x1 = nodeX(i - 1) + NODE_W / 2;
          const y1 = PAD + (i - 1) * ROW + NODE_H;
          const x2 = nodeX(i) + NODE_W / 2;
          const y2 = PAD + i * ROW - 3;
          const mid = (y2 - y1) / 2;
          return (
            <path
              key={`edge-${s.title}`}
              d={`M ${x1} ${y1} C ${x1} ${y1 + mid}, ${x2} ${y2 - mid}, ${x2} ${y2}`}
              fill="none"
              stroke="#67d4e6"
              strokeWidth="3"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={i <= step ? 0 : 1}
              markerEnd={i <= step ? `url(#${titleId}-arrow)` : undefined}
              opacity={i <= step ? 1 : 0}
              style={{ transition: "stroke-dashoffset 450ms ease-out" }}
            />
          );
        })}

        {diagram.steps.map((s, i) => {
          const k = KIND[s.kind];
          const x = nodeX(i);
          const y = PAD + i * ROW;
          const visible = i <= step;
          const active = i === step;
          const lines = wrapTitle(s.title);
          return (
            <g
              key={`${s.kind}-${s.title}`}
              style={{
                opacity: visible ? 1 : 0,
                transform: `translateY(${visible ? 0 : 10}px)`,
                transition: "opacity 400ms ease-out 150ms, transform 400ms ease-out 150ms",
              }}
              data-testid="diagram-node"
              data-visible={visible}
            >
              {active && (
                <rect
                  x={x - 4}
                  y={y - 4}
                  width={NODE_W + 8}
                  height={NODE_H + 8}
                  rx="18"
                  fill="none"
                  stroke="#2dd4bf"
                  strokeWidth="3"
                  opacity="0.6"
                />
              )}
              <rect
                x={x}
                y={y + 4}
                width={NODE_W}
                height={NODE_H}
                rx="14"
                fill={k.stroke}
                opacity="0.35"
              />
              <rect
                x={x}
                y={y}
                width={NODE_W}
                height={NODE_H}
                rx="14"
                fill={k.fill}
                stroke={k.stroke}
                strokeWidth="2"
              />
              <circle cx={x + 26} cy={y + NODE_H / 2} r="15" fill={k.badge} />
              <text
                x={x + 26}
                y={y + NODE_H / 2 + 5}
                textAnchor="middle"
                fontSize="14"
                fontWeight="800"
                fill={s.kind === "decision" ? "#0b7d9a" : s.kind === "gpc" ? "#082c3b" : "#ffffff"}
              >
                {i + 1}
              </text>
              <text
                x={x + 52}
                y={y + 18}
                fontSize="9.5"
                fontWeight="800"
                letterSpacing="0.8"
                fill={k.sub}
              >
                {k.label}
              </text>
              {lines.map((line, li) => (
                <text
                  key={line}
                  x={x + 52}
                  y={y + 36 + li * 16}
                  fontSize="13.5"
                  fontWeight="700"
                  fill={k.text}
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}
      </svg>

      <div
        className="rounded-2xl border-2 p-3"
        style={{
          borderColor: kind.stroke,
          background: current.kind === "decision" || current.kind === "gpc" ? "#f2fafc" : kind.fill,
        }}
        aria-live="polite"
        data-testid="diagram-detail"
      >
        <p
          className="text-[11px] font-extrabold tracking-wide"
          style={{
            color:
              current.kind === "gpc" ? "#0d647d" : kind.sub === "#cff4f9" ? "#0b7d9a" : kind.sub,
          }}
        >
          {step + 1}. {kind.label}
        </p>
        <p className="font-bold text-brand-950">{current.title}</p>
        <p className="mt-1 text-[15px] leading-relaxed">{current.detail}</p>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ChevronLeft aria-hidden /> Anterior
        </Button>
        {step < n - 1 ? (
          <Button
            className="flex-1"
            onClick={() => setStep((s) => Math.min(n - 1, s + 1))}
            data-testid="diagram-next"
          >
            Siguiente paso <ChevronRight aria-hidden />
          </Button>
        ) : (
          <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>
            Repetir
          </Button>
        )}
      </div>
      {step < n - 1 && (
        <button
          type="button"
          onClick={() => setStep(n - 1)}
          className="flex min-h-11 w-full items-center justify-center gap-1 text-sm font-semibold text-brand-700"
        >
          <Layers className="size-4" aria-hidden /> Ver el diagrama completo
        </button>
      )}

      <ol className="sr-only">
        {diagram.steps.map((s) => (
          <li key={`sr-${s.title}`}>
            {KIND[s.kind].label}: {s.title}. {s.detail}
          </li>
        ))}
      </ol>
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {diagram.source === "adk" ? (
          <>
            <Sparkles className="size-3" aria-hidden /> Generado con IA solo a partir de la
            explicación y la GPC del reactivo.
          </>
        ) : (
          "Construido con la explicación y la GPC del reactivo."
        )}
      </p>
    </div>
  );
}

type ExplainRequest = { sessionId: string } | { examId: string; itemId: string };

/** Pide el diagrama a /api/explain. Con `autoLoad` lo carga al montarse; si no, muestra un botón. */
export function ExplanationDiagramLoader({
  request,
  autoLoad = false,
  className,
}: {
  request: ExplainRequest;
  autoLoad?: boolean;
  className?: string;
}) {
  const [diagram, setDiagram] = useState<Diagram | null>(null);
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
      setDiagram(ExplanationDiagramSchema.parse(await res.json()));
    } catch {
      setError("No se pudo construir el diagrama.");
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

  if (diagram) {
    return (
      <div className={className}>
        <ExplanationDiagram diagram={diagram} />
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {loading ? (
        <div
          className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/60 text-sm text-brand-700"
          data-testid="diagram-loading"
        >
          <Loader2 className="size-5 animate-spin" aria-hidden /> Construyendo el diagrama paso a
          paso…
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => void load()}
          data-testid="load-diagram"
        >
          <Workflow aria-hidden /> {error ? "Reintentar diagrama" : "Ver diagrama paso a paso"}
        </Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
