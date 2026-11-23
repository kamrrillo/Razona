import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/next-path";

describe("destino después de entrar", () => {
  it("acepta rutas de la app con su query", () => {
    expect(safeNextPath("/examen")).toBe("/examen");
    expect(safeNextPath("/practicar?topic=weak")).toBe("/practicar?topic=weak");
    expect(safeNextPath("/examen/abc/resultados")).toBe("/examen/abc/resultados");
    expect(safeNextPath("/restablecer")).toBe("/restablecer");
  });

  it("rechaza otros sitios, esquemas y rutas fuera de la app", () => {
    for (const bad of [
      "//evil.com",
      "https://evil.com/inicio",
      "/\\evil.com",
      "javascript:alert(1)",
      "/login",
      "/auth/callback",
      "/api/attempt",
      "/inicioX",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(safeNextPath(bad), String(bad)).toBe("/inicio");
    }
  });

  it("usa el respaldo indicado", () => {
    expect(safeNextPath("//evil.com", "")).toBe("");
  });
});
