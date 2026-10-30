import { describe, expect, it } from "vitest";
import { ENCUADRE_INICIAL as I } from "./encuadre";
import { mapaDeArmado, origenTrasGirar, planDeSalida, pppPara, rutaEnZip, type RecetaProbador } from "./salida";

const receta = (cambios: Partial<RecetaProbador> = {}): RecetaProbador => ({
  tipo: "CANVAS",
  marco: { w: 30, h: 40 },
  ventana: { x: 0, y: 0, w: 30, h: 40 },
  encuadre: I,
  envolturaCm: 5,
  orden: 2,
  total: 5,
  ...cambios,
});

describe("el archivo para el laboratorio", () => {
  it("baja la resolución en los cuadros grandes", () => {
    expect(pppPara(30, 45)).toBe(300);
    expect(pppPara(70, 50)).toBe(200);
    expect(pppPara(70, 100)).toBe(150);
  });

  it("un canvas 30x40 a 300 ppp suma 5 cm de envoltura por lado", () => {
    const p = planDeSalida(receta(), { w: 3000, h: 4000 });
    expect(p.ppp).toBe(300);
    expect(p.frente).toEqual({ w: 3543, h: 4724 });
    expect(p.total).toEqual({ w: 4725, h: 5906 });
  });

  it("sin inclinación, el origen es la esquina del cuadro llevada a la foto", () => {
    // Foto 3000×4000 en un cuadro 30×40: cubre justo, el origen es (0,0) de la foto.
    const p = planDeSalida(receta(), { w: 3000, h: 4000 });
    expect(p.region.left + p.origen.x).toBeCloseTo(0, 6);
    expect(p.region.top + p.origen.y).toBeCloseTo(0, 6);
    expect(p.escala).toBeCloseTo((30 / 3000) * (300 / 2.54), 9);
  });

  it("con una foto para todos, cada cuadro toma su parte del conjunto", () => {
    // Conjunto 65×40 (dos de 30×40 separados 5 cm); el segundo empieza en x = 35 cm.
    const p = planDeSalida(receta({ marco: { w: 65, h: 40 }, ventana: { x: 35, y: 0, w: 30, h: 40 } }), { w: 6500, h: 4000 });
    expect(p.region.left + p.origen.x).toBeCloseTo(3500, 6);
  });

  it("sin girar, origenTrasGirar sólo escala", () => {
    const q = origenTrasGirar({ x: 10, y: 20 }, { x: 2, y: 2 }, 0, { w: 100, h: 100 }, { w: 100, h: 100 });
    expect(q.x).toBeCloseTo(20, 9);
    expect(q.y).toBeCloseTo(40, 9);
  });

  it("con inclinación la región que se lee sigue dentro de la foto", () => {
    const p = planDeSalida(receta({ encuadre: { ...I, incl: 15, escala: 1.4 } }), { w: 3000, h: 4000 });
    expect(p.region.left).toBeGreaterThanOrEqual(0);
    expect(p.region.top).toBeGreaterThanOrEqual(0);
    expect(p.region.left + p.region.width).toBeLessThanOrEqual(3000);
    expect(p.region.top + p.region.height).toBeLessThanOrEqual(4000);
  });

  it("el nombre en el ZIP dice tipo, medida y número, sin caracteres raros", () => {
    expect(rutaEnZip(12, "Ana / Pérez", receta())).toBe("Pedido 12 - Ana - Pérez/Canvas 30x40/Cuadro 2 de 5.jpg");
  });

  it("el mapa de armado da medidas y distancias desde la esquina del conjunto", () => {
    const { texto, svg } = mapaDeArmado([{ x: 10, y: 5, w: 30, h: 40, tipo: "CANVAS" }, { x: 45, y: 5, w: 30, h: 40, tipo: "CANVAS" }], 12, "Ana");
    expect(texto).toContain("Cuadro 1 · Canvas 30 × 40 cm · a 0 cm de la izquierda y 0 cm de arriba");
    expect(texto).toContain("Cuadro 2 · Canvas 30 × 40 cm · a 35 cm de la izquierda");
    expect(svg.startsWith("<svg")).toBe(true);
  });
});
