import { describe, expect, it } from "vitest";
import { claveRenglon, normalizarMedida, normalizarTexto } from "./clave";

describe("clave", () => {
  it("normaliza texto sin tildes ni mayúsculas", () => {
    expect(normalizarTexto("  ROMÁN   Impresiones ")).toBe("roman impresiones");
  });
  it("normaliza medidas con el número chico primero", () => {
    expect(normalizarMedida("30 X 20")).toBe("20x30");
    expect(normalizarMedida("15,2x30,5")).toBe("15.2x30.5");
    expect(normalizarMedida("")).toBeNull();
  });
  it("la clave ignora mayúsculas y tildes", () => {
    const a = claveRenglon({ tipo: "TAPA", categoria: "Tapas", producto: "Tapa", modelo: "Maldivas", medida: "20x40", variante: null, cantidadMinima: null });
    const b = claveRenglon({ tipo: "TAPA", categoria: "tapas", producto: "TAPA", modelo: "maldivas", medida: "20x40", variante: null, cantidadMinima: null });
    expect(a).toBe(b);
  });
});
