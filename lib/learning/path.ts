import type { Item, Specialty } from "@/lib/schemas/content";
import type { TopicStat } from "./stats";

export type NodeState = "mastered" | "current" | "in-progress" | "new";

export type PathNode = {
  topic: string;
  specialtyId: string;
  state: NodeState;
  mastery: number;
  correct: number;
  total: number;
  /** El tema tiene caso de práctica (si no, se repasa en el simulacro). */
  hasCase: boolean;
  href: string;
};

export type PathUnit = {
  index: number;
  specialtyId: string;
  name: string;
  correct: number;
  total: number;
  accuracy: number;
  nodes: PathNode[];
};

export const MASTERY_THRESHOLD = 0.7;
export const MIN_ATTEMPTS_FOR_MASTERY = 3;

/**
 * Ruta de aprendizaje estilo "camino": una unidad por especialidad y un nodo por tema.
 * El tema débil es el nodo actual ("Empieza aquí").
 */
export function buildLearningPath(opts: {
  specialties: Specialty[];
  items: Item[];
  stats: TopicStat[];
  weakTopic: string | null;
}): PathUnit[] {
  const byTopic = new Map(opts.stats.map((s) => [s.topic, s]));
  const caseTopics = new Set(opts.items.filter((i) => i.kind === "case").map((i) => i.topic));

  return opts.specialties
    .map((specialty, index) => {
      // Primero los temas con caso, en el orden en que aparecen en el contenido.
      const topics = [
        ...new Set(
          opts.items
            .filter((i) => i.specialtyId === specialty.id)
            .sort((a, b) => Number(b.kind === "case") - Number(a.kind === "case"))
            .map((i) => i.topic),
        ),
      ];
      const nodes: PathNode[] = topics.map((topic) => {
        const stat = byTopic.get(topic);
        const total = stat?.total ?? 0;
        const correct = stat?.correct ?? 0;
        const mastery = stat?.mastery ?? 0;
        const hasCase = caseTopics.has(topic);
        let state: NodeState = "new";
        if (topic === opts.weakTopic) state = "current";
        else if (total >= MIN_ATTEMPTS_FOR_MASTERY && mastery >= MASTERY_THRESHOLD)
          state = "mastered";
        else if (total > 0) state = "in-progress";
        return {
          topic,
          specialtyId: specialty.id,
          state,
          mastery,
          correct,
          total,
          hasCase,
          href: !hasCase
            ? "/examen"
            : state === "current"
              ? "/practicar?topic=weak"
              : `/practicar?topic=${encodeURIComponent(topic)}`,
        };
      });
      const correct = nodes.reduce((acc, n) => acc + n.correct, 0);
      const total = nodes.reduce((acc, n) => acc + n.total, 0);
      return {
        index: index + 1,
        specialtyId: specialty.id,
        name: specialty.name,
        correct,
        total,
        accuracy: total === 0 ? 0 : correct / total,
        nodes,
      };
    })
    .filter((u) => u.nodes.length > 0);
}

/** Desplazamiento horizontal (px) en zigzag para el nodo i del camino. */
export function zigzagOffset(i: number, amplitude = 64): number {
  const pattern = [0, 0.6, 1, 0.6, 0, -0.6, -1, -0.6];
  return Math.round(pattern[i % pattern.length] * amplitude);
}
