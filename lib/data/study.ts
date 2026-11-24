import "server-only";
import { STUDY_CASE_IDS, STUDY_SIZE } from "@/lib/study";
import type { ServerSupabase } from "@/lib/supabase/server";

export type StudyProgress = {
  /** Preguntas del estudio ya respondidas. */
  answered: number;
  total: number;
  done: boolean;
  /** Siguiente caso por responder (null si terminó). */
  nextCaseId: string | null;
};

/** Avance de una participante: cuántos de los casos del estudio ya respondió. */
export async function getStudyProgress(
  supabase: ServerSupabase,
  userId: string,
): Promise<StudyProgress> {
  const { data, error } = await supabase
    .from("attempts")
    .select("item_id")
    .eq("user_id", userId)
    .in("item_id", [...STUDY_CASE_IDS]);
  if (error) throw error;
  const seen = new Set(data.map((a) => a.item_id));
  const next = STUDY_CASE_IDS.find((id) => !seen.has(id)) ?? null;
  return { answered: seen.size, total: STUDY_SIZE, done: next === null, nextCaseId: next };
}
