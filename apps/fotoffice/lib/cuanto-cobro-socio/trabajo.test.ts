import { describe, expect, it } from "vitest";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { INITIAL_CUANTO_COBRO_PROFILE } from "@repo/cuanto-cobro-core";
import { resumirPerfil } from "@/lib/precios/resumen";
import { gastosConImporte, presupuestarTrabajo, trabajoSocioVacio, type TrabajoSocio } from "./trabajo";

const AHORA = new Date("2026-11-10T15:00:00Z");

function trabajo(parcial: Partial<TrabajoSocio> = {}): TrabajoSocio {
  return { ...trabajoSocioVacio(), tipoDeTrabajo: "Casamiento", horasCobertura: "6", horasEdicion: "10", ...parcial };
}

describe("presupuesto de un trabajo del socio", () => {
  it("cobra las horas al valor de la hora del perfil", () => {
    const perfil = createBaseCompleteProfile();
    const r = presupuestarTrabajo(perfil, trabajo(), AHORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { presupuesto: p } = r;
    expect(p.valorHora).toBeCloseTo(resumirPerfil(perfil).valorHora!, 0);
    expect(p.horas).toBe(16);
    expect(p.gastos).toEqual([]);
    expect(p.totalGastos).toBe(0);
    expect(p.precioSugerido).toBeGreaterThanOrEqual(p.precioMinimo);
    expect(p.costo).toBeGreaterThan(0);
    // La cuenta que enseña el artículo: horas × valor de la hora es el costo (sin gastos del evento).
    expect(p.costo).toBeCloseTo(p.horas * p.valorHora, 0);
  });

  it("los gastos variables del evento suben el costo y el precio lo mismo que suman", () => {
    const perfil = createBaseCompleteProfile();
    const sin = presupuestarTrabajo(perfil, trabajo(), AHORA);
    const gastos = [
      { id: "a", concepto: "Asistente", monto: "40000" },
      { id: "b", concepto: "Viáticos", monto: "15000" },
      { id: "c", concepto: "", monto: "" },
    ];
    const con = presupuestarTrabajo(perfil, trabajo({ gastos }), AHORA);
    if (!sin.ok || !con.ok) throw new Error("debería calcular");
    expect(con.presupuesto.gastos).toEqual([
      { concepto: "Asistente", monto: 40000 },
      { concepto: "Viáticos", monto: 15000 },
    ]);
    expect(con.presupuesto.totalGastos).toBe(55000);
    expect(con.presupuesto.costo - sin.presupuesto.costo).toBeCloseTo(55000, 0);
    expect(con.presupuesto.precioMinimo - sin.presupuesto.precioMinimo).toBeGreaterThanOrEqual(55000 - 1);
    // Las horas no cambian por gastar más.
    expect(con.presupuesto.horas).toBe(sin.presupuesto.horas);
  });

  it("con el perfil vacío no inventa un precio: dice qué falta", () => {
    const r = presupuestarTrabajo(INITIAL_CUANTO_COBRO_PROFILE, trabajo(), AHORA);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.faltan.length).toBeGreaterThan(0);
    expect(r.error).toBe("Para calcular faltan estos datos:");
  });

  it("un renglón sin importe o ilegible no cuenta; uno sin nombre se llama «Gasto del evento»", () => {
    expect(
      gastosConImporte([
        { id: "1", concepto: "  ", monto: "1000" },
        { id: "2", concepto: "Nada", monto: "" },
        { id: "3", concepto: "Raro", monto: "abc" },
      ]),
    ).toEqual([{ concepto: "Gasto del evento", monto: 1000 }]);
  });

  it("arranca con los tres gastos que más se olvidan, vacíos", () => {
    expect(trabajoSocioVacio().gastos.map((g) => [g.concepto, g.monto])).toEqual([
      ["Asistente", ""],
      ["Viáticos y traslado", ""],
      ["Impresiones o insumos", ""],
    ]);
  });
});
