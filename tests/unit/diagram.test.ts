import { describe, expect, it } from "vitest";
import { buildFallbackDiagram, normalizeModelDiagram, wrapTitle } from "@/lib/ai/diagram";
import { ExplanationDiagramSchema } from "@/lib/schemas/diagram";
import { BRONQUIOLITIS, fixtureCatalog, fixtureItem } from "../fixtures/catalog";

const item = fixtureItem(BRONQUIOLITIS);
const getAllItems = () => fixtureCatalog().items;

describe("diagrama de respaldo", () => {
  it("cumple el contrato para todos los ítems y termina en la GPC", () => {
    for (const it of getAllItems()) {
      const wrong = it.options.filter((o) => o.id !== it.correctOptionId).map((o) => o.id);
      const d = buildFallbackDiagram(it, wrong);
      expect(ExplanationDiagramSchema.safeParse(d).success, it.id).toBe(true);
      expect(d.steps.at(-1)?.kind).toBe("gpc");
      expect(d.steps.at(-1)?.detail).toContain(it.citation.snippet.slice(0, 40));
    }
  });

  it("solo usa texto del ítem (no inventa contenido clínico)", () => {
    const d = buildFallbackDiagram(item, ["a"]);
    const source = [
      item.vignette,
      item.explanation,
      item.citation.snippet,
      item.citation.section,
      ...item.options.map((o) => o.text),
    ]
      .join(" ")
      .replace(/\s+/g, " ");
    const fixed =
      "Esta opción no es la recomendada para este caso; compárala con la explicación y la GPC.";
    for (const step of d.steps) {
      const detail = step.detail.replace(/…$/, "").replace(/\.$/, "");
      expect(detail === fixed.replace(/\.$/, "") || source.includes(detail.slice(0, 60))).toBe(
        true,
      );
    }
  });

  it("incluye la opción que eligió la estudiante como descarte", () => {
    const d = buildFallbackDiagram(item, ["a", item.correctOptionId]);
    const descartes = d.steps.filter((s) => s.kind === "descarte");
    expect(descartes).toHaveLength(1); // la correcta no se descarta
    expect(descartes[0].title).toContain("a)");
  });
});

describe("diagrama del modelo", () => {
  it("recorta textos y fuerza la GPC del ítem al final", () => {
    const d = normalizeModelDiagram(item, {
      title: "Manejo",
      steps: [
        { kind: "dato", title: "Datos", detail: "x".repeat(400) },
        { kind: "gpc", title: "GPC inventada", detail: "texto que no es del ítem" },
        { kind: "decision", title: "Soporte", detail: "Medidas de soporte." },
      ],
    });
    expect(ExplanationDiagramSchema.safeParse(d).success).toBe(true);
    expect(d.steps.filter((s) => s.kind === "gpc")).toHaveLength(1);
    expect(d.steps.at(-1)?.detail).toBe(item.citation.snippet);
    expect(d.steps[0].detail.length).toBeLessThanOrEqual(260);
  });

  it("rechaza diagramas demasiado cortos", () => {
    expect(() =>
      normalizeModelDiagram(item, {
        title: "x",
        steps: [{ kind: "dato", title: "a", detail: "b" }],
      }),
    ).toThrow();
  });
});

describe("wrapTitle", () => {
  it("parte en máximo 2 líneas", () => {
    const lines = wrapTitle("Descartar a) Salbutamol nebulizado de forma rutinaria en el lactante");
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines.every((l) => l.length <= 26)).toBe(true);
    expect(wrapTitle("Datos clave")).toEqual(["Datos clave"]);
  });
});
