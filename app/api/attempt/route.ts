import { HttpError, handleError, ok, parseJson, requireAuth } from "@/lib/api";
import { loadStudySession, recordAttempt } from "@/lib/data/practice";
import { getStudyGroup } from "@/lib/data/study-group";
import { errorTypesFor, orderResources } from "@/lib/learning/resources";
import { AttemptRequestSchema, AttemptResponseSchema } from "@/lib/schemas/api";

/**
 * Registra la respuesta de un caso de práctica y lo cierra. Acierte o no, devuelve la respuesta
 * correcta, la cita y los recursos (primero los que atienden su error) para la explicación.
 */
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

    const { isCorrect, attemptNumber } = await recordAttempt(
      supabase,
      userId,
      session,
      body.optionId,
    );
    // Grupo control (solo cuestionario): respuesta y explicación fija; sin recursos de aprendizaje.
    const control = (await getStudyGroup(supabase, userId)) === "control";
    const errorTypes = isCorrect || control ? [] : errorTypesFor(session.item, [body.optionId]);
    return ok(AttemptResponseSchema, {
      isCorrect,
      attemptNumber,
      selectedOptionId: body.optionId,
      correctOptionId: session.item.correctOptionId,
      // Modo sin IA: solo si acertó y la respuesta correcta (sin explicación ni cita).
      ...(control
        ? {}
        : { explanation: session.item.explanation, citation: session.item.citation }),
      resources: control ? [] : orderResources(session.item.resources ?? [], errorTypes),
      errorTypes,
    });
  } catch (error) {
    return handleError(error);
  }
}
