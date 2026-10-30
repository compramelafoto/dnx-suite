import { describe, expect, it } from "vitest";
import {
  aplicarATodos,
  cambiarMedida,
  desdePlantilla,
  duplicarCuadro,
  moverCuadro,
  quitarCuadro,
  rectanguloDelConjunto,
  rectFoto,
} from "./composicion";

const centro = { x: 190, y: 115 };

describe("la composición libre", () => {
  it("el escalonado 5 tiene el del centro más alto y todos centrados en alto", () => {
    const c = desdePlantilla("escalonado5", 50, 100, 5, "CANVAS", centro);
    const altos = c.cuadros.map((q) => q.h);
    expect(altos).toEqual([60, 80, 100, 80, 60]);
    const centros = c.cuadros.map((q) => q.y + q.h / 2);
    expect(new Set(centros.map((v) => v.toFixed(6))).size).toBe(1);
  });

  it("queda centrado en el punto pedido de la pared", () => {
    const c = desdePlantilla("triptico", 50, 70, 5, "IMPRESION", centro);
    const r = rectanguloDelConjunto(c);
    expect(c.ox + r.x + r.w / 2).toBeCloseTo(centro.x, 9);
    expect(c.oy + r.y + r.h / 2).toBeCloseTo(centro.y, 9);
  });

  it("el rectángulo del conjunto envuelve a todos los cuadros del escalonado", () => {
    const c = desdePlantilla("escalonado5", 50, 100, 5, "CANVAS", centro);
    const r = rectanguloDelConjunto(c);
    for (const q of c.cuadros) {
      expect(q.x).toBeGreaterThanOrEqual(r.x);
      expect(q.y).toBeGreaterThanOrEqual(r.y);
      expect(q.x + q.w).toBeLessThanOrEqual(r.x + r.w + 1e-9);
      expect(q.y + q.h).toBeLessThanOrEqual(r.y + r.h + 1e-9);
    }
    expect(r.h).toBe(100);
  });

  it("mover un cuadro cerca del borde de un vecino lo encastra y avisa la guía", () => {
    const c = desdePlantilla("diptico", 50, 70, 5, "IMPRESION", centro);
    const [a, b] = c.cuadros;
    // Llevar el segundo hasta 0,6 cm del borde izquierdo del primero alineado en x.
    const dx = a.x - b.x + 0.6;
    const { comp, guias } = moverCuadro(c, b.id, dx, 30);
    expect(comp.cuadros[1].x).toBeCloseTo(a.x, 9);
    expect(guias.x).toContain(a.x);
  });

  it("sin vecinos cerca no encastra", () => {
    const c = desdePlantilla("diptico", 50, 70, 5, "IMPRESION", centro);
    const b = c.cuadros[1];
    const { comp, guias } = moverCuadro(c, b.id, 20, 13);
    expect(comp.cuadros[1].x).toBeCloseTo(b.x + 20, 9);
    expect(guias.x).toEqual([]);
  });

  it("cambiar la medida conserva el centro del cuadro", () => {
    const c = desdePlantilla("individual", 50, 70, 5, "IMPRESION", centro);
    const q = c.cuadros[0];
    const n = cambiarMedida(c, q.id, 30, 40).cuadros[0];
    expect(n.x + n.w / 2).toBeCloseTo(q.x + q.w / 2, 9);
    expect(n.y + n.h / 2).toBeCloseTo(q.y + q.h / 2, 9);
  });

  it("quitar nunca deja el conjunto vacío", () => {
    const c = desdePlantilla("individual", 50, 70, 5, "IMPRESION", centro);
    expect(quitarCuadro(c, c.cuadros[0].id).cuadros).toHaveLength(1);
  });

  it("duplicar agrega un cuadro con otro id", () => {
    const c = desdePlantilla("diptico", 50, 70, 5, "IMPRESION", centro);
    const d = duplicarCuadro(c, c.cuadros[0].id);
    expect(d.cuadros).toHaveLength(3);
    expect(new Set(d.cuadros.map((q) => q.id)).size).toBe(3);
  });

  it("aplicar a todos cambia el tipo y la medida de cada cuadro", () => {
    const c = desdePlantilla("triptico", 50, 70, 5, "IMPRESION", centro);
    const d = aplicarATodos(c, { tipo: "MARCO", w: 40, h: 50 });
    expect(d.cuadros.every((q) => q.tipo === "MARCO" && q.w === 40 && q.h === 50)).toBe(true);
  });

  it("la ventana de la foto de un marco con paspartú 5 resta 7,5 cm por lado", () => {
    const c = desdePlantilla("individual", 50, 70, 5, "MARCO", centro);
    const q = c.cuadros[0];
    expect(q.paspartu).toBe(5);
    const r = rectFoto(q);
    expect(r).toEqual({ x: q.x + 7.5, y: q.y + 7.5, w: 35, h: 55 });
  });

  it("el canvas y la impresión usan el cuadro entero", () => {
    const q = desdePlantilla("individual", 50, 70, 5, "CANVAS", centro).cuadros[0];
    expect(rectFoto(q)).toEqual({ x: q.x, y: q.y, w: 50, h: 70 });
  });
});
