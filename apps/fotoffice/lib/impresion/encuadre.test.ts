import { describe, expect, it } from "vitest";
import { AJUSTES_NEUTROS } from "./ajustes";
import {
  aspectoCoincide,
  cambiarModo,
  cambiarOrientacion,
  colocacionEnPantalla,
  conZoom,
  encuadreQueContiene,
  encuadreQueLlena,
  enderezarA,
  girar90,
  limitarEncuadre,
  moverEncuadre,
  nivelDeZoom,
  papelOrientado,
  propuestaAutomatica,
  rangoDeZoom,
  volverALaPropuesta,
  zoomEncuadre,
} from "./encuadre";
import { recetaInicial, validarReceta, type Receta } from "./receta";

const P10 = { anchoMm: 102, altoMm: 152 };
const ctx = (ancho: number, alto: number) => ({ foto: { ancho, alto }, papel: P10 });

describe("propuesta automática (§5.5)", () => {
  it("una foto 3:2 acostada se recorta, centrada y en papel acostado", () => {
    const r = propuestaAutomatica(6000, 4000, P10);
    expect([r.modo, r.orientacion, r.colorBorde, r.rotacion90, r.enderezar]).toEqual(["RECORTAR", "HORIZONTAL", "#ffffff", 0, 0]);
    expect(r.encuadre.alto).toBe(1);
    expect(r.encuadre.ancho).toBeCloseTo(152 / 102 / 1.5, 6);
    expect(r.encuadre.x).toBeCloseTo((1 - 152 / 102 / 1.5) / 2, 6);
    expect(validarReceta(r)).toEqual(r);
  });

  it("16:9 pierde más del 8 %: se encaja con borde arriba y abajo", () => {
    const r = propuestaAutomatica(1920, 1080, P10);
    expect([r.modo, r.orientacion]).toEqual(["ENCAJAR", "HORIZONTAL"]);
    expect(r.encuadre.ancho).toBe(1);
    expect(r.encuadre.alto).toBeCloseTo(16 / 9 / (152 / 102), 6);
    expect(r.encuadre.y).toBeCloseTo(-(r.encuadre.alto - 1) / 2, 6);
    expect(validarReceta(r)).toEqual(r);
  });

  it("una foto de celular parada 3:4 se encaja en papel parado", () => {
    const r = propuestaAutomatica(3000, 4000, P10);
    expect([r.modo, r.orientacion]).toEqual(["ENCAJAR", "VERTICAL"]);
    expect(r.encuadre.alto).toBeCloseTo(0.75 / (102 / 152), 6);
  });

  it("el umbral es 8 % o menos para recortar", () => {
    const cuadrado = { anchoMm: 100, altoMm: 100 };
    // Pérdida 5 % y 20 %: claramente a cada lado del umbral, sin depender de redondeos.
    expect(propuestaAutomatica(1000, 950, cuadrado).modo).toBe("RECORTAR");
    expect(propuestaAutomatica(1000, 800, cuadrado).modo).toBe("ENCAJAR");
    // Pérdida 7 % y 9 %: apenas de cada lado.
    expect(propuestaAutomatica(1000, 930, cuadrado).modo).toBe("RECORTAR");
    expect(propuestaAutomatica(1000, 910, cuadrado).modo).toBe("ENCAJAR");
  });

  it("una panorámica 3:1 se encaja y la receta es válida", () => {
    const r = propuestaAutomatica(9000, 3000, P10);
    expect([r.modo, r.orientacion]).toEqual(["ENCAJAR", "HORIZONTAL"]);
    expect(r.encuadre.alto).toBeCloseTo(3 / (152 / 102), 6);
    expect(validarReceta(r)).toEqual(r);
  });

  it("una foto cuadrada va en papel parado", () => {
    expect(propuestaAutomatica(2000, 2000, P10).orientacion).toBe("VERTICAL");
  });

  it("el papel se orienta sin importar cómo está guardado", () => {
    expect(papelOrientado(P10, "HORIZONTAL")).toEqual({ anchoMm: 152, altoMm: 102 });
    expect(papelOrientado({ anchoMm: 152, altoMm: 102 }, "VERTICAL")).toEqual(P10);
  });
});

