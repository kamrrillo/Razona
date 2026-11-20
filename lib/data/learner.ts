import "server-only";
import type { LearnerContext } from "@/lib/ai/feedback";
import { topicStats, weakestTopic } from "@/lib/learning/stats";
import { computeStreak } from "@/lib/learning/streak";
import type { Item } from "@/lib/schemas/content";
import type { ServerSupabase } from "@/lib/supabase/server";
import { loadOutcomes } from "./progress";

type Answer = Pick<
  LearnerContext,
  "mode" | "wrongChoices" | "answeredCorrectly" | "attempts" | "usedTutor" | "studentMessages"
>;

/** Contexto de la estudiante para personalizar la explicación: su historial real en Supabase. */
export async function loadLearnerContext(
  supabase: ServerSupabase,
  userId: string,
  item: Item,
  answer: Answer,
  now = new Date(),
): Promise<LearnerContext> {
  const [outcomes, profile] = await Promise.all([
    loadOutcomes(supabase, userId),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
  ]);
  const stats = topicStats(outcomes);
  const topic = stats.find((s) => s.topic === item.topic);
  const weak = weakestTopic(stats);
  return {
    ...answer,
    name: profile.data?.display_name ?? "",
    topic: {
      correct: topic?.correct ?? 0,
      total: topic?.total ?? 0,
      isWeakest: weak?.topic === item.topic,
    },
    weakestTopic: weak?.topic ?? null,
    streakDays: computeStreak(
      outcomes.map((o) => new Date(o.at)),
      now,
    ).current,
  };
}
