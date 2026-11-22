import { z } from "zod";

export const TutorEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), delta: z.string() }),
  z.object({ type: z.literal("hint"), text: z.string() }),
  z.object({
    type: z.literal("citation"),
    gpcId: z.string(),
    gpcTitle: z.string().optional(),
    section: z.string(),
    page: z.number().int().positive().optional(),
    snippet: z.string(),
  }),
  z.object({ type: z.literal("done") }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type TutorEvent = z.infer<typeof TutorEventSchema>;

export const ChatMessageSchema = z.object({
  role: z.enum(["student", "tutor"]),
  text: z.string(),
  at: z.string(),
  /** Opción elegida que motivó el mensaje (si aplica). */
  optionId: z.string().optional(),
  engine: z.enum(["adk", "fallback"]).optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export const ChatHistorySchema = z.array(ChatMessageSchema);
