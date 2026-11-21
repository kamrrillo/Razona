import "server-only";
import { getCatalog } from "@/lib/content";
import { type Outcome, topicStats, weakestTopic } from "@/lib/learning/stats";
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
  const [outcomes, profile, exams, catalog] = await Promise.all([
    loadOutcomes(supabase, userId),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase
      .from("exams")
      .select("id, finished_at, score, correct, total")
      .eq("user_id", userId)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(5),
    getCatalog(),
  ]);
  if (exams.error) throw exams.error;

  // Avance por área: cada tema pertenece a un grupo del catálogo (json/temas.json).
  const groupOfTopic = new Map(catalog.topics.map((t) => [t.name, t.groupId]));
  const groupName = (id: string) => catalog.groups.find((g) => g.id === id)?.name ?? id;
  const byGroup = new Map<string, { correct: number; total: number }>();
  for (const o of outcomes) {
    const g = groupOfTopic.get(o.topic);
    if (!g) continue; // historial de contenido anterior al banco
    const acc = byGroup.get(g) ?? { correct: 0, total: 0 };
    acc.total += 1;
    if (o.isCorrect) acc.correct += 1;
    byGroup.set(g, acc);
  }

  const today = localDay(now);
  const streak = computeStreak(
    outcomes.map((o) => new Date(o.at)),
    now,
  );
  const stats = topicStats(outcomes.filter((o) => groupOfTopic.has(o.topic)));
  const weak = weakestTopic(stats);
  const beforeToday = topicStats(outcomes.filter((o) => localDay(new Date(o.at)) !== today));
  const weakBefore = weak ? beforeToday.find((s) => s.topic === weak.topic) : undefined;

  return {
    displayName: profile.data?.display_name ?? "",
    streak,
    totals: {
      answered: outcomes.length,
      correct: outcomes.filter((o) => o.isCorrect).length,
      answeredToday: outcomes.filter((o) => localDay(new Date(o.at)) === today).length,
    },
    bySpecialty: catalog.groups.map((g) => {
      const stat = byGroup.get(g.id);
      return {
        specialtyId: g.id,
        name: g.name,
        correct: stat?.correct ?? 0,
        total: stat?.total ?? 0,
        accuracy: stat && stat.total > 0 ? stat.correct / stat.total : 0,
      };
    }),
    byTopic: stats,
    weakTopic: weak
      ? {
          topic: weak.topic,
          specialtyId: weak.specialtyId,
          specialtyName: groupName(groupOfTopic.get(weak.topic) ?? weak.specialtyId),
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
