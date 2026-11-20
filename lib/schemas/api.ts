import { z } from "zod";
import { CitationSchema, PublicItemSchema } from "./content";
import { ChatMessageSchema } from "./tutor";

const OptionId = z.string().regex(/^[a-e]$/);

// POST /api/session ---------------------------------------------------------
export const SessionRequestSchema = z.object({
  /** Tema a practicar. "weak" = tema débil actual. Omitido = Thompson sampling. */
  topic: z.string().min(1).max(120).optional(),
  excludeItemId: z.string().optional(),
});
export const SessionResponseSchema = z.object({
  sessionId: z.uuid(),
  item: PublicItemSchema,
  reason: z.enum(["topic", "weak", "thompson"]),
  messages: z.array(ChatMessageSchema),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

// POST /api/attempt ---------------------------------------------------------
export const AttemptRequestSchema = z.object({
  sessionId: z.uuid(),
  optionId: OptionId,
});
export const AttemptResponseSchema = z.discriminatedUnion("isCorrect", [
  z.object({
    isCorrect: z.literal(true),
    attemptNumber: z.number().int().positive(),
    explanation: z.string(),
    correctOptionId: OptionId,
    citation: CitationSchema,
  }),
  z.object({
    isCorrect: z.literal(false),
    attemptNumber: z.number().int().positive(),
  }),
]);
export type AttemptResponse = z.infer<typeof AttemptResponseSchema>;

// POST /api/tutor -----------------------------------------------------------
export const TutorRequestSchema = z
  .object({
    sessionId: z.uuid(),
    /** Opción incorrecta recién elegida (dispara la pregunta socrática). */
    optionId: OptionId.optional(),
    /** Mensaje libre de la estudiante. */
    message: z.string().trim().min(1).max(1000).optional(),
  })
  .refine((r) => r.optionId || r.message, { message: "optionId o message requerido" });
export type TutorRequest = z.infer<typeof TutorRequestSchema>;

// POST /api/exam/start ------------------------------------------------------
export const ExamStartRequestSchema = z.object({}).strict();
export const ExamStartResponseSchema = z.object({
  examId: z.uuid(),
});

// POST /api/exam/answer -----------------------------------------------------
export const ExamAnswerRequestSchema = z.object({
  examId: z.uuid(),
  itemId: z.string().min(1),
  optionId: OptionId,
});
export const ExamAnswerResponseSchema = z.object({
  ok: z.literal(true),
  answered: z.number().int().nonnegative(),
});

// POST /api/exam/grade ------------------------------------------------------
export const ExamGradeRequestSchema = z.object({
  examId: z.uuid(),
  /** Completa los reactivos sin responder con las respuestas precargadas (demo). */
  fillDemo: z.boolean().default(false),
});
export const ExamGradeResponseSchema = z.object({
  examId: z.uuid(),
  correct: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  score: z.number().min(0).max(100),
});

// GET /api/progress ---------------------------------------------------------
export const ProgressSchema = z.object({
  displayName: z.string(),
  streak: z.object({
    current: z.number().int().nonnegative(),
    activeToday: z.boolean(),
    lastSevenDays: z.array(z.object({ day: z.string(), active: z.boolean() })),
  }),
  totals: z.object({
    answered: z.number().int().nonnegative(),
    correct: z.number().int().nonnegative(),
    answeredToday: z.number().int().nonnegative(),
  }),
  bySpecialty: z.array(
    z.object({
      specialtyId: z.string(),
      name: z.string(),
      correct: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
      accuracy: z.number().min(0).max(1),
    }),
  ),
  byTopic: z.array(
    z.object({
      topic: z.string(),
      specialtyId: z.string(),
      correct: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
      mastery: z.number().min(0).max(1),
    }),
  ),
  weakTopic: z
    .object({
      topic: z.string(),
      specialtyId: z.string(),
      specialtyName: z.string(),
      correct: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
      mastery: z.number().min(0).max(1),
      /** Dominio antes de la actividad de hoy (para mostrar el cambio). */
      masteryBeforeToday: z.number().min(0).max(1).nullable(),
    })
    .nullable(),
  recentExams: z.array(
    z.object({
      id: z.uuid(),
      finishedAt: z.string(),
      score: z.number(),
      correct: z.number().int(),
      total: z.number().int(),
    }),
  ),
});
export type Progress = z.infer<typeof ProgressSchema>;

export const ApiErrorSchema = z.object({ error: z.string() });