describe("mover y hacer zoom", () => {
  const vertical = cambiarOrientacion(propuestaAutomatica(6000, 4000, P10), ctx(6000, 4000));

  it("cambiar la orientación recentra en el modo actual", () => {
    expect([vertical.orientacion, vertical.modo]).toEqual(["VERTICAL", "RECORTAR"]);
    expect(vertical.encuadre.ancho).toBeCloseTo((102 / 152) / 1.5, 6);
    expect(vertical.encuadre.x).toBeCloseTo((1 - (102 / 152) / 1.5) / 2, 6);
  });

  it("RECORTAR: arrastrar mueve el encuadre al revés y no deja salir de la foto", () => {
    const e = vertical.encuadre;
    expect(moverEncuadre(e, 0.1, 0, "RECORTAR").x).toBeCloseTo(e.x - 0.1 * e.ancho, 6);
    expect(moverEncuadre(e, 5, 0, "RECORTAR").x).toBe(0);
    expect(moverEncuadre(e, -5, 0, "RECORTAR").x).toBeCloseTo(1 - e.ancho, 6);
  });

  it("ENCAJAR: en el eje con borde, la foto queda entera dentro del papel", () => {
    const e = propuestaAutomatica(1920, 1080, P10).encuadre;
    expect(moverEncuadre(e, 0, 1, "ENCAJAR").y).toBeCloseTo(1 - e.alto, 6);
    expect(moverEncuadre(e, 0, -1, "ENCAJAR").y).toBe(0);
    expect(moverEncuadre(e, 1, 0, "ENCAJAR").x).toBe(0);
  });

  it("limitar no toca un encuadre que ya está bien", () => {
    const e = { x: 0.1, y: 0.2, ancho: 0.5, alto: 0.5 };
    expect(limitarEncuadre(e, "RECORTAR")).toEqual(e);
  });

  it("RECORTAR: el zoom acerca hasta 6× y no achica más que llenar el papel; conserva centro y proporción", () => {
    const af = 1.5, ap = 102 / 152;
    const e = vertical.encuadre;
    const z = zoomEncuadre(e, 2, "RECORTAR", af, ap);
    expect(z.ancho).toBeCloseTo(e.ancho / 2, 6);
    expect(z.alto).toBeCloseTo(0.5, 6);
    expect(z.x + z.ancho / 2).toBeCloseTo(0.5, 6);
    expect(z.alto / z.ancho).toBeCloseTo(af / ap, 6);
    expect(zoomEncuadre(e, 0.1, "RECORTAR", af, ap).ancho).toBeCloseTo(e.ancho, 6);
    expect(zoomEncuadre(e, 100, "RECORTAR", af, ap).ancho).toBeCloseTo(e.ancho / 6, 6);
  });

  it("ENCAJAR: se achica hasta 1/4 del papel y se agranda hasta llenarlo", () => {
    const af = 16 / 9, ap = 152 / 102;
    const e = encuadreQueContiene(af, ap);
    const chica = zoomEncuadre(e, 0.1, "ENCAJAR", af, ap);
    expect(chica.ancho).toBeCloseTo(4, 6);
    expect(chica.x).toBeCloseTo(-1.5, 6);
    const llena = zoomEncuadre(e, 100, "ENCAJAR", af, ap);
    expect(llena.y).toBeCloseTo(0, 6);
    expect(llena.alto).toBeCloseTo(1, 6);
    expect(llena.ancho).toBeCloseTo(encuadreQueLlena(af, ap).ancho, 6);
  });

  it("el nivel de zoom: 1 = llena el papel; el rango depende del modo", () => {
    const af = 16 / 9, ap = 152 / 102;
    expect(nivelDeZoom(encuadreQueLlena(af, ap), af, ap)).toBeCloseTo(1, 6);
    expect(rangoDeZoom("RECORTAR", af, ap)).toEqual({ min: 1, max: 6 });
    const r = rangoDeZoom("ENCAJAR", af, ap);
    expect(r.max).toBe(1);
    expect(r.min).toBeCloseTo(ap / af / 4, 6);
    expect(nivelDeZoom(conZoom(encuadreQueContiene(af, ap), 0.5, "ENCAJAR", af, ap), af, ap)).toBeCloseTo(0.5, 6);
  });
});

