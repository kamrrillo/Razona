import { HttpError, handleError, ok, parseJson, requireAuth } from "@/lib/api";
import { getItem } from "@/lib/content";
import { chooseCase, createStudySession, toPublicItem } from "@/lib/data/practice";
import { getStudyProgress } from "@/lib/data/study";
import { SessionRequestSchema, SessionResponseSchema } from "@/lib/schemas/api";

export async function POST(request: Request) {
  try {
    const { supabase, userId, isAnonymous } = await requireAuth();
    const body = await parseJson(request, SessionRequestSchema);

    // Participante del estudio: las preguntas fijas, en orden, hasta terminar.
    if (isAnonymous) {
      const progress = await getStudyProgress(supabase, userId);
      if (!progress.nextCaseId) throw new HttpError(409, "El estudio ya terminó");
      const item = await getItem(progress.nextCaseId);
      if (!item) throw new HttpError(500, `Falta el caso ${progress.nextCaseId} en el banco`);
      const sessionId = await createStudySession(supabase, userId, item.id);
      return ok(SessionResponseSchema, {
        sessionId,
        item: toPublicItem(item),
        reason: "study",
        messages: [],
        study: { index: progress.answered + 1, total: progress.total },
      });
    }

    const { item, reason } = await chooseCase(supabase, userId, body);
    const sessionId = await createStudySession(supabase, userId, item.id);
    return ok(SessionResponseSchema, {
      sessionId,
      item: toPublicItem(item),
      reason,
      messages: [],
    });
  } catch (error) {
    return handleError(error);
  }
}
