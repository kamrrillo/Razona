import { describe, expect, it } from "vitest";
import {
  buildFallbackConceptDiagram,
  countLeaves,
  normalizeModelDiagram,
  treeDepth,
  wrapText,
} from "@/lib/ai/concept-diagram";
import {
  buildExplanationPrompt,
  buildFallbackExplanation,
  type LearnerContext,
  normalizeModelExplanation,
} from "@/lib/ai/feedback";
import { layoutCompare, layoutFlow, layoutScale, layoutTree, MIN_W } from "@/lib/diagram-layout";
import {
  ConceptDiagramSchema,
  type ModelExplanation,
  TutorExplanationSchema,
} from "@/lib/schemas/explanation";
import { BRONQUIOLITIS, fixtureCatalog, fixtureItem } from "../fixtures/catalog";

const item = fixtureItem(BRONQUIOLITIS);
const getAllItems = () => fixtureCatalog().items;

const ctx: LearnerContext = {
  name: "Ana García",
  mode: "practica",
  wrongChoices: ["a"],
  answeredCorrectly: true,
  attempts: 2,
  usedTutor: true,
  studentMessages: ["Pensé que las sibilancias eran broncoespasmo"],
  topic: { correct: 3, total: 11, isWeakest: true },
  weakestTopic: item.topic,
  streakDays: 6,
};

const emptyDiagram: ModelExplanation["diagram"] = {
  kind: "arbol",
  title: "",
  nodes: [],
  scale: { unit: "", min: 0, max: 0, ranges: [], markerValue: -1, markerLabel: "" },
  columns: [],
  rows: [],
};
const node = (id: string, parentId: string, label = id, role = "normal" as const) => ({
  id,
  parentId,
  label,
  note: `Nota ${id}`,
  role,
  edge: "",
});

describe("explicación de respaldo personalizada", () => {
  it("cumple el contrato para todos los ítems y modos", () => {
    for (const it of getAllItems()) {
      const wrong = it.options.find((o) => o.id !== it.correctOptionId)?.id ?? "a";
      for (const mode of ["practica", "examen", "diagnostico"] as const) {
        const e = buildFallbackExplanation(it, {
          ...ctx,
          mode,
          wrongChoices: [wrong],
          answeredCorrectly: mode === "practica",
        });
        expect(TutorExplanationSchema.safeParse(e).success, `${it.id} ${mode}`).toBe(true);
        expect(e.why).toBe(it.explanation.slice(0, 900));
        expect(e.gpc).toContain(it.citation.gpcId);
        expect(e.socraticQuestion.trim().endsWith("?")).toBe(true);
      }
    }
  });

  it("usa el nombre, el camino y el historial reales de la estudiante", () => {
    const e = buildFallbackExplanation(item, ctx);
    expect(e.personal).toContain("Ana");
    expect(e.personal).toContain("2 intentos");
    expect(e.personal).toContain("3 de 11");
    expect(e.personal).toContain("tema más débil");
    expect(e.distractors[0]).toMatchObject({ optionId: "a", chosen: true });
    expect(e.distractors.map((d) => d.optionId)).not.toContain(item.correctOptionId);
  });

  it("el diagrama de respaldo es un árbol con la respuesta y la elección", () => {
    const d = buildFallbackConceptDiagram(item, ["a", item.correctOptionId]);
    expect(d.kind).toBe("arbol");
    if (d.kind !== "arbol") return;
    const roles: string[] = [];
    const stack = [d.root];
    for (let n = stack.pop(); n; n = stack.pop()) {
      roles.push(n.role);
      stack.push(...n.children);
    }
    expect(roles).toContain("respuesta");
    expect(roles.filter((r) => r === "elegida")).toHaveLength(1);
  });

  it("el prompt incluye el contexto y la GPC", () => {
    const prompt = buildExplanationPrompt(item, ctx);
    expect(prompt).toContain("Ana");
    expect(prompt).toContain("3 de 11");
    expect(prompt).toContain("Es su tema más débil");
    expect(prompt).toContain("«Pensé que las sibilancias eran broncoespasmo»");
    expect(prompt).toContain(item.citation.snippet);
    expect(prompt).toContain(item.citation.gpcId);
  });

  it("la pregunta socrática de respaldo sale de la rúbrica para su error", () => {
    const e = buildFallbackExplanation(item, ctx);
    const seed = item.rubric?.find((r) => r.optionIds.includes("a"))?.question;
    if (seed) expect(e.socraticQuestion).toBe(seed);
  });
});

