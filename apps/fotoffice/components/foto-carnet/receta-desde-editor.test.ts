import { describe, expect, it } from "vitest";
import { AJUSTES_NEUTROS } from "@/lib/impresion/ajustes";
import { recetaDesdeEditor } from "./receta-desde-editor";

describe("receta desde el editor", () => {
  it("separa el giro de 90° del enderezado y pasa el encuadre a proporciones de la caja girada", () => {
    const r = recetaDesdeEditor({ cropPx: { x: 100, y: 200, width: 400, height: 400 }, vista: { ancho: 1200, alto: 1600 }, rotacion: 93, ajustes: AJUSTES_NEUTROS });
    expect(r.rotacion90).toBe(90);
    expect(r.enderezar).toBe(3);
  });
  it("−4° queda como enderezado −4 sin giro", () => {
    const r = recetaDesdeEditor({ cropPx: { x: 0, y: 0, width: 10, height: 10 }, vista: { ancho: 100, alto: 100 }, rotacion: -4, ajustes: AJUSTES_NEUTROS });
    expect([r.rotacion90, r.enderezar]).toEqual([0, -4]);
  });
  it("el encuadre usa la caja girada de la vista previa", () => {
    const r = recetaDesdeEditor({ cropPx: { x: 400, y: 300, width: 800, height: 600 }, vista: { ancho: 1200, alto: 1600 }, rotacion: 90, ajustes: AJUSTES_NEUTROS });
    // Girada 90°, la caja es 1600 × 1200.
    expect(r.encuadre).toEqual({ x: 0.25, y: 0.25, ancho: 0.5, alto: 0.5 });
  });
});
