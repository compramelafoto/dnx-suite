import { describe, expect, it } from "vitest";
import { avisoDeCalidad, cajaRotada, calidadDeCopia, encuadreDesdePixeles, interseccionConFoto, planDeRecorte, rectanguloEnPixeles, resolucionEfectiva, tamanoVistaPrevia } from "./geometria";
import { encuadreQueContiene, encuadreQueLlena } from "./encuadre";
import { recetaInicial, type Receta } from "./receta";

describe("geometría", () => {
  it("la caja rotada 90° invierte lados y 0° no cambia", () => {
    expect(cajaRotada(4000, 3000, 0)).toEqual({ ancho: 4000, alto: 3000 });
    expect(cajaRotada(4000, 3000, 90)).toEqual({ ancho: 3000, alto: 4000 });
  });
  it("la caja rotada 10° es más grande que la foto", () => {
    const c = cajaRotada(4000, 3000, 10);
    expect(c.ancho).toBe(Math.round(4000 * Math.cos(Math.PI / 18) + 3000 * Math.sin(Math.PI / 18)));
    expect(c.alto).toBeGreaterThan(3000);
  });
  it("ida y vuelta entre píxeles de la vista previa y proporciones", () => {
    const caja = { ancho: 1600, alto: 1200 };
    const e = encuadreDesdePixeles({ x: 400, y: 300, width: 800, height: 600 }, caja);
    expect(e).toEqual({ x: 0.25, y: 0.25, ancho: 0.5, alto: 0.5 });
    expect(rectanguloEnPixeles(e, { ancho: 4000, alto: 3000 })).toEqual({ left: 1000, top: 750, width: 2000, height: 1500 });
  });
  it("nunca se sale de la caja, ni siquiera con margen de seguridad", () => {
    const r = rectanguloEnPixeles({ x: 0.9, y: 0.9, ancho: 0.1, alto: 0.1 }, { ancho: 1001, alto: 1001 }, 2);
    expect(r.left + r.width).toBeLessThanOrEqual(1001 - 2);
    expect(r.top + r.height).toBeLessThanOrEqual(1001 - 2);
    expect(r.width).toBeGreaterThanOrEqual(1);
  });
  it("encuadreDesdePixeles recorta valores fuera de rango", () => {
    const e = encuadreDesdePixeles({ x: -5, y: -5, width: 2000, height: 2000 }, { ancho: 1000, alto: 1000 });
    expect(e).toEqual({ x: 0, y: 0, ancho: 1, alto: 1 });
  });
  it("resolución efectiva y aviso", () => {
    expect(resolucionEfectiva({ width: 1205, height: 1795 }, { anchoMm: 102, altoMm: 152 })).toBe(300);
    expect(avisoDeCalidad(200)).toBe("OK");
    expect(avisoDeCalidad(199)).toBe("BLANDA");
    expect(avisoDeCalidad(150)).toBe("BLANDA");
    expect(avisoDeCalidad(149)).toBe("PIXELADA");
  });
  it("la vista previa: 1600 px de lado mayor, sin agrandar fotos chicas", () => {
    expect(tamanoVistaPrevia(4000, 3000)).toEqual({ ancho: 1600, alto: 1200 });
    expect(tamanoVistaPrevia(3001, 4003)).toEqual({ ancho: 1200, alto: 1600 });
    expect(tamanoVistaPrevia(800, 600)).toEqual({ ancho: 800, alto: 600 });
    expect(tamanoVistaPrevia(20000, 3)).toEqual({ ancho: 1600, alto: 1 });
  });
});

