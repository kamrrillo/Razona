import "server-only";
import { cases, getItem, practiceTopics, toPublicItem } from "@/lib/content";
import { hashString } from "@/lib/learning/random";
import { topicStats, weakestTopic } from "@/lib/learning/stats";
import { chooseTopicThompson } from "@/lib/learning/thompson";
import type { Item } from "@/lib/schemas/content";
import { type ChatMessage, ChatHistorySchema } from "@/lib/schemas/tutor";
import type { ServerSupabase } from "@/lib/supabase/server";
import { loadOutcomes } from "./progress";

export type CaseChoice = { item: Item; reason: "topic" | "weak" | "thompson" };

export async function chooseCase(
  supabase: ServerSupabase,
  userId: string,
  opts: { topic?: string; excludeItemId?: string },
): Promise<CaseChoice> {
  const outcomes = await loadOutcomes(supabase, userId);
  const stats = topicStats(outcomes);
  const available = cases.filter((c) => c.id !== opts.excludeItemId);
  const pool = available.length > 0 ? available : cases;

  let topic: string | undefined;
  let reason: CaseChoice["reason"] = "thompson";

  if (opts.topic === "weak") {
    topic = weakestTopic(stats.filter((s) => practiceTopics().includes(s.topic)))?.topic;
    reason = "weak";
  } else if (opts.topic) {
    topic = opts.topic;
    reason = "topic";
  }

  if (!topic || !pool.some((c) => c.topic === topic)) {
    const candidates = [...new Set(pool.map((c) => c.topic))];
    // Semilla determinista: misma historia → misma elección (demo reproducible).
    topic = chooseTopicThompson(candidates, stats, hashString(`${userId}:${outcomes.length}`));
    reason = "thompson";
  }

  const item = pool.find((c) => c.topic === topic) ?? pool[0];
  return { item, reason };
}

export async function createStudySession(
  supabase: ServerSupabase,
  userId: string,
  itemId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("study_sessions")
    .insert({ user_id: userId, item_id: itemId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export type LoadedSession = {
  id: string;
  item: Item;
  messages: ChatMessage[];
  completedAt: string | null;
};

export async function loadStudySession(
  supabase: ServerSupabase,
  userId: string,
  sessionId: string,
): Promise<LoadedSession | null> {
  const { data, error } = await supabase
    .from("study_sessions")
    .select("id, item_id, messages, completed_at")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const item = getItem(data.item_id);
  if (!item) return null;
  const messages = ChatHistorySchema.safeParse(data.messages);
  return {
    id: data.id,
    item,
    messages: messages.success ? messages.data : [],
    completedAt: data.completed_at,
  };
}

export async function appendMessages(
  supabase: ServerSupabase,
  session: LoadedSession,
  newMessages: ChatMessage[],
): Promise<void> {
  const messages = [...session.messages, ...newMessages];
  const { error } = await supabase
    .from("study_sessions")
    .update({ messages })
    .eq("id", session.id);
  if (error) throw error;
  session.messages = messages;
}

export async function recordAttempt(
  supabase: ServerSupabase,
  userId: string,
  session: LoadedSession,
  optionId: string,
) {
  const isCorrect = optionId === session.item.correctOptionId;
  const { count, error: countError } = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id);
  if (countError) throw countError;

  const usedTutor = session.messages.some((m) => m.role === "tutor");
  const { error } = await supabase.from("attempts").insert({
    user_id: userId,
    session_id: session.id,
    item_id: session.item.id,
    specialty_id: session.item.specialtyId,
    topic: session.item.topic,
    selected_option: optionId,
    is_correct: isCorrect,
    used_tutor: usedTutor,
  });
  if (error) throw error;

  if (isCorrect) {
    const { error: updateError } = await supabase
      .from("study_sessions")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", session.id);
    if (updateError) throw updateError;
  }

  return { isCorrect, attemptNumber: (count ?? 0) + 1 };
}

export { toPublicItem };
