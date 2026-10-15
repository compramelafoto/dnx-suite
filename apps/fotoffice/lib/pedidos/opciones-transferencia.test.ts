import { describe, expect, it } from "vitest";
import { condicionesDeCobro } from "@/lib/presupuestos/cobro";
import { INITIAL_CUANTO_COBRO_PRICING_EXTRAS as BASE } from "@repo/cuanto-cobro-core";
import { buscarOpcion, conCondicionesCobro, opcionesDeInstantanea, opcionesSegunCobros, opcionesParaPresupuesto, resumenPlanOpcion, SUFIJO_TRANSFERENCIA } from "./opciones-pago";

const HOY = "2026-10-15";
const AJUSTES = { paymentOptions: { cashEnabled: true, cashDiscountPercent: "", cashCommercialNote: "", installmentPlans: [{ id: "tres", numberOfInstallments: "3", interestMode: "none", interestPercent: "", commercialNote: "" }] } };

function instantanea(extras: Partial<typeof BASE>) {
  const s = opcionesParaPresupuesto(AJUSTES, 1_000_000, "2027-03-20", HOY, "2026-10-15T12:00:00.000Z");
  return conCondicionesCobro(s, condicionesDeCobro({ ...BASE, ...extras }, 1_000_000));
}

describe("medio de pago dentro de la opción (etapa B)", () => {
  it("sin condiciones de cobro: las opciones de siempre, sin medio", () => {
    const s = opcionesParaPresupuesto(AJUSTES, 1_000_000, null, HOY);
    const o = opcionesDeInstantanea(s);
    expect(o.map((x) => x.id)).toEqual(["contado", "tres"]);
    expect(o.every((x) => x.medio === null)).toBe(true);
  });

  it("con descuento por transferencia: cada opción tiene su variante, con el total descontado", () => {
    const o = opcionesDeInstantanea(instantanea({ paymentCommissionPercent: "6" }));
    expect(o.map((x) => x.id)).toEqual(["contado", `contado${SUFIJO_TRANSFERENCIA}`, "tres", `tres${SUFIJO_TRANSFERENCIA}`]);
    const mp = o[0]!;
    const tr = o[1]!;
    expect(mp).toMatchObject({ medio: "MERCADO_PAGO", total: 1_000_000 });
    expect(mp.etiqueta).toMatch(/Mercado Pago/);
    expect(tr).toMatchObject({ medio: "TRANSFERENCIA", total: 940_000, cuotas: 1, descuentoTransferenciaPorcentaje: 6 });
    expect(tr.etiqueta).toMatch(/transferencia.*6 %/);
    expect(buscarOpcion(instantanea({ paymentCommissionPercent: "6" }), `tres${SUFIJO_TRANSFERENCIA}`)).toMatchObject({ total: 940_000, cuotas: 3, importeCuota: 313_333.33 });
  });

  it("con IVA, las opciones van sobre el total con IVA", () => {
    const s = opcionesParaPresupuesto(AJUSTES, 1_210_000, null, HOY);
    expect(opcionesDeInstantanea(s)[0]!.total).toBe(1_210_000);
  });

  it("sin Mercado Pago: sólo las variantes por transferencia; sin descuento, todas (son transferencia o efectivo)", () => {
    const con = opcionesDeInstantanea(instantanea({ paymentCommissionPercent: "6" }));
    expect(opcionesSegunCobros(con, false).map((x) => x.medio)).toEqual(["TRANSFERENCIA", "TRANSFERENCIA"]);
    expect(opcionesSegunCobros(con, true)).toHaveLength(4);
    const sin = opcionesDeInstantanea(instantanea({ depositPercent: "30" }));
    expect(opcionesSegunCobros(sin, false)).toHaveLength(2);
  });

  it("resumen del plan con seña: seña + cuotas del saldo", () => {
    const o = buscarOpcion(instantanea({ depositPercent: "30" }), "tres")!;
    expect(resumenPlanOpcion(o, 30)).toEqual({ sena: 300_000, saldo: 700_000, cuotas: 3, importeCuota: 233_333.33 });
    expect(resumenPlanOpcion(o, 0)).toEqual({ sena: 0, saldo: 1_000_000, cuotas: 3, importeCuota: 333_333.33 });
    const contado = buscarOpcion(instantanea({ depositPercent: "30" }), "contado")!;
    expect(resumenPlanOpcion(contado, 30)).toEqual({ sena: 300_000, saldo: 700_000, cuotas: 1, importeCuota: 700_000 });
  });
});
