import "server-only";
import { type Catalog, getCatalog } from "@/lib/content";
import { hashString, mulberry32 } from "@/lib/learning/random";
import type { Item } from "@/lib/schemas/content";
import type { ServerSupabase } from "@/lib/supabase/server";

/** Alcance del examen simulado. */
export type ExamScope =
  | { kind: "global" }
  | { kind: "grupo"; ref: string }
  | { kind: "tema"; ref: string };

export const EXAM_SIZE = 10;
export const SECONDS_PER_ITEM = 90;

export class ExamClosedError extends Error {}
export class NotFoundError extends Error {}

function shuffle<T>(list: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Toma hasta `size` reactivos repartidos por turnos entre los grupos dados (índices primero). */
function roundRobin(buckets: Item[][], size: number): Item[] {
  const queues = buckets.map((b) => [
    ...b.filter((i) => i.tipo !== "variante"),
    ...b.filter((i) => i.tipo === "variante"),
  ]);
  const picked: Item[] = [];
  while (picked.length < size && queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      const next = q.shift();
      if (next) picked.push(next);
      if (picked.length === size) break;
    }
  }
  return picked;
}

function groupBy(items: Item[], key: (i: Item) => string): Item[][] {
  const map = new Map<string, Item[]>();
  for (const i of items) map.set(key(i), [...(map.get(key(i)) ?? []), i]);
  return [...map.values()];
}

/**
 * Reactivos del examen según su alcance.
 * - tema: todos los casos del tema (índice y variante; como mucho 2).
 * - grupo: hasta 10, repartidos entre los temas del grupo.
 * - global: hasta 10, repartidos entre los grupos.
 * El orden es determinista para una misma semilla.
 */
export function selectExamItems(catalog: Catalog, scope: ExamScope, seed: number): Item[] {
  if (scope.kind === "tema") {
    return catalog.items
      .filter((i) => i.sindrome === scope.ref)
      .sort((a, b) => Number(a.tipo === "variante") - Number(b.tipo === "variante"));
  }
  const pool =
    scope.kind === "grupo" ? catalog.items.filter((i) => i.groupId === scope.ref) : catalog.items;
  const by =
    scope.kind === "grupo"
      ? (i: Item) => i.sindrome ?? i.topic
      : (i: Item) => i.groupId ?? i.specialtyId;
  const buckets = shuffle(groupBy(pool, by), seed).map((b, k) => shuffle(b, seed + k + 1));
  return roundRobin(buckets, EXAM_SIZE);
}

export function examTitle(catalog: Catalog, scope: ExamScope): string {
  if (scope.kind === "tema") {
    const t = catalog.topics.find((x) => x.sindrome === scope.ref);
    return `Examen de ${t?.name ?? scope.ref}`;
  }
  if (scope.kind === "grupo") {
    const g = catalog.groups.find((x) => x.id === scope.ref);
    return `Examen de ${g?.name ?? scope.ref}`;
  }
  return "Examen simulado global";
}

export async function startExam(
  supabase: ServerSupabase,
  userId: string,
  scope: ExamScope = { kind: "global" },
): Promise<string> {
  const catalog = await getCatalog();
  const items = selectExamItems(catalog, scope, hashString(`${userId}:${Date.now()}`));
  if (items.length === 0) throw new NotFoundError("No hay reactivos para ese alcance");
  const { data, error } = await supabase
    .from("exams")
    .insert({
      user_id: userId,
      exam_key: `simulacro-${scope.kind}`,
      scope: scope.kind,
      scope_ref: scope.kind === "global" ? null : scope.ref,
      item_ids: items.map((i) => i.id),
      duration_seconds: items.length * SECONDS_PER_ITEM,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export type ExamRow = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number;
  correct: number | null;
  total: number | null;
  score: number | null;
  scope: ExamScope;
  itemIds: string[];
};

function toScope(scope: string, ref: string | null): ExamScope {
  if ((scope === "grupo" || scope === "tema") && ref) return { kind: scope, ref };
  return { kind: "global" };
}

export async function loadExam(
  supabase: ServerSupabase,
  userId: string,
  examId: string,
): Promise<{ exam: ExamRow; answers: Record<string, string> } | null> {
  const [exam, answers] = await Promise.all([
    supabase
      .from("exams")
      .select(
        "id, started_at, finished_at, duration_seconds, correct, total, score, scope, scope_ref, item_ids",
      )
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
  const answerMap = Object.fromEntries(answers.data.map((a) => [a.item_id, a.selected_option]));
  return {
    exam: {
      id: exam.data.id,
      startedAt: exam.data.started_at,
      finishedAt: exam.data.finished_at,
      durationSeconds: exam.data.duration_seconds,
      correct: exam.data.correct,
      total: exam.data.total,
      score: exam.data.score === null ? null : Number(exam.data.score),
      scope: toScope(exam.data.scope, exam.data.scope_ref),
      // Exámenes sin lista (p. ej. el diagnóstico del agente): sus reactivos son los respondidos.
      itemIds: exam.data.item_ids ?? Object.keys(answerMap),
    },
    answers: answerMap,
  };
}

/** Ítems del examen, en su orden. */
export async function examItemsFor(exam: ExamRow): Promise<Item[]> {
  const { byId } = await getCatalog();
  return exam.itemIds.map((id) => byId.get(id)).filter((i): i is Item => Boolean(i));
}

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
  const item = (await getCatalog()).byId.get(itemId);
  if (!item || !loaded.exam.itemIds.includes(itemId)) {
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
  const items = await examItemsFor(loaded.exam);

  if (loaded.exam.finishedAt) {
    return {
      examId,
      correct: loaded.exam.correct ?? 0,
      total: loaded.exam.total ?? items.length,
      score: loaded.exam.score ?? 0,
    };
  }

  const answers = { ...loaded.answers };
  if (fillDemo) {
    // Solo en modo demo: completa los reactivos sin responder para llegar a resultados.
    for (const item of items.filter((i) => !(i.id in answers))) {
      await answerExam(supabase, userId, examId, item.id, item.correctOptionId);
      answers[item.id] = item.correctOptionId;
    }
  }

  // Los reactivos sin responder cuentan como incorrectos.
  const total = items.length;
  const correct = items.filter((i) => answers[i.id] === i.correctOptionId).length;
  const score = total === 0 ? 0 : Math.round((correct / total) * 10000) / 100;

  const { error } = await supabase
    .from("exams")
    .update({ finished_at: new Date().toISOString(), correct, total, score })
    .eq("id", examId)
    .eq("user_id", userId);
  if (error) throw error;

  return { examId, correct, total, score };
}
