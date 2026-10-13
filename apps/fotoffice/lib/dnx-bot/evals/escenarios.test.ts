import { describe, expect, it } from "vitest";
import { ESCENARIOS, fallasDeEntrada, type Escenario } from "./escenarios";

describe("banco de escenarios", () => {
  it("ids únicos y cada escenario con situación, mensaje y alguna expectativa", () => {
    expect(new Set(ESCENARIOS.map((e) => e.id)).size).toBe(ESCENARIOS.length);
    for (const e of ESCENARIOS) {
      expect(e.situacion.length, e.id).toBeGreaterThan(0);
      expect(e.mensaje.length, e.id).toBeGreaterThan(0);
      const expectativas =
        (e.debeUsar?.length ?? 0) + (e.debeUsarAlguna?.length ?? 0) + (e.noDebeUsar?.length ?? 0) + (e.textoNoDebeContener?.length ?? 0);
      expect(expectativas, e.id).toBeGreaterThan(0);
    }
  });
});

describe("fallasDeEntrada", () => {
  const e: Escenario = { id: "x", situacion: "s", mensaje: "m", entradaEsperada: { cotizar_trabajo: { tipoDeTrabajo: "boda" } } };
  it("pasa si toda llamada trae el valor; falla si alguna no", () => {
    expect(fallasDeEntrada(e, [{ herramienta: "cotizar_trabajo", entrada: { tipoDeTrabajo: "boda" } }])).toEqual([]);
    expect(fallasDeEntrada(e, [{ herramienta: "cotizar_trabajo", entrada: { tipoDeTrabajo: "quince" } }])).toEqual([
      'cotizar_trabajo con tipoDeTrabajo="quince" (se esperaba "boda")',
    ]);
  });
  it("ignora otras herramientas", () => {
    expect(fallasDeEntrada(e, [{ herramienta: "ver_perfil_de_precios", entrada: {} }])).toEqual([]);
  });
});
