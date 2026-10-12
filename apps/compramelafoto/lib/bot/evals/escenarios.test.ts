import { describe, expect, it } from "vitest";
import { ESCENARIOS } from "./escenarios";

describe("banco de escenarios", () => {
  it("ids únicos y al menos 12", () => {
    expect(new Set(ESCENARIOS.map((e) => e.id)).size).toBe(ESCENARIOS.length);
    expect(ESCENARIOS.length).toBeGreaterThanOrEqual(12);
  });

  it("todo escenario tiene situación, mensaje y alguna expectativa", () => {
    for (const e of ESCENARIOS) {
      expect(e.situacion.length, e.id).toBeGreaterThan(0);
      expect(e.mensaje.length, e.id).toBeGreaterThan(0);
      expect((e.debeUsar?.length ?? 0) + (e.noDebeUsar?.length ?? 0) + (e.textoNoDebeContener?.length ?? 0), e.id).toBeGreaterThan(0);
    }
  });
});
