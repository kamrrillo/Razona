import { tutorFallbackFile } from "@/lib/content";
import type { TutorEngine, TutorInput, TutorReply } from "./tutor-engine";

const GENERIC_QUESTION =
  "Antes de elegir otra opción: ¿qué dato de la viñeta te parece más importante para decidir? ¿Qué mecanismo explica ese hallazgo?";
const GENERIC_HINT = "Relee la viñeta y compara cada opción con lo que recomienda la GPC citada.";

/** Tutor de respaldo: respuestas precalculadas por ítem (content/tutor-fallback.json). */
export class FallbackTutorEngine implements TutorEngine {
  readonly name = "fallback" as const;

  async respond(input: TutorInput): Promise<TutorReply> {
    const script = tutorFallbackFile.scripts[input.item.id];
    const citation = input.item.citation;
    const hintSuffix = `Revisa ${citation.gpcTitle}, sección «${citation.section}».`;

    if (input.selectedOptionId) {
      const entry = script?.byOption[input.selectedOptionId];
      await input.tools
        .registerAttempt({ optionId: input.selectedOptionId })
        .catch(() => undefined);
      return {
        text: entry?.question ?? GENERIC_QUESTION,
        hint: entry?.hint ?? `${GENERIC_HINT} ${hintSuffix}`,
        citation,
        engine: "fallback",
      };
    }

    const studentTurns = input.history.filter((m) => m.role === "student" && !m.optionId).length;
    const followUps = script?.followUp ?? [GENERIC_QUESTION];
    return {
      text: followUps[studentTurns % followUps.length],
      hint: hintSuffix,
      citation,
      engine: "fallback",
    };
  }
}
