import { describe, expect, it } from "vitest";
import { importeParaCampo, nombreDeMes, valorDePeriodo } from "./url";
import { parseArsToMinor } from "@/lib/membership/money";

describe("url de informes", () => {
  it("valorDePeriodo arma el rango desde/hasta y, si no, usa periodo", () => {
    expect(valorDePeriodo({ desde: "2026-01", hasta: "2026-03" })).toBe("2026-01..2026-03");
    expect(valorDePeriodo({ periodo: "ultimos-3" })).toBe("ultimos-3");
    expect(valorDePeriodo({ desde: "2026-01" })).toBeUndefined();
    expect(valorDePeriodo({ desde: "2026-01", hasta: "2026-03", periodo: "x" })).toBe("2026-01..2026-03");
  });
  it("nombreDeMes", () => {
    expect(nombreDeMes("2026-10")).toBe("octubre de 2026");
  });
  it("importeParaCampo vuelve a entrar por parseArsToMinor (es-AR: punto miles, coma decimales)", () => {
    expect(importeParaCampo(null)).toBe("");
    expect(importeParaCampo(123456789)).toBe("1.234.567,89");
    expect(parseArsToMinor(importeParaCampo(123456789))).toBe(123456789);
    expect(importeParaCampo(0)).toBe("0,00");
  });
});
