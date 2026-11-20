import type { TutorEvent } from "@/lib/schemas/tutor";
import type { TutorReply } from "./tutor-engine";

export function encodeSse(event: TutorEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Divide el texto en fragmentos de pocas palabras para transmitirlo como deltas. */
export function chunkText(text: string, wordsPerChunk = 3): string[] {
  const tokens = text.split(/(\s+)/).filter((t) => t.length > 0);
  const chunks: string[] = [];
  let current = "";
  let words = 0;
  for (const token of tokens) {
    current += token;
    if (!/^\s+$/.test(token)) words += 1;
    if (words >= wordsPerChunk && /\s$/.test(current)) {
      chunks.push(current);
      current = "";
      words = 0;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Convierte una respuesta del tutor en la secuencia de eventos SSE tipados. */
export function replyToEvents(reply: TutorReply): TutorEvent[] {
  const events: TutorEvent[] = chunkText(reply.text).map((delta) => ({ type: "text", delta }));
  if (reply.hint) events.push({ type: "hint", text: reply.hint });
  events.push({
    type: "citation",
    gpcId: reply.citation.gpcId,
    section: reply.citation.section,
    snippet: reply.citation.snippet,
  });
  events.push({ type: "done" });
  return events;
}

/** Parser de SSE para el cliente: acumula bytes y emite cada `data:` completo. */
export function createSseParser(onData: (data: string) => void) {
  let buffer = "";
  return (chunk: string) => {
    buffer += chunk;
    let index = buffer.indexOf("\n\n");
    while (index !== -1) {
      const raw = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      for (const line of raw.split("\n")) {
        if (line.startsWith("data: ")) onData(line.slice(6));
      }
      index = buffer.indexOf("\n\n");
    }
  };
}
