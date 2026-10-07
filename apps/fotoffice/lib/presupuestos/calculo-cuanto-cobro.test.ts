import { describe, expect, it } from "vitest";
import { calculateCuantoCobro, type CuantoCobroCalculationComplete } from "@repo/cuanto-cobro-core";
import {
  createBaseCompleteProfile,
  createBaseCompleteQuote,
} from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { itemDesdeCalculo } from "./calculo-cuanto-cobro";
import { itemSinDatosInternos, validarItem } from "./constantes";
import { calcularTotales } from "./totales";

const CUANDO = new Date("2026-10-07T15:00:00.000Z");

function calculoCompleto(chosenPrice = ""): CuantoCobroCalculationComplete {
  const r = calculateCuantoCobro(createBaseCompleteProfile(), createBaseCompleteQuote({ chosenPrice }));
  if (r.status !== "complete") throw new Error(`fixture incompleta: ${r.missingFields.join(", ")}`);
  return r;
}

describe("itemDesdeCalculo (motor real de ¿Cuánto Cobro?)", () => {
  it("convierte el resultado en un ítem CALCULO con el precio sugerido y su instantánea", () => {
    const r = calculoCompleto();
    const res = itemDesdeCalculo(r, { id: "i1", nombre: " Cobertura boda ", calculadoEn: CUANDO, parametros: { horas: 8 } });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const { item } = res;
    expect(item).toMatchObject({ id: "i1", nombre: "Cobertura boda", cantidad: 1, modoPrecio: "CALCULO", opcional: false });
    expect(item.precioUnitario).toBe(Math.round(r.chosenPriceEffective * 100) / 100);
    expect(item.precioUnitario).toBeGreaterThan(0);
    expect(item.calculo).toMatchObject({
      motor: "cuanto-cobro-core",
      calculadoEn: CUANDO.toISOString(),
      precioSugerido: item.precioUnitario,
      entrada: { horas: 8 },
    });
    expect(item.calculo!.precioMinimo).toBeGreaterThan(0);
    expect(item.calculo!.costoHumano).toBeGreaterThan(0);
  });

  it("respeta el precio manual que se cargó en el motor", () => {
    const r = calculoCompleto("250000");
    const res = itemDesdeCalculo(r, { id: "i1", nombre: "X" });
    expect(res.ok && res.item.precioUnitario).toBe(250000);
  });

  it("un precio ajustado manda sobre el sugerido, y la instantánea guarda el sugerido", () => {
    const r = calculoCompleto();
    const res = itemDesdeCalculo(r, { id: "i1", nombre: "X", precioAjustado: 123456.789 });
    if (!res.ok) throw new Error("debía andar");
    expect(res.item.precioUnitario).toBe(123456.79);
    expect(res.item.calculo!.precioSugerido).toBe(Math.round(r.chosenPriceEffective * 100) / 100);
    // El margen que vale es el del precio elegido, con la cuenta del motor (precio − minimumPrice).
    const base = Math.round(r.minimumPrice * 100) / 100;
    expect(res.item.calculo).toMatchObject({ costoBase: base, precioElegido: 123456.79, margenElegido: Math.round((123456.79 - base) * 100) / 100 });
    expect(res.item.calculo!.margen).toBe(Math.round(r.chosenMargin * 100) / 100);
  });

  it("sin ajuste, el margen elegido es el del motor", () => {
    const r = calculoCompleto();
    const res = itemDesdeCalculo(r, { id: "i1", nombre: "X" });
    if (!res.ok) throw new Error("debía andar");
    expect(res.item.calculo!.margenElegido).toBeCloseTo(r.chosenMargin, 2);
    expect(res.item.calculo!.margenElegidoProporcion).toBeCloseTo(r.chosenMarginRatio ?? 0, 3);
  });

  it("el precio del motor es el del renglón: con 3 unidades (no divisible) el ítem queda en cantidad 1 y el renglón es exacto", () => {
    const res = itemDesdeCalculo(calculoCompleto("100000"), { id: "i1", nombre: "X", cantidad: 3, seccion: " Fiesta ", opcional: false });
    if (!res.ok) throw new Error("debía andar");
    expect(res.item).toMatchObject({ cantidad: 1, precioUnitario: 100000, seccion: "Fiesta" });
    expect(res.item.calculo!.unidades).toBe(3);
    expect(calcularTotales([res.item], null).total).toBe(100000);
    const ajustado = itemDesdeCalculo(calculoCompleto(), { id: "i2", nombre: "Y", cantidad: 3, precioAjustado: 100000.01 });
    if (!ajustado.ok) throw new Error("debía andar");
    expect(calcularTotales([ajustado.item], null).total).toBe(100000.01);
  });

  it("un cálculo incompleto no da ítem y dice qué falta", () => {
    const r = calculateCuantoCobro(createBaseCompleteProfile(), createBaseCompleteQuote({ concepts: [] }));
    expect(r.status).toBe("incomplete");
    const res = itemDesdeCalculo(r, { id: "i1", nombre: "X" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.faltan.length).toBeGreaterThan(0);
  });

  it("el ítem calculado pasa la validación y suma en los totales como uno de lista", () => {
    const res = itemDesdeCalculo(calculoCompleto("100000"), { id: "i1", nombre: "Calculado" });
    if (!res.ok) throw new Error("debía andar");
    const v = validarItem(JSON.parse(JSON.stringify(res.item)));
    expect(v.ok).toBe(true);
    const lista = { ...res.item, id: "i2", modoPrecio: "LISTA" as const, calculo: null, precioUnitario: 50000 };
    expect(calcularTotales([res.item, lista], null).total).toBe(150000);
  });

  it("la versión pública del ítem no lleva costos ni márgenes", () => {
    const res = itemDesdeCalculo(calculoCompleto(), { id: "i1", nombre: "X", productId: "p1" });
    if (!res.ok) throw new Error("debía andar");
    const publico = itemSinDatosInternos(res.item);
    const json = JSON.stringify(publico);
    expect(publico).not.toHaveProperty("calculo");
    expect(publico).not.toHaveProperty("productId");
    for (const palabra of ["costo", "margen", "precioMinimo", "valorHora"]) expect(json).not.toContain(palabra);
  });
});

describe("esPrecioAjustado (contrato del precio al recalcular)", async () => {
  const { esPrecioAjustado } = await import("./calculo-cuanto-cobro");
  it("la marca explícita manda; sin marca, sólo si difiere del sugerido guardado", () => {
    expect(esPrecioAjustado(100, { precioAjustado: true })).toBe(true);
    expect(esPrecioAjustado(100, { precioAjustado: false, sugeridoAnterior: 5 })).toBe(false);
    expect(esPrecioAjustado(0, { precioAjustado: true })).toBe(false);
    expect(esPrecioAjustado(100, { sugeridoAnterior: 100 })).toBe(false);
    expect(esPrecioAjustado(100.001, { sugeridoAnterior: 100 })).toBe(false);
    expect(esPrecioAjustado(101, { sugeridoAnterior: 100 })).toBe(true);
    // Ítem nuevo, sin sugerido guardado: un precio > 0 es un ajuste; 0 es "el del motor".
    expect(esPrecioAjustado(100)).toBe(true);
    expect(esPrecioAjustado(0)).toBe(false);
  });
});
