import { HttpError, handleError, ok, parseJson, requireAuth } from "@/lib/api";
import { loadStudySession, recordAttempt } from "@/lib/data/practice";
import { AttemptRequestSchema, AttemptResponseSchema } from "@/lib/schemas/api";

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireAuth();
    const body = await parseJson(request, AttemptRequestSchema);
    const session = await loadStudySession(supabase, userId, body.sessionId);
    if (!session) throw new HttpError(404, "Sesión no encontrada");
    if (session.completedAt) throw new HttpError(409, "El caso ya fue resuelto");
    if (!session.item.options.some((o) => o.id === body.optionId)) {
      throw new HttpError(400, "Opción no válida");
    }

    const { isCorrect, attemptNumber } = await recordAttempt(supabase, userId, session, body.optionId);
    if (isCorrect) {
      return ok(AttemptResponseSchema, {
        isCorrect: true,
        attemptNumber,
        explanation: session.item.explanation,
        correctOptionId: session.item.correctOptionId,
        citation: session.item.citation,
      });
    }
    return ok(AttemptResponseSchema, { isCorrect: false, attemptNumber });
  } catch (error) {
    return handleError(error);
  }
}
