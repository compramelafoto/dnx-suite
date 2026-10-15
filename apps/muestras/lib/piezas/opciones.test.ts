import { describe, expect, it } from "vitest";
import { opcionesDePieza, urlDePieza } from "./opciones";

const sp = (q: string) => new URLSearchParams(q);

describe("opcionesDePieza", () => {
  it("marcos: medida, orientación, con o sin foto y una obra", () => {
    expect(opcionesDePieza("marcos", sp("tamano=40x50&orientacion=PORTRAIT&foto=no&obra=w1"))).toEqual({
      pieza: "marcos", tamano: "40x50", orientacion: "PORTRAIT", conFoto: false, obra: "w1", tanda: null,
    });
    expect(opcionesDePieza("marcos", sp(""))).toEqual({ pieza: "marcos", tamano: "A4", orientacion: "AUTO", conFoto: true, obra: null, tanda: null });
  });
  it("marcos por tandas de 40 (etapa 6): la tanda se lee; lo que no es un número desde 1, no", () => {
    expect(opcionesDePieza("marcos", sp("tanda=2"))).toMatchObject({ tanda: 2 });
    expect(opcionesDePieza("marcos", sp("tanda=0"))).toMatchObject({ tanda: null });
    expect(opcionesDePieza("marcos", sp("tanda=abc"))).toMatchObject({ tanda: null });
    expect(opcionesDePieza("marcos", sp("tanda=1.5"))).toMatchObject({ tanda: null });
  });
  it("lo desconocido toma el valor por defecto; una pieza desconocida no existe", () => {
    expect(opcionesDePieza("cartel", sp("tamano=A0"))).toEqual({ pieza: "cartel", tamano: "A3" });
    expect(opcionesDePieza("catalogo", sp("tamano=A4"))).toEqual({ pieza: "catalogo", tamano: "A4" });
    expect(opcionesDePieza("libro", sp(""))).toEqual({ pieza: "libro", tamano: "A4" });
    expect(opcionesDePieza("montaje", sp("x=1"))).toEqual({ pieza: "montaje" });
    expect(opcionesDePieza("fichas", sp(""))).toBeNull();
    expect(opcionesDePieza("marcos", sp("obra=../x"))).toMatchObject({ obra: null });
  });
  it("arma la dirección de descarga", () => {
    expect(urlDePieza("a1", { pieza: "marcos", tamano: "A3", orientacion: "AUTO", conFoto: false, obra: null, tanda: null })).toBe("/api/piezas/a1/marcos?tamano=A3&orientacion=AUTO&foto=no");
    expect(urlDePieza("a1", { pieza: "marcos", tamano: "A3", orientacion: "AUTO", conFoto: true, obra: null, tanda: 3 })).toBe("/api/piezas/a1/marcos?tamano=A3&orientacion=AUTO&tanda=3");
    expect(urlDePieza("a1", { pieza: "montaje" })).toBe("/api/piezas/a1/montaje");
  });
});
