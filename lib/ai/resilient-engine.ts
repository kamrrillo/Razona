import type { TutorEngine, TutorInput, TutorReply } from "./tutor-engine";

export class TimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`timeout ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Usa el motor principal (ADK) y, si falla o tarda más de `timeoutMs`,
 * responde con el de respaldo. La estudiante no nota el cambio: ambos
 * producen el mismo tipo de respuesta y se transmiten igual por SSE.
 */
export class ResilientTutorEngine implements TutorEngine {
  readonly name = "resilient" as const;

  constructor(
    private readonly primary: TutorEngine,
    private readonly fallback: TutorEngine,
    private readonly timeoutMs: number,
    private readonly onFallback?: (reason: unknown) => void,
  ) {}

  async respond(input: TutorInput): Promise<TutorReply> {
    try {
      return await withTimeout(this.primary.respond(input), this.timeoutMs);
    } catch (error) {
      this.onFallback?.(error);
      return this.fallback.respond(input);
    }
  }
}
