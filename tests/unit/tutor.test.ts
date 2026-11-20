import { describe, expect, it, vi } from "vitest";
import { FallbackTutorEngine } from "@/lib/ai/fallback-engine";
import { ResilientTutorEngine } from "@/lib/ai/resilient-engine";
import { chunkText, createSseParser, encodeSse, replyToEvents } from "@/lib/ai/sse";
import { revealsAnswer, type TutorEngine, type TutorInput } from "@/lib/ai/tutor-engine";
import { getItem } from "@/lib/content";
import { TutorRequestSchema } from "@/lib/schemas/api";
import { TutorEventSchema } from "@/lib/schemas/tutor";

const item = getItem("caso-bronquiolitis-01");
if (!item) throw new Error("falta el caso");

function input(overrides: Partial<TutorInput> = {}): TutorInput {
  return {
    item: item as NonNullable<typeof item>,
    history: [],
    selectedOptionId: "a",
    tools: {
      registerAttempt: vi.fn(async () => ({ ok: true })),
      nextCase: vi.fn(async () => ({ topic: "Bronquiolitis", title: "x" })),
    },
    ...overrides,
  };
}

describe("FallbackTutorEngine", () => {
  it("responde con pregunta socrática, pista y cita de la GPC", async () => {
    const reply = await new FallbackTutorEngine().respond(input());
    expect(reply.engine).toBe("fallback");
    expect(reply.text).toContain("?");
    expect(reply.hint).toBeTruthy();
    expect(reply.citation.gpcId).toBe(item?.citation.gpcId);
    expect(revealsAnswer(reply.text, item as NonNullable<typeof item>)).toBe(false);
  });

  it("nunca revela la respuesta en ningún guion", async () => {
    const engine = new FallbackTutorEngine();
    for (const optionId of ["a", "c", "d"]) {
      const reply = await engine.respond(input({ selectedOptionId: optionId }));
      expect(revealsAnswer(reply.text, item as NonNullable<typeof item>)).toBe(false);
    }
  });

  it("responde a mensajes libres", async () => {
    const reply = await new FallbackTutorEngine().respond(
      input({ selectedOptionId: undefined, studentMessage: "¿por qué?" }),
    );
    expect(reply.text.length).toBeGreaterThan(10);
  });
});

describe("ResilientTutorEngine", () => {
  const fallback = new FallbackTutorEngine();

  it("usa el respaldo si el principal tarda más del límite", async () => {
    const slow: TutorEngine = {
      name: "adk",
      respond: () => new Promise((resolve) => setTimeout(() => resolve({} as never), 1000)),
    };
    const onFallback = vi.fn();
    const reply = await new ResilientTutorEngine(slow, fallback, 50, onFallback).respond(input());
    expect(reply.engine).toBe("fallback");
    expect(onFallback).toHaveBeenCalledOnce();
  });

  it("usa el respaldo si el principal falla", async () => {
    const failing: TutorEngine = {
      name: "adk",
      respond: async () => {
        throw new Error("boom");
      },
    };
    const reply = await new ResilientTutorEngine(failing, fallback, 1000).respond(input());
    expect(reply.engine).toBe("fallback");
  });

  it("usa el principal si responde a tiempo", async () => {
    const fast: TutorEngine = {
      name: "adk",
      respond: async () => ({
        text: "¿Qué mecanismo?",
        citation: item?.citation as never,
        engine: "adk",
      }),
    };
    const reply = await new ResilientTutorEngine(fast, fallback, 1000).respond(input());
    expect(reply.engine).toBe("adk");
  });
});

describe("salvaguarda de respuesta", () => {
  it("detecta cuando se revela la opción correcta", () => {
    const it_ = item as NonNullable<typeof item>;
    expect(revealsAnswer("La respuesta correcta es la b.", it_)).toBe(true);
    expect(
      revealsAnswer(
        "Deberías elegir medidas de soporte: aspiración de secreciones nasales, hidratación y vigilancia de datos de alarma",
        it_,
      ),
    ).toBe(true);
    expect(revealsAnswer("¿Qué mecanismo produce las sibilancias?", it_)).toBe(false);
  });
});

describe("SSE", () => {
  it("los fragmentos reconstruyen el texto", () => {
    const text = "Hola, ¿qué   mecanismo explica las sibilancias en este lactante?";
    expect(chunkText(text).join("")).toBe(text);
  });

  it("emite eventos tipados terminando en done", async () => {
    const reply = await new FallbackTutorEngine().respond(input());
    const events = replyToEvents(reply);
    for (const e of events) expect(TutorEventSchema.safeParse(e).success).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done" });
    expect(events.some((e) => e.type === "citation")).toBe(true);
    expect(events.some((e) => e.type === "hint")).toBe(true);
  });

  it("el parser maneja fragmentos partidos", () => {
    const received: string[] = [];
    const parse = createSseParser((d) => received.push(d));
    const wire = encodeSse({ type: "text", delta: "hola " }) + encodeSse({ type: "done" });
    parse(wire.slice(0, 7));
    parse(wire.slice(7, 30));
    parse(wire.slice(30));
    expect(received.map((r) => JSON.parse(r))).toEqual([
      { type: "text", delta: "hola " },
      { type: "done" },
    ]);
  });
});

describe("contratos de API", () => {
  it("POST /api/tutor exige opción o mensaje", () => {
    const sessionId = "00000000-0000-4000-8000-000000000000";
    expect(TutorRequestSchema.safeParse({ sessionId }).success).toBe(false);
    expect(TutorRequestSchema.safeParse({ sessionId, optionId: "a" }).success).toBe(true);
    expect(TutorRequestSchema.safeParse({ sessionId, message: "hola" }).success).toBe(true);
    expect(TutorRequestSchema.safeParse({ sessionId, optionId: "z" }).success).toBe(false);
  });
});
