import { type TutorEvent, TutorEventSchema } from "@/lib/schemas/tutor";
import { createSseParser } from "./sse";

/** Consume /api/tutor (SSE sobre POST) y emite eventos tipados y validados. */
export async function streamTutor(
  body: { sessionId: string; optionId?: string; message?: string },
  onEvent: (event: TutorEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/tutor", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    onEvent({ type: "error", message: "El tutor no está disponible. Intenta de nuevo." });
    return;
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  const parse = createSseParser((data) => {
    try {
      const parsed = TutorEventSchema.safeParse(JSON.parse(data));
      if (parsed.success) onEvent(parsed.data);
    } catch {
      // Ignora fragmentos mal formados.
    }
  });
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parse(value);
  }
}
