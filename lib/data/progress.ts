import "server-only";
import { specialties, specialtyName } from "@/lib/content";
import { type Outcome, specialtyStats, topicStats, weakestTopic } from "@/lib/learning/stats";
import { computeStreak, localDay } from "@/lib/learning/streak";
import type { Progress } from "@/lib/schemas/api";
import type { ServerSupabase } from "@/lib/supabase/server";

export async function loadOutcomes(supabase: ServerSupabase, userId: string): Promise<Outcome[]> {
  const [attempts, answers] = await Promise.all([
    supabase
      .from("attempts")
      .select("topic, specialty_id, is_correct, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(5000),
    supabase
      .from("exam_answers")
      .select("topic, specialty_id, is_correct, answered_at, exams!inner(finished_at)")
      .eq("user_id", userId)
      .not("exams.finished_at", "is", null)
      .limit(5000),
  ]);
  if (attempts.error) throw attempts.error;
  if (answers.error) throw answers.error;

  return [
    ...attempts.data.map((a) => ({
      topic: a.topic,
      specialtyId: a.specialty_id,
      isCorrect: a.is_correct,
      at: a.created_at,
    })),
    ...answers.data.map((a) => ({
      topic: a.topic,
      specialtyId: a.specialty_id,
      isCorrect: a.is_correct,
      at: a.answered_at,
    })),
  ];
}

export async function getProgress(
  supabase: ServerSupabase,
  userId: string,
  now = new Date(),
): Promise<Progress> {
  const [outcomes, profile, exams] = await Promise.all([
    loadOutcomes(supabase, userId),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase
      .from("exams")
      .select("id, finished_at, score, correct, total")
      .eq("user_id", userId)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(5),
  ]);
  if (exams.error) throw exams.error;

  const today = localDay(now);
  const streak = computeStreak(
    outcomes.map((o) => new Date(o.at)),
    now,
  );
  const stats = topicStats(outcomes);
  const weak = weakestTopic(stats);
  const beforeToday = topicStats(outcomes.filter((o) => localDay(new Date(o.at)) !== today));
  const weakBefore = weak ? beforeToday.find((s) => s.topic === weak.topic) : undefined;

  const bySpec = specialtyStats(outcomes);
  return {
    displayName: profile.data?.display_name ?? "",
    streak,
    totals: {
      answered: outcomes.length,
      correct: outcomes.filter((o) => o.isCorrect).length,
      answeredToday: outcomes.filter((o) => localDay(new Date(o.at)) === today).length,
    },
    bySpecialty: specialties.map((s) => {
      const stat = bySpec.find((b) => b.specialtyId === s.id);
      return {
        specialtyId: s.id,
        name: s.name,
        correct: stat?.correct ?? 0,
        total: stat?.total ?? 0,
        accuracy: stat?.accuracy ?? 0,
      };
    }),
    byTopic: stats,
    weakTopic: weak
      ? {
          topic: weak.topic,
          specialtyId: weak.specialtyId,
          specialtyName: specialtyName(weak.specialtyId),
          correct: weak.correct,
          total: weak.total,
          mastery: weak.mastery,
          masteryBeforeToday: weakBefore ? weakBefore.mastery : null,
        }
      : null,
    recentExams: exams.data.map((e) => ({
      id: e.id,
      finishedAt: e.finished_at ?? "",
      score: Number(e.score ?? 0),
      correct: e.correct ?? 0,
      total: e.total ?? 0,
    })),
  };
}
