import "server-only";
import { examFile, examItems, getItem } from "@/lib/content";
import type { ServerSupabase } from "@/lib/supabase/server";

export async function startExam(supabase: ServerSupabase, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("exams")
    .insert({
      user_id: userId,
      exam_key: examFile.examKey,
      duration_seconds: examFile.durationMinutes * 60,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export type ExamRow = {
  id: string;
  examKey: string;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number;
  correct: number | null;
  total: number | null;
  score: number | null;
};

export async function loadExam(
  supabase: ServerSupabase,
  userId: string,
  examId: string,
): Promise<{ exam: ExamRow; answers: Record<string, string> } | null> {
  const [exam, answers] = await Promise.all([
    supabase
      .from("exams")
      .select("id, exam_key, started_at, finished_at, duration_seconds, correct, total, score")
      .eq("id", examId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("exam_answers")
      .select("item_id, selected_option")
      .eq("exam_id", examId)
      .eq("user_id", userId),
  ]);
  if (exam.error) throw exam.error;
  if (answers.error) throw answers.error;
  if (!exam.data) return null;
  return {
    exam: {
      id: exam.data.id,
      examKey: exam.data.exam_key,
      startedAt: exam.data.started_at,
      finishedAt: exam.data.finished_at,
      durationSeconds: exam.data.duration_seconds,
      correct: exam.data.correct,
      total: exam.data.total,
      score: exam.data.score === null ? null : Number(exam.data.score),
    },
    answers: Object.fromEntries(answers.data.map((a) => [a.item_id, a.selected_option])),
  };
}

export class ExamClosedError extends Error {}
export class NotFoundError extends Error {}

export async function answerExam(
  supabase: ServerSupabase,
  userId: string,
  examId: string,
  itemId: string,
  optionId: string,
): Promise<number> {
  const loaded = await loadExam(supabase, userId, examId);
  if (!loaded) throw new NotFoundError("Examen no encontrado");
  if (loaded.exam.finishedAt) throw new ExamClosedError("El examen ya terminó");
  const item = getItem(itemId);
  if (!item || item.kind !== "exam" || !examItems.some((i) => i.id === itemId)) {
    throw new NotFoundError("Reactivo no encontrado");
  }
  if (!item.options.some((o) => o.id === optionId)) {
    throw new NotFoundError("Opción no válida");
  }
  const { error } = await supabase.from("exam_answers").upsert(
    {
      exam_id: examId,
      user_id: userId,
      item_id: itemId,
      specialty_id: item.specialtyId,
      topic: item.topic,
      selected_option: optionId,
      is_correct: optionId === item.correctOptionId,
      answered_at: new Date().toISOString(),
    },
    { onConflict: "exam_id,item_id" },
  );
  if (error) throw error;
  return Object.keys({ ...loaded.answers, [itemId]: optionId }).length;
}

export async function gradeExam(
  supabase: ServerSupabase,
  userId: string,
  examId: string,
  fillDemo: boolean,
) {
  const loaded = await loadExam(supabase, userId, examId);
  if (!loaded) throw new NotFoundError("Examen no encontrado");

  if (loaded.exam.finishedAt) {
    return {
      examId,
      correct: loaded.exam.correct ?? 0,
      total: loaded.exam.total ?? examItems.length,
      score: loaded.exam.score ?? 0,
    };
  }

  const answers = { ...loaded.answers };
  if (fillDemo) {
    const missing = examItems.filter((i) => !(i.id in answers));
    for (const item of missing) {
      const optionId = examFile.demoAnswers[item.id];
      await answerExam(supabase, userId, examId, item.id, optionId);
      answers[item.id] = optionId;
    }
  }

  const total = examItems.length;
  const correct = examItems.filter((i) => answers[i.id] === i.correctOptionId).length;
  const score = Math.round((correct / total) * 10000) / 100;

  const { error } = await supabase
    .from("exams")
    .update({ finished_at: new Date().toISOString(), correct, total, score })
    .eq("id", examId)
    .eq("user_id", userId);
  if (error) throw error;

  return { examId, correct, total, score };
}
