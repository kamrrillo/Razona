import { z } from "zod";

/**
 * Contratos del contenido clínico.
 *
 * La fuente es el banco de casos (json/casos), que se carga en Supabase con
 * json/herramientas/cargar_supabase.py. La vista `v_casos_app` traduce cada caso a
 * `Item`; la app web (lib/content) y el agente de Python leen de ahí.
 */

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
  /** Página del PDF de la GPC (desde 1). */
  page: z.number().int().positive().optional(),
  snippet: z.string().min(1),
  /** Enlace público al PDF de la GPC (campo `url` de json/fuentes), si existe. */
  pdfUrl: z.url({ protocol: /^https$/ }).optional(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const ErrorTypeSchema = z.enum(["lectura", "dato_omitido", "razonamiento", "conocimiento"]);
export type ErrorType = z.infer<typeof ErrorTypeSchema>;

/** Entrada de la rúbrica: SOLO servidor (revela la respuesta por descarte). */
export const RubricEntrySchema = z.object({
  errorType: ErrorTypeSchema,
  description: z.string().min(1),
  optionIds: z.array(z.string().regex(/^[a-e]$/)).min(1),
  question: z.string().min(1),
  explanation: z.string().min(1),
  citation: CitationSchema,
});
export type RubricEntry = z.infer<typeof RubricEntrySchema>;

export const KeyPointSchema = z.object({
  text: z.string().min(1),
  citation: CitationSchema,
});
export type KeyPoint = z.infer<typeof KeyPointSchema>;

const ResourceBase = {
  id: z.string().min(1),
  concept: z.string().min(1),
  errorTypes: z.array(ErrorTypeSchema).min(1),
  citations: z.array(CitationSchema).optional(),
};

/**
 * Recurso de aprendizaje del banco (json/casos: "recursos"). Se muestra solo DESPUÉS de
 * responder: puede contener la respuesta. Nunca va en PublicItem.
 */
export const ResourceSchema = z.discriminatedUnion("type", [
  z.object({
    ...ResourceBase,
    type: z.literal("flashcard"),
    front: z.string().min(1),
    back: z.string().min(1),
  }),
  z.object({ ...ResourceBase, type: z.literal("diagram"), code: z.string().min(1) }),
  z.object({
    ...ResourceBase,
    type: z.literal("highlight"),
    fragment: z.string().min(1),
    reason: z.string().min(1),
  }),
  z.object({
    ...ResourceBase,
    type: z.literal("table"),
    columns: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())).min(1),
  }),
  z.object({
    ...ResourceBase,
    type: z.literal("image"),
    imagePath: z.string().regex(/^\/recursos\/[A-Za-z0-9-]+\.(jpg|jpeg|png|svg|webp)$/),
    description: z.string().min(1),
    source: z.string().min(1),
    author: z.string().min(1),
    license: z.string().min(1),
    sourceUrl: z.string().url(),
  }),
]);
export type Resource = z.infer<typeof ResourceSchema>;
export type ResourceType = Resource["type"];

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
    // Campos del banco de casos (opcionales para no romper consumidores anteriores).
    specialtyName: z.string().optional(),
    tipo: z.enum(["indice", "variante"]).optional(),
    casoIndiceId: z.string().nullable().optional(),
    sindrome: z.string().optional(),
    groupId: z.string().optional(),
    groupName: z.string().optional(),
    keyPoints: z.array(KeyPointSchema).optional(),
    rubric: z.array(RubricEntrySchema).optional(),
    resources: z.array(ResourceSchema).optional(),
  })
  .refine((item) => item.options.some((o) => o.id === item.correctOptionId), {
    message: "correctOptionId debe existir en options",
  });
export type Item = z.infer<typeof ItemSchema>;

/** Lo que ve el cliente antes de responder: sin respuesta, explicación, cita ni rúbrica. */
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

/** Tema del catálogo (tabla `temas`). */
export const TopicSchema = z.object({
  sindrome: z.string().min(1),
  name: z.string().min(1),
  groupId: z.string().min(1),
});
export type Topic = z.infer<typeof TopicSchema>;

/** Grupo de temas (tabla `temas_grupos`). */
export const TopicGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  specialtyId: z.string().min(1),
});
export type TopicGroup = z.infer<typeof TopicGroupSchema>;
