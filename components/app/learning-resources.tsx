"use client";

import {
  ChevronDown,
  Highlighter,
  ImageIcon,
  Layers,
  Loader2,
  RotateCcw,
  Table2,
  Workflow,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { CitationCard } from "@/components/app/citation-card";
import { Button } from "@/components/ui/button";
import type { Citation, ErrorType, Resource, ResourceType } from "@/lib/schemas/content";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<ResourceType, string> = {
  flashcard: "Tarjeta",
  diagram: "Algoritmo",
  highlight: "Dato del caso",
  table: "Tabla",
  image: "Imagen",
};

const TYPE_ICON: Record<ResourceType, typeof Layers> = {
  flashcard: Layers,
  diagram: Workflow,
  highlight: Highlighter,
  table: Table2,
  image: ImageIcon,
};

const ERROR_LABEL: Record<ErrorType, string> = {
  lectura: "lectura",
  dato_omitido: "dato omitido",
  razonamiento: "razonamiento",
  conocimiento: "conocimiento",
};

/** Cuántos recursos se ven antes de "Ver más". */
const VISIBLE = 3;

/**
 * Recursos de aprendizaje del banco de casos (flashcards, algoritmos, datos clave de la viñeta,
 * tablas e imágenes). Solo se muestran después de responder. Los que atienden los errores de la
 * alumna van primero (el servidor ya los ordena) y llevan la etiqueta "Para tu error".
 */
export function LearningResources({
  resources,
  errorTypes = [],
  className,
}: {
  resources: readonly Resource[];
  errorTypes?: readonly ErrorType[];
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (resources.length === 0) return null;
  const shown = expanded ? resources : resources.slice(0, VISIBLE);
  const hidden = resources.length - shown.length;

  return (
    <section className={cn("space-y-3", className)} data-testid="learning-resources">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-bold text-brand-900">Repasa lo clave</h3>
        <span className="text-xs text-muted-foreground">
          {resources.length} {resources.length === 1 ? "recurso" : "recursos"}
        </span>
      </div>
      <ul className="space-y-3">
        {shown.map((r) => (
          <li key={r.id}>
            <ResourceCard
              resource={r}
              forYou={r.errorTypes.filter((t) => errorTypes.includes(t))}
            />
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setExpanded(true)}
          data-testid="more-resources"
        >
          <ChevronDown aria-hidden /> Ver {hidden} {hidden === 1 ? "recurso más" : "recursos más"}
        </Button>
      )}
    </section>
  );
}

function ResourceCard({ resource, forYou }: { resource: Resource; forYou: ErrorType[] }) {
  const Icon = TYPE_ICON[resource.type];
  return (
    <article
      className="space-y-2 rounded-2xl border bg-white p-3"
      data-testid="resource"
      data-type={resource.type}
    >
      <header className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="inline-flex items-center gap-1 text-brand-700">
          <Icon className="size-4" aria-hidden /> {TYPE_LABEL[resource.type]}
        </span>
        {forYou.length > 0 && (
          <span
            className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900"
            data-testid="resource-for-you"
          >
            Para tu error de {forYou.map((t) => ERROR_LABEL[t]).join(" y ")}
          </span>
        )}
      </header>
      <ResourceBody resource={resource} />
      {resource.type !== "flashcard" && <Citations citations={resource.citations} />}
    </article>
  );
}

function ResourceBody({ resource: r }: { resource: Resource }) {
  switch (r.type) {
    case "flashcard":
      return <Flashcard front={r.front} back={r.back} citations={r.citations} />;
    case "highlight":
      return (
        <div className="space-y-1">
          <blockquote className="rounded-lg bg-yellow-50 px-3 py-2 text-[15px]">
            <mark className="bg-yellow-200/80 px-0.5">{r.fragment}</mark>
          </blockquote>
          <p className="text-sm leading-relaxed">{r.reason}</p>
        </div>
      );
    case "diagram":
      return <MermaidDiagram code={r.code} />;
    case "table":
      return (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {r.columns.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="border-b-2 border-brand-200 px-2 py-1.5 text-left font-semibold"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row) => (
                <tr key={row.join("|")} className="border-b last:border-0">
                  {row.map((cell, i) => (
                    <td key={`${r.columns[i] ?? i}`} className="px-2 py-1.5 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "image":
      return (
        <figure className="space-y-1.5">
          {/* biome-ignore lint/performance/noImgElement: tamaño desconocido; viene de json/assets */}
          <img
            src={r.imagePath}
            alt={r.description}
            loading="lazy"
            className="max-h-72 w-full rounded-lg bg-muted object-contain"
          />
          <figcaption className="space-y-0.5 text-sm">
            <span className="block leading-relaxed">{r.description}</span>
            <span className="block text-xs text-muted-foreground">
              {r.author} · {r.license} ·{" "}
              <a
                href={r.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                {r.source}
              </a>
            </span>
          </figcaption>
        </figure>
      );
  }
}

function Flashcard({
  front,
  back,
  citations,
}: {
  front: string;
  back: string;
  citations?: Citation[];
}) {
  const [open, setOpen] = useState(false);
  const backId = useId();
  return (
    <div className="space-y-2">
      <p className="font-semibold leading-snug">{front}</p>
      {/* La cita va con el reverso: su fragmento suele contener la respuesta. */}
      <div id={backId} hidden={!open} className="space-y-2" data-testid="flashcard-back">
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[15px] text-emerald-950">{back}</p>
        <Citations citations={citations} />
      </div>
      <Button
        variant="outline"
        size="sm"
        className="min-h-11 w-full"
        aria-expanded={open}
        aria-controls={backId}
        onClick={() => setOpen((v) => !v)}
        data-testid="flashcard-toggle"
      >
        {open ? (
          <>
            <RotateCcw aria-hidden /> Ocultar respuesta
          </>
        ) : (
          "Piensa tu respuesta y toca para verla"
        )}
      </Button>
    </div>
  );
}

/** La primera cita a la vista; las demás (p. ej. las de un algoritmo) plegadas. */
function Citations({ citations }: { citations?: Citation[] }) {
  if (!citations?.length) return null;
  const [first, ...rest] = citations;
  const card = (c: Citation) => (
    <CitationCard
      key={`${c.gpcId}-${c.page}-${c.snippet}`}
      gpcId={c.gpcId}
      gpcTitle={c.gpcTitle}
      section={c.section}
      page={c.page}
      snippet={c.snippet}
      className="text-xs"
    />
  );
  return (
    <div className="space-y-2">
      {card(first)}
      {rest.length > 0 && (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-brand-700">
            <ChevronDown
              className="size-4 transition-transform group-open:rotate-180"
              aria-hidden
            />
            {rest.length === 1 ? "Ver 1 cita más" : `Ver ${rest.length} citas más`}
          </summary>
          <div className="space-y-2 pt-1">{rest.map(card)}</div>
        </details>
      )}
    </div>
  );
}

let mermaidReady: Promise<typeof import("mermaid").default> | null = null;

/** Carga mermaid una sola vez y solo en el navegador (pesa; no entra en el bundle inicial). */
function loadMermaid() {
  mermaidReady ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      fontFamily: "inherit",
      themeVariables: {
        primaryColor: "#ecfbfd",
        primaryBorderColor: "#0f9bb8",
        primaryTextColor: "#0b2a3c",
        lineColor: "#0f9bb8",
        fontSize: "14px",
      },
      // Tamaño natural (texto legible en el teléfono); si no cabe, se desplaza en horizontal.
      flowchart: { useMaxWidth: false, wrappingWidth: 160, nodeSpacing: 24, rankSpacing: 36 },
    });
    return mermaid;
  });
  return mermaidReady;
}

function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [wide, setWide] = useState(false);
  const id = `mmd-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    let cancelled = false;
    loadMermaid()
      .then((mermaid) => mermaid.render(id, code))
      .then(({ svg }) => {
        if (cancelled || !ref.current) return;
        // securityLevel "strict": mermaid sanea el SVG (DOMPurify) antes de devolverlo.
        ref.current.innerHTML = svg;
        setWide(ref.current.scrollWidth > ref.current.clientWidth + 4);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  return (
    <div data-testid="resource-diagram" data-state={state}>
      {state === "loading" && (
        <p className="flex min-h-20 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Dibujando el algoritmo…
        </p>
      )}
      {state === "error" && (
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {[...code.matchAll(/"([^"]+)"/g)].map((m, i) => (
            <li key={`${i}-${m[1]}`}>{m[1]}</li>
          ))}
        </ol>
      )}
      {wide && (
        <p className="pb-1 text-center text-xs text-muted-foreground">
          Desliza para ver todo el algoritmo →
        </p>
      )}
      <section
        ref={ref}
        aria-label="Algoritmo de la guía"
        tabIndex={wide ? 0 : -1}
        className="-mx-3 overflow-x-auto px-3 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-none"
      />
    </div>
  );
}
