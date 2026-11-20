import { z } from "zod";

/**
 * Diagrama de explicación paso a paso. El modelo NO genera SVG: devuelve esta estructura
 * (validada) y la app la dibuja con su propio componente.
 */
export const DiagramStepKindSchema = z.enum([
  "dato", // dato clave de la viñeta
  "razonamiento", // interpretación / mecanismo
  "descarte", // por qué una opción no aplica
  "decision", // la respuesta correcta
  "gpc", // recomendación de la GPC
]);
export type DiagramStepKind = z.infer<typeof DiagramStepKindSchema>;

export const DiagramStepSchema = z.object({
  kind: DiagramStepKindSchema,
  title: z.string().trim().min(1).max(60),
  detail: z.string().trim().min(1).max(260),
});
export type DiagramStep = z.infer<typeof DiagramStepSchema>;

export const ExplanationDiagramSchema = z.object({
  title: z.string().trim().min(1).max(80),
  steps: z.array(DiagramStepSchema).min(3).max(7),
  source: z.enum(["adk", "fallback"]),
});
export type ExplanationDiagram = z.infer<typeof ExplanationDiagramSchema>;

/** Lo que pide el modelo (sin `source`; la app lo agrega). Límites holgados: luego se recortan. */
export const ModelDiagramSchema = z.object({
  title: z.string(),
  steps: z
    .array(
      z.object({
        kind: DiagramStepKindSchema,
        title: z.string(),
        detail: z.string(),
      }),
    )
    .min(3)
    .max(8),
});

export const ExplainRequestSchema = z.union([
  z.object({ sessionId: z.uuid() }).strict(),
  z.object({ examId: z.uuid(), itemId: z.string().min(1).max(120) }).strict(),
]);
