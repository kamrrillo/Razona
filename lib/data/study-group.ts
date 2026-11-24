import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

/**
 * Grupo del estudio (profiles.study_group). 'control' es la versión de solo cuestionario:
 * sin tutor, sin explicación ni diagramas con IA, sin recursos y sin diagnóstico.
 */
export type StudyGroup = "ia" | "control";

export type StudyProfile = {
  group: StudyGroup;
  /** Ya eligió (o se le fijó) el modo. Las participantes de /estudio eligen una sola vez. */
  chosen: boolean;
  name: string;
};

export async function getStudyProfile(
  supabase: ServerSupabase,
  userId: string,
): Promise<StudyProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("study_group, study_group_chosen_at, display_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    group: data?.study_group === "control" ? "control" : "ia",
    chosen: Boolean(data?.study_group_chosen_at),
    name: data?.display_name ?? "",
  };
}

export async function getStudyGroup(supabase: ServerSupabase, userId: string): Promise<StudyGroup> {
  return (await getStudyProfile(supabase, userId)).group;
}
