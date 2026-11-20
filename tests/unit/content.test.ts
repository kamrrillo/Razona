import { describe, expect, it } from "vitest";
import {
  cases,
  examFile,
  examItems,
  getAllItems,
  itemsFile,
  tutorFallbackFile,
} from "@/lib/content";
import { SAMPLE_NOTICE } from "@/lib/schemas/content";

describe("contenido de ejemplo", () => {
  it("valida con Zod y está marcado como ejemplo", () => {
    expect(itemsFile.notice).toBe(SAMPLE_NOTICE);
    expect(examFile.notice).toBe(SAMPLE_NOTICE);
    expect(getAllItems().every((i) => i.isSample)).toBe(true);
  });

  it("tiene 3 casos y 10 reactivos", () => {
    expect(cases).toHaveLength(3);
    expect(examItems).toHaveLength(10);
  });

  it("cada ítem cita una GPC y referencia una especialidad conocida", () => {
    const ids = new Set(itemsFile.specialties.map((s) => s.id));
    for (const item of getAllItems()) {
      expect(ids.has(item.specialtyId)).toBe(true);
      expect(item.citation.snippet.length).toBeGreaterThan(10);
    }
  });

  it("ids únicos", () => {
    const ids = getAllItems().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("el tutor de respaldo cubre cada opción incorrecta de cada caso", () => {
    for (const item of cases) {
      const script = tutorFallbackFile.scripts[item.id];
      expect(script, item.id).toBeDefined();
      for (const option of item.options) {
        if (option.id === item.correctOptionId) continue;
        expect(script.byOption[option.id], `${item.id}:${option.id}`).toBeDefined();
      }
    }
  });

  it("las respuestas precargadas del examen son opciones válidas", () => {
    for (const item of examItems) {
      const answer = examFile.demoAnswers[item.id];
      expect(item.options.some((o) => o.id === answer)).toBe(true);
    }
  });
});
