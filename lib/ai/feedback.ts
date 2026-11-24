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

export const EXPLANATION_INSTRUCTION = `Eres el tutor inteligente de Razona (preparación para el ENARM, México). La estudiante YA respondió el reactivo; ahora le explicas el tema en orden, de lo general a lo profundo, para que progrese paso a paso.

Te digo si ACERTÓ o SE EQUIVOCÓ; adapta toda la explicación a eso:
- Si SE EQUIVOCÓ: el objetivo es CORREGIR. Dile con claridad y sin culparla cuál era la respuesta correcta; identifica la idea equivocada que revela su opción y el dato de la viñeta que pasó por alto o malinterpretó; contrasta su opción con la correcta usando la GPC; la pregunta socrática debe hacerla reconstruir el razonamiento correcto por sí misma (no repetir la respuesta).
- Si ACERTÓ: el objetivo es REFORZAR. Nombra qué dato o criterio usó bien para llegar a la respuesta y consolídalo con la GPC; agrega un matiz que la haga más sólida (un límite, una excepción o lo que cambiaría la conducta); la pregunta socrática debe llevarla un paso más allá del caso (transferencia a una variante).

Devuelve SOLO el JSON pedido, en español de México, en texto plano (sin Markdown), hablándole de tú:
- personal (2 a 3 oraciones): usa su nombre y SU contexto real. Si se equivocó: qué opción eligió, cuál era la correcta y qué idea equivocada revela su elección. Si acertó: qué razonamiento la llevó a la respuesta. Si escribió su razonamiento, retómalo con sus palabras. Menciona su historial en el tema con los números que te doy (y si es su tema más débil). Nada de elogios genéricos.
- gpc (3 a 4 oraciones) — ES LO PRIMERO QUE LEE: explica qué dice la GPC sobre este caso, citándola de forma explícita con su clave, sección y página, por ejemplo: «La GPC IMSS-027-08 (Diagnóstico, p. 14) señala que…». Parafrasea o cita textual entre comillas latinas «» solo lo que está en los fragmentos que te doy; si hay varios fragmentos relevantes, cita los dos más útiles. Conecta lo que dice la guía con el dato de la viñeta que lo activa.
- why (3 a 5 oraciones): por qué la respuesta correcta es correcta, conectando los datos de la viñeta con el mecanismo o criterio que la sustenta (aquí ya no repitas la cita, profundiza en el razonamiento). Si se equivocó, incluye en qué punto exacto su razonamiento se separó del correcto.
- fundamentals (2 a 4): conceptos base que hay que dominar para resolver casos así (fisiopatología, criterios, clasificación, mecanismo de acción). title corto + text de 1 a 2 oraciones.
- distractors: por qué NO aplica cada opción incorrecta, empezando por las que eligió ella (1 a 2 oraciones cada una; optionId es la letra).
- nextStep (1 oración): qué le conviene practicar ahora, según su historial.
- socraticQuestion (1 pregunta, termina en «?»): para cerrar. Si se equivocó, que la haga identificar por sí misma el dato o criterio que la habría llevado a la respuesta correcta. Si acertó, que la obligue a USAR lo aprendido un paso más allá del caso (qué cambiaría si un dato de la viñeta fuera distinto, o qué dato buscaría para confirmar). No la respondas tú; no debe poder contestarse con sí/no ni copiando una frase de la explicación.
- diagram: un diagrama CONCEPTUAL del tema (no una lista de pasos). Elige el tipo que mejor lo explique:
  * "escala": cuando el tema depende de puntos de corte numéricos (glucosa, presión, saturación, puntajes). Llena scale con min/max, 2 a 4 rangos contiguos con su etiqueta y markerValue con el valor del paciente (markerLabel corto y sin el número, p. ej. "Paciente").
  * "arbol": clasificaciones o decisiones (raíz = concepto; hijos = categorías o ramas; edge = criterio que lleva a cada rama). 4 a 9 nodos, máximo 2 niveles bajo la raíz y 3 hijos por nodo.
  * "flujo": mecanismos o cadenas causales (fisiopatología, secuencia de eventos). 3 a 6 nodos en orden; edge = qué conecta un paso con el siguiente.
  * "comparacion": para contrastar la opción correcta con la(s) elegida(s) u otras entidades: 2 a 3 columnas y 2 a 5 filas de criterios, una celda corta por columna.
  Etiquetas de máximo 4 palabras; note de 1 oración con la explicación de ese nodo. Marca role "respuesta" en lo que corresponde a la respuesta correcta o donde cae el paciente, "elegida" en lo que eligió ella si aparece, "clave" en los datos decisivos y "raiz" en el concepto central del árbol. Deja vacíos los campos que no usa el tipo elegido.

Reglas estrictas:
- Los puntos de corte, dosis, cifras y recomendaciones clínicas salen ÚNICAMENTE de la viñeta, las opciones, la explicación y los fragmentos de la GPC que te doy. Para los fundamentos puedes usar fisiología y fisiopatología básicas ampliamente aceptadas, sin contradecir ese material.
- Cita solo la GPC que te doy, con la clave, sección y página exactas de cada fragmento. No menciones ni cites guías, sociedades, estudios ni fuentes distintas (por ejemplo, no digas "según la ADA" ni "la OMS").
- No inventes datos de la estudiante: usa solo su contexto.`;

