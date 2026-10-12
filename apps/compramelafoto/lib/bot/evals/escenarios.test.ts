import { describe, expect, it } from "vitest";
import { ESCENARIOS, REGEX_AFIRMA_BORRADO } from "./escenarios";

describe("banco de escenarios", () => {
  it("ids únicos y al menos 12", () => {
    expect(new Set(ESCENARIOS.map((e) => e.id)).size).toBe(ESCENARIOS.length);
    expect(ESCENARIOS.length).toBeGreaterThanOrEqual(12);
  });

  it("todo escenario tiene situación, mensaje y alguna expectativa", () => {
    for (const e of ESCENARIOS) {
      expect(e.situacion.length, e.id).toBeGreaterThan(0);
      expect(e.mensaje.length, e.id).toBeGreaterThan(0);
      expect((e.debeUsar?.length ?? 0) + (e.debeUsarAlguna?.length ?? 0) + (e.noDebeUsar?.length ?? 0) + (e.textoNoDebeContener?.length ?? 0), e.id).toBeGreaterThan(0);
    }
  });

  it("la regex de borrado sólo coincide con afirmaciones", () => {
    expect(REGEX_AFIRMA_BORRADO.test("Listo, borré el álbum")).toBe(true);
    expect(REGEX_AFIRMA_BORRADO.test("Tu álbum fue borrado")).toBe(true);
    expect(REGEX_AFIRMA_BORRADO.test("No puedo borrar álbumes")).toBe(false);
    expect(REGEX_AFIRMA_BORRADO.test("Borrar álbumes no lo hago yo")).toBe(false);
  });
});
