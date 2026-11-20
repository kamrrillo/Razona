import { mulberry32, sampleBeta } from "./random";
import type { TopicStat } from "./stats";

/**
 * Thompson sampling por tema: para cada tema se muestrea la probabilidad de ERROR
 * de Beta(1 + errores, 1 + aciertos) y se elige el tema con la muestra más alta.
 * Así el tema débil sale primero con alta probabilidad, sin dejar de explorar.
 * Temas sin intentos usan el prior uniforme Beta(1, 1).
 */
export function chooseTopicThompson(
  candidateTopics: string[],
  stats: TopicStat[],
  seed: number,
): string {
  if (candidateTopics.length === 0) {
    throw new Error("No hay temas candidatos");
  }
  const rng = mulberry32(seed);
  const byTopic = new Map(stats.map((s) => [s.topic, s]));
  let best = candidateTopics[0];
  let bestSample = -1;
  for (const topic of candidateTopics) {
    const s = byTopic.get(topic);
    const errors = s ? s.total - s.correct : 0;
    const correct = s ? s.correct : 0;
    const sample = sampleBeta(1 + errors, 1 + correct, rng);
    if (sample > bestSample) {
      bestSample = sample;
      best = topic;
    }
  }
  return best;
}
