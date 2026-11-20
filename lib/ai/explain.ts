import "server-only";
import { serverEnv } from "@/lib/env.server";
import type { Item } from "@/lib/schemas/content";
import type { ExplanationDiagram } from "@/lib/schemas/diagram";
import { buildFallbackDiagram } from "./diagram";

const DIAGRAM_TIMEOUT_MS = 9000;

/** Diagrama con ADK si hay clave; si falla o tarda, el diagrama determinista del ítem. */
export async function explainWithDiagram(
  item: Item,
  wrongOptionIds: string[],
): Promise<ExplanationDiagram> {
  const fallback = () => buildFallbackDiagram(item, wrongOptionIds);
  if (!serverEnv.googleApiKey) return fallback();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { generateDiagramWithAdk } = await import("./adk-diagram");
    return await Promise.race([
      generateDiagramWithAdk(item, wrongOptionIds, {
        apiKey: serverEnv.googleApiKey,
        model: serverEnv.geminiModel,
        thinkingLevel: serverEnv.geminiThinkingLevel,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), DIAGRAM_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.warn("[diagrama] usando respaldo:", error instanceof Error ? error.message : error);
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}