describe("normalización de la salida del modelo", () => {
  it("arma un árbol desde parentId y lo recorta para el teléfono", () => {
    const d = normalizeModelDiagram({
      ...emptyDiagram,
      title: "Clasificación",
      nodes: [
        node("r", "", "Raíz", "raiz" as never),
        ...["a", "b", "c", "d", "e"].map((id) => node(id, "r")),
        node("a1", "a"),
        node("a2", "a"),
        node("a1x", "a1"),
      ],
    });
    expect(d.kind).toBe("arbol");
    if (d.kind !== "arbol") return;
    expect(d.root.label).toBe("Raíz");
    expect(d.root.children.length).toBeLessThanOrEqual(4);
    expect(countLeaves(d.root)).toBeLessThanOrEqual(5);
    expect(treeDepth(d.root)).toBeLessThanOrEqual(3);
  });

  it("ordena y recorta los rangos de una escala", () => {
    const d = normalizeModelDiagram({
      ...emptyDiagram,
      kind: "escala",
      title: "Glucosa",
      scale: {
        unit: "mg/dL",
        min: 70,
        max: 160,
        ranges: [
          { from: 126, to: 200, label: "Diabetes", role: "respuesta" },
          { from: 50, to: 100, label: "Normal", role: "normal" },
          { from: 100, to: 126, label: "Prediabetes", role: "normal" },
        ],
        markerValue: 131,
        markerLabel: "Paciente",
      },
    });
    expect(d.kind).toBe("escala");
    if (d.kind !== "escala") return;
    expect(d.ranges.map((r) => r.label)).toEqual(["Normal", "Prediabetes", "Diabetes"]);
    expect(d.ranges[0].from).toBe(70);
    expect(d.ranges[2].to).toBe(160);
    expect(d.marker?.value).toBe(131);
  });

  it("completa las celdas faltantes de una comparación", () => {
    const d = normalizeModelDiagram({
      ...emptyDiagram,
      kind: "comparacion",
      title: "Opciones",
      columns: [
        { label: "Soporte", role: "respuesta" },
        { label: "Salbutamol", role: "elegida" },
      ],
      rows: [
        { label: "Mecanismo", cells: ["Edema y moco"] },
        { label: "GPC", cells: ["Sí", "No"] },
      ],
    });
    expect(ConceptDiagramSchema.safeParse(d).success).toBe(true);
    if (d.kind === "comparacion") expect(d.rows[0].cells).toEqual(["Edema y moco", "—"]);
  });

  it("rechaza diagramas inutilizables", () => {
    expect(() => normalizeModelDiagram(emptyDiagram)).toThrow();
    expect(() => normalizeModelDiagram({ ...emptyDiagram, kind: "flujo" })).toThrow();
    expect(() => normalizeModelDiagram({ ...emptyDiagram, kind: "escala" })).toThrow();
  });

  it("filtra opciones inválidas y cae al diagrama de respaldo si hace falta", () => {
    const e = normalizeModelExplanation(item, ctx, {
      personal: "**Ana**, elegiste salbutamol.",
      why: "Porque es una infección viral.",
      fundamentals: [{ title: "Mecanismo", text: "Edema y moco en bronquiolos." }],
      distractors: [
        { optionId: item.correctOptionId, text: "no debería aparecer" },
        { optionId: "z", text: "inválida" },
        { optionId: "A)", text: "No revierte la obstrucción." },
        { optionId: "a", text: "duplicada" },
      ],
      nextStep: "Otro caso de bronquiolitis.",
      gpc: "Dice que es viral.",
      socraticQuestion: "Piensa en el mecanismo",
      diagram: emptyDiagram,
    });
    expect(e.personal).toBe("Ana, elegiste salbutamol.");
    expect(e.distractors).toEqual([
      expect.objectContaining({ optionId: "a", chosen: true, text: "No revierte la obstrucción." }),
    ]);
    expect(e.source).toBe("adk");
    expect(e.diagramSource).toBe("fallback");
    // Sin citar la GPC ni terminar en «?» se usan los de respaldo.
    expect(e.gpc).toContain(item.citation.gpcId);
    expect(e.socraticQuestion.endsWith("?")).toBe(true);
    expect(e.citation).toEqual(item.citation);
    expect(TutorExplanationSchema.safeParse(e).success).toBe(true);
  });

  it("conserva el texto de la GPC del modelo cuando la cita", () => {
    const gpc = `La GPC ${item.citation.gpcId} (${item.citation.section}) indica que el manejo es de soporte.`;
    const e = normalizeModelExplanation(item, ctx, {
      personal: "Ana, elegiste salbutamol.",
      gpc,
      why: "Porque es una infección viral.",
      fundamentals: [],
      distractors: [],
      nextStep: "",
      socraticQuestion: "¿Qué cambiaría si la saturación fuera menor?",
      diagram: emptyDiagram,
    });
    expect(e.gpc).toBe(gpc);
    expect(e.socraticQuestion).toBe("¿Qué cambiaría si la saturación fuera menor?");
  });
});

