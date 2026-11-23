import "server-only";
import { serverEnv } from "@/lib/env.server";
import type { Item } from "@/lib/schemas/content";
import type { TutorExplanation } from "@/lib/schemas/explanation";
import { withTimeout } from "./adk-structured";
import { buildFallbackExplanation, type LearnerContext } from "./feedback";

const EXPLANATION_TIMEOUT_MS = 16000;

export function geminiOptions() {
  if (!serverEnv.googleApiKey) return null;
  return {
    apiKey: serverEnv.googleApiKey,
    model: serverEnv.geminiModel,
    thinkingLevel: serverEnv.geminiThinkingLevel,
  };
}

/** Explicación personalizada con ADK si hay clave; si falla o tarda, la de respaldo. */
export async function explainForLearner(
  item: Item,
  ctx: LearnerContext,
): Promise<TutorExplanation> {
  const gemini = geminiOptions();
  if (!gemini) return buildFallbackExplanation(item, ctx);
  try {
    const { generateExplanationWithAdk } = await import("./adk-explanation");
    return await withTimeout(generateExplanationWithAdk(item, ctx, gemini), EXPLANATION_TIMEOUT_MS);
  } catch (error) {
    console.warn("[explicación] usando respaldo:", error instanceof Error ? error.message : error);
    return buildFallbackExplanation(item, ctx);
  }
}
