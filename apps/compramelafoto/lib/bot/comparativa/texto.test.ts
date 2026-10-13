import { describe, expect, it } from "vitest";
import { periodosFinDeSemana, periodosMensuales } from "./periodos";
import { formatearComparativa, type DatosComparativa } from "./texto";

const { actual, anterior } = periodosFinDeSemana();
const base: DatosComparativa = {
  tipo: "fin_de_semana",
  actual,
  anterior,
  costoTotalMicroUsd: 18_420_000,
  fotografos: { costoMicroUsd: 12_300_000, conversaciones: 41, mensajes: 312 },
  compradores: { costoMicroUsd: 6_120_000, conversaciones: 27, mensajes: 118 },
  ventasActual: { pedidos: 132, pesos: 1_845_000 },
  ventasAnterior: { pedidos: 110, pesos: 1_500_000 },
  ayudaCompradores: { pedidos: 4, pesos: 52_000 },
  ayudaFotografos: { hablaron: 35, vendieron: 9, pedidos: 47, pesos: 610_500, ventanaAbierta: true },
  primerasVentas: { fotografos: 3, hablaronConElBot: 2 },
  cotizacion: { pesosPorDolar: 1_500, fuente: "dolarapi" },
  parcial: false,
};

describe("formatearComparativa", () => {
  it("fin de semana completo", () => {
    const t = formatearComparativa(base);
    expect(t).toMatchInlineSnapshot(`
      "🤖 DNX Bot · CLF · costo vs ventas
      Período: del 12/10 al 17/10/2026 (6 días, con el bot abierto a todos).
      Comparado con: del 06/10 al 11/10/2026 (los 6 días anteriores).

      Costo del bot: USD 18,42 (dólares reales, se factura en USD).
      En pesos: $ 27.630 (dólar tarjeta $ 1.500, dolarapi.com).
      Fotógrafos: USD 12,30, 41 conversaciones, 312 mensajes.
      Compradores: USD 6,12, 27 conversaciones, 118 mensajes.

      Ventas de CLF (fecha: creación del pedido):
      Este período: 132 pedidos, $ 1.845.000.
      Período anterior: 110 pedidos, $ 1.500.000.
      Cambio: +20 % en pedidos, +23 % en pesos.

      Ventas que el bot pudo haber ayudado:
      Compradores: 4 pedidos, $ 52.000 (hasta 48 h después del bot).
      Fotógrafos: 9 de 35 que usaron el bot vendieron en 30 días.
      Son 47 pedidos, $ 610.500 (la ventana sigue abierta).
      Primera venta de su vida: 3 fotógrafos (2 usaron el bot).

      El bot costó el 1,50 % de las ventas. Es correlación, no prueba."
    `);
  });
  it("sin asteriscos de markdown y con líneas cortas", () => {
    const t = formatearComparativa(base);
    expect(t).not.toContain("*");
    for (const linea of t.split("\n")) expect(linea.length).toBeLessThanOrEqual(80);
  });
  it("sin cotización omite los pesos del costo y el porcentaje", () => {
    const t = formatearComparativa({ ...base, cotizacion: null });
    expect(t).not.toContain("En pesos:");
    expect(t).toContain("Sin dólar o sin ventas no hay %.");
    expect(t).toContain("correlación, no prueba");
  });
  it("con la cotización de la variable lo aclara", () => {
    expect(formatearComparativa({ ...base, cotizacion: { pesosPorDolar: 1450, fuente: "variable" } })).toContain("CLF_BOT_USD_ARS");
  });
  it("mensual: nombra los meses y suma el promedio de 3 meses", () => {
    const p = periodosMensuales(new Date("2026-11-01T13:00:00Z"));
    const t = formatearComparativa({
      ...base, tipo: "mensual", actual: p.actual, anterior: p.anterior,
      promedioPrevios: { pedidos: 100, pesos: 1_000_000 },
      ayudaFotografos: { ...base.ayudaFotografos, ventanaAbierta: false },
    });
    expect(t).toContain("Período: octubre 2026.");
    expect(t).toContain("Comparado con: septiembre 2026.");
    expect(t).toContain("Promedio de los 3 meses anteriores: 100 pedidos");
    expect(t).toContain("Contra ese promedio: +85 % en pesos.");
    expect(t).not.toContain("ventana sigue abierta");
  });
  it("parcial y sin ventas previas", () => {
    const t = formatearComparativa({ ...base, parcial: true, ventasAnterior: { pedidos: 0, pesos: 0 } });
    expect(t).toContain("los números son parciales");
    expect(t).toContain("Cambio: sin base para comparar en pedidos, sin base para comparar en pesos.");
  });
});
