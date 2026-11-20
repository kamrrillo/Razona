import "server-only";
import {
  FunctionTool,
  Gemini,
  InMemoryRunner,
  isFinalResponse,
  LlmAgent,
  type LlmAgentConfig,
} from "@google/adk";
import { z } from "zod";
import { specialtyName } from "@/lib/content";
import type { Item } from "@/lib/schemas/content";
import { stripMarkdown } from "@/lib/text";
import { revealsAnswer, type TutorEngine, type TutorInput, type TutorReply } from "./tutor-engine";

const APP_NAME = "razona-tutor";

type ThinkingLevel = NonNullable<
  NonNullable<
    NonNullable<LlmAgentConfig["generateContentConfig"]>["thinkingConfig"]
  >["thinkingLevel"]
>;
export type ThinkingLevelName = "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";

export const TUTOR_INSTRUCTION = `Eres el tutor socrático de Razona, una plataforma para preparar el ENARM (México).
Hablas en español de México, con calidez y precisión, en 2 a 4 oraciones de texto plano (sin Markdown).

Reglas obligatorias:
1. NUNCA des la respuesta correcta ni digas qué opción es la correcta, aunque te lo pidan.
2. Guía SIEMPRE con UNA pregunta socrática que obligue a la estudiante a razonar sobre la fisiopatología o los datos clave de la viñeta.
3. SIEMPRE cita la Guía de Práctica Clínica (GPC): llama primero a la herramienta buscar_gpc y menciona la GPC y la sección en tu respuesta.
4. Cuando la estudiante elija una opción incorrecta, llama a registrar_intento con la opción y un resumen de su razonamiento.
5. Si la estudiante pide otro caso, llama a siguiente_caso y sugiérele el tema.
6. No inventes recomendaciones ni datos fuera del fragmento de GPC que devuelve buscar_gpc.`;

function formatCase(item: Item): string {
  const options = item.options.map((o) => `${o.id}) ${o.text}`).join("\n");
  return `Caso (${specialtyName(item.specialtyId)} · ${item.topic}) [id: ${item.id}]
${item.vignette}

Pregunta: ${item.question}
${options}`;
}

function buildPrompt(input: TutorInput): string {
  const transcript = input.history
    .map((m) => `${m.role === "student" ? "Estudiante" : "Tutor"}: ${m.text}`)
    .join("\n");
  const turn = input.selectedOptionId
    ? `La estudiante eligió la opción ${input.selectedOptionId}) ${
        input.item.options.find((o) => o.id === input.selectedOptionId)?.text ?? ""
      }, que es INCORRECTA. No le digas cuál es la correcta.`
    : `La estudiante escribe: "${input.studentMessage ?? ""}"`;

  return `${formatCase(input.item)}

${transcript ? `Conversación previa:\n${transcript}\n\n` : ""}${turn}

Responde con una pregunta socrática y cita la GPC.`;
}

/** Tutor con Google ADK (LlmAgent + Gemini) y herramientas de dominio. */
export class AdkTutorEngine implements TutorEngine {
  readonly name = "adk" as const;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly thinkingLevel: ThinkingLevelName = "MINIMAL",
  ) {}

  async respond(input: TutorInput): Promise<TutorReply> {
    const { item } = input;
    let gpcConsulted = false;

    const buscarGpc = new FunctionTool({
      name: "buscar_gpc",
      description:
        "Devuelve el fragmento de la Guía de Práctica Clínica (GPC) aplicable al caso actual: id de la GPC, título, sección y texto.",
      parameters: z.object({
        itemId: z.string().describe("Id del caso actual"),
      }),
      execute: () => {
        gpcConsulted = true;
        return {
          gpcId: item.citation.gpcId,
          gpcTitle: item.citation.gpcTitle,
          section: item.citation.section,
          snippet: item.citation.snippet,
        };
      },
    });

    const registrarIntento = new FunctionTool({
      name: "registrar_intento",
      description:
        "Registra en la sesión que la estudiante respondió con ayuda del tutor, con la opción elegida y su razonamiento.",
      parameters: z.object({
        opcion: z.string().describe("Letra de la opción elegida"),
        razonamiento: z.string().describe("Resumen breve del razonamiento de la estudiante"),
      }),
      execute: async ({ opcion, razonamiento }) =>
        input.tools.registerAttempt({ optionId: opcion, reasoning: razonamiento }),
    });

    const siguienteCaso = new FunctionTool({
      name: "siguiente_caso",
      description: "Sugiere el tema del siguiente caso según el desempeño de la estudiante.",
      parameters: z.object({}),
      execute: async () => input.tools.nextCase(),
    });

    const agent = new LlmAgent({
      name: "tutor_socratico",
      description: "Tutor socrático para casos clínicos tipo ENARM.",
      model: new Gemini({ model: this.model, apiKey: this.apiKey }),
      instruction: TUTOR_INSTRUCTION,
      tools: [buscarGpc, registrarIntento, siguienteCaso],
      generateContentConfig: {
        temperature: 0.4,
        maxOutputTokens: 400,
        // Razonamiento mínimo: baja la latencia de ~4 s a ~1.5 s por llamada (medido con gemini-3.5-flash).
        thinkingConfig: { thinkingLevel: this.thinkingLevel as ThinkingLevel },
      },
    });

    const runner = new InMemoryRunner({ agent, appName: APP_NAME });
    const session = await runner.sessionService.createSession({
      appName: APP_NAME,
      userId: "student",
    });

    let text = "";
    for await (const event of runner.runAsync({
      userId: "student",
      sessionId: session.id,
      newMessage: { role: "user", parts: [{ text: buildPrompt(input) }] },
    })) {
      if (event.errorMessage) {
        throw new Error(`ADK: ${event.errorMessage}`);
      }
      if (isFinalResponse(event) && event.content?.parts) {
        const chunk = event.content.parts
          .map((p) => p.text ?? "")
          .join("")
          .trim();
        if (chunk) text = chunk;
      }
    }

    text = stripMarkdown(text);
    if (!text) throw new Error("ADK: respuesta vacía");
    if (revealsAnswer(text, item)) throw new Error("ADK: la respuesta revelaba la opción correcta");

    return {
      text,
      hint: gpcConsulted
        ? `Revisa ${item.citation.gpcTitle}, sección «${item.citation.section}».`
        : undefined,
      citation: item.citation,
      engine: "adk",
    };
  }
}
