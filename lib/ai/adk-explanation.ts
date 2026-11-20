import "server-only";
import {
  Gemini,
  InMemoryRunner,
  isFinalResponse,
  LlmAgent,
  type LlmAgentConfig,
} from "@google/adk";
import type { Item } from "@/lib/schemas/content";
import { ModelExplanationSchema, type TutorExplanation } from "@/lib/schemas/explanation";
import {
  buildExplanationPrompt,
  EXPLANATION_INSTRUCTION,
  type LearnerContext,
  normalizeModelExplanation,
} from "./feedback";

const APP_NAME = "razona-explicaciones";

type ThinkingLevel = NonNullable<
  NonNullable<
    NonNullable<LlmAgentConfig["generateContentConfig"]>["thinkingConfig"]
  >["thinkingLevel"]
>;

/** Retroalimentación + diagrama conceptual con un LlmAgent de ADK y salida estructurada. */
export async function generateExplanationWithAdk(
  item: Item,
  ctx: LearnerContext,
  opts: { apiKey: string; model: string; thinkingLevel: string },
): Promise<TutorExplanation> {
  const agent = new LlmAgent({
    name: "tutor_explicador",
    description: "Explica un reactivo resuelto con retroalimentación personalizada y un diagrama.",
    model: new Gemini({ model: opts.model, apiKey: opts.apiKey }),
    instruction: EXPLANATION_INSTRUCTION,
    outputSchema: ModelExplanationSchema,
    generateContentConfig: {
      temperature: 0.4,
      maxOutputTokens: 3000,
      thinkingConfig: { thinkingLevel: opts.thinkingLevel as ThinkingLevel },
    },
  });
  const runner = new InMemoryRunner({ agent, appName: APP_NAME });
  const session = await runner.sessionService.createSession({
    appName: APP_NAME,
    userId: "student",
  });

  let raw = "";
  for await (const event of runner.runAsync({
    userId: "student",
    sessionId: session.id,
    newMessage: { role: "user", parts: [{ text: buildExplanationPrompt(item, ctx) }] },
  })) {
    if (event.errorMessage) throw new Error(`ADK: ${event.errorMessage}`);
    if (isFinalResponse(event) && event.content?.parts) {
      const text = event.content.parts
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      if (text) raw = text;
    }
  }
  const json = raw.replace(/^```(?:json)?\s*|\s*```$/g, "");
  return normalizeModelExplanation(item, ctx, ModelExplanationSchema.parse(JSON.parse(json)));
}
