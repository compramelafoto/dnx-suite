import { describe, expect, it } from "vitest";
import { cotizarParaBot, elegirModelo, ofertaParaBot } from "./bot";
import type { CatalogoFotolibro } from "./cotizar";

// Base = costo × 3 (margen 200 %), en centavos. Sin tramos: redondea al peso.
const pieza = (medida: string, modelo: string | null, pesos: number) => ({ medida, modelo, baseMinor: pesos * 300, costoMinor: pesos * 100 });
const CATALOGO: CatalogoFotolibro = {
  marginPct: 200,
  tramos: [],
  fotosPorHoja: { "30x45": 10, "20x30": 4 },
  ofertas: [
    {
      proveedorId: "roman",
      proveedor: "Román",
      vigencia: "2026-10",
      tapas: [pieza("30x45", "Gold", 20000), pieza("30x45", "Gold Premium", 30000), pieza("20x30", "Gold", 10000), pieza("30x45", "Basic", 12000)],
      hojas: [pieza("30x45", null, 3000), pieza("20x30", null, 1500)],
      cajas: [pieza("30x45", "Gold", 15000)],
    },
  ],
};
const ROMAN = ofertaParaBot(CATALOGO, "roman")!;

describe("elegirModelo", () => {
  it("exacto o el único que contiene las palabras", () => {
    expect(elegirModelo(["Gold", "Gold Premium"], "gold")).toEqual({ ok: true, modelo: "Gold" });
    expect(elegirModelo(["Gold", "Gold Premium"], "premium")).toEqual({ ok: true, modelo: "Gold Premium" });
    expect(elegirModelo(["Gold Premium", "Gold Shine"], "gold")).toEqual({ ok: false, opciones: ["Gold Premium", "Gold Shine"] });
  });
});

describe("cotizarParaBot", () => {
  it("rígida sin modelo: rango de precios por medida para esas fotos", () => {
    const r = cotizarParaBot(CATALOGO, ROMAN, { tapa: "RIGIDA", fotos: 100 });
    expect(r).toMatchObject({ tipo: "RANGO", fotos: 100, modelos: ["Basic", "Gold", "Gold Premium"] });
    // 30x45: 10 fotos por hoja → 10 hojas. Basic = (12.000 + 10 × 3.000) × 3; Gold Premium = (30.000 + 30.000) × 3.
    expect(r.tipo === "RANGO" && r.filas.find((f) => f.medida === "30x45")).toEqual({ medida: "30x45", hojas: 10, desdeMinor: 12_600_000, hastaMinor: 18_000_000, desdeModelo: "Basic" });
  });

  it("con modelo y sin medida: las medidas con sus hojas y precio", () => {
    const r = cotizarParaBot(CATALOGO, ROMAN, { tapa: "RIGIDA", modelo: "gold", fotos: 40 });
    expect(r).toEqual({
      tipo: "MEDIDAS", modelo: "Gold", fotos: 40,
      filas: [
        { medida: "20x30", hojas: 10, precioMinor: (10000 + 10 * 1500) * 300 },
        { medida: "30x45", hojas: 4, precioMinor: (20000 + 4 * 3000) * 300 },
      ],
    });
  });

  it("con todo: precio del libro y de la caja (la medida acepta 45x30)", () => {
    const r = cotizarParaBot(CATALOGO, ROMAN, { tapa: "RIGIDA", modelo: "Gold", medida: "45x30", fotos: 180, caja: true });
    expect(r).toEqual({
      tipo: "PRECIO", proveedorId: "roman", modelo: "Gold", medida: "30x45", hojas: 18, fotos: 180,
      precioMinor: (20000 + 18 * 3000) * 300, costoMinor: (20000 + 18 * 3000) * 100,
      caja: { precioMinor: 15000 * 300, costoMinor: 15000 * 100 }, conCaja: true,
    });
  });

  it("las hojas dichas mandan; sin caja en esa medida, la caja es null", () => {
    const r = cotizarParaBot(CATALOGO, ROMAN, { tapa: "RIGIDA", modelo: "Basic", medida: "30x45", hojas: 20, caja: true });
    expect(r).toMatchObject({ tipo: "PRECIO", hojas: 20, caja: null, conCaja: false });
  });

  it("flexible: un solo modelo, va directo a las medidas", () => {
    const r = cotizarParaBot(CATALOGO, ROMAN, { tapa: "FLEXIBLE" });
    expect(r).toMatchObject({ tipo: "MEDIDAS", modelo: "Tapa flexible", fotos: 100 });
  });

  it("un modelo que no existe devuelve los que hay; uno dudoso, las opciones", () => {
    expect(cotizarParaBot(CATALOGO, ROMAN, { tapa: "RIGIDA", modelo: "dubai" })).toMatchObject({ tipo: "NO_ESTA", modelos: ["Basic", "Gold", "Gold Premium"] });
    expect(cotizarParaBot(CATALOGO, ROMAN, { tapa: "RIGIDA", modelo: "go" })).toEqual({ tipo: "AMBIGUO", opciones: ["Gold", "Gold Premium"] });
  });
});
