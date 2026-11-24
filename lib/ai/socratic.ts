import "server-only";
import { specialtyName } from "@/lib/content";
import type { Item } from "@/lib/schemas/content";
import {
  ModelSocraticSchema,
  SOCRATIC_LEVELS,
  type SocraticReply,
  type SocraticTurn,
} from "@/lib/schemas/explanation";
import { stripMarkdown } from "@/lib/text";
import { runStructuredAgent, withTimeout } from "./adk-structured";
import { clamp } from "./concept-diagram";
import { geminiOptions } from "./explain";
import { gpcFragments, type LearnerContext } from "./feedback";

const SOCRATIC_TIMEOUT_MS = 12000;
const MAX_LEVEL = SOCRATIC_LEVELS.length;

export const SOCRATIC_INSTRUCTION = `Eres el tutor socrático de Razona (preparación para el ENARM, México). La estudiante ya resolvió el caso y leyó la explicación; ahora conversan para que lo domine POCO A POCO. Cada turno sube un nivel en esta escalera: 1 recordar → 2 comprender → 3 aplicar → 4 analizar → 5 transferir (a una variante del caso con un dato distinto).

En cada turno devuelve SOLO el JSON pedido, en español de México, texto plano, hablándole de tú:
- understood: "si", "parcial" o "no" según su ÚLTIMA respuesta a TU ÚLTIMA pregunta.
- feedback (2 a 3 oraciones): primero reconoce lo concreto que razonó bien (sin elogios vacíos); luego corrige o completa lo que falte. Si es una afirmación clínica, apóyala en la GPC citando clave, sección y página de los fragmentos que te doy (p. ej. «según la GPC IMSS-027-08, Tratamiento, p. 20…»).
- nextQuestion: UNA pregunta socrática del nivel que te indico, que termine en «?». Si understood es "no", quédate en el mismo nivel y reformula más sencillo con una pista. No la respondas tú.
- done: true solo si ya completó el nivel 5 con understood "si" o "parcial"; entonces nextQuestion va vacía y feedback cierra con un resumen de 1 oración de lo que ya domina.

Reglas: cifras y recomendaciones clínicas salen SOLO de la viñeta, la explicación y los fragmentos de la GPC que te doy; no cites otras fuentes. Si la estudiante se sale del tema o pide la respuesta, redirígela con amabilidad a la pregunta. Nada de Markdown.`;

function buildPrompt(
  item: Item,
  ctx: LearnerContext,
  history: SocraticTurn[],
  answer: string,
  level: number,
): string {
  const options = item.options.map((o) => `${o.id}) ${o.text}`).join("\n");
  const transcript = history
    .map((t) => `${t.role === "tutor" ? "Tutor" : "Estudiante"}: ${t.text}`)
    .join("\n");
  return `Caso (${specialtyName(item)} · ${item.topic}):
${item.vignette}

Pregunta: ${item.question}
${options}
Respuesta correcta: ${item.correctOptionId}) ${item.options.find((o) => o.id === item.correctOptionId)?.text ?? ""}
Explicación: ${item.explanation}
Fragmentos de la GPC (${item.citation.gpcTitle}):
${gpcFragments(item, 5)}

Cómo le fue en el caso: ${
    ctx.answeredCorrectly
      ? "ACERTÓ; la conversación refuerza y lleva a transferir."
      : `SE EQUIVOCÓ (eligió ${ctx.wrongChoices.map((id) => `${id}) ${item.options.find((o) => o.id === id)?.text ?? ""}`).join("; ")}); en los primeros niveles asegúrate de que corrija esa idea.`
  }
Historial de la estudiante en el tema: ${ctx.topic.correct} de ${ctx.topic.total} aciertos.

Conversación:
${transcript}
Estudiante: ${answer}

Nivel actual: ${level} (${SOCRATIC_LEVELS[level - 1]}). Si entendió, la siguiente pregunta es del nivel ${Math.min(level + 1, MAX_LEVEL)} (${SOCRATIC_LEVELS[Math.min(level, MAX_LEVEL - 1)]}).`;
}

const plain = (s: string, max: number) => clamp(stripMarkdown(s), max);

async function replyWithAdk(
  item: Item,
  ctx: LearnerContext,
  history: SocraticTurn[],
  answer: string,
  level: number,
): Promise<SocraticReply> {
  const gemini = geminiOptions();
  if (!gemini) throw new Error("sin clave");
  const raw = await runStructuredAgent({
    appName: "razona-socratico",
    name: "tutor_socratico_profundiza",
    description: "Diálogo socrático progresivo después de resolver un caso.",
    instruction: SOCRATIC_INSTRUCTION,
    schema: ModelSocraticSchema,
    prompt: buildPrompt(item, ctx, history, answer, level),
    gemini,
    temperature: 0.5,
    maxOutputTokens: 1200,
  });
  const feedback = plain(raw.feedback, 700);
  if (!feedback) throw new Error("respuesta vacía");
  const advance = raw.understood !== "no";
  const nextLevel = advance ? Math.min(level + 1, MAX_LEVEL) : level;
  const done = Boolean(raw.done) && level >= MAX_LEVEL && advance;
  const nextQuestion = done ? "" : plain(raw.nextQuestion, 320);
  if (!done && !nextQuestion.endsWith("?")) throw new Error("sin pregunta");
  return { feedback, nextQuestion, level: nextLevel, done, source: "adk" };
}

/**
 * Respaldo sin LLM: no evalúa la respuesta (no puede), la contrasta con la GPC y avanza por las
 * preguntas semilla de la rúbrica del banco (escritas y revisadas por humanos).
 */
export function fallbackSocraticReply(
  item: Item,
  history: SocraticTurn[],
  level: number,
): SocraticReply {
  const asked = new Set(history.filter((t) => t.role === "tutor").map((t) => t.text.trim()));
  const seeds = (item.rubric ?? []).map((r) => ({ q: r.question, c: r.citation }));
  const next = seeds.find((s) => !asked.has(s.q.trim()));
  const kp = item.keyPoints?.[Math.min(level - 1, (item.keyPoints?.length ?? 1) - 1)];
  const cite = kp?.citation ?? item.citation;
  const feedback = clamp(
    `Compara tu respuesta con la GPC ${cite.gpcId} (${cite.section}${cite.page ? `, p. ${cite.page}` : ""}): «${cite.snippet}». ¿Coincide con lo que razonaste?`,
    700,
  );
  const done = !next || level >= MAX_LEVEL;
  return {
    feedback,
    nextQuestion: done ? "" : clamp(next.q, 320),
    level: Math.min(level + 1, MAX_LEVEL),
    done,
    source: "fallback",
  };
}

export async function socraticReply(
  item: Item,
  ctx: LearnerContext,
  history: SocraticTurn[],
  answer: string,
  level: number,
): Promise<SocraticReply> {
  if (!geminiOptions()) return fallbackSocraticReply(item, history, level);
  try {
    return await withTimeout(replyWithAdk(item, ctx, history, answer, level), SOCRATIC_TIMEOUT_MS);
  } catch (error) {
    console.warn("[socrático] usando respaldo:", error instanceof Error ? error.message : error);
    return fallbackSocraticReply(item, history, level);
  }
}
