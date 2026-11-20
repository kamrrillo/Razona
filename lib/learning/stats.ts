export type Outcome = {
  topic: string;
  specialtyId: string;
  isCorrect: boolean;
  at: string; // ISO
};

export type TopicStat = {
  topic: string;
  specialtyId: string;
  correct: number;
  total: number;
  /** Media posterior Beta(1+aciertos, 1+errores). */
  mastery: number;
};

export type SpecialtyStat = {
  specialtyId: string;
  correct: number;
  total: number;
  accuracy: number;
};

export function topicStats(outcomes: Outcome[]): TopicStat[] {
  const map = new Map<string, TopicStat>();
  for (const o of outcomes) {
    const s = map.get(o.topic) ?? {
      topic: o.topic,
      specialtyId: o.specialtyId,
      correct: 0,
      total: 0,
      mastery: 0,
    };
    s.total += 1;
    if (o.isCorrect) s.correct += 1;
    map.set(o.topic, s);
  }
  return [...map.values()].map((s) => ({
    ...s,
    mastery: (s.correct + 1) / (s.total + 2),
  }));
}

export function specialtyStats(outcomes: Outcome[]): SpecialtyStat[] {
  const map = new Map<string, SpecialtyStat>();
  for (const o of outcomes) {
    const s = map.get(o.specialtyId) ?? {
      specialtyId: o.specialtyId,
      correct: 0,
      total: 0,
      accuracy: 0,
    };
    s.total += 1;
    if (o.isCorrect) s.correct += 1;
    map.set(o.specialtyId, s);
  }
  return [...map.values()].map((s) => ({
    ...s,
    accuracy: s.total === 0 ? 0 : s.correct / s.total,
  }));
}

/** Tema débil: menor dominio posterior entre temas con al menos `minAttempts` respuestas. */
export function weakestTopic(stats: TopicStat[], minAttempts = 3): TopicStat | null {
  const eligible = stats.filter((s) => s.total >= minAttempts);
  if (eligible.length === 0) return null;
  return eligible.reduce((worst, s) => (s.mastery < worst.mastery ? s : worst));
}
