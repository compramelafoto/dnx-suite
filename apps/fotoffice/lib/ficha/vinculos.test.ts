import { describe, expect, it } from "vitest";
import { VINCULOS, esClaveDeVinculo, etiquetaDelVinculo } from "./vinculos";

describe("vinculos", () => {
  it("hay nueve y cada uno tiene sus dos lados en español", () => {
    expect(VINCULOS.map((v) => v.clave)).toEqual([
      "madre-padre", "pareja", "hermano", "abuelo", "tio", "proveedor", "empleado", "amigo", "otro",
    ]);
    for (const v of VINCULOS) {
      expect(v.desde.length).toBeGreaterThan(0);
      expect(v.hacia.length).toBeGreaterThan(0);
    }
  });
  it("madre-padre se lee distinto de cada lado", () => {
    expect(etiquetaDelVinculo("madre-padre", "desde")).toBe("Madre o padre");
    expect(etiquetaDelVinculo("madre-padre", "hacia")).toBe("Hijo o hija");
    expect(etiquetaDelVinculo("proveedor", "hacia")).toBe("Cliente");
    expect(etiquetaDelVinculo("tio", "hacia")).toBe("Sobrino o sobrina");
  });
  it("los simétricos se leen igual", () => {
    expect(etiquetaDelVinculo("pareja", "hacia")).toBe("Pareja");
    expect(etiquetaDelVinculo("amigo", "desde")).toBe(etiquetaDelVinculo("amigo", "hacia"));
  });
  it("otro usa el texto libre en los dos lados", () => {
    expect(etiquetaDelVinculo("otro", "desde", " Padrino ")).toBe("Padrino");
    expect(etiquetaDelVinculo("otro", "hacia", "Padrino")).toBe("Padrino");
    expect(etiquetaDelVinculo("otro", "hacia")).toBe("Otro");
  });
  it("valida claves", () => {
    expect(esClaveDeVinculo("pareja")).toBe(true);
    expect(esClaveDeVinculo("nada")).toBe(false);
    expect(esClaveDeVinculo(3)).toBe(false);
  });
});
