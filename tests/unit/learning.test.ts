import { describe, expect, it } from "vitest";
import { type Outcome, specialtyStats, topicStats, weakestTopic } from "@/lib/learning/stats";
import { computeStreak, localDay } from "@/lib/learning/streak";
import { chooseTopicThompson } from "@/lib/learning/thompson";

const NOW = new Date("2026-11-20T18:00:00-06:00");

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

function outcomes(topic: string, specialtyId: string, correct: number, total: number): Outcome[] {
  return Array.from({ length: total }, (_, i) => ({
    topic,
    specialtyId,
    isCorrect: i < correct,
    at: daysAgo(1).toISOString(),
  }));
}

describe("racha", () => {
  it("cuenta días consecutivos hasta ayer si hoy no hay actividad", () => {
    const dates = [1, 2, 3, 4, 5, 6].map(daysAgo);
    const streak = computeStreak(dates, NOW);
    expect(streak.current).toBe(6);
    expect(streak.activeToday).toBe(false);
  });

  it("sube al practicar hoy", () => {
    const dates = [0, 1, 2, 3, 4, 5, 6].map(daysAgo);
    expect(computeStreak(dates, NOW).current).toBe(7);
  });

  it("se rompe con un día sin actividad", () => {
    expect(computeStreak([daysAgo(2), daysAgo(3)], NOW).current).toBe(0);
  });

  it("usa la zona horaria de Ciudad de México", () => {
    expect(localDay(new Date("2026-11-21T03:00:00Z"))).toBe("2026-11-20");
  });

  it("devuelve los últimos 7 días", () => {
    const streak = computeStreak([daysAgo(0)], NOW);
    expect(streak.lastSevenDays).toHaveLength(7);
    expect(streak.lastSevenDays.at(-1)).toEqual({ day: "2026-11-20", active: true });
  });
});

describe("estadísticas", () => {
  const data = [
    ...outcomes("Bronquiolitis", "pediatria", 2, 9),
    ...outcomes("Hipertensión arterial", "medicina-interna", 7, 9),
    ...outcomes("Apendicitis aguda", "cirugia-general", 6, 8),
  ];

  it("detecta el tema débil", () => {
    expect(weakestTopic(topicStats(data))?.topic).toBe("Bronquiolitis");
  });

  it("ignora temas con pocos intentos", () => {
    expect(weakestTopic(topicStats(outcomes("X", "pediatria", 0, 2)))).toBeNull();
  });

  it("agrega por especialidad", () => {
    const ped = specialtyStats(data).find((s) => s.specialtyId === "pediatria");
    expect(ped).toMatchObject({ correct: 2, total: 9 });
  });

  it("Thompson sampling elige el tema débil casi siempre y es determinista", () => {
    const stats = topicStats(data);
    const topics = ["Bronquiolitis", "Hipertensión arterial", "Apendicitis aguda"];
    let weakFirst = 0;
    for (let seed = 1; seed <= 500; seed++) {
      if (chooseTopicThompson(topics, stats, seed) === "Bronquiolitis") weakFirst++;
    }
    expect(weakFirst / 500).toBeGreaterThan(0.9);
    expect(chooseTopicThompson(topics, stats, 42)).toBe(chooseTopicThompson(topics, stats, 42));
  });

  it("Thompson sampling explora temas sin intentos", () => {
    const picked = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      picked.add(chooseTopicThompson(["A", "B"], [], seed));
    }
    expect(picked).toEqual(new Set(["A", "B"]));
  });
});

describe("ruta de aprendizaje", async () => {
  const { buildLearningPath } = await import("@/lib/learning/path");
  const { fixtureCatalog } = await import("../fixtures/catalog");
  const catalog = fixtureCatalog();

  const stats = topicStats([
    ...outcomes("Bronquiolitis aguda", "pediatria", 2, 9),
    ...outcomes("Infección de vías urinarias", "pediatria", 8, 9),
    ...outcomes("Ictericia neonatal", "pediatria", 1, 2),
  ]);
  const path = buildLearningPath({
    specialties: catalog.groups,
    items: catalog.cases,
    stats,
    weakTopic: "Bronquiolitis aguda",
    unitOf: (i) => i.groupId ?? i.specialtyId,
  });
  const nodes = path.flatMap((u) => u.nodes);

  it("tiene una unidad por área con casos y cubre todos los temas de práctica", () => {
    expect(path.map((u) => u.specialtyId)).toEqual([
      "neonatologia",
      "respiratorio_orl",
      "nefrourologia",
    ]);
    expect(new Set(nodes.map((n) => n.topic))).toEqual(new Set(catalog.cases.map((i) => i.topic)));
  });

  it("marca estados", () => {
    const by = (t: string) => nodes.find((n) => n.topic === t);
    expect(by("Bronquiolitis aguda")?.state).toBe("current");
    expect(by("Bronquiolitis aguda")?.href).toBe("/practicar?topic=weak");
    expect(by("Infección de vías urinarias")?.state).toBe("mastered");
    expect(by("Ictericia neonatal")?.state).toBe("in-progress");
  });

  it("sin agrupador usa la especialidad", () => {
    const bySpecialty = buildLearningPath({
      specialties: catalog.specialties,
      items: catalog.cases,
      stats,
      weakTopic: null,
    });
    expect(bySpecialty).toHaveLength(1);
    expect(bySpecialty[0].nodes).toHaveLength(3);
  });
});
