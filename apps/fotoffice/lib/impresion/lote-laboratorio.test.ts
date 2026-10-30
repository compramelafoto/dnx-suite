import { describe, expect, it } from "vitest";
import { cambiarModo, propuestaAutomatica } from "./encuadre";
import { medidaEnMm, type OpcionesLab } from "./laboratorio";
import {
  aplicarGuardadoLab,
  cambiosLab,
  piezaNueva,
  piezasFaltantes,
  plazoParaMedida,
  resumenPorGrupo,
  textoDePieza,
  valoresIniciales,
  type FotoLabVista,
  type ValoresLab,
} from "./lote-laboratorio";

const opciones: OpcionesLab = {
  medidas: [
    { medida: "10x15", plazos: ["MANANA", "SEMANA"] },
    { medida: "13x18", plazos: ["SEMANA"] },
    { medida: "20x30", plazos: ["MANANA"] },
  ],
  papeles: ["MATE", "BRILLO"],
};

const V: ValoresLab = { medida: "10x15", plazo: "SEMANA", papel: "MATE", cantidad: 1 };

function foto(id: string, v: Partial<ValoresLab> = {}, revisada = false, ancho = 4000, alto = 6000): FotoLabVista {
  const valores = { ...V, ...v };
  return {
    originalId: id,
    nombre: `${id}.jpg`,
    ancho,
    alto,
    pieza: { ...valores, receta: propuestaAutomatica(ancho, alto, medidaEnMm(valores.medida)!), revisada },
  };
}

describe("valores de las fotos nuevas", () => {
  it("primera medida, próxima semana si la ofrece, primer papel y 1 copia", () => {
    expect(valoresIniciales(opciones)).toEqual({ medida: "10x15", plazo: "SEMANA", papel: "MATE", cantidad: 1 });
  });
  it("si la primera medida no tiene próxima semana, su primer plazo", () => {
    expect(valoresIniciales({ ...opciones, medidas: [{ medida: "20x30", plazos: ["MANANA"] }] })?.plazo).toBe("MANANA");
  });
  it("sin medidas o sin papeles no hay valores", () => {
    expect(valoresIniciales({ medidas: [], papeles: ["MATE"] })).toBeNull();
    expect(valoresIniciales({ ...opciones, papeles: [] })).toBeNull();
  });
  it("plazoParaMedida respeta el pedido si la medida lo ofrece", () => {
    expect(plazoParaMedida(opciones, "10x15", "MANANA")).toBe("MANANA");
    expect(plazoParaMedida(opciones, "13x18", "MANANA")).toBe("SEMANA");
    expect(plazoParaMedida(opciones, "20x30", "SEMANA")).toBe("MANANA");
    expect(plazoParaMedida(opciones, "99x99")).toBeNull();
  });
});

describe("piezaNueva y piezasFaltantes", () => {
  it("la foto nueva lleva los valores y la propuesta automática de esa medida", () => {
    const p = piezaNueva({ originalId: "a", ancho: 6000, alto: 4000 }, { ...V, cantidad: 3 });
    expect(p).toMatchObject({ originalId: "a", medida: "10x15", plazo: "SEMANA", papel: "MATE", cantidad: 3, revisada: false });
    expect(p!.receta).toEqual(propuestaAutomatica(6000, 4000, medidaEnMm("10x15")!));
  });
  it("sólo completa las que no tienen pieza", () => {
    const sin: FotoLabVista = { originalId: "b", nombre: "b", ancho: 100, alto: 150, pieza: null };
    expect(piezasFaltantes([foto("a"), sin], V).map((x) => x.originalId)).toEqual(["b"]);
  });
});

