import { describe, expect, it } from "vitest";
import { opcionesParaPresupuesto } from "@/lib/pedidos/opciones-pago";
import {
  entradaDesdeInstantanea,
  entradaGuardada,
  importeDeOpcion,
  MENSAJES_OPCIONES_PAGO as M,
  opcionElegida,
  opcionesPublicas,
  opcionesVacias,
  pesosCuota,
  validarOpcionesPago,
} from "./opciones-pago";

const EN = "2026-10-08T12:00:00.000Z";
const HOY = "2026-10-08";

const CONFIGURADAS = {
  cashEnabled: true,
  cashDiscountPercent: "10",
  cashCommercialNote: "Transferencia al confirmar",
  installmentPlans: [
    { id: "p3", numberOfInstallments: "3", interestMode: "none", interestPercent: "", commercialNote: "" },
    { id: "p6", numberOfInstallments: "6", interestMode: "manual", interestPercent: "15", commercialNote: "Con tarjeta" },
  ],
};

describe("validarOpcionesPago", () => {
  it("limpia y acepta las de ¿Cuánto Cobro?", () => {
    const r = validarOpcionesPago({ ...CONFIGURADAS, cashDiscountPercent: " 12,5 " });
    expect(r).toEqual({
      ok: true,
      valor: {
        cashEnabled: true,
        cashDiscountPercent: "12.5",
        cashCommercialNote: "Transferencia al confirmar",
        installmentPlans: [
          { id: "p3", numberOfInstallments: "3", interestMode: "none", interestPercent: "", commercialNote: "", appliedIndexMetadata: null },
          { id: "p6", numberOfInstallments: "6", interestMode: "manual", interestPercent: "15", commercialNote: "Con tarjeta", appliedIndexMetadata: null },
        ],
      },
    });
  });

  it("rechaza cuotas, porcentajes, notas y cantidades fuera de rango", () => {
    const plan = (p: Record<string, unknown>) => ({ ...CONFIGURADAS, installmentPlans: [{ ...CONFIGURADAS.installmentPlans[0], ...p }] });
    expect(validarOpcionesPago(null)).toEqual({ ok: false, error: M.invalidas });
    expect(validarOpcionesPago("x")).toEqual({ ok: false, error: M.invalidas });
    expect(validarOpcionesPago({ installmentPlans: "x" })).toEqual({ ok: false, error: M.invalidas });
    expect(validarOpcionesPago(plan({ numberOfInstallments: "" }))).toEqual({ ok: false, error: M.cuotas });
    expect(validarOpcionesPago(plan({ numberOfInstallments: "0" }))).toEqual({ ok: false, error: M.cuotas });
    expect(validarOpcionesPago(plan({ numberOfInstallments: "2.5" }))).toEqual({ ok: false, error: M.cuotas });
    expect(validarOpcionesPago(plan({ numberOfInstallments: "61" }))).toEqual({ ok: false, error: M.cuotas });
    expect(validarOpcionesPago(plan({ interestMode: "manual", interestPercent: "-1" }))).toEqual({ ok: false, error: M.interes });
    expect(validarOpcionesPago(plan({ interestMode: "manual", interestPercent: "501" }))).toEqual({ ok: false, error: M.interes });
    expect(validarOpcionesPago(plan({ commercialNote: "x".repeat(301) }))).toEqual({ ok: false, error: M.nota });
    expect(validarOpcionesPago({ ...CONFIGURADAS, cashDiscountPercent: "101" })).toEqual({ ok: false, error: M.descuento });
    expect(validarOpcionesPago({ ...CONFIGURADAS, cashDiscountPercent: "diez" })).toEqual({ ok: false, error: M.descuento });
    const muchos = Array.from({ length: 13 }, (_, i) => ({ id: `p${i}`, numberOfInstallments: "2" }));
    expect(validarOpcionesPago({ installmentPlans: muchos })).toEqual({ ok: false, error: M.planes });
  });

  it("sin interés no guarda tasa; el índice sólo queda si ese plan ya venía guardado así (con su información guardada)", () => {
    const indice = { sourceLabel: "INDEC", method: "ipc" };
    const conIndice = {
      ...opcionesVacias(),
      installmentPlans: [
        { id: "i", numberOfInstallments: "6", interestMode: "index_suggested", interestPercent: "20", commercialNote: "", appliedIndexMetadata: { sourceLabel: "falso", method: "x" } },
        { id: "nuevo", numberOfInstallments: "3", interestMode: "index_suggested", interestPercent: "8", commercialNote: "" },
        { id: "s", numberOfInstallments: "2", interestMode: "none", interestPercent: "99", commercialNote: "" },
      ],
    };
    const anteriores = {
      ...opcionesVacias(),
      installmentPlans: [{ id: "i", numberOfInstallments: "6", interestMode: "index_suggested" as const, interestPercent: "20", commercialNote: "", appliedIndexMetadata: indice as never }],
    };
    const r = validarOpcionesPago(conIndice, anteriores);
    if (!r.ok) throw new Error(r.error);
    expect(r.valor.installmentPlans.map((p) => [p.id, p.interestMode, p.interestPercent, p.appliedIndexMetadata])).toEqual([
      ["i", "index_suggested", "20", indice],
      ["nuevo", "manual", "8", null],
      ["s", "none", "", null],
    ]);
  });
});

