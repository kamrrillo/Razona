import type { Item } from "@/lib/schemas/content";
import type { DiagramStep, ExplanationDiagram } from "@/lib/schemas/diagram";

function clamp(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

function sentences(text: string): string[] {
  // Corta en ". " o "; " (no en decimales como 37.8).
  return text
    .split(/[.;]\s+/)
    .map((s) => s.trim().replace(/[.;]$/, ""))
    .filter(Boolean)
    .map((s) => `${s}.`);
}

export function gpcStep(item: Item): DiagramStep {
  return {
    kind: "gpc",
    title: clamp(`GPC · ${item.citation.section}`, 60),
    detail: clamp(item.citation.snippet, 260),
  };
}

/**
 * Diagrama determinista construido SOLO con los campos del ítem (sin LLM, sin inventar):
 * caso → opciones descartadas por la estudiante → por qué → respuesta → GPC.
 */
export function buildFallbackDiagram(
  item: Item,
  wrongOptionIds: string[] = [],
): ExplanationDiagram {
  const correct = item.options.find((o) => o.id === item.correctOptionId);
  const steps: DiagramStep[] = [
    { kind: "dato", title: "El caso", detail: clamp(item.vignette, 260) },
  ];
  for (const id of wrongOptionIds.slice(0, 2)) {
    const option = item.options.find((o) => o.id === id);
    if (!option || id === item.correctOptionId) continue;
    steps.push({
      kind: "descarte",
      title: clamp(`Descartar ${id}) ${option.text}`, 60),
      detail:
        "Esta opción no es la recomendada para este caso; compárala con la explicación y la GPC.",
    });
  }
  const why = sentences(item.explanation);
  steps.push({
    kind: "razonamiento",
    title: "Por qué",
    detail: clamp(why.slice(0, 2).join(" ") || item.explanation, 260),
  });
  steps.push({
    kind: "decision",
    title: clamp(`Respuesta: ${item.correctOptionId}) ${correct?.text ?? ""}`, 60),
    detail: clamp(correct?.text ?? item.question, 260),
  });
  steps.push(gpcStep(item));
  return { title: clamp(item.title, 80), steps: steps.slice(0, 7), source: "fallback" };
}

/** Normaliza la salida del modelo: recorta textos y garantiza que el último paso sea la GPC del ítem. */
export function normalizeModelDiagram(
  item: Item,
  raw: { title: string; steps: DiagramStep[] },
): ExplanationDiagram {
  const steps = raw.steps
    .filter((s) => s.kind !== "gpc")
    .map((s) => ({ kind: s.kind, title: clamp(s.title, 60), detail: clamp(s.detail, 260) }))
    .filter((s) => s.title && s.detail)
    .slice(0, 6);
  if (steps.length < 2) throw new Error("Diagrama demasiado corto");
  return {
    title: clamp(raw.title || item.title, 80),
    steps: [...steps, gpcStep(item)],
    source: "adk",
  };
}

/** Parte el título en máximo 2 líneas (~24 caracteres) para el nodo SVG. */
export function wrapTitle(text: string, max = 24): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [""];
  for (const word of words) {
    const current = lines[lines.length - 1];
    if ((current ? `${current} ${word}` : word).length <= max) {
      lines[lines.length - 1] = current ? `${current} ${word}` : word;
    } else if (lines.length < 2) {
      lines.push(word);
    } else {
      lines[1] = `${lines[1]}…`;
      break;
    }
  }
  return lines.map((l) => (l.length > max + 1 ? `${l.slice(0, max)}…` : l));
}
