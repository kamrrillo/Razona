import type { Citation, Item, RubricEntry } from "@/lib/schemas/content";
import type { TutorEngine, TutorInput, TutorReply } from "./tutor-engine";

const GENERIC_QUESTION =
  "Antes de elegir otra opción: ¿qué dato de la viñeta te parece más importante para decidir? ¿Qué mecanismo explica ese hallazgo?";
const GENERIC_HINT = "Relee la viñeta y compara cada opción con lo que recomienda la GPC citada.";

const ERROR_HINT: Record<RubricEntry["errorType"], string> = {
  lectura:
    "Vuelve a leer la viñeta y la pregunta con calma: edad, tiempos y palabras como «excepto».",
  dato_omitido: "Hay un dato de la viñeta que cambia la decisión; búscalo antes de responder.",
  razonamiento: "Ordena los datos que tienes: ¿qué es prioritario y qué va primero?",
  conocimiento: "Repasa lo que recomienda la GPC para este escenario.",
};

function citationHint(c: Citation): string {
  const page = c.page ? `, p. ${c.page}` : "";
  return `Revisa ${c.gpcTitle}, sección «${c.section}»${page}.`;
}

/** Entrada de la rúbrica de una opción INCORRECTA (nunca de la correcta). */
export function rubricFor(item: Item, optionId: string): RubricEntry | undefined {
  if (optionId === item.correctOptionId) return undefined;
  return item.rubric?.find((r) => r.optionIds.includes(optionId));
}

/**
 * Tutor de respaldo, sin LLM: usa la rúbrica del banco de casos.
 * Para la opción elegida toma su pregunta socrática semilla y la cita de esa entrada.
 */
export class FallbackTutorEngine implements TutorEngine {
  readonly name = "fallback" as const;

  async respond(input: TutorInput): Promise<TutorReply> {
    const { item } = input;

    if (input.selectedOptionId) {
      const entry = rubricFor(item, input.selectedOptionId);
      await input.tools
        .registerAttempt({ optionId: input.selectedOptionId })
        .catch(() => undefined);
      const citation = entry?.citation ?? item.citation;
      return {
        text: entry?.question ?? GENERIC_QUESTION,
        hint: `${entry ? ERROR_HINT[entry.errorType] : GENERIC_HINT} ${citationHint(citation)}`,
        citation,
        engine: "fallback",
      };
    }

    // Mensaje libre: recorre las preguntas semilla de la rúbrica.
    const questions = item.rubric?.map((r) => r.question) ?? [];
    const followUps = questions.length > 0 ? questions : [GENERIC_QUESTION];
    const studentTurns = input.history.filter((m) => m.role === "student" && !m.optionId).length;
    return {
      text: followUps[studentTurns % followUps.length],
      hint: citationHint(item.citation),
      citation: item.citation,
      engine: "fallback",
    };
  }
}
