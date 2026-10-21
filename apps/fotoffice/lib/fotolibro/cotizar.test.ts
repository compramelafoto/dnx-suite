import { describe, expect, it } from "vitest";
import { cotizarFotolibro, fotosPorHoja, hojasSugeridas, medidasDe, modelosDe, tablaSugerencias, TAPA_FLEXIBLE, type CatalogoFotolibro } from "./cotizar";
import { TRAMOS_POR_OMISION } from "@/lib/precios-proveedor/redondeo";

// Román, octubre 2026: hoja 30x45 $8.400; tapa Gold 30x45 $25.000; caja 30x45 $42.000. Factor ×3.
const pieza = (medida: string, costo: number, modelo: string | null = null) => ({ medida, modelo, baseMinor: costo * 100 * 3, costoMinor: costo * 100 });
const catalogo: CatalogoFotolibro = {
  marginPct: 200,
  tramos: TRAMOS_POR_OMISION,
  fotosPorHoja: {},
  ofertas: [
    {
      proveedorId: "roman",
      proveedor: "Román",
      vigencia: "2026-10",
      tapas: [pieza("30x45", 25_000, "Gold Collection"), pieza("15x30", 15_500, "Gold Collection")],
      hojas: [pieza("30x45", 8_400), pieza("15x30", 4_300), pieza("20x40", 6_600)],
      cajas: [pieza("30x45", 42_000, "Gold Collection")],
    },
  ],
};

describe("hojas sugeridas", () => {
  it("fotos ÷ fotos por hoja, hacia arriba, mínimo 2", () => {
    expect(hojasSugeridas(100, 8)).toBe(13);
    expect(hojasSugeridas(100, 10)).toBe(10);
    expect(hojasSugeridas(3, 10)).toBe(2);
    expect(hojasSugeridas(0, 10)).toBe(2);
  });
  it("fotos por hoja: lo configurado, si no la planilla, si no por superficie", () => {
    expect(fotosPorHoja("30x45", { "30x45": 12 })).toBe(12);
    expect(fotosPorHoja("15x30", {})).toBe(8);
    expect(fotosPorHoja("30x90", {})).toBe(20);
  });
});

describe("modelos y medidas", () => {
  it("los modelos son las tapas, más la tapa flexible si hay hojas", () => {
    expect(modelosDe(catalogo.ofertas[0]!)).toEqual(["Gold Collection", TAPA_FLEXIBLE]);
  });
  it("sólo las medidas que tienen tapa de ese modelo y hoja", () => {
    expect(medidasDe(catalogo.ofertas[0]!, "Gold Collection")).toEqual(["15x30", "30x45"]);
    expect(medidasDe(catalogo.ofertas[0]!, TAPA_FLEXIBLE)).toEqual(["15x30", "20x40", "30x45"]);
  });
});

describe("cotizarFotolibro", () => {
  it("tapa + hoja × hojas (+ caja) × 3, redondeado", () => {
    const r = cotizarFotolibro(catalogo, { proveedorId: "roman", modelo: "Gold Collection", medida: "30x45", hojas: 20, conCaja: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // (25.000 + 8.400 × 20 + 42.000) × 3 = 705.000
    expect(r.costoMinor).toBe(23_500_000);
    expect(r.precioMinor).toBe(70_500_000);
    expect(r.descripcion).toBe("Fotolibro Gold Collection 30x45 · 20 hojas + caja (Román)");
  });
  it("redondea hacia arriba con los tramos", () => {
    const r = cotizarFotolibro({ ...catalogo, marginPct: 170, ofertas: [{ ...catalogo.ofertas[0]!, tapas: [{ medida: "15x30", modelo: "Gold Collection", baseMinor: 4_185_000.5, costoMinor: 1_550_000 }] }] }, { proveedorId: "roman", modelo: "Gold Collection", medida: "15x30", hojas: 2, conCaja: false });
    expect(r.ok && r.precioMinor % 100_000).toBe(0);
  });
  it("tapa flexible = una hoja más", () => {
    const r = cotizarFotolibro(catalogo, { proveedorId: "roman", modelo: TAPA_FLEXIBLE, medida: "20x40", hojas: 4, conCaja: false });
    expect(r.ok && r.costoMinor).toBe(5 * 660_000);
  });
  it("errores claros: sin caja para esa medida, medida sin tapa, hojas inválidas", () => {
    expect(cotizarFotolibro(catalogo, { proveedorId: "roman", modelo: "Gold Collection", medida: "15x30", hojas: 10, conCaja: true }).ok).toBe(false);
    expect(cotizarFotolibro(catalogo, { proveedorId: "roman", modelo: "Gold Collection", medida: "20x40", hojas: 10, conCaja: false }).ok).toBe(false);
    expect(cotizarFotolibro(catalogo, { proveedorId: "roman", modelo: "Gold Collection", medida: "30x45", hojas: 0, conCaja: false }).ok).toBe(false);
    expect(cotizarFotolibro(catalogo, { proveedorId: "otro", modelo: "Gold Collection", medida: "30x45", hojas: 4, conCaja: false }).ok).toBe(false);
  });
  it("sin permiso de ver costos el costo viene nulo y el precio igual se calcula", () => {
    const sinCostos: CatalogoFotolibro = { ...catalogo, ofertas: catalogo.ofertas.map((o) => ({ ...o, tapas: o.tapas.map((t) => ({ ...t, costoMinor: null })), hojas: o.hojas.map((t) => ({ ...t, costoMinor: null })), cajas: o.cajas.map((t) => ({ ...t, costoMinor: null })) })) };
    const r = cotizarFotolibro(sinCostos, { proveedorId: "roman", modelo: "Gold Collection", medida: "30x45", hojas: 20, conCaja: true });
    expect(r.ok && r.costoMinor).toBeNull();
    expect(r.ok && r.precioMinor).toBe(70_500_000);
  });
});

describe("tablaSugerencias", () => {
  it("una fila por medida del modelo, con hojas sugeridas y precio", () => {
    const filas = tablaSugerencias(catalogo, "roman", "Gold Collection", 100);
    expect(filas.map((f) => [f.medida, f.hojas])).toEqual([["15x30", 13], ["30x45", 10]]);
    // 30x45: (25.000 + 8.400 × 10) × 3 = 327.000
    expect(filas[1]!.precioMinor).toBe(32_700_000);
  });
});
