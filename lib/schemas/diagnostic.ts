import { z } from "zod";

/** Contratos con el servidor del agente de diagnóstico (agent/razona_agent/web_diagnostic.py). */

const OptionId = z.string().regex(/^[a-e]$/);

export const AgentCitationSchema = z.object({
  gpc_id: z.string(),
  gpc_title: z.string(),
  section: z.string(),
  snippet: z.string(),
});

export const DiagnosticItemSchema = z.object({
  id: z.string(),
  numero: z.number().int().positive(),
  specialty_id: z.string(),
  specialty_name: z.string(),
  topic: z.string(),
  title: z.string(),
  vignette: z.string(),
  question: z.string(),
  options: z.array(z.object({ id: OptionId, text: z.string() })),
  is_sample: z.boolean(),
});
export type DiagnosticItem = z.infer<typeof DiagnosticItemSchema>;

const StatSchema = z.object({
  specialty_id: z.string(),
  correct: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export const DiagnosticResultSchema = z.object({
  exam_id: z.string(),
  total: z.number().int().positive(),
  answered: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  score: z.number().min(0).max(100),
  by_specialty: z.array(StatSchema.extend({ name: z.string(), accuracy: z.number() })),
  weak_topics: z.array(StatSchema.extend({ topic: z.string(), mastery: z.number() })),
  overall_weak_topic: z
    .object({ topic: z.string(), specialty_name: z.string(), mastery: z.number() })
    .nullable(),
  review: z.array(
    z.object({
      item_id: z.string(),
      topic: z.string(),
      question: z.string(),
      selected_option: z.string().nullable(),
      correct_option: OptionId,
      correct_option_text: z.string(),
      is_correct: z.boolean(),
      explanation: z.string(),
      citation: AgentCitationSchema,
    }),
  ),
});
export type DiagnosticResult = z.infer<typeof DiagnosticResultSchema>;

export const DiagnosticResponseSchema = z.object({
  session_id: z.string().min(1),
  agente_disponible: z.boolean(),
  estado: z.object({
    exam_id: z.uuid(),
    total: z.number().int().positive(),
    respondidas: z.number().int().nonnegative(),
    finalizado: z.boolean(),
    reactivos: z.array(
      z.object({ id: z.string(), numero: z.number().int(), respondido: z.boolean() }),
    ),
    reactivo_actual: DiagnosticItemSchema.nullable(),
    resultado: DiagnosticResultSchema.nullable(),
  }),
  respuestas: z.array(z.object({ autor: z.string(), texto: z.string() })),
});
export type DiagnosticResponse = z.infer<typeof DiagnosticResponseSchema>;

// Peticiones de la app web (el user_id lo pone el servidor desde la sesión de Supabase).
const SessionId = z
  .string()
  .min(8)
  .max(100)
  .regex(/^[\w-]+$/);

export const DiagnosticStartRequestSchema = z.object({}).strict();
export const DiagnosticAnswerRequestSchema = z.object({
  sessionId: SessionId,
  itemId: z.string().min(1).max(120),
  optionId: OptionId,
});
export const DiagnosticMessageRequestSchema = z.object({
  sessionId: SessionId,
  text: z.string().trim().min(1).max(1000),
});
export const DiagnosticGradeRequestSchema = z.object({ sessionId: SessionId });
