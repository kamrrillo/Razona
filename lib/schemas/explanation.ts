import { z } from "zod";
import { CitationSchema } from "./content";

/**
 * Explicación del tutor después de resolver un reactivo: retroalimentación personalizada,
 * fundamentos y un diagrama conceptual. El modelo NO genera SVG: devuelve datos estructurados
 * (validados y normalizados) y la app los dibuja con sus propios componentes.
 */

/** A qué reactivo resuelto se refiere la explicación. */
const ExplainTargetSchema = z.union([
  z.object({ sessionId: z.uuid() }).strict(),
  z.object({ examId: z.uuid(), itemId: z.string().min(1).max(120) }).strict(),
]);

/** Papel de un elemento del diagrama (define su color). */
export const NodeRoleSchema = z.enum([
  "raiz", // concepto central
  "normal",
  "clave", // dato que decide el caso
  "respuesta", // la respuesta correcta / donde cae el caso
  "elegida", // lo que eligió la estudiante (incorrecto)
]);
export type NodeRole = z.infer<typeof NodeRoleSchema>;

const label = z.string().trim().min(1).max(40);
const note = z.string().trim().max(180);

export type TreeNode = {
  label: string;
  note?: string;
  /** Texto sobre la arista que llega desde el padre (p. ej. "SatO₂ < 92 %"). */
  edge?: string;
  role: NodeRole;
  children: TreeNode[];
};

export const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    label,
    note: note.optional(),
    edge: z.string().trim().max(28).optional(),
    role: NodeRoleSchema,
    children: z.array(TreeNodeSchema).max(4),
  }),
);

export const FlowNodeSchema = z.object({
  label,
  note: note.optional(),
  /** Texto de la flecha hacia el siguiente nodo. */
  edge: z.string().trim().max(28).optional(),
  role: NodeRoleSchema,
});

export const ScaleRangeSchema = z.object({
  from: z.number(),
  to: z.number(),
  label: z.string().trim().min(1).max(32),
  role: NodeRoleSchema,
});

export const ConceptDiagramSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("arbol"),
    title: z.string().trim().min(1).max(80),
    root: TreeNodeSchema,
  }),
  z.object({
    kind: z.literal("flujo"),
    title: z.string().trim().min(1).max(80),
    nodes: z.array(FlowNodeSchema).min(2).max(6),
  }),
  z.object({
    kind: z.literal("escala"),
    title: z.string().trim().min(1).max(80),
    unit: z.string().trim().max(16),
    min: z.number(),
    max: z.number(),
    ranges: z.array(ScaleRangeSchema).min(2).max(5),
    marker: z.object({ value: z.number(), label: z.string().trim().min(1).max(32) }).optional(),
  }),
  z.object({
    kind: z.literal("comparacion"),
    title: z.string().trim().min(1).max(80),
    columns: z
      .array(z.object({ label: z.string().trim().min(1).max(28), role: NodeRoleSchema }))
      .min(2)
      .max(3),
    rows: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(28),
          cells: z.array(z.string().trim().max(70)),
        }),
      )
      .min(2)
      .max(5),
  }),
]);
export type ConceptDiagram = z.infer<typeof ConceptDiagramSchema>;

export const TutorExplanationSchema = z.object({
  /** Retroalimentación personalizada (camino de la estudiante, su historial en el tema). */
  personal: z.string().trim().min(1).max(600),
  /** Lo primero que se explica: qué dice la GPC sobre el caso, citándola (clave, sección, página). */
  gpc: z.string().trim().min(1).max(800),
  /** Cita principal (con enlace al PDF si la fuente lo trae). */
  citation: CitationSchema,
  /** Por qué la respuesta correcta es correcta, con el mecanismo. */
  why: z.string().trim().min(1).max(900),
  fundamentals: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(60),
        text: z.string().trim().min(1).max(320),
      }),
    )
    .min(1)
    .max(4),
  /** Por qué no aplica cada opción incorrecta (primero las que eligió). */
  distractors: z
    .array(
      z.object({
        optionId: z.string().regex(/^[a-e]$/),
        optionText: z.string(),
        text: z.string().trim().min(1).max(320),
        chosen: z.boolean(),
      }),
    )
    .max(4),
  nextStep: z.string().trim().min(1).max(320),
  /** Cierre: pregunta socrática para seguir razonando con el tutor. */
  socraticQuestion: z.string().trim().min(1).max(320),
  diagram: ConceptDiagramSchema,
  /** Quién redactó el texto y quién el diagrama ("adk" = Gemini vía ADK, "fallback" = la app). */
  source: z.enum(["adk", "fallback"]),
  diagramSource: z.enum(["adk", "fallback"]),
});
export type TutorExplanation = z.infer<typeof TutorExplanationSchema>;

/**
 * Lo que se le pide al modelo (outputSchema de ADK). Plano y sin uniones para que Gemini lo
 * respete; los límites son holgados porque luego se recortan y se arma el diagrama tipado.
 */
