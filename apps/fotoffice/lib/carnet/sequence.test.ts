import { describe, expect, it } from "vitest";
import { nextCardSequence } from "./sequence";
import { formatCardNumber } from "./token";

describe("nextCardSequence", () => {
  it("sin carnets del año, arranca en 1", () => {
    expect(nextCardSequence([], 2026)).toBe(1);
    expect(formatCardNumber(2026, nextCardSequence([], 2026))).toBe("C-2026-0001");
  });

  it("sigue desde el más alto del año", () => {
    expect(nextCardSequence(["C-2026-0001", "C-2026-0007", "C-2026-0003"], 2026)).toBe(8);
  });

  it("se reinicia cada año", () => {
    // Identifica una emisión, no a una persona: C-2027-0001 se lee mejor que C-8471.
    expect(nextCardSequence(["C-2026-0412"], 2027)).toBe(1);
  });

  it("ignora números con otro formato en vez de fallar", () => {
    expect(nextCardSequence(["viejo-12", "C-2026-abc", "", "C-2026-0005"], 2026)).toBe(6);
  });

  it("no cuenta los de otro año", () => {
    expect(nextCardSequence(["C-2025-9999", "C-2026-0002"], 2026)).toBe(3);
  });

  it("no reutiliza el número de uno anulado", () => {
    // El listado que se le pasa incluye los anulados a propósito: reciclar el número haría
    // que dos emisiones distintas compartieran identificador.
    expect(nextCardSequence(["C-2026-0001", "C-2026-0002"], 2026)).toBe(3);
  });
});
