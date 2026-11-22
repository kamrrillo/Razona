import { specialtyName } from "@/lib/content";
import type { Item } from "@/lib/schemas/content";
import type { ModelExplanation, TutorExplanation } from "@/lib/schemas/explanation";
import { stripMarkdown } from "@/lib/text";
import {
  buildFallbackConceptDiagram,
  clamp,
  normalizeModelDiagram,
  sentences,
} from "./concept-diagram";

/** Lo que sabemos de la estudiante para personalizar la retroalimentación (todo de Supabase). */
export type LearnerContext = {
  name: string;
  mode: "practica" | "examen" | "diagnostico";
  /** Opciones incorrectas que eligió, en orden (práctica) o la elegida en el examen. */
  wrongChoices: string[];
  /** Si su respuesta final fue correcta (en práctica siempre, al resolver). */
  answeredCorrectly: boolean;
  attempts: number;
  usedTutor: boolean;
  /** Lo que le escribió al tutor en este caso (sus palabras, últimas 3). */
  studentMessages: string[];
  topic: { correct: number; total: number; isWeakest: boolean };
  weakestTopic: string | null;
  streakDays: number;
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";
const pct = (c: number, t: number) => (t === 0 ? 0 : Math.round((c / t) * 100));

function optionText(item: Item, id: string) {
  return `${id}) ${item.options.find((o) => o.id === id)?.text ?? ""}`;
}

export const EXPLANATION_INSTRUCTION = `Eres el tutor inteligente de Razona (preparación para el ENARM, México). La estudiante YA respondió el reactivo; ahora le das retroalimentación personalizada y le explicas el porqué con fundamentos.

Devuelve SOLO el JSON pedido, en español de México, en texto plano (sin Markdown), hablándole de tú:
- personal (2 a 3 oraciones): usa su nombre y SU contexto real: qué opción(es) eligió y qué idea equivocada revela esa elección; si escribió su razonamiento, retómalo con sus palabras y corrígelo con tacto; menciona su historial en el tema con los números que te doy (y si es su tema más débil). Nada de elogios genéricos.
- why (3 a 5 oraciones): por qué la respuesta correcta es correcta, conectando los datos de la viñeta con el mecanismo o criterio que la sustenta.
- fundamentals (2 a 4): conceptos base que hay que dominar para resolver casos así (fisiopatología, criterios, clasificación, mecanismo de acción). title corto + text de 1 a 2 oraciones.
- distractors: por qué NO aplica cada opción incorrecta, empezando por las que eligió ella (1 a 2 oraciones cada una; optionId es la letra).
- nextStep (1 oración): qué le conviene practicar ahora, según su historial.
- diagram: un diagrama CONCEPTUAL del tema (no una lista de pasos). Elige el tipo que mejor lo explique:
  * "escala": cuando el tema depende de puntos de corte numéricos (glucosa, presión, saturación, puntajes). Llena scale con min/max, 2 a 4 rangos contiguos con su etiqueta y markerValue con el valor del paciente (markerLabel corto y sin el número, p. ej. "Paciente").
  * "arbol": clasificaciones o decisiones (raíz = concepto; hijos = categorías o ramas; edge = criterio que lleva a cada rama). 4 a 9 nodos, máximo 2 niveles bajo la raíz y 3 hijos por nodo.
  * "flujo": mecanismos o cadenas causales (fisiopatología, secuencia de eventos). 3 a 6 nodos en orden; edge = qué conecta un paso con el siguiente.
  * "comparacion": para contrastar la opción correcta con la(s) elegida(s) u otras entidades: 2 a 3 columnas y 2 a 5 filas de criterios, una celda corta por columna.
  Etiquetas de máximo 4 palabras; note de 1 oración con la explicación de ese nodo. Marca role "respuesta" en lo que corresponde a la respuesta correcta o donde cae el paciente, "elegida" en lo que eligió ella si aparece, "clave" en los datos decisivos y "raiz" en el concepto central del árbol. Deja vacíos los campos que no usa el tipo elegido.

Reglas estrictas:
- Los puntos de corte, dosis, cifras y recomendaciones clínicas salen ÚNICAMENTE de la viñeta, las opciones, la explicación y el fragmento de la GPC que te doy. Para los fundamentos puedes usar fisiología y fisiopatología básicas ampliamente aceptadas, sin contradecir ese material.
- No menciones ni cites guías, sociedades, estudios ni fuentes distintas de la GPC que te doy (por ejemplo, no digas "según la ADA" ni "la OMS").
- No inventes datos de la estudiante: usa solo su contexto.`;

export function buildExplanationPrompt(item: Item, ctx: LearnerContext): string {
  const options = item.options.map((o) => `${o.id}) ${o.text}`).join("\n");
  const wrong = ctx.wrongChoices.map((id) => optionText(item, id)).join("; ");
  const history =
    ctx.topic.total > 0
      ? `${ctx.topic.correct} de ${ctx.topic.total} aciertos en ${item.topic} (${pct(ctx.topic.correct, ctx.topic.total)} %)`
      : `es la primera vez que responde ${item.topic}`;
  const how =
    ctx.mode === "practica"
      ? ctx.attempts <= 1
        ? "Lo resolvió al primer intento."
        : `Lo resolvió en ${ctx.attempts} intentos${ctx.usedTutor ? " con ayuda del tutor socrático" : ""}. Antes eligió: ${wrong}.`
      : ctx.answeredCorrectly
        ? `En el ${ctx.mode === "examen" ? "simulacro" : "diagnóstico"} acertó.`
        : `En el ${ctx.mode === "examen" ? "simulacro" : "diagnóstico"} eligió ${wrong || "nada (lo dejó sin responder)"}, que es incorrecta.`;

  return `Caso (${specialtyName(item)} · ${item.topic}):
${item.vignette}

Pregunta: ${item.question}
${options}

Respuesta correcta: ${optionText(item, item.correctOptionId)}
Explicación: ${item.explanation}
GPC: ${item.citation.gpcTitle} — ${item.citation.section}: ${item.citation.snippet}

Contexto de la estudiante:
- Nombre: ${firstName(ctx.name) || "(sin nombre)"}
- ${how}
- Historial: ${history}.${ctx.topic.isWeakest ? " Es su tema más débil." : ctx.weakestTopic ? ` Su tema más débil es ${ctx.weakestTopic}.` : ""}
- Racha: ${ctx.streakDays} día(s) seguidos estudiando.
${ctx.studentMessages.length ? `- Lo que le escribió al tutor: ${ctx.studentMessages.map((m) => `«${m}»`).join(" ")}` : "- No escribió su razonamiento."}`;
}

const plain = (s: string, max: number) => clamp(stripMarkdown(s), max);

/** Valida y recorta la salida del modelo. El diagrama cae al de respaldo si no es utilizable. */
export function normalizeModelExplanation(
  item: Item,
  ctx: LearnerContext,
  raw: ModelExplanation,
): TutorExplanation {
  const personal = plain(raw.personal, 600);
  const why = plain(raw.why, 900);
  if (!personal || !why) throw new Error("Explicación incompleta");

  const fundamentals = raw.fundamentals
    .map((f) => ({ title: plain(f.title, 60), text: plain(f.text, 320) }))
    .filter((f) => f.title && f.text)
    .slice(0, 4);
  const validWrong = new Set(
    item.options.filter((o) => o.id !== item.correctOptionId).map((o) => o.id),
  );
  const seen = new Set<string>();
  const distractors = raw.distractors
    .map((d) => ({
      optionId: d.optionId.trim().toLowerCase().replace(/\)$/, ""),
      text: plain(d.text, 320),
    }))
    .filter(
      (d) => validWrong.has(d.optionId) && d.text && !seen.has(d.optionId) && seen.add(d.optionId),
    )
    .map((d) => ({
      ...d,
      optionText: item.options.find((o) => o.id === d.optionId)?.text ?? "",
      chosen: ctx.wrongChoices.includes(d.optionId),
    }))
    .sort((a, b) => Number(b.chosen) - Number(a.chosen))
    .slice(0, 4);

  let diagram: TutorExplanation["diagram"];
  let diagramSource: TutorExplanation["diagramSource"] = "adk";
  try {
    diagram = normalizeModelDiagram(raw.diagram);
  } catch {
    diagram = buildFallbackConceptDiagram(item, ctx.wrongChoices);
    diagramSource = "fallback";
  }

  return {
    personal,
    why,
    fundamentals: fundamentals.length ? fundamentals : fallbackFundamentals(item),
    distractors,
    nextStep: plain(raw.nextStep, 320) || fallbackNextStep(item, ctx),
    diagram,
    source: "adk",
    diagramSource,
  };
}

