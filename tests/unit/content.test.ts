import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { selectExamItems } from "@/lib/data/exam";
import { ItemSchema } from "@/lib/schemas/content";
import { fixtureCatalog } from "../fixtures/catalog";

describe("catálogo (fixture del banco)", () => {
  const catalog = fixtureCatalog();

  it("los casos de práctica son solo los índices", () => {
    expect(catalog.cases.map((c) => c.id)).toEqual([
      "RZ-PED-027-I",
      "RZ-PED-032-I",
      "RZ-PED-262-I",
    ]);
    expect(catalog.items).toHaveLength(4);
  });

  it("cada caso trae cita con página, puntos clave y rúbrica", () => {
    for (const item of catalog.items) {
      expect(item.isSample).toBe(false);
      expect(item.citation.page).toBeGreaterThan(0);
      expect(item.keyPoints?.length).toBeGreaterThanOrEqual(2);
      expect(item.rubric?.length).toBeGreaterThanOrEqual(4);
      expect(item.options).toHaveLength(5);
    }
  });

  it("solo muestra especialidades con casos", () => {
    expect(catalog.specialties.map((s) => s.id)).toEqual(["pediatria"]);
  });
});

describe("selección del examen", () => {
  const catalog = fixtureCatalog();

  it("por tema: el índice y su variante, en ese orden", () => {
    const items = selectExamItems(catalog, { kind: "tema", ref: "bronquiolitis_aguda" }, 1);
    expect(items.map((i) => i.id)).toEqual(["RZ-PED-032-I", "RZ-PED-032-V1"]);
  });

  it("por grupo: solo casos del grupo", () => {
    const items = selectExamItems(catalog, { kind: "grupo", ref: "respiratorio_orl" }, 1);
    expect(items.every((i) => i.groupId === "respiratorio_orl")).toBe(true);
    expect(items).toHaveLength(2);
  });

  it("global: reparte entre áreas, sin repetir y de forma determinista", () => {
    const a = selectExamItems(catalog, { kind: "global" }, 7);
    const b = selectExamItems(catalog, { kind: "global" }, 7);
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
    expect(new Set(a.map((i) => i.id)).size).toBe(a.length);
    expect(a).toHaveLength(4);
    // Las tres áreas del fixture aparecen antes que una segunda pregunta de la misma área.
    expect(new Set(a.slice(0, 3).map((i) => i.groupId)).size).toBe(3);
  });

  it("un tema sin casos da un examen vacío", () => {
    expect(selectExamItems(catalog, { kind: "tema", ref: "no_existe" }, 1)).toEqual([]);
  });
});

// Integración con Supabase local: valida TODO el banco tal como lo entrega la vista.
config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isLocal = Boolean(url?.includes("127.0.0.1") || url?.includes("localhost"));
const reachable =
  isLocal && secret
    ? await fetch(`${url}/rest/v1/`, { headers: { apikey: secret } })
        .then((r) => r.ok)
        .catch(() => false)
    : false;

describe.skipIf(!reachable)("banco en Supabase local (v_casos_app)", () => {
  it("todos los casos cumplen ItemSchema y la rúbrica no apunta a la respuesta en errores de razonamiento o conocimiento", async () => {
    const db = createClient(url as string, secret as string);
    const { data, error } = await db.from("v_casos_app").select("id, payload");
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    for (const row of data ?? []) {
      const item = ItemSchema.parse(row.payload);
      for (const r of item.rubric ?? []) {
        if (r.errorType === "razonamiento" || r.errorType === "conocimiento") {
          expect(r.optionIds, `${item.id}`).not.toContain(item.correctOptionId);
        }
      }
    }
  });

  it("la llave pública no puede leer el banco ni sus vistas", async () => {
    const anon = createClient(url as string, publishable as string);
    for (const table of [
      "casos_clinicos",
      "v_casos_app",
      "v_casos_rubrica",
      "v_casos_citas",
      "temas",
    ]) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(data ?? [], table).toHaveLength(0);
      expect(error?.code, table).toBe("42501");
    }
  });
});
