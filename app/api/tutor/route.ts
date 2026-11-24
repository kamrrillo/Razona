import { getTutorEngine } from "@/lib/ai";
import { encodeSse, replyToEvents } from "@/lib/ai/sse";
import type { TutorTools } from "@/lib/ai/tutor-engine";
import { HttpError, handleError, parseJson, requireAiAuth } from "@/lib/api";
import { appendMessages, chooseCase, loadStudySession } from "@/lib/data/practice";
import { TutorRequestSchema } from "@/lib/schemas/api";
import { type ChatMessage, type TutorEvent, TutorEventSchema } from "@/lib/schemas/tutor";

export const maxDuration = 30;

const DELTA_DELAY_MS = 35;

export async function POST(request: Request) {
  let ctx: Awaited<ReturnType<typeof requireAiAuth>>;
  let body: Awaited<ReturnType<typeof parseJson<typeof TutorRequestSchema>>>;
  try {
    ctx = await requireAiAuth();
    body = await parseJson(request, TutorRequestSchema);
  } catch (error) {
    return handleError(error);
  }

  const { supabase, userId } = ctx;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: TutorEvent) => {
        controller.enqueue(encoder.encode(encodeSse(TutorEventSchema.parse(event))));
      };
      try {
        const session = await loadStudySession(supabase, userId, body.sessionId);
        if (!session) throw new HttpError(404, "Sesión no encontrada");
        if (body.optionId && body.optionId === session.item.correctOptionId) {
          throw new HttpError(400, "La opción es correcta; no requiere tutor");
        }

        const now = new Date().toISOString();
        const studentMessage: ChatMessage = body.optionId
          ? {
              role: "student",
              text: `Elegí la opción ${body.optionId}) ${
                session.item.options.find((o) => o.id === body.optionId)?.text ?? ""
              }`,
              at: now,
              optionId: body.optionId,
            }
          : { role: "student", text: body.message ?? "", at: now };

        const tools: TutorTools = {
          registerAttempt: async () => {
            const { data } = await supabase
              .from("attempts")
              .select("id")
              .eq("session_id", session.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (!data) return { ok: false };
            const { error } = await supabase
              .from("attempts")
              .update({ used_tutor: true })
              .eq("id", data.id);
            return { ok: !error };
          },
          nextCase: async () => {
            const { item } = await chooseCase(supabase, userId, { excludeItemId: session.item.id });
            return { topic: item.topic, title: item.title };
          },
        };

        const reply = await getTutorEngine().respond({
          item: session.item,
          history: session.messages,
          selectedOptionId: body.optionId,
          studentMessage: body.message,
          tools,
        });

        await appendMessages(supabase, session, [
          studentMessage,
          { role: "tutor", text: reply.text, at: new Date().toISOString(), engine: reply.engine },
        ]);

        for (const event of replyToEvents(reply)) {
          send(event);
          if (event.type === "text") {
            await new Promise((r) => setTimeout(r, DELTA_DELAY_MS));
          }
        }
      } catch (error) {
        console.error("[tutor]", error);
        send({
          type: "error",
          message:
            error instanceof HttpError
              ? error.message
              : "El tutor no está disponible. Intenta de nuevo.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
