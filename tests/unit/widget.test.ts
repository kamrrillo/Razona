import { describe, expect, it } from "vitest";
import { fallbackSocraticReply } from "@/lib/ai/socratic";
import { buildFallbackWidget } from "@/lib/ai/widget";
import { LearningWidgetSchema, SocraticReplySchema } from "@/lib/schemas/explanation";
import { buildWidgetDocument } from "@/lib/widget-doc";
import { BRONQUIOLITIS, fixtureCatalog, fixtureItem } from "../fixtures/catalog";

const item = fixtureItem(BRONQUIOLITIS);

describe("documento del widget", () => {
  const doc = buildWidgetDocument({
    html: '<p class="rz-x">Hola</p>',
    css: ".rz-x{color:red}</style><script>alert(1)</script>",
    js: 'var s="</script><img src=x>";',
    image: {
      src: "data:image/png;base64,AAAA",
      alt: "Radiografía",
      kind: "generada",
      credit: "IA",
    },
  });

  it("bloquea la red con CSP y solo permite imágenes data:", () => {
    expect(doc).toContain("default-src 'none'");
    expect(doc).toContain("img-src data:");
    expect(doc).not.toMatch(/connect-src/);
  });

  it("el CSS y el JS del modelo no pueden cerrar su etiqueta", () => {
    expect(doc).not.toContain(".rz-x{color:red}</style>");
    expect(doc).toContain("<\\/style>");
    expect(doc).toContain('var s="<\\/script>');
  });

  it("inserta la imagen verificada y reporta la altura al padre", () => {
    expect(doc).toContain("data:image/png;base64,AAAA");
    expect(doc).toContain("rz-widget-height");
    expect(doc).toContain('<div id="rz-root"><p class="rz-x">Hola</p></div>');
  });
});

describe("widget de respaldo", () => {
  it("cumple el contrato para todos los casos", async () => {
    for (const it of fixtureCatalog().items) {
      const w = await buildFallbackWidget(it);
      expect(LearningWidgetSchema.safeParse(w).success, it.id).toBe(true);
      expect(w.source).toBe("fallback");
      expect(w.html).toContain(it.citation.gpcId);
    }
  });

  it("escapa el contenido del banco", async () => {
    const w = await buildFallbackWidget({
      ...item,
      keyPoints: [{ text: "<b>dato</b>", citation: item.citation }],
    });
    expect(w.html).toContain("&#60;b&#62;dato");
    expect(w.html).not.toContain("<b>dato</b>");
  });
});

describe("diálogo socrático de respaldo", () => {
  it("avanza por las preguntas semilla de la rúbrica sin repetirlas", () => {
    const first = item.rubric?.[0]?.question ?? "¿Por qué?";
    const r = fallbackSocraticReply(item, [{ role: "tutor", text: first }], 1);
    expect(SocraticReplySchema.safeParse(r).success).toBe(true);
    expect(r.level).toBe(2);
    expect(r.feedback).toContain(item.citation.gpcId);
    if (!r.done) expect(r.nextQuestion).not.toBe(first);
  });

  it("termina en el último nivel", () => {
    const r = fallbackSocraticReply(item, [{ role: "tutor", text: "¿Qué harías?" }], 5);
    expect(r.done).toBe(true);
    expect(r.nextQuestion).toBe("");
  });
});