export const ModelExplanationSchema = z.object({
  personal: z.string(),
  gpc: z
    .string()
    .describe("Qué dice la GPC sobre este caso, citándola con clave, sección y página."),
  why: z.string(),
  fundamentals: z.array(z.object({ title: z.string(), text: z.string() })),
  distractors: z.array(z.object({ optionId: z.string(), text: z.string() })),
  nextStep: z.string(),
  socraticQuestion: z.string().describe("Una sola pregunta socrática que termina en «?»."),
  diagram: z.object({
    kind: z.enum(["arbol", "flujo", "escala", "comparacion"]),
    title: z.string(),
    nodes: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          note: z.string(),
          role: NodeRoleSchema,
          parentId: z.string().describe('Solo "arbol": id del padre; "" para la raíz.'),
          edge: z.string().describe("Texto corto de la arista (o vacío)."),
        }),
      )
      .describe('Para "arbol" y "flujo". Vacío en los otros tipos.'),
    scale: z
      .object({
        unit: z.string(),
        min: z.number(),
        max: z.number(),
        ranges: z.array(
          z.object({ from: z.number(), to: z.number(), label: z.string(), role: NodeRoleSchema }),
        ),
        markerValue: z.number().describe("Valor del paciente; usa min - 1 si no aplica."),
        markerLabel: z.string(),
      })
      .describe('Solo para "escala".'),
    columns: z
      .array(z.object({ label: z.string(), role: NodeRoleSchema }))
      .describe('Solo "comparacion": 2 o 3 columnas.'),
    rows: z
      .array(z.object({ label: z.string(), cells: z.array(z.string()) }))
      .describe('Solo "comparacion": 2 a 5 filas, una celda por columna.'),
  }),
});
export type ModelExplanation = z.infer<typeof ModelExplanationSchema>;

export const ExplainRequestSchema = ExplainTargetSchema;
export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;

// ---------------------------------------------------------------------------
// Widget interactivo complementario (HTML + CSS + JS generados por el modelo)
// ---------------------------------------------------------------------------

export const WidgetImageSchema = z.object({
  /** data: URL (la imagen se descarga y verifica en el servidor; el widget no sale a la red). */
  src: z.string().startsWith("data:image/"),
  alt: z.string().max(200),
  kind: z.enum(["banco", "commons", "generada"]),
  /** Crédito visible: autor y licencia, o «Ilustración generada con IA». */
  credit: z.string().max(300),
  sourceUrl: z.url().optional(),
});
export type WidgetImage = z.infer<typeof WidgetImageSchema>;

export const LearningWidgetSchema = z.object({
  /** Formato elegido (p. ej. «Simulador», «Clasificador», «Línea de tiempo»). */
  approach: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(90),
  /** Qué hacer con el widget (1 oración). */
  intro: z.string().trim().max(240),
  html: z.string().max(16000),
  css: z.string().max(12000),
  js: z.string().max(16000),
  image: WidgetImageSchema.nullable(),
  source: z.enum(["adk", "fallback"]),
});
export type LearningWidget = z.infer<typeof LearningWidgetSchema>;

/** Lo que se le pide al modelo para el widget. */
export const ModelWidgetSchema = z.object({
  approach: z.string(),
  title: z.string(),
  intro: z.string(),
  html: z.string().describe("Contenido que va dentro de #rz-root. Sin <html>, <head> ni <body>."),
  css: z.string().describe("CSS (se permite anidamiento nativo tipo SCSS)."),
  js: z.string().describe("JavaScript vanilla, sin dependencias ni red."),
  image: z.object({
    mode: z.enum(["banco", "buscar", "generar", "ninguna"]),
    query: z.string().describe('"buscar": 2 a 5 términos en inglés para Wikimedia Commons.'),
    prompt: z
      .string()
      .describe('"generar" (y respaldo de "buscar"): ilustración didáctica sin texto.'),
    alt: z.string(),
  }),
});
export type ModelWidget = z.infer<typeof ModelWidgetSchema>;

// ---------------------------------------------------------------------------
// Diálogo socrático después de la explicación (progresión paso a paso)
// ---------------------------------------------------------------------------

export const SocraticTurnSchema = z.object({
  role: z.enum(["tutor", "student"]),
  text: z.string().trim().min(1).max(1000),
});
export type SocraticTurn = z.infer<typeof SocraticTurnSchema>;

/** Niveles de la progresión: recordar → comprender → aplicar → analizar → transferir. */
export const SOCRATIC_LEVELS = [
  "recordar",
  "comprender",
  "aplicar",
  "analizar",
  "transferir",
] as const;
export const SocraticLevelSchema = z.number().int().min(1).max(SOCRATIC_LEVELS.length);

export const SocraticRequestSchema = z.object({
  target: ExplainTargetSchema,
  /** Conversación hasta ahora (la primera pregunta es la de la explicación). */
  history: z.array(SocraticTurnSchema).min(1).max(16),
  answer: z.string().trim().min(1).max(1000),
  level: SocraticLevelSchema,
});
export type SocraticRequest = z.infer<typeof SocraticRequestSchema>;

export const SocraticReplySchema = z.object({
  /** Retroalimentación a su respuesta (qué acertó, qué corregir), citando la GPC si es clínico. */
  feedback: z.string().trim().min(1).max(700),
  /** Siguiente pregunta, un paso más profunda (vacía si terminó). */
  nextQuestion: z.string().trim().max(320),
  level: SocraticLevelSchema,
  done: z.boolean(),
  source: z.enum(["adk", "fallback"]),
});
export type SocraticReply = z.infer<typeof SocraticReplySchema>;

export const ModelSocraticSchema = z.object({
  understood: z.enum(["si", "parcial", "no"]).describe("¿Su respuesta muestra que entendió?"),
  feedback: z.string(),
  nextQuestion: z.string(),
  done: z.boolean(),
});
