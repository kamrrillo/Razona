import { HttpError, handleError, ok, parseJson, requireAuth } from "@/lib/api";
import { loadStudySession, recordAttempt } from "@/lib/data/practice";
import { getStudyGroup } from "@/lib/data/study-group";
import { errorTypesFor, orderResources } from "@/lib/learning/resources";
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

    const control = (await getStudyGroup(supabase, userId)) === "control";
    const { isCorrect, attemptNumber } = await recordAttempt(
      supabase,
      userId,
      session,
      body.optionId,
      { closeOnWrong: control },
    );
    if (control) {
      // Solo cuestionario: respuesta y explicación fija del caso; sin recursos ni tutor.
      const reveal = {
        correctOptionId: session.item.correctOptionId,
        explanation: session.item.explanation,
        citation: session.item.citation,
      };
      return isCorrect
        ? ok(AttemptResponseSchema, { isCorrect: true, attemptNumber, ...reveal })
        : ok(AttemptResponseSchema, { isCorrect: false, attemptNumber, reveal });
    }
    if (isCorrect) {
      // Los recursos pueden revelar la respuesta: solo se entregan al resolver el caso.
      const { data: attempts, error } = await supabase
        .from("attempts")
        .select("selected_option")
        .eq("session_id", session.id)
        .eq("is_correct", false);
      if (error) throw error;
      const errorTypes = errorTypesFor(
        session.item,
        attempts.map((a) => a.selected_option),
      );
      return ok(AttemptResponseSchema, {
        isCorrect: true,
        attemptNumber,
        explanation: session.item.explanation,
        correctOptionId: session.item.correctOptionId,
        citation: session.item.citation,
        resources: orderResources(session.item.resources ?? [], errorTypes),
        errorTypes,
      });
    }
    return ok(AttemptResponseSchema, { isCorrect: false, attemptNumber });
  } catch (error) {
    return handleError(error);
  }
}
