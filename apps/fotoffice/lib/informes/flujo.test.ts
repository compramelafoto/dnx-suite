import { describe, expect, it } from "vitest";
import { armarFlujo } from "./flujo";

const base = { saldoCaja: 100_000, cuotas: [], cuentas: [], saldoMinimo: null } as const;

describe("armarFlujo", () => {
  it("fila Hoy: saldo + vencido por cobrar − vencido por pagar", () => {
    const f = armarFlujo({
      ...base,
      hoy: "2026-03-10",
      agrupar: "mes",
      hasta: "2026-03-31",
      cuotas: [{ dueDate: "2026-03-09", saldoCentavos: 5000 }],
      cuentas: [{ dueDate: "2026-03-01", centavos: 2000 }],
    });
    expect(f.hoy).toMatchObject({ etiqueta: "Hoy", saldoCaja: 100_000, vencidoCobrar: 5000, vencidoPagar: 2000, acumulado: 103_000 });
  });

  it("hoy mismo no está vencido: cae en la primera fila", () => {
    const f = armarFlujo({ ...base, hoy: "2026-03-10", agrupar: "dia", hasta: "2026-03-11", cuotas: [{ dueDate: "2026-03-10", saldoCentavos: 700 }] });
    expect(f.hoy.vencidoCobrar).toBe(0);
    expect(f.filas[0]).toMatchObject({ etiqueta: "10/03", porCobrar: 700, neto: 700, acumulado: 100_700 });
  });

  it("agrupa por día", () => {
    const f = armarFlujo({ ...base, hoy: "2026-03-10", agrupar: "dia", hasta: "2026-03-12" });
    expect(f.filas.map((x) => x.etiqueta)).toEqual(["10/03", "11/03", "12/03"]);
  });

  it("semanas de lunes a domingo; la primera y la última se recortan", () => {
    // 2026-03-11 es miércoles.
    const f = armarFlujo({
      ...base,
      hoy: "2026-03-11",
      agrupar: "semana",
      hasta: "2026-03-24",
      cuotas: [
        { dueDate: "2026-03-15", saldoCentavos: 1 }, // domingo: primera semana
        { dueDate: "2026-03-16", saldoCentavos: 10 }, // lunes: segunda
        { dueDate: "2026-03-24", saldoCentavos: 100 }, // martes: tercera
        { dueDate: "2026-03-25", saldoCentavos: 1000 }, // afuera del horizonte
      ],
    });
    expect(f.filas.map((x) => [x.etiqueta, x.desde, x.hasta, x.porCobrar])).toEqual([
      ["Semana del 11/03", "2026-03-11", "2026-03-15", 1],
      ["Semana del 16/03", "2026-03-16", "2026-03-22", 10],
      ["Semana del 23/03", "2026-03-23", "2026-03-24", 100],
    ]);
  });

  it("meses con cruce de año y etiqueta MM/AAAA", () => {
    const f = armarFlujo({
      ...base,
      hoy: "2026-11-20",
      agrupar: "mes",
      hasta: "2027-01-31",
      cuotas: [{ dueDate: "2026-12-31", saldoCentavos: 3 }, { dueDate: "2027-01-01", saldoCentavos: 4 }],
    });
    expect(f.filas.map((x) => [x.etiqueta, x.desde, x.hasta, x.porCobrar])).toEqual([
      ["11/2026", "2026-11-20", "2026-11-30", 0],
      ["12/2026", "2026-12-01", "2026-12-31", 3],
      ["01/2027", "2027-01-01", "2027-01-31", 4],
    ]);
  });

  it("acumula neto fila a fila", () => {
    const f = armarFlujo({
      ...base,
      hoy: "2026-03-10",
      agrupar: "dia",
      hasta: "2026-03-12",
      cuotas: [{ dueDate: "2026-03-10", saldoCentavos: 500 }],
      cuentas: [{ dueDate: "2026-03-11", centavos: 800 }, { dueDate: "2026-03-12", centavos: 1 }],
    });
    expect(f.filas.map((x) => x.acumulado)).toEqual([100_500, 99_700, 99_699]);
    expect(f.filas.map((x) => x.neto)).toEqual([500, -800, -1]);
  });

  it("sin fecha: aparte, no suma al acumulado", () => {
    const f = armarFlujo({ ...base, hoy: "2026-03-10", agrupar: "mes", hasta: "2026-03-31", cuentas: [{ dueDate: null, centavos: 9000 }, { dueDate: null, centavos: 1 }] });
    expect(f.sinFecha).toEqual({ etiqueta: "Sin fecha", porPagar: 9001, cantidad: 2 });
    expect(f.hoy.acumulado).toBe(100_000);
    expect(f.filas[0].acumulado).toBe(100_000);
  });

  it("saldo mínimo: marca las filas por debajo y la primera fecha", () => {
    const f = armarFlujo({
      ...base,
      hoy: "2026-03-10",
      agrupar: "dia",
      hasta: "2026-03-12",
      saldoMinimo: 100_000,
      cuentas: [{ dueDate: "2026-03-11", centavos: 1 }],
    });
    expect(f.filas.map((x) => x.bajoMinimo)).toEqual([false, true, true]);
    expect(f.primeraFechaBajoMinimo).toBe("2026-03-11");
    expect(f.hoy.bajoMinimo).toBe(false);
  });

  it("si ya hoy está bajo el mínimo, la primera fecha es hoy; sin mínimo nunca marca", () => {
    const a = armarFlujo({ ...base, hoy: "2026-03-10", agrupar: "mes", hasta: "2026-03-31", saldoMinimo: 200_000 });
    expect(a.primeraFechaBajoMinimo).toBe("2026-03-10");
    expect(a.hoy.bajoMinimo).toBe(true);
    const b = armarFlujo({ ...base, hoy: "2026-03-10", agrupar: "mes", hasta: "2026-03-31", saldoCaja: -5 });
    expect(b.primeraFechaBajoMinimo).toBeNull();
  });

  it("un saldo igual al mínimo no está bajo", () => {
    const f = armarFlujo({ ...base, hoy: "2026-03-10", agrupar: "mes", hasta: "2026-03-31", saldoMinimo: 100_000 });
    expect(f.filas[0].bajoMinimo).toBe(false);
  });
});