describe("plan de recorte", () => {
  it("RECORTAR: el encuadre entero a todo el destino (igual que la etapa 1)", () => {
    const e = { x: 0.25, y: 0.25, ancho: 0.5, alto: 0.5 };
    expect(planDeRecorte({ modo: "RECORTAR", encuadre: e }, { ancho: 4000, alto: 3000 }, { ancho: 600, alto: 450 })).toEqual({
      // Valores fijos (no la misma función que usa la implementación): 25 % de 4000 y 3000, 50 % de cada lado.
      recorte: { left: 1000, top: 750, width: 2000, height: 1500 },
      colocacion: { left: 0, top: 0, width: 600, height: 450 },
      completo: true,
    });
  });

  it("ENCAJAR 2:1 en papel cuadrado: la foto entera, centrada, con borde arriba y abajo", () => {
    const plan = planDeRecorte({ modo: "ENCAJAR", encuadre: { x: 0, y: -0.5, ancho: 1, alto: 2 } }, { ancho: 2000, alto: 1000 }, { ancho: 200, alto: 200 });
    expect(plan).toEqual({
      recorte: { left: 0, top: 0, width: 2000, height: 1000 },
      colocacion: { left: 0, top: 50, width: 200, height: 100 },
      completo: false,
    });
  });

  it("ENCAJAR que corta los costados: sólo la parte de la foto que cae en el papel", () => {
    const plan = planDeRecorte({ modo: "ENCAJAR", encuadre: { x: 0.1, y: -0.5, ancho: 0.8, alto: 2 } }, { ancho: 2000, alto: 1000 }, { ancho: 200, alto: 200 });
    expect(plan.recorte).toEqual({ left: 200, top: 0, width: 1600, height: 1000 });
    expect(plan.colocacion).toEqual({ left: 0, top: 50, width: 200, height: 100 });
  });

  it("la vista previa y el original dan la misma colocación (la pantalla no cambia el resultado)", () => {
    const r = { modo: "ENCAJAR" as const, encuadre: encuadreQueContiene(1.5, 127 / 180) };
    const final = planDeRecorte(r, { ancho: 3000, alto: 2000 }, { ancho: 400, alto: 567 });
    const vista = planDeRecorte(r, { ancho: 1600, alto: 1067 }, { ancho: 400, alto: 567 });
    expect(vista.colocacion).toEqual(final.colocacion);
    expect(final.colocacion).toEqual({ left: 0, top: 150, width: 400, height: 267 });
  });

  it("la intersección con la foto: null si no la toca", () => {
    expect(interseccionConFoto({ x: -0.5, y: 0, ancho: 2, alto: 1 })).toEqual({ x: 0, y: 0, ancho: 1, alto: 1 });
    expect(interseccionConFoto({ x: 1.2, y: 0, ancho: 1, alto: 1 })).toBeNull();
  });
});

describe("calidad de una copia", () => {
  it("una foto justa para 10x15 a 300 ppp no avisa", () => {
    const r: Receta = { ...recetaInicial(), orientacion: "VERTICAL", encuadre: encuadreQueLlena(1205 / 1795, 102 / 152) };
    expect(calidadDeCopia({ ancho: 1205, alto: 1795 }, r, { anchoMm: 102, altoMm: 152 })).toEqual({ ppp: 300, aviso: "OK" });
  });

  it("una foto chica avisa pixelada", () => {
    const r: Receta = { ...recetaInicial(), orientacion: "HORIZONTAL", encuadre: encuadreQueLlena(400 / 300, 180 / 127) };
    expect(calidadDeCopia({ ancho: 400, alto: 300 }, r, { anchoMm: 180, altoMm: 127 })).toEqual({ ppp: 56, aviso: "PIXELADA" });
  });

  it("en ENCAJAR cuenta sólo el lugar que ocupa la foto en el papel", () => {
    const r: Receta = { ...recetaInicial(), modo: "ENCAJAR", orientacion: "HORIZONTAL", encuadre: encuadreQueContiene(2, 152 / 102) };
    expect(calidadDeCopia({ ancho: 2000, alto: 1000 }, r, { anchoMm: 152, altoMm: 102 })).toEqual({ ppp: 334, aviso: "OK" });
  });
});