describe("instantánea congelada", () => {
  const congelada = opcionesParaPresupuesto({ paymentOptions: CONFIGURADAS }, 1_000_000, null, HOY, EN);

  it("lo que ve el cliente: nombre, cuotas, importe por cuota, total y nota; nada más", () => {
    const pub = opcionesPublicas(congelada);
    expect(pub).toEqual([
      { id: "contado", etiqueta: "Contado con 10% de descuento", cuotas: 1, importeCuota: 900_000, total: 900_000, nota: "Transferencia al confirmar" },
      { id: "p3", etiqueta: "3 cuotas sin interés", cuotas: 3, importeCuota: 333_333.33, total: 1_000_000, nota: null },
      { id: "p6", etiqueta: "6 cuotas con 15% de interés", cuotas: 6, importeCuota: 191_666.66, total: 1_150_000, nota: "Con tarjeta" },
    ]);
    // Ni tasas internas, ni el precio base, ni la información del índice.
    expect(Object.keys(pub[2]!).sort()).toEqual(["cuotas", "etiqueta", "id", "importeCuota", "nota", "total"]);
    expect(opcionesPublicas(null)).toEqual([]);
    expect(opcionesPublicas(CONFIGURADAS)).toEqual([]);
  });

  it("sin opciones configuradas, la de omisión", () => {
    for (const ajustes of [null, opcionesVacias()]) {
      const s = opcionesParaPresupuesto({ paymentOptions: ajustes }, 600_000, "2026-12-20", HOY, EN);
      expect(opcionesPublicas(s)).toEqual([
        { id: "omision", etiqueta: "Hasta 2 cuotas sin interés", cuotas: 2, importeCuota: 300_000, total: 600_000, nota: "Hasta 2 cuotas sin interés" },
      ]);
    }
  });

  it("la elección: sin elegir, la primera; un id de la instantánea, ese; otro, error; sin instantánea, sólo sin elegir", () => {
    expect(opcionElegida(congelada, undefined)).toEqual({ ok: true, valor: "contado" });
    expect(opcionElegida(congelada, "")).toEqual({ ok: true, valor: "contado" });
    expect(opcionElegida(congelada, "p6")).toEqual({ ok: true, valor: "p6" });
    expect(opcionElegida(congelada, "omision")).toEqual({ ok: false, error: M.elegida });
    expect(opcionElegida(congelada, 3)).toEqual({ ok: false, error: M.elegida });
    expect(opcionElegida(null, undefined)).toEqual({ ok: true, valor: null });
    expect(opcionElegida(null, "contado")).toEqual({ ok: false, error: M.elegida });
  });

  it("la versión siguiente vuelve a editar lo congelado (sin copiar la de omisión como plan)", () => {
    const e = entradaDesdeInstantanea(congelada);
    expect(e).toEqual({
      cashEnabled: true,
      cashDiscountPercent: "10",
      cashCommercialNote: "Transferencia al confirmar",
      installmentPlans: [
        { id: "p3", numberOfInstallments: "3", interestMode: "none", interestPercent: "", commercialNote: "", appliedIndexMetadata: null },
        { id: "p6", numberOfInstallments: "6", interestMode: "manual", interestPercent: "15", commercialNote: "Con tarjeta", appliedIndexMetadata: null },
      ],
    });
    expect(entradaGuardada(congelada)).toEqual(e);
    const omision = opcionesParaPresupuesto(null, 600_000, null, HOY, EN);
    expect(entradaGuardada(omision)).toEqual(opcionesVacias());
    expect(entradaGuardada(null)).toBeNull();
  });
});

describe("importes", () => {
  it("por cuota con centavos sólo si no es entero; el total, sin decimales", () => {
    expect(pesosCuota(40_000).replace(/\s/g, " ")).toBe("$ 40.000");
    expect(pesosCuota(333_333.33).replace(/\s/g, " ")).toBe("$ 333.333,33");
    expect(importeDeOpcion({ cuotas: 3, importeCuota: 333_333.33, total: 1_000_000 }).replace(/\s/g, " ")).toBe(
      "3 cuotas de $ 333.333,33 · total $ 1.000.000",
    );
    expect(importeDeOpcion({ cuotas: 1, importeCuota: 900_000, total: 900_000 }).replace(/\s/g, " ")).toBe("$ 900.000");
  });
});