describe("cambiosLab", () => {
  it("sin elegidas cambia todas; sólo devuelve las que cambian", () => {
    const fotos = [foto("a"), foto("b", { papel: "BRILLO" })];
    const r = cambiosLab(fotos, new Set(), { papel: "BRILLO" }, opciones);
    expect(r.map((x) => x.originalId)).toEqual(["a"]);
    expect(r[0]).toMatchObject({ papel: "BRILLO", revisada: false });
    expect(r[0]!.receta).toBe(fotos[0]!.pieza!.receta);
  });
  it("con elegidas, sólo esas", () => {
    const r = cambiosLab([foto("a"), foto("b")], new Set(["b"]), { cantidad: 4 }, opciones);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ originalId: "b", cantidad: 4 });
  });
  it("la cantidad queda entre 1 y 99", () => {
    expect(cambiosLab([foto("a")], new Set(), { cantidad: 500 }, opciones)[0]!.cantidad).toBe(99);
    expect(cambiosLab([foto("a", { cantidad: 3 })], new Set(), { cantidad: 0 }, opciones)[0]!.cantidad).toBe(1);
  });
  it("cambiar la medida rehace el recorte para la medida nueva en el mismo modo y ajusta el plazo", () => {
    const f = foto("a", { plazo: "SEMANA" }, true);
    const [r] = cambiosLab([f], new Set(), { medida: "20x30" }, opciones);
    expect(r).toMatchObject({ medida: "20x30", plazo: "MANANA", revisada: false });
    const esperada = cambiarModo(propuestaAutomatica(4000, 6000, medidaEnMm("20x30")!), f.pieza!.receta.modo, {
      foto: { ancho: 4000, alto: 6000 },
      papel: medidaEnMm("20x30")!,
    });
    expect(r!.receta.encuadre).toEqual(esperada.encuadre);
    expect(r!.receta.modo).toBe(f.pieza!.receta.modo);
  });
  it("un plazo que la medida no ofrece queda en el que tenga", () => {
    const [r] = cambiosLab([foto("a", { medida: "13x18" })], new Set(), { plazo: "MANANA", cantidad: 2 }, opciones);
    expect(r).toMatchObject({ plazo: "SEMANA", cantidad: 2 });
  });
  it("saltea las fotos sin pieza", () => {
    expect(cambiosLab([{ originalId: "x", nombre: "x", ancho: 1, alto: 1, pieza: null }], new Set(), { cantidad: 2 }, opciones)).toEqual([]);
  });
});

describe("aplicarGuardadoLab", () => {
  it("conserva «Revisada» si no cambió ni el recorte, ni la medida, ni el papel", () => {
    const f = foto("a", {}, true);
    const [r1] = aplicarGuardadoLab([f], cambiosLab([f], new Set(), { cantidad: 5, plazo: "MANANA" }, opciones));
    expect(r1!.pieza).toMatchObject({ cantidad: 5, plazo: "MANANA", revisada: true });
    const [r2] = aplicarGuardadoLab([f], cambiosLab([f], new Set(), { papel: "BRILLO" }, opciones));
    expect(r2!.pieza!.revisada).toBe(false);
  });
  it("una foto sin pieza la recibe", () => {
    const sin: FotoLabVista = { originalId: "b", nombre: "b", ancho: 100, alto: 150, pieza: null };
    const [r] = aplicarGuardadoLab([sin], piezasFaltantes([sin], V));
    expect(r!.pieza).toMatchObject({ medida: "10x15", cantidad: 1, revisada: false });
  });
});

describe("resumenPorGrupo", () => {
  it("suma fotos y copias por medida · papel · plazo, en el orden de las medidas", () => {
    const r = resumenPorGrupo(
      [
        foto("a", { medida: "13x18", cantidad: 2 }),
        foto("b", { cantidad: 3 }),
        foto("c", { cantidad: 1 }),
        foto("d", { papel: "BRILLO", cantidad: 2 }),
        { originalId: "e", nombre: "e", ancho: 1, alto: 1, pieza: null },
      ],
      opciones,
    );
    expect(r).toEqual([
      { medida: "10x15", papel: "MATE", plazo: "SEMANA", fotos: 2, copias: 4 },
      { medida: "10x15", papel: "BRILLO", plazo: "SEMANA", fotos: 1, copias: 2 },
      { medida: "13x18", papel: "MATE", plazo: "SEMANA", fotos: 1, copias: 2 },
    ]);
  });
});

describe("textoDePieza", () => {
  it("se lee como en el mostrador", () => {
    expect(textoDePieza({ medida: "10x15", papel: "MATE", cantidad: 2, plazo: "SEMANA" })).toBe("10x15 · mate · ×2 · próxima semana");
  });
});
