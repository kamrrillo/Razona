import "server-only";
import { serverEnv } from "@/lib/env.server";
import { FallbackTutorEngine } from "./fallback-engine";
import { ResilientTutorEngine } from "./resilient-engine";
import type { TutorEngine, TutorInput, TutorReply } from "./tutor-engine";

/** Carga ADK de forma diferida: si el módulo no carga, el ResilientTutorEngine usa el respaldo. */
class LazyAdkTutorEngine implements TutorEngine {
  readonly name = "adk" as const;
  private engine: Promise<TutorEngine> | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async respond(input: TutorInput): Promise<TutorReply> {
    this.engine ??= import("./adk-engine").then(
      ({ AdkTutorEngine }) => new AdkTutorEngine(this.apiKey, this.model),
    );
    try {
      return await (await this.engine).respond(input);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("ADK")) this.engine = null;
      throw error;
    }
  }
}

let cached: TutorEngine | null = null;

/** ADK si hay GOOGLE_GENAI_API_KEY (con respaldo automático); si no, solo respaldo. */
export function getTutorEngine(): TutorEngine {
  if (cached) return cached;
  const fallback = new FallbackTutorEngine();
  cached = serverEnv.googleApiKey
    ? new ResilientTutorEngine(
        new LazyAdkTutorEngine(serverEnv.googleApiKey, serverEnv.geminiModel),
        fallback,
        serverEnv.tutorTimeoutMs,
        (reason) =>
          console.warn(
            "[tutor] usando respaldo:",
            reason instanceof Error ? reason.message : reason,
          ),
      )
    : fallback;
  return cached;
}