describe("girar, enderezar, modo y propuesta", () => {
  const c = ctx(6000, 4000);
  const base = propuestaAutomatica(6000, 4000, P10);

  it("girar 90° recentra con la caja girada", () => {
    const r = girar90(base, c);
    expect(r.rotacion90).toBe(90);
    expect(r.encuadre.ancho).toBe(1);
    expect(r.encuadre.alto).toBeCloseTo((4000 / 6000) / (152 / 102), 6);
  });

  it("enderezar se acota a ±10° y la receta sigue válida", () => {
    const r = enderezarA(base, 15, c);
    expect(r.enderezar).toBe(10);
    expect(validarReceta(r)).toEqual(r);
    expect(enderezarA(base, -3.46, c).enderezar).toBe(-3.5);
  });

  it("cambiar de modo recentra; al mismo modo no cambia nada", () => {
    expect(cambiarModo(base, "RECORTAR", c)).toBe(base);
    const e = cambiarModo(base, "ENCAJAR", c);
    expect(e.modo).toBe("ENCAJAR");
    expect(e.colorBorde).toBe("#ffffff");
    expect(e.encuadre.ancho).toBe(1);
  });

  it("volver a la propuesta deshace giro y encuadre pero conserva los ajustes", () => {
    const tocada: Receta = { ...girar90(base, c), enderezar: 3, ajustes: { ...AJUSTES_NEUTROS, exposicion: 10 } };
    const r = volverALaPropuesta(tocada, c);
    expect([r.rotacion90, r.enderezar, r.orientacion, r.modo]).toEqual([0, 0, "HORIZONTAL", "RECORTAR"]);
    expect(r.ajustes.exposicion).toBe(10);
    expect(r.encuadre).toEqual(base.encuadre);
  });

  it("aspectoCoincide: el encuadre tiene la proporción del papel en la foto donde se usa", () => {
    const r = propuestaAutomatica(600, 400, P10);
    expect(aspectoCoincide({ ancho: 600, alto: 400 }, r, P10)).toBe(true);
    expect(aspectoCoincide({ ancho: 400, alto: 600 }, r, P10)).toBe(false);
  });
});

describe("colocación en pantalla", () => {
  it("ENCAJAR 2:1 en papel cuadrado: la foto ocupa la mitad del alto, centrada", () => {
    const r: Receta = { ...recetaInicial(), modo: "ENCAJAR", orientacion: "VERTICAL", encuadre: { x: 0, y: -0.5, ancho: 1, alto: 2 } };
    const c = colocacionEnPantalla(r, { ancho: 2000, alto: 1000 }, { ancho: 200, alto: 200 });
    expect(c.caja.left).toBeCloseTo(0, 6);
    expect(c.caja.top).toBeCloseTo(50, 6);
    expect(c.caja.width).toBeCloseTo(200, 6);
    expect(c.caja.height).toBeCloseTo(100, 6);
    expect(c.foto).toEqual({ width: 200, height: 100, rotacion: 0 });
  });

  it("con la foto girada 90° la imagen se dibuja girada dentro de la caja", () => {
    const r: Receta = { ...recetaInicial(), rotacion90: 90, modo: "ENCAJAR", orientacion: "VERTICAL", encuadre: { x: 0, y: -0.5, ancho: 1, alto: 2 } };
    const c = colocacionEnPantalla(r, { ancho: 1000, alto: 2000 }, { ancho: 200, alto: 200 });
    expect(c.caja.height).toBeCloseTo(100, 6);
    expect(c.foto).toEqual({ width: 100, height: 200, rotacion: 90 });
  });

  describe("panorámicas: el encuadre nunca pasa el tope de 20", () => {
    const papel = { anchoMm: 100, altoMm: 150 };
    for (const [ancho, alto] of [[10000, 1000], [30000, 1000]] as const) {
      it(`${ancho / alto}:1 da recetas válidas en la propuesta y en el máximo alejado`, () => {
        const r = propuestaAutomatica(ancho, alto, papel);
        expect(r.modo).toBe("ENCAJAR");
        expect(validarReceta(r)).not.toBeNull();
        const af = ancho / alto;
        const ap = 150 / 100;
        const { min } = rangoDeZoom("ENCAJAR", af, ap);
        const lejos = conZoom(r.encuadre, min, "ENCAJAR", af, ap);
        expect(validarReceta({ ...r, encuadre: lejos })).not.toBeNull();
        const muyLejos = zoomEncuadre(r.encuadre, 0.0001, "ENCAJAR", af, ap);
        expect(validarReceta({ ...r, encuadre: muyLejos })).not.toBeNull();
        expect(Math.abs(muyLejos.x + muyLejos.ancho / 2 - 0.5)).toBeLessThan(1e-6);
      });
    }
  });
});
