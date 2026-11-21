import { explainWithDiagram } from "@/lib/ai/explain";
import { HttpError, handleError, ok, parseJson, requireAuth } from "@/lib/api";
import { getItem } from "@/lib/content";
import { loadExam } from "@/lib/data/exam";
import { loadStudySession } from "@/lib/data/practice";
import { ExplainRequestSchema, ExplanationDiagramSchema } from "@/lib/schemas/diagram";

export const maxDuration = 30;

/**
 * Diagrama paso a paso de la explicación de un reactivo. Solo se entrega cuando la respuesta
 * ya es visible para la usuaria: caso de práctica resuelto o examen terminado que incluye el ítem.
 */
export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireAuth();
    const body = await parseJson(request, ExplainRequestSchema);

    if ("sessionId" in body) {
      const session = await loadStudySession(supabase, userId, body.sessionId);
      if (!session) throw new HttpError(404, "Sesión no encontrada");
      if (!session.completedAt)
        throw new HttpError(409, "Resuelve el caso para ver la explicación");
      const { data, error } = await supabase
        .from("attempts")
        .select("selected_option, is_correct")
        .eq("session_id", session.id)
        .eq("user_id", userId);
      if (error) throw error;
      const wrong = [...new Set(data.filter((a) => !a.is_correct).map((a) => a.selected_option))];
      return ok(ExplanationDiagramSchema, await explainWithDiagram(session.item, wrong));
    }

    const loaded = await loadExam(supabase, userId, body.examId);
    if (!loaded) throw new HttpError(404, "Examen no encontrado");
    if (!loaded.exam.finishedAt)
      throw new HttpError(409, "Termina el examen para ver la explicación");
    const item = await getItem(body.itemId);
    const inExam = body.itemId in loaded.answers || loaded.exam.itemIds.includes(body.itemId);
    if (!item || !inExam) throw new HttpError(404, "Reactivo no encontrado");
    const chosen = loaded.answers[body.itemId];
    const wrong = chosen && chosen !== item.correctOptionId ? [chosen] : [];
    return ok(ExplanationDiagramSchema, await explainWithDiagram(item, wrong));
  } catch (error) {
    return handleError(error);
  }
}
