import { describe, expect, it } from "vitest";
import { toPublicItem } from "@/lib/content";
import { errorTypesFor, orderResources } from "@/lib/learning/resources";
import { PublicItemSchema } from "@/lib/schemas/content";
import { BRONQUIOLITIS, fixtureItem } from "../fixtures/catalog";

describe("recursos de aprendizaje", () => {
  const item = fixtureItem(BRONQUIOLITIS);
  const resources = item.resources ?? [];

  it("el caso trae recursos de varios tipos con citas de la GPC", () => {
    expect(resources.length).toBeGreaterThan(0);
    expect(new Set(resources.map((r) => r.type))).toEqual(
      new Set(["flashcard", "diagram", "highlight", "image"]),
    );
    const flashcard = resources.find((r) => r.type === "flashcard");
    expect(flashcard?.citations?.[0]?.gpcId).toBe("IMSS-032-08");
    expect(flashcard?.citations?.[0]?.page).toBeGreaterThan(0);
  });

  it("los tipos de error salen de la rúbrica de las opciones incorrectas elegidas", () => {
    expect(errorTypesFor(item, ["a"])).toEqual(["razonamiento"]);
    expect(errorTypesFor(item, [item.correctOptionId])).toEqual([]);
    expect(errorTypesFor(item, [])).toEqual([]);
  });

  it("primero van los recursos que atienden su error, sin perder ninguno", () => {
    const ordered = orderResources(resources, ["razonamiento"]);
    expect(ordered).toHaveLength(resources.length);
    const firstOther = ordered.findIndex((r) => !r.errorTypes.includes("razonamiento"));
    expect(firstOther).toBeGreaterThan(0);
    expect(ordered.slice(firstOther).every((r) => !r.errorTypes.includes("razonamiento"))).toBe(
      true,
    );
    expect(orderResources(resources, [])).toEqual(resources);
  });

  it("nunca llegan al cliente antes de responder", () => {
    const pub = toPublicItem(item);
    expect(pub).not.toHaveProperty("resources");
    expect(PublicItemSchema.strict().safeParse(pub).success).toBe(true);
  });
});
