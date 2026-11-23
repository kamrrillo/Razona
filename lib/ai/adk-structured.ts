import "server-only";
import {
  Gemini,
  InMemoryRunner,
  isFinalResponse,
  LlmAgent,
  type LlmAgentConfig,
} from "@google/adk";
import type { z } from "zod";

type ThinkingLevel = NonNullable<
  NonNullable<
    NonNullable<LlmAgentConfig["generateContentConfig"]>["thinkingConfig"]
  >["thinkingLevel"]
>;

export type GeminiOptions = { apiKey: string; model: string; thinkingLevel: string };

/**
 * Corre un LlmAgent de ADK de un solo turno con salida estructurada (outputSchema) y devuelve
 * el JSON validado con Zod. Lo usan la explicación, el widget y el diálogo socrático.
 */
export async function runStructuredAgent<S extends z.ZodType>(opts: {
  appName: string;
  name: string;
  description: string;
  instruction: string;
  schema: S;
  prompt: string;
  gemini: GeminiOptions;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<z.output<S>> {
  const agent = new LlmAgent({
    name: opts.name,
    description: opts.description,
    model: new Gemini({ model: opts.gemini.model, apiKey: opts.gemini.apiKey }),
    instruction: opts.instruction,
    outputSchema: opts.schema as unknown as LlmAgentConfig["outputSchema"],
    generateContentConfig: {
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxOutputTokens ?? 3000,
      thinkingConfig: { thinkingLevel: opts.gemini.thinkingLevel as ThinkingLevel },
    },
  });
  const runner = new InMemoryRunner({ agent, appName: opts.appName });
  const session = await runner.sessionService.createSession({
    appName: opts.appName,
    userId: "student",
  });

  let raw = "";
  for await (const event of runner.runAsync({
    userId: "student",
    sessionId: session.id,
    newMessage: { role: "user", parts: [{ text: opts.prompt }] },
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
  return opts.schema.parse(JSON.parse(json));
}

/** Corre `task` con un límite de tiempo; al vencer, rechaza con "timeout". */
export async function withTimeout<T>(task: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
