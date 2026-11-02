import { describe, expect, it } from "vitest";
import { armarCatalogo } from "./catalogo";
import { ENCUADRE_INICIAL } from "./encuadre";
import { validarPedido } from "./pedido";
import { armarMarcos } from "./marcos";

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

describe("pedir un cuadro con marco real", () => {
  const catalogoMarco = armarCatalogo([{ id: "a", name: "Ampliación 20x30", priceArs: 4500, costArs: 1500, supplierName: null, preferredProveedorId: "isla" }]);
  const modelo = {
    id: "m1", productId: "p1", color: "Negro", imagenUrl: "https://x/m.png", imagenAncho: 1000, imagenAlto: 1250,
    ventana: { x: 125, y: 125, w: 750, h: 1000 }, exteriorAnchoCm: 40, exteriorAltoCm: 50,
  };
  const marcos = armarMarcos([{ id: "p1", name: "Marco box de madera", priceArs: 0, costArs: 9000, variantes: [{ id: "v1", name: "Negro · 20x30cm", priceArs: 25000 }] }], [modelo], catalogoMarco);
  const conMarco = { tipo: "MARCO", w: 99, h: 99, x: 0, y: 0, paspartu: 0, foto: 0, encuadre: ENCUADRE_INICIAL, marco: { modeloId: "m1", medidaFoto: { corto: 20, largo: 30 } } };

  it("cobra marco + ampliación, rearma la medida y manda la foto a la medida de la ampliación", () => {
    const r = validarPedido({ cuadros: [conMarco] }, catalogoMarco, new Set([0]), marcos);
    if (!r.ok) throw new Error(r.error);
    expect(r.totalArs).toBe(29500);
    const [renglon] = r.renglones;
    expect(renglon.receta.ventana).toEqual({ x: 0, y: 0, w: 20, h: 30 });
    expect(renglon.receta.marcoReal).toEqual({ nombre: "Marco box de madera", color: "Negro" });
    expect(renglon.precio.proveedorId).toBe("isla");
    expect(renglon.precio.costoArs).toBe(10500);
    expect(r.mapa[0]).toMatchObject({ w: 30, h: 40, marco: { color: "Negro" } });
  });

  it("un modelo que ya no está no se puede pedir", () => {
    const r = validarPedido({ cuadros: [{ ...conMarco, marco: { modeloId: "otro", medidaFoto: { corto: 20, largo: 30 } } }] }, catalogoMarco, new Set([0]), marcos);
    expect(r.ok).toBe(false);
  });
});
