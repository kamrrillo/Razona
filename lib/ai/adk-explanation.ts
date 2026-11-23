import "server-only";
import type { Item } from "@/lib/schemas/content";
import { ModelExplanationSchema, type TutorExplanation } from "@/lib/schemas/explanation";
import { type GeminiOptions, runStructuredAgent } from "./adk-structured";
import {
  buildExplanationPrompt,
  EXPLANATION_INSTRUCTION,
  type LearnerContext,
  normalizeModelExplanation,
} from "./feedback";

/** Explicación (GPC primero) + diagrama + pregunta socrática con un LlmAgent de ADK. */
export async function generateExplanationWithAdk(
  item: Item,
  ctx: LearnerContext,
  gemini: GeminiOptions,
): Promise<TutorExplanation> {
  const raw = await runStructuredAgent({
    appName: "razona-explicaciones",
    name: "tutor_explicador",
    description: "Explica un reactivo resuelto citando la GPC, con diagrama y pregunta socrática.",
    instruction: EXPLANATION_INSTRUCTION,
    schema: ModelExplanationSchema,
    prompt: buildExplanationPrompt(item, ctx),
    gemini,
    temperature: 0.4,
    maxOutputTokens: 3500,
  });
  return normalizeModelExplanation(item, ctx, raw);
}
