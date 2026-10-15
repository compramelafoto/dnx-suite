import { describe, expect, it } from "vitest";
import { formatoPesos, sumarValores, valorComoNumero } from "./valor";

describe("valor estimado", () => {
  it("pesos argentinos sin decimales", () => {
    expect(formatoPesos(1250000.5)).toMatch(/^\$\s1\.250\.001$/);
    expect(formatoPesos(0)).toMatch(/^\$\s0$/);
  });
  it("Decimal de Prisma, número o vacío", () => {
    expect(valorComoNumero({ toString: () => "1500.25" })).toBe(1500.25);
    expect(valorComoNumero(10)).toBe(10);
    expect(valorComoNumero(null)).toBeNull();
    expect(valorComoNumero({ toString: () => "x" })).toBeNull();
  });
  it("suma en centavos y sin los vacíos", () => {
    expect(sumarValores([0.1, 0.2, null])).toBe(0.3);
    expect(sumarValores([])).toBe(0);
  });
});