describe("geometría de los diagramas", () => {
  it("wrapText respeta el ancho y el número de líneas", () => {
    const lines = wrapText("Medidas de soporte con oxígeno e hidratación adecuada", 14, 2);
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(14);
    expect(lines[1].endsWith("…")).toBe(true);
  });

  it("el árbol no encima nodos del mismo nivel y cabe en el lienzo", () => {
    const d = buildFallbackConceptDiagram(item, ["a", "b"]);
    if (d.kind !== "arbol") throw new Error("se esperaba árbol");
    const l = layoutTree(d.root);
    expect(l.width).toBeGreaterThanOrEqual(MIN_W);
    expect(l.edges).toHaveLength(l.nodes.length - 1);
    const byRow = new Map<number, typeof l.nodes>();
    for (const e of l.edges) {
      if (!e.label) continue;
      expect(e.lx - e.lw / 2).toBeGreaterThanOrEqual(0);
      expect(e.lx + e.lw / 2).toBeLessThanOrEqual(l.width);
    }
    for (const n of l.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(l.width);
      expect(n.y + n.h).toBeLessThanOrEqual(l.height);
      const key = Math.round(n.y + n.h / 2);
      byRow.set(key, [...(byRow.get(key) ?? []), n]);
    }
    for (const row of byRow.values()) {
      const sorted = [...row].sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].x).toBeGreaterThanOrEqual(sorted[i - 1].x + sorted[i - 1].w);
      }
    }
  });

  it("las etiquetas largas de aristas caben en su rama y en el lienzo", () => {
    const leaf = (label: string, edge: string) => ({
      label,
      edge,
      role: "normal" as const,
      children: [],
    });
    const l = layoutTree({
      label: "Lactante con bronquiolitis",
      role: "raiz",
      children: [
        {
          ...leaf("Criterios de hospitalización", "Presencia de datos de alarma"),
          children: [
            leaf("Hipoxemia", "Gasométrico/Oxímetro"),
            leaf("Apnea", "Clínico"),
            leaf("Rechazo a la vía oral", "Alimentación"),
          ],
        },
        leaf("Manejo en casa", "Sin datos de alarma"),
      ],
    });
    for (const e of l.edges) {
      expect(e.lx - e.lw / 2).toBeGreaterThanOrEqual(0);
      expect(e.lx + e.lw / 2).toBeLessThanOrEqual(l.width);
    }
    const level2 = l.edges.filter((e) => e.id.split(".").length === 3).sort((a, b) => a.lx - b.lx);
    for (let i = 1; i < level2.length; i++) {
      expect(level2[i].lx - level2[i].lw / 2).toBeGreaterThanOrEqual(
        level2[i - 1].lx + level2[i - 1].lw / 2,
      );
    }
  });

  it("flujo, escala y comparación producen geometría válida", () => {
    const flow = layoutFlow([
      { label: "Virus", role: "normal", edge: "infecta" },
      { label: "Edema y moco", role: "clave" },
      { label: "Obstrucción", role: "respuesta" },
    ]);
    expect(flow.edges).toHaveLength(2);
    expect(flow.edges[0].label).toBe("infecta");

    const scale = layoutScale({
      kind: "escala",
      title: "Glucosa",
      unit: "mg/dL",
      min: 70,
      max: 160,
      ranges: [
        { from: 70, to: 100, label: "Normal", role: "normal" },
        { from: 100, to: 126, label: "Prediabetes", role: "normal" },
        { from: 126, to: 160, label: "Diabetes", role: "respuesta" },
      ],
      marker: { value: 131, label: "Paciente" },
    });
    expect(scale.segments.at(-1)?.x).toBeCloseTo(
      scale.x0 + ((126 - 70) / 90) * (scale.x1 - scale.x0),
    );
    expect(scale.marker?.label).toBe("Paciente: 131 mg/dL");
    expect(scale.ticks.map((t) => t.value)).toEqual(["70", "100", "126", "160 mg/dL"]);

    const table = layoutCompare({
      kind: "comparacion",
      title: "t",
      columns: [
        { label: "A", role: "respuesta" },
        { label: "B", role: "elegida" },
      ],
      rows: [
        { label: "x", cells: ["1", "2"] },
        { label: "y", cells: ["3", "4"] },
      ],
    });
    expect(table.rows).toHaveLength(2);
    expect(table.labelW + table.colW * 2).toBeCloseTo(table.width);
  });
});