function fallbackFundamentals(item: Item) {
  const [first, ...rest] = sentences(item.explanation);
  const out = [{ title: "La clave del caso", text: clamp(first ?? item.explanation, 320) }];
  if (rest.length) out.push({ title: "Además", text: clamp(rest.join(" "), 320) });
  out.push({ title: `Qué dice la GPC`, text: clamp(item.citation.snippet, 320) });
  return out;
}

function fallbackNextStep(item: Item, ctx: LearnerContext) {
  if (ctx.topic.isWeakest)
    return `Haz otro caso de ${item.topic}: es tu tema más débil y ya tienes la idea fresca.`;
  if (ctx.weakestTopic) return `Sigue con un caso de ${ctx.weakestTopic}, tu tema más débil ahora.`;
  return "Sigue con el siguiente caso o pon a prueba lo aprendido en el simulacro.";
}

/** Retroalimentación sin LLM, personalizada con datos reales y sin inventar contenido clínico. */
export function buildFallbackExplanation(item: Item, ctx: LearnerContext): TutorExplanation {
  const name = firstName(ctx.name);
  const hi = name ? `${name}, ` : "";
  const parts: string[] = [];
  if (ctx.mode === "practica") {
    parts.push(
      ctx.attempts <= 1
        ? `${name ? `¡Bien, ${name}!` : "¡Bien!"} Lo resolviste al primer intento.`
        : `${hi}lo resolviste en ${ctx.attempts} intentos: antes elegiste ${ctx.wrongChoices.map((id) => optionText(item, id)).join(" y ")}.`,
    );
  } else if (ctx.answeredCorrectly) {
    parts.push(`${hi}acertaste este reactivo.`);
  } else {
    parts.push(
      ctx.wrongChoices.length
        ? `${hi}elegiste ${optionText(item, ctx.wrongChoices[0])}; la respuesta es ${optionText(item, item.correctOptionId)}.`
        : `${hi}lo dejaste sin responder; la respuesta es ${optionText(item, item.correctOptionId)}.`,
    );
  }
  if (ctx.topic.total > 0) {
    parts.push(
      `En ${item.topic} llevas ${ctx.topic.correct} de ${ctx.topic.total} aciertos (${pct(ctx.topic.correct, ctx.topic.total)} %)${ctx.topic.isWeakest ? ", tu tema más débil: vale la pena fijar este concepto" : ""}.`,
    );
  }

  const chosen = new Set(ctx.wrongChoices);
  const distractors = item.options
    .filter((o) => o.id !== item.correctOptionId)
    .map((o) => ({
      optionId: o.id,
      optionText: o.text,
      chosen: chosen.has(o.id),
      text: `No es la conducta que respaldan la explicación y la GPC (${item.citation.section}) para este caso.`,
    }))
    .sort((a, b) => Number(b.chosen) - Number(a.chosen))
    .slice(0, 4);

  return {
    personal: clamp(parts.join(" "), 600),
    why: clamp(item.explanation, 900),
    fundamentals: fallbackFundamentals(item),
    distractors,
    nextStep: fallbackNextStep(item, ctx),
    diagram: buildFallbackConceptDiagram(item, ctx.wrongChoices),
    source: "fallback",
    diagramSource: "fallback",
  };
}
