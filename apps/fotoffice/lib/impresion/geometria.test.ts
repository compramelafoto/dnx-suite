import { describe, expect, it } from "vitest";
import { avisoDeCalidad, cajaRotada, encuadreDesdePixeles, rectanguloEnPixeles, resolucionEfectiva, tamanoVistaPrevia } from "./geometria";

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
