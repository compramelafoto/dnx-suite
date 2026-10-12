import { describe, expect, it } from "vitest";
import { buildSystemGuide } from "./index";

describe("buildSystemGuide", () => {
  it("es idéntica entre llamadas (si cambia, se rompe el caché)", () => {
    expect(buildSystemGuide()).toBe(buildSystemGuide());
  });
  it("no contiene fechas ni datos variables", () => {
    expect(buildSystemGuide()).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
  });
  it("incluye las reglas duras y el nombre", () => {
    const g = buildSystemGuide();
    expect(g).toContain("DNX Bot");
    expect(g).toContain("Nunca prometas");
    expect(g).toContain("pesos");
  });
  it("es lo bastante larga para cachearse (>4096 caracteres)", () => {
    expect(buildSystemGuide().length).toBeGreaterThan(4096);
  });
  it("incluye las preguntas frecuentes del sitio", () => {
    expect(buildSystemGuide()).toContain("¿Para qué sirve ComprameLaFoto?");
  });
});
