import { describe, expect, it } from "vitest";
import { modeloTapaPorId, modelosParaLibro } from "./catalogo";
import { geometriaTapa } from "./geometria";

describe("tapas de fotolibro", () => {
  it("el Gold Premium de Román 30x60 es la pieza del PSD, con la cara de 305 mm de alto", () => {
    const g = geometriaTapa(modeloTapaPorId("roman-gold-premium-30x60")!, 20);
    expect(g.pieza).toEqual({ ancho: 305, alto: 345 });
    expect(g.tapa.x).toBeCloseTo(19.9, 1);
    expect(g.tapa.x + g.tapa.w).toBeCloseTo(284.8, 1);
    expect(g.tapa.h).toBeCloseTo(305.1, 1);
    expect(g.lomo).toBeNull();
  });

  it("la flexible es el pliego, con la contratapa a la izquierda y la tapa a la derecha", () => {
    const [m] = modelosParaLibro("flexible-30x60");
    expect(m!.tipo).toBe("flexible");
    const g = geometriaTapa(m!, 10);
    expect(g.pieza).toEqual({ ancho: 620, alto: 305 });
    expect(g.contratapa!.x).toBe(0);
    expect(g.tapa.x).toBe(310);
  });

  it("filtra por laboratorio y por medida", () => {
    // La del laboratorio primero, y la genérica siempre.
    expect(modelosParaLibro("rigido-30x60", "Román").map((m) => m.id)).toEqual(["roman-gold-premium-30x60", "generica-rigido-30x60"]);
    expect(modelosParaLibro("rigido-30x60", "La Isla").map((m) => m.id)).toEqual(["generica-rigido-30x60"]);
    expect(modelosParaLibro("rigido-20x30", "Román").map((m) => m.id)).toEqual(["generica-rigido-20x30"]);
  });

  it("en una tapa completa el lomo crece con las hojas", () => {
    const completa = { ...modeloTapaPorId("roman-gold-premium-30x60")!, tipo: "completa" as const, pieza: { ancho: 300, alto: 300 }, demasia: { arriba: 15, abajo: 15, exterior: 15, interior: 0 }, lomo: { baseMm: 4, porHojaMm: 1.5 } };
    const diez = geometriaTapa(completa, 10);
    const veinte = geometriaTapa(completa, 20);
    expect(diez.lomo!.w).toBe(19);
    expect(veinte.pieza.ancho - diez.pieza.ancho).toBe(15);
  });

  it("la genérica de un 30x60 es una pieza completa cuyo lomo crece con las hojas", () => {
    const m = modeloTapaPorId("generica-rigido-30x60")!;
    expect(m.estimada).toBe(true);
    const g = geometriaTapa(m, 20);
    // 1 mm por hoja: 20 hojas, 20 mm de lomo.
    expect(g.lomo!.w).toBe(20);
    expect(geometriaTapa(m, 35).lomo!.w).toBe(35);
    expect(g.tapa.w).toBeCloseTo(308, 0);
    expect(g.pieza.ancho).toBeCloseTo(18 * 2 + 308 * 2 + 20, 0);
  });
});
