import { describe, expect, it } from "vitest";
import { armarCatalogo } from "./catalogo";
import { ENCUADRE_INICIAL } from "./encuadre";
import { validarPedido } from "./pedido";

const CATALOGO = armarCatalogo([
  { id: "c1", name: "Cuadro canvas 30x40", priceArs: 60000, supplierName: null },
  { id: "m1", name: "Cuadro MDF 30x40", priceArs: 28800, supplierName: null },
]);
const cuadro = (x: number, tipo = "CANVAS", foto = 0) => ({ tipo, w: 30, h: 40, x, y: 0, paspartu: 0, foto, encuadre: ENCUADRE_INICIAL });

describe("validar el pedido del probador", () => {
  it("cobra el precio del catálogo y arma la receta de cada cuadro", () => {
    const r = validarPedido({ cuadros: [cuadro(0), cuadro(35, "MDF", 1)], totalVisto: 88800 }, CATALOGO, new Set([0, 1]));
    if (!r.ok) throw new Error(r.error);
    expect(r.totalArs).toBe(88800);
    expect(r.renglones[0].receta.envolturaCm).toBe(5);
    expect(r.renglones[1].receta.envolturaCm).toBe(0);
    expect(r.renglones[1].receta.orden).toBe(2);
  });

  it("con una foto para todos, cada cuadro es una ventana del conjunto", () => {
    const r = validarPedido({ cuadros: [cuadro(0), cuadro(35)], unaFoto: true, fotoConjunto: 0, encuadreConjunto: ENCUADRE_INICIAL }, CATALOGO, new Set([0]));
    if (!r.ok) throw new Error(r.error);
    expect(r.renglones[1].receta.marco).toEqual({ w: 65, h: 40 });
    expect(r.renglones[1].receta.ventana).toEqual({ x: 35, y: 0, w: 30, h: 40 });
  });

  it("si el precio cambió, avisa en lugar de cobrar otro importe", () => {
    const r = validarPedido({ cuadros: [cuadro(0)], totalVisto: 50000 }, CATALOGO, new Set([0]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.replace(/\s/g, " ")).toBe("El precio cambió: ahora el total es $ 60.000. Revisalo y volvé a pedir.");
  });

  it("no deja pedir una medida sin precio", () => {
    const r = validarPedido({ cuadros: [{ ...cuadro(0), w: 45, h: 45 }] }, CATALOGO, new Set([0]));
    expect(r.ok).toBe(false);
  });

  it("no deja pedir sin las fotos subidas", () => {
    const r = validarPedido({ cuadros: [cuadro(0)] }, CATALOGO, new Set());
    expect(r).toEqual({ ok: false, error: "Falta subir una de tus fotos. Volvé al paso de las fotos." });
  });

  it("rechaza datos raros sin romperse", () => {
    expect(validarPedido({ cuadros: [{ tipo: "CANVAS", w: "30" }] }, CATALOGO, new Set([0])).ok).toBe(false);
    expect(validarPedido(null, CATALOGO, new Set([0])).ok).toBe(false);
    expect(validarPedido({ cuadros: [{ ...cuadro(0), encuadre: { ...ENCUADRE_INICIAL, incl: 90 } }] }, CATALOGO, new Set([0])).ok).toBe(false);
  });
});
