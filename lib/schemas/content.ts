import { z } from "zod";

export const SAMPLE_NOTICE =
  "CONTENIDO DE EJEMPLO — reemplazar por los ítems validados";

export const SpecialtySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type Specialty = z.infer<typeof SpecialtySchema>;

export const OptionSchema = z.object({
  id: z.string().regex(/^[a-e]$/),
  text: z.string().min(1),
});
export type Option = z.infer<typeof OptionSchema>;

export const CitationSchema = z.object({
  gpcId: z.string().min(1),
  gpcTitle: z.string().min(1),
  section: z.string().min(1),
  snippet: z.string().min(1),
});
export type Citation = z.infer<typeof CitationSchema>;

export const ItemSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["case", "exam"]),
    specialtyId: z.string().min(1),
    topic: z.string().min(1),
    title: z.string().min(1),
    vignette: z.string().min(1),
    question: z.string().min(1),
    options: z.array(OptionSchema).min(3).max(5),
    correctOptionId: z.string().regex(/^[a-e]$/),
    explanation: z.string().min(1),
    citation: CitationSchema,
    isSample: z.boolean(),
  })
  .refine((item) => item.options.some((o) => o.id === item.correctOptionId), {
    message: "correctOptionId debe existir en options",
  });
export type Item = z.infer<typeof ItemSchema>;

/** Lo que ve el cliente antes de responder: sin respuesta, explicación ni cita. */
export const PublicItemSchema = z.object({
  id: z.string(),
  kind: z.enum(["case", "exam"]),
  specialtyId: z.string(),
  specialtyName: z.string(),
  topic: z.string(),
  title: z.string(),
  vignette: z.string(),
  question: z.string(),
  options: z.array(OptionSchema),
  isSample: z.boolean(),
});
export type PublicItem = z.infer<typeof PublicItemSchema>;

export const ItemsFileSchema = z.object({
  notice: z.literal(SAMPLE_NOTICE),
  specialties: z.array(SpecialtySchema).min(1),
  items: z.array(ItemSchema).min(1),
});
export type ItemsFile = z.infer<typeof ItemsFileSchema>;

export const ExamFileSchema = z
  .object({
    notice: z.literal(SAMPLE_NOTICE),
    examKey: z.string().min(1),
    title: z.string().min(1),
    durationMinutes: z.number().int().positive(),
    items: z.array(ItemSchema).length(10),
    /** Respuestas precargadas para el botón "Completar examen (demo)". */
    demoAnswers: z.record(z.string(), z.string().regex(/^[a-e]$/)),
  })
  .refine((exam) => exam.items.every((i) => i.id in exam.demoAnswers), {
    message: "demoAnswers debe cubrir los 10 reactivos",
  });
export type ExamFile = z.infer<typeof ExamFileSchema>;

export const FallbackScriptSchema = z.object({
  /** Pregunta socrática por opción incorrecta elegida. */
  byOption: z.record(
    z.string().regex(/^[a-e]$/),
    z.object({ question: z.string().min(1), hint: z.string().min(1) }),
  ),
  /** Respuesta cuando la estudiante escribe en el chat sin una opción nueva. */
  followUp: z.array(z.string().min(1)).min(1),
});
export type FallbackScript = z.infer<typeof FallbackScriptSchema>;

export const TutorFallbackFileSchema = z.object({
  notice: z.literal(SAMPLE_NOTICE),
  scripts: z.record(z.string(), FallbackScriptSchema),
});
export type TutorFallbackFile = z.infer<typeof TutorFallbackFileSchema>;
