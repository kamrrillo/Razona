import type { Citation, Item } from "@/lib/schemas/content";
import type { ChatMessage } from "@/lib/schemas/tutor";

/** Herramientas de dominio que el tutor puede invocar (implementadas por el servidor). */
export type TutorTools = {
  /** Marca el último intento de la sesión como acompañado por el tutor. */
  registerAttempt: (input: { optionId?: string; reasoning?: string }) => Promise<{ ok: boolean }>;
  /** Devuelve el tema sugerido para el siguiente caso (Thompson sampling). */
  nextCase: () => Promise<{ topic: string; title: string }>;
};

export type TutorInput = {
  item: Item;
  history: ChatMessage[];
  /** Opción incorrecta recién elegida. */
  selectedOptionId?: string;
  /** Mensaje libre de la estudiante. */
  studentMessage?: string;
  tools: TutorTools;
};

export type TutorReply = {
  text: string;
  hint?: string;
  citation: Citation;
  engine: "adk" | "fallback";
};

export interface TutorEngine {
  readonly name: "adk" | "fallback" | "resilient";
  respond(input: TutorInput): Promise<TutorReply>;
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Salvaguarda: detecta si una respuesta del modelo revela la opción correcta.
 * Si la revela, se descarta y se usa el tutor de respaldo.
 */
export function revealsAnswer(text: string, item: Item): boolean {
  const t = normalize(text);
  if (/(la )?respuesta correcta (es|seria)|opcion correcta (es|seria)|inciso correcto/.test(t)) {
    return true;
  }
  const correct = item.options.find((o) => o.id === item.correctOptionId);
  if (!correct) return false;
  const correctText = normalize(correct.text);
  return correctText.length >= 12 && t.includes(correctText);
}
