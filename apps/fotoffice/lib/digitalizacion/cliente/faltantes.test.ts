import { describe, expect, it } from "vitest";
import { faltantesParaGrabar, type EstadoPreparacion } from "./faltantes";

const listo: EstadoPreparacion = {
  videoElegido: true,
  audioElegido: true,
  vistaPrevia: true,
  listaOk: true,
  sinPedido: false,
  proyectoElegido: true,
  dvdSubiendo: false,
  continuando: false,
};

describe("faltantesParaGrabar", () => {
  it("con todo listo no falta nada", () => {
    expect(faltantesParaGrabar(listo)).toEqual([]);
  });
  it("sin video ni audio elegidos pide las dos cosas y no habla de la vista previa", () => {
    expect(faltantesParaGrabar({ ...listo, videoElegido: false, audioElegido: false, vistaPrevia: false })).toEqual([
      "Elegí la capturadora en «Video».",
      "Elegí la entrada de audio en «Audio» (sin audio no se puede grabar).",
    ]);
  });
  it("con video y audio elegidos pero sin vista previa avisa que espere", () => {
    expect(faltantesParaGrabar({ ...listo, vistaPrevia: false })).toEqual(["Esperá a que aparezca la vista previa de la capturadora."]);
  });
  it("sin la lista de chequeo", () => {
    expect(faltantesParaGrabar({ ...listo, listaOk: false })).toEqual(["Tocá «Listo, ya lo chequeé» en el recuadro de arriba."]);
  });
  it("sin pedido elegido ni prueba", () => {
    expect(faltantesParaGrabar({ ...listo, proyectoElegido: false })).toEqual(["Elegí el pedido de la lista o tildá «Sin pedido (prueba)»."]);
  });
  it("«Sin pedido (prueba)» alcanza sin elegir pedido", () => {
    expect(faltantesParaGrabar({ ...listo, proyectoElegido: false, sinPedido: true })).toEqual([]);
  });
  it("al continuar una grabación no pide pedido", () => {
    expect(faltantesParaGrabar({ ...listo, proyectoElegido: false, continuando: true })).toEqual([]);
  });
  it("con un DVD subiendo", () => {
    expect(faltantesParaGrabar({ ...listo, dvdSubiendo: true })).toEqual(["Esperá a que termine de subir el DVD."]);
  });
});
