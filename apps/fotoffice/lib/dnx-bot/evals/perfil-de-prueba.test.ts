import { describe, expect, it } from "vitest";
import { resumirPerfil } from "@/lib/precios/resumen";
import { cotizar } from "../motor-trabajo";
import { perfilConCobrosDePrueba, perfilDePrueba } from "./perfil-de-prueba";

/**
 * El perfil con el que corre `bot:eval` tiene que parecerse a uno real de 2026 (lo que va a ver
 * Daniel): valor hora entre $25.000 y $40.000 y un casamiento en el orden del millón.
 */
const claves = () => {
  let n = 0;
  return () => `k${++n}`;
};

describe("perfil de prueba de bot:eval", () => {
  it("está completo y el valor hora es realista", () => {
    const r = resumirPerfil(perfilDePrueba());
    expect(r.completo).toBe(true);
    expect(r.valorHora!).toBeGreaterThanOrEqual(25_000);
    expect(r.valorHora!).toBeLessThanOrEqual(40_000);
  });
  it("un casamiento de 8 h de cobertura, 20 de edición y 2 de viaje sale entre $500.000 y $2.000.000", () => {
    const c = cotizar(perfilDePrueba(), { tipoDeTrabajo: "Casamiento", conceptos: [{ nombre: "Cobertura", horasCobertura: "8", horasEdicion: "20", horasViaje: "2" }] }, { nuevaClave: claves() });
    if (c.estado !== "OK") throw new Error(c.estado);
    const total = c.items.reduce((s, i) => s + i.precioUnitario, 0);
    expect(total).toBeGreaterThan(500_000);
    expect(total).toBeLessThan(2_000_000);
  });
  it("«dejalo en $1.100.000» da una ganancia razonable, no un porcentaje absurdo", () => {
    const c = cotizar(perfilDePrueba(), { tipoDeTrabajo: "Casamiento", conceptos: [{ nombre: "Cobertura", horasCobertura: "8", horasEdicion: "20" }], precioTotalElegido: "1100000" }, { nuevaClave: claves() });
    if (c.estado !== "OK") throw new Error(c.estado);
    const pct = Number(c.resumen.total.gananciaPct!.replace(/\D/g, ""));
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(150);
  });
  it("cada llamada devuelve un perfil nuevo (las pruebas no se pisan)", () => {
    expect(perfilDePrueba()).not.toBe(perfilDePrueba());
    expect(perfilDePrueba()).toEqual(perfilDePrueba());
  });
});

describe("perfil con impuestos, cobros y recargos (escenarios del precio completo)", () => {
  it("es válido, trae precio completo y un retrato chico queda bajo el mínimo", () => {
    const c = cotizar(
      perfilConCobrosDePrueba(),
      { tipoDeTrabajo: "Retrato", conceptos: [{ nombre: "Sesión", horasCobertura: "1", horasEdicion: "1" }], ajustes: { fechaEvento: "2026-10-20", distanciaKm: "0" } },
      { nuevaClave: claves(), ahora: new Date("2026-10-15T15:00:00Z") },
    );
    if (c.estado !== "OK") throw new Error(c.estado);
    expect(c.resumen.precioCompleto?.bajoMinimo).toBe(true);
    expect(c.resumen.precioCompleto?.sena).toMatch(/30 %/);
  });
  it("un evento a seis meses trae el ajuste por inflación", () => {
    const c = cotizar(
      perfilConCobrosDePrueba(),
      { tipoDeTrabajo: "XV", conceptos: [{ nombre: "Cobertura", horasCobertura: "6", horasEdicion: "10" }], ajustes: { fechaEvento: "2027-04-17" } },
      { nuevaClave: claves(), ahora: new Date("2026-10-15T15:00:00Z") },
    );
    if (c.estado !== "OK") throw new Error(c.estado);
    expect(c.resumen.precioCompleto?.inflacion).toMatch(/6 meses al 2 %/);
  });
});
