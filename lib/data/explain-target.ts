import "server-only";
import type { LearnerContext } from "@/lib/ai/feedback";
import { HttpError } from "@/lib/api";
import { getItem } from "@/lib/content";
import type { AuthedContext } from "@/lib/data/auth";
import { loadExam } from "@/lib/data/exam";
import { loadLearnerContext } from "@/lib/data/learner";
import { loadStudySession } from "@/lib/data/practice";
import type { Item } from "@/lib/schemas/content";
import type { ExplainRequest } from "@/lib/schemas/explanation";

/**
 * Reactivo ya resuelto al que se refiere una explicación, widget o diálogo socrático, con el
 * contexto de la estudiante. Solo se entrega cuando la respuesta ya es visible para ella:
 * caso de práctica resuelto o examen terminado que incluye el ítem.
 */
export async function loadExplainTarget(
  { supabase, userId }: Pick<AuthedContext, "supabase" | "userId">,
  target: ExplainRequest,
): Promise<{ item: Item; ctx: LearnerContext }> {
  if ("sessionId" in target) {
    const session = await loadStudySession(supabase, userId, target.sessionId);
    if (!session) throw new HttpError(404, "Sesión no encontrada");
    if (!session.completedAt) throw new HttpError(409, "Resuelve el caso para ver la explicación");
    const { data, error } = await supabase
      .from("attempts")
      .select("selected_option, is_correct, created_at")
      .eq("session_id", session.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const wrong = [...new Set(data.filter((a) => !a.is_correct).map((a) => a.selected_option))];
    const ctx = await loadLearnerContext(supabase, userId, session.item, {
      mode: "practica",
      wrongChoices: wrong,
      answeredCorrectly: true,
      attempts: data.length,
      usedTutor: session.messages.some((m) => m.role === "tutor"),
      studentMessages: session.messages
        .filter((m) => m.role === "student" && !m.optionId)
        .map((m) => m.text.slice(0, 280))
        .slice(-3),
    });
    return { item: session.item, ctx };
  }

  const loaded = await loadExam(supabase, userId, target.examId);
  if (!loaded) throw new HttpError(404, "Examen no encontrado");
  if (!loaded.exam.finishedAt)
    throw new HttpError(409, "Termina el examen para ver la explicación");
  const item = await getItem(target.itemId);
  const inExam = target.itemId in loaded.answers || loaded.exam.itemIds.includes(target.itemId);
  if (!item || !inExam) throw new HttpError(404, "Reactivo no encontrado");
  const chosen = loaded.answers[target.itemId];
  const ctx = await loadLearnerContext(supabase, userId, item, {
    mode: loaded.exam.examKey === "diagnostico-adk" ? "diagnostico" : "examen",
    wrongChoices: chosen && chosen !== item.correctOptionId ? [chosen] : [],
    answeredCorrectly: chosen === item.correctOptionId,
    attempts: chosen ? 1 : 0,
    usedTutor: false,
    studentMessages: [],
  });
  return { item, ctx };
}
