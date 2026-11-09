import { describe, expect, it } from "vitest";
import { plataformasPorTipo, REGIONES, TIPOS_CONTACTO } from "./tipos";

describe("plataformasPorTipo", () => {
  it.each([
    ["FOTOGRAFO", ["CLF", "FOTOFFICE"]],
    ["ESCUELA", ["CLF"]],
    ["CLUB", ["CLF", "INFOSPOT"]],
    ["ORGANIZADOR_EVENTOS", ["INFOSPOT", "CLF"]],
    ["ORGANIZADOR_MUESTRAS", ["MUESTRAS"]],
    ["ASOCIACION_FOTOGRAFOS", ["CLF", "MUESTRAS", "FOTOFFICE"]],
    ["EMPRESA_TURISMO", ["CLF"]],
    ["NEGOCIO_FOTOGRAFIA", ["CLF", "FOTOFFICE"]],
    ["OTRO", []],
  ] as const)("%s", (tipo, esperado) => {
    expect(plataformasPorTipo(tipo)).toEqual(esperado);
  });

  it("cubre todos los tipos y devuelve una copia", () => {
    for (const t of TIPOS_CONTACTO) expect(Array.isArray(plataformasPorTipo(t))).toBe(true);
    plataformasPorTipo("ESCUELA").push("INFOSPOT");
    expect(plataformasPorTipo("ESCUELA")).toEqual(["CLF"]);
  });

  it("las regiones van en orden", () => {
    expect([...REGIONES]).toEqual(["CENTRO", "BUENOS_AIRES_AMBA", "CUYO", "NOA", "NEA", "PATAGONIA"]);
  });
});