/** Fragmentos de la GPC del caso (puntos clave), sin repetir, para citarlos con precisión. */
export function gpcFragments(item: Item, max = 4): string {
  const seen = new Set<string>();
  const all = [item.citation, ...(item.keyPoints ?? []).map((k) => k.citation)];
  return all
    .filter((c) => {
      const key = `${c.section}|${c.page}|${c.snippet}`;
      return !seen.has(key) && seen.add(key);
    })
    .slice(0, max)
    .map((c) => `- [${c.gpcId} · ${c.section}${c.page ? ` · p. ${c.page}` : ""}] «${c.snippet}»`)
    .join("\n");
}

export function buildExplanationPrompt(item: Item, ctx: LearnerContext): string {
  const options = item.options.map((o) => `${o.id}) ${o.text}`).join("\n");
  const wrong = ctx.wrongChoices.map((id) => optionText(item, id)).join("; ");
  const history =
    ctx.topic.total > 0
      ? `${ctx.topic.correct} de ${ctx.topic.total} aciertos en ${item.topic} (${pct(ctx.topic.correct, ctx.topic.total)} %)`
      : `es la primera vez que responde ${item.topic}`;
  const where =
    ctx.mode === "practica"
      ? "En la práctica"
      : ctx.mode === "examen"
        ? "En el simulacro"
        : "En el diagnóstico";
  const how = ctx.answeredCorrectly
    ? `${where} ACERTÓ.${wrong ? ` Antes había elegido: ${wrong}.` : ""}`
    : `${where} SE EQUIVOCÓ: eligió ${wrong || "nada (lo dejó sin responder)"}, que es incorrecta.`;
  const goal = ctx.answeredCorrectly
    ? "REFORZAR lo que hizo bien y llevarla un paso más allá."
    : "CORREGIR su idea equivocada y que entienda por qué la correcta es la correcta.";

  return `Caso (${specialtyName(item)} · ${item.topic}):
${item.vignette}

Pregunta: ${item.question}
${options}

Respuesta correcta: ${optionText(item, item.correctOptionId)}
Explicación: ${item.explanation}
GPC: ${item.citation.gpcTitle} (clave ${item.citation.gpcId})
Fragmentos de la GPC que puedes citar:
${gpcFragments(item)}

Contexto de la estudiante:
- Nombre: ${firstName(ctx.name) || "(sin nombre)"}
- ${how}
- Objetivo de esta explicación: ${goal}
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
  const gpc = plain(raw.gpc, 800);
  const socratic = plain(raw.socraticQuestion, 320);

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
    gpc: citesGpc(gpc, item) ? gpc : fallbackGpc(item),
    citation: item.citation,
    why,
    fundamentals: fundamentals.length ? fundamentals : fallbackFundamentals(item),
    distractors,
    nextStep: plain(raw.nextStep, 320) || fallbackNextStep(item, ctx),
    socraticQuestion: socratic.endsWith("?") ? socratic : fallbackSocratic(item, ctx),
    diagram,
    source: "adk",
    diagramSource,
  };
}

/** El texto de la GPC debe nombrar la guía (clave o «GPC»); si no, se usa el de respaldo. */
function citesGpc(text: string, item: Item): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return t.includes("gpc") || t.includes(item.citation.gpcId.toLowerCase());
}

function citeLabel(c: Item["citation"]) {
  return `${c.gpcId}, ${c.section}${c.page ? `, p. ${c.page}` : ""}`;
}

/** Lo que dice la GPC, armado con los fragmentos literales (sin LLM). */
export function fallbackGpc(item: Item): string {
  const second = item.keyPoints?.find(
    (k) => k.citation.snippet !== item.citation.snippet && k.citation.section,
  );
  const parts = [`La GPC ${citeLabel(item.citation)} indica: «${item.citation.snippet}».`];
  if (second) parts.push(`Y en ${citeLabel(second.citation)}: «${second.citation.snippet}».`);
  return clamp(parts.join(" "), 800);
}

/** Pregunta socrática de cierre: la semilla de la rúbrica para su error, o una general. */
export function fallbackSocratic(item: Item, ctx: Pick<LearnerContext, "wrongChoices">): string {
  const rubric = item.rubric ?? [];
  const forChoice = rubric.find((r) => r.optionIds.some((o) => ctx.wrongChoices.includes(o)));
  const q = (forChoice ?? rubric[0])?.question;
  if (q) return clamp(q, 320);
  return `Si cambiara el dato más decisivo de esta viñeta, ¿cambiaría tu conducta? ¿Cuál dato buscarías primero y por qué?`;
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
  if (ctx.answeredCorrectly) {
    parts.push(
      ctx.mode === "practica"
        ? `${name ? `¡Bien, ${name}!` : "¡Bien!"} Acertaste: repasa por qué para fijarlo.`
        : `${hi}acertaste este reactivo.`,
    );
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
    gpc: fallbackGpc(item),
    citation: item.citation,
    why: clamp(item.explanation, 900),
    fundamentals: fallbackFundamentals(item),
    distractors,
    nextStep: fallbackNextStep(item, ctx),
    socraticQuestion: fallbackSocratic(item, ctx),
    diagram: buildFallbackConceptDiagram(item, ctx.wrongChoices),
    source: "fallback",
    diagramSource: "fallback",
  };
}
