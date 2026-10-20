import { describe, expect, it } from "vitest";
import { AJUSTES_NEUTROS } from "./ajustes";
import { propuestaAutomatica } from "./encuadre";
import { aplicarGuardado, cambiosEnLote, mismaReceta, textoDeAviso, totalDeCopias } from "./lote";
import type { FotoCopia } from "./copias";

const P10 = { anchoMm: 102, altoMm: 152 };
function foto(id: string, ancho: number, alto: number, cantidad = 1, revisada = false): FotoCopia {
  return {
    originalId: id,
    nombre: `${id}.jpg`,
    ancho,
    alto,
    pieza: { receta: propuestaAutomatica(ancho, alto, P10), cantidad, revisada, ppp: 300, aviso: "OK" },
    hoja: { id: `h-${id}`, version: "v", copias: cantidad },
  };
}
const FOTOS = [foto("a", 6000, 4000), foto("b", 1920, 1080, 2)];

describe("cambios en lote", () => {
  it("encajar todas: sólo cambia la que estaba recortada, y sin marcar revisada", () => {
    const c = cambiosEnLote(FOTOS, new Set(), { modo: "ENCAJAR" }, P10);
    expect(c.map((x) => [x.originalId, x.receta.modo, x.cantidad, x.revisada])).toEqual([["a", "ENCAJAR", 1, false]]);
  });

  it("cantidad para todas, o sólo para las elegidas", () => {
    expect(cambiosEnLote(FOTOS, new Set(), { cantidad: 3 }, P10).map((x) => [x.originalId, x.cantidad])).toEqual([["a", 3], ["b", 3]]);
    expect(cambiosEnLote(FOTOS, new Set(["b"]), { cantidad: 3 }, P10).map((x) => x.originalId)).toEqual(["b"]);
    expect(cambiosEnLote(FOTOS, new Set(), { cantidad: 2, modo: "ENCAJAR" }, P10).map((x) => x.originalId)).toEqual(["a"]);
  });

  it("el total de copias suma la cantidad de cada foto", () => {
    expect(totalDeCopias(FOTOS)).toBe(3);
    expect(totalDeCopias([{ pieza: null }])).toBe(0);
  });
});

describe("reflejar lo guardado en pantalla", () => {
  const revisada = foto("a", 6000, 4000, 1, true);

  it("sólo la cantidad: sigue revisada y la hoja queda vencida", () => {
    const [f] = aplicarGuardado([revisada], [{ originalId: "a", cantidad: 4, receta: revisada.pieza!.receta, revisada: false }], P10);
    expect(f!.pieza).toMatchObject({ cantidad: 4, revisada: true });
    expect(f!.hoja).toBeNull();
  });

  it("otra receta sin confirmar: deja de estar revisada", () => {
    const receta = { ...revisada.pieza!.receta, ajustes: { ...AJUSTES_NEUTROS, exposicion: 5 } };
    const [f] = aplicarGuardado([revisada], [{ originalId: "a", cantidad: 1, receta, revisada: false }], P10);
    expect(f!.pieza!.revisada).toBe(false);
  });

  it("sin cambios: la hoja sigue vigente; las fotos que no se tocaron quedan igual", () => {
    const fotos = [revisada, foto("b", 1920, 1080)];
    const r = aplicarGuardado(fotos, [{ originalId: "a", cantidad: 1, receta: revisada.pieza!.receta, revisada: true }], P10);
    expect(r[0]!.hoja).toEqual(revisada.hoja);
    expect(r[1]).toBe(fotos[1]);
  });

  it("dos recetas iguales con las claves en otro orden son la misma", () => {
    const r = revisada.pieza!.receta;
    const alReves = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).reverse());
    const desordenada = { ...alReves(r as unknown as Record<string, unknown>), ajustes: alReves(r.ajustes as unknown as Record<string, unknown>) } as unknown as typeof r;
    expect(Object.keys(desordenada)).not.toEqual(Object.keys(r));
    expect(mismaReceta(r, desordenada)).toBe(true);
  });

  it("textos del aviso de calidad (§5.4)", () => {
    expect(textoDeAviso("OK", "13x18")).toBeNull();
    expect(textoDeAviso("BLANDA", "13x18")).toBe("Puede verse algo blanda en 13x18");
    expect(textoDeAviso("PIXELADA", "13x18")).toBe("Se va a ver pixelada en 13x18");
  });
});
