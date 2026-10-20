import { describe, expect, it } from "vitest";
import { asientoEnCelda, leerFiltroCelda, leerFiltroFlujo, paramsDeCelda } from "./detalle";
import type { Asiento, RubroInfo } from "./resultados";

const rubros: RubroInfo[] = [
  { id: "p", nombre: "Ventas", codigo: "3.1", parentId: null, activo: true },
  { id: "h", nombre: "Bodas", codigo: null, parentId: "p", activo: true },
  { id: "x", nombre: "Otro", codigo: "9", parentId: null, activo: true },
];
const porId = new Map(rubros.map((r) => [r.id, r]));
const a = (extra: Partial<Asiento> = {}): Asiento => ({ mes: "2026-10", categoryId: "h", kind: "INGRESO", centavos: 100, signo: 1, ...extra });
const MESES = ["2026-09", "2026-10"];

describe("leerFiltroCelda", () => {
  it("exige un bloque válido y acepta sólo meses del período", () => {
    expect(leerFiltroCelda({ bloque: "NOPE" }, MESES)).toBeNull();
    expect(leerFiltroCelda({}, MESES)).toBeNull();
    expect(leerFiltroCelda({ bloque: "INGRESOS", mes: "2026-10" }, MESES)).toEqual({ bloque: "INGRESOS", rubro: { tipo: "todos" }, mes: "2026-10" });
    expect(leerFiltroCelda({ bloque: "INGRESOS", mes: "2024-01" }, MESES)?.mes).toBeNull();
    expect(leerFiltroCelda({ bloque: "COSTOS", rubro: "sin" }, MESES)?.rubro).toEqual({ tipo: "sin" });
    expect(leerFiltroCelda({ bloque: "COSTOS", rubro: "abc", hijos: "1" }, MESES)?.rubro).toEqual({ tipo: "id", id: "abc", conHijos: true });
    expect(leerFiltroCelda({ bloque: "COSTOS", rubro: "x".repeat(65) }, MESES)?.rubro).toEqual({ tipo: "todos" });
  });

  it("paramsDeCelda y leerFiltroCelda son inversas", () => {
    const f = { bloque: "GASTOS" as const, rubro: { tipo: "id" as const, id: "r1", conHijos: true }, mes: "2026-09" };
    const p = paramsDeCelda(f, "caja", "ultimos-3");
    expect(leerFiltroCelda(Object.fromEntries(p.entries()), MESES)).toEqual(f);
  });
});

describe("asientoEnCelda", () => {
  it("el padre con hijos incluye lo del hijo; el hijo solo, no incluye al padre", () => {
    const padre = { bloque: "INGRESOS" as const, rubro: { tipo: "id" as const, id: "p", conHijos: true }, mes: null };
    expect(asientoEnCelda(a(), padre, porId)).toBe(true);
    expect(asientoEnCelda(a({ categoryId: "p" }), padre, porId)).toBe(true);
    expect(asientoEnCelda(a(), { ...padre, rubro: { tipo: "id", id: "p", conHijos: false } }, porId)).toBe(false);
    expect(asientoEnCelda(a({ categoryId: "p" }), { ...padre, rubro: { tipo: "id", id: "h", conHijos: false } }, porId)).toBe(false);
  });

  it("respeta mes y bloque (un egreso en rubro de ingresos va a Sin clasificar de egresos)", () => {
    const f = { bloque: "INGRESOS" as const, rubro: { tipo: "todos" as const }, mes: "2026-09" };
    expect(asientoEnCelda(a(), f, porId)).toBe(false);
    expect(asientoEnCelda(a({ mes: "2026-09" }), f, porId)).toBe(true);
    expect(asientoEnCelda(a({ kind: "EGRESO" }), { ...f, mes: null }, porId)).toBe(false);
    expect(asientoEnCelda(a({ kind: "EGRESO" }), { bloque: "SIN_CLASIFICAR_EGRESO", rubro: { tipo: "todos" }, mes: null }, porId)).toBe(true);
    expect(asientoEnCelda(a({ categoryId: "x" }), { bloque: "SIN_CLASIFICAR_INGRESO", rubro: { tipo: "id", id: "x", conHijos: false }, mes: null }, porId)).toBe(true);
    expect(asientoEnCelda(a({ categoryId: null }), { bloque: "SIN_CLASIFICAR_INGRESO", rubro: { tipo: "sin" }, mes: null }, porId)).toBe(true);
  });
});

describe("leerFiltroFlujo", () => {
  const MAX = "2027-10-09";
  it("valida tipo, fechas reales y el límite", () => {
    expect(leerFiltroFlujo({ tipo: "pagar", hasta: "2026-10-31" }, MAX)).toEqual({ tipo: "pagar", desde: null, hasta: "2026-10-31" });
    expect(leerFiltroFlujo({ tipo: "cobrar", desde: "2026-10-01", hasta: "2026-10-31" }, MAX)).toEqual({ tipo: "cobrar", desde: "2026-10-01", hasta: "2026-10-31" });
    expect(leerFiltroFlujo({ tipo: "sinfecha" }, MAX)).toEqual({ tipo: "sinfecha", desde: null, hasta: null });
    expect(leerFiltroFlujo({ tipo: "pagar", hasta: "2026-02-30" }, MAX)).toBeNull();
    expect(leerFiltroFlujo({ tipo: "pagar", hasta: "2028-01-01" }, MAX)).toBeNull();
    expect(leerFiltroFlujo({ tipo: "pagar", desde: "2026-11-01", hasta: "2026-10-31" }, MAX)).toBeNull();
    expect(leerFiltroFlujo({ tipo: "pagar" }, MAX)).toBeNull();
    expect(leerFiltroFlujo({ tipo: "x", hasta: "2026-10-31" }, MAX)).toBeNull();
  });
});
