import "server-only";
import { serverEnv } from "@/lib/env.server";
import type { Item } from "@/lib/schemas/content";
import type { TutorExplanation } from "@/lib/schemas/explanation";
import { buildFallbackExplanation, type LearnerContext } from "./feedback";

const EXPLANATION_TIMEOUT_MS = 14000;

/** Explicación personalizada con ADK si hay clave; si falla o tarda, la de respaldo. */
export async function explainForLearner(
  item: Item,
  ctx: LearnerContext,
): Promise<TutorExplanation> {
  const fallback = () => buildFallbackExplanation(item, ctx);
  if (!serverEnv.googleApiKey) return fallback();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { generateExplanationWithAdk } = await import("./adk-explanation");
    return await Promise.race([
      generateExplanationWithAdk(item, ctx, {
        apiKey: serverEnv.googleApiKey,
        model: serverEnv.geminiModel,
        thinkingLevel: serverEnv.geminiThinkingLevel,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), EXPLANATION_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.warn("[explicación] usando respaldo:", error instanceof Error ? error.message : error);
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}
