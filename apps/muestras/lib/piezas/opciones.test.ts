import { describe, expect, it } from "vitest";
import { opcionesDePieza, urlDePieza } from "./opciones";

const sp = (q: string) => new URLSearchParams(q);

describe("opcionesDePieza", () => {
  it("marcos: medida, orientación, con o sin foto y una obra", () => {
    expect(opcionesDePieza("marcos", sp("tamano=40x50&orientacion=PORTRAIT&foto=no&obra=w1"))).toEqual({
      pieza: "marcos", tamano: "40x50", orientacion: "PORTRAIT", conFoto: false, obra: "w1",
    });
    expect(opcionesDePieza("marcos", sp(""))).toEqual({ pieza: "marcos", tamano: "A4", orientacion: "AUTO", conFoto: true, obra: null });
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
    expect(urlDePieza("a1", { pieza: "marcos", tamano: "A3", orientacion: "AUTO", conFoto: false, obra: null })).toBe("/api/piezas/a1/marcos?tamano=A3&orientacion=AUTO&foto=no");
    expect(urlDePieza("a1", { pieza: "montaje" })).toBe("/api/piezas/a1/montaje");
  });
});
