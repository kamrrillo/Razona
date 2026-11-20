import "server-only";
import {
  Gemini,
  InMemoryRunner,
  isFinalResponse,
  LlmAgent,
  type LlmAgentConfig,
} from "@google/adk";
import { specialtyName } from "@/lib/content";
import type { Item } from "@/lib/schemas/content";
import { type ExplanationDiagram, ModelDiagramSchema } from "@/lib/schemas/diagram";
import { normalizeModelDiagram } from "./diagram";

const APP_NAME = "razona-diagramas";

type ThinkingLevel = NonNullable<
  NonNullable<
    NonNullable<LlmAgentConfig["generateContentConfig"]>["thinkingConfig"]
  >["thinkingLevel"]
>;

export const DIAGRAM_INSTRUCTION = `Eres el tutor de Razona. La estudiante YA resolvió el caso; ahora le explicas la respuesta con un diagrama paso a paso que se construye en orden.

Devuelve SOLO el JSON pedido, en español de México, texto plano (sin Markdown):
- title: título corto del razonamiento.
- steps (4 a 6 pasos, en orden lógico):
  1. "dato": 1 o 2 pasos con los datos clave de la viñeta que deciden el caso.
  2. "razonamiento": qué significan esos datos (gravedad, mecanismo, clasificación).
  3. "descarte": por qué la(s) opción(es) que eligió la estudiante no aplican (si eligió alguna incorrecta).
  4. "decision": la conducta/respuesta correcta.
- Cada paso: title de máximo 6 palabras y detail de 1 a 2 oraciones (máx. 220 caracteres).

Reglas estrictas:
- Usa ÚNICAMENTE información de la viñeta, las opciones, la explicación y el fragmento de la GPC que te doy. No agregues datos, cifras ni recomendaciones que no estén ahí.
- No incluyas un paso de tipo "gpc": la app agrega la cita de la GPC al final.`;

function buildPrompt(item: Item, wrongOptionIds: string[]): string {
  const options = item.options.map((o) => `${o.id}) ${o.text}`).join("\n");
  const wrong = wrongOptionIds
    .map((id) => `${id}) ${item.options.find((o) => o.id === id)?.text ?? ""}`)
    .join("; ");
  return `Caso (${specialtyName(item.specialtyId)} · ${item.topic}):
${item.vignette}

Pregunta: ${item.question}
${options}

Respuesta correcta: ${item.correctOptionId})
Explicación: ${item.explanation}
GPC: ${item.citation.gpcTitle} — ${item.citation.section}: ${item.citation.snippet}

Opciones incorrectas que eligió la estudiante: ${wrong || "ninguna (acertó al primer intento)"}`;
}

/** Genera el diagrama con un LlmAgent de ADK con salida estructurada (outputSchema). */
export async function generateDiagramWithAdk(
  item: Item,
  wrongOptionIds: string[],
  opts: { apiKey: string; model: string; thinkingLevel: string },
): Promise<ExplanationDiagram> {
  const agent = new LlmAgent({
    name: "explicador_diagramas",
    description: "Convierte la explicación de un caso resuelto en un diagrama paso a paso.",
    model: new Gemini({ model: opts.model, apiKey: opts.apiKey }),
    instruction: DIAGRAM_INSTRUCTION,
    outputSchema: ModelDiagramSchema,
    generateContentConfig: {
      temperature: 0.3,
      maxOutputTokens: 1200,
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
    newMessage: { role: "user", parts: [{ text: buildPrompt(item, wrongOptionIds) }] },
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
  const parsed = ModelDiagramSchema.parse(JSON.parse(json));
  return normalizeModelDiagram(item, parsed);
}
