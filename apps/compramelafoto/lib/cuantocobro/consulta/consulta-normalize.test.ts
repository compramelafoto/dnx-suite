import { describe, expect, it } from "vitest";
import { formatConsultaNumber } from "./consulta-number-format";
import { normalizeCuantoCobroConsultaInput, parseEstimatedValueCents } from "./normalize";

describe("consulta normalize", () => {
  it("normaliza campos básicos y etiquetas únicas", () => {
    const result = normalizeCuantoCobroConsultaInput({
      title: "  Boda verano  ",
      probability: 150,
      tags: ["boda", "boda", " 2026 "],
      currency: "ars",
      estimatedValue: "150000",
    });

    expect(result.title).toBe("Boda verano");
    expect(result.probability).toBe(100);
    expect(result.tags).toEqual(["boda", "2026"]);
    expect(result.currency).toBe("ARS");
    expect(parseEstimatedValueCents(result.estimatedValue)).toBe(150000);
  });
});

describe("consulta number", () => {
  it("formatea número CCO con padding", () => {
    expect(formatConsultaNumber(2026, 1)).toBe("CCO-2026-000001");
    expect(formatConsultaNumber(2026, 42)).toBe("CCO-2026-000042");
  });
});
