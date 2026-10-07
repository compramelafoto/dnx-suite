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
  });

  it("el precio del motor es el del renglón: con cantidad 4, el unitario es la cuarta parte", () => {
    const res = itemDesdeCalculo(calculoCompleto("100000"), { id: "i1", nombre: "X", cantidad: 4, seccion: " Fiesta ", opcional: true });
    if (!res.ok) throw new Error("debía andar");
    expect(res.item).toMatchObject({ cantidad: 4, precioUnitario: 25000, seccion: "Fiesta", opcional: true });
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
