import { describe, expect, it } from "vitest";
import { INITIAL_CUANTO_COBRO_PRICING_EXTRAS as BASE } from "@repo/cuanto-cobro-core";
import { condicionesDeCobro, leerCondicionesCobro } from "./cobro";

describe("condiciones de cobro al enviar (etapa B)", () => {
  it("sin extras o sin nada que cambie el cobro: null (como antes)", () => {
    expect(condicionesDeCobro(null, 1_000_000)).toBeNull();
    expect(condicionesDeCobro(BASE, 1_000_000)).toBeNull();
    expect(condicionesDeCobro({ ...BASE, grossIncomePercent: "3" }, 1_000_000)).toBeNull();
  });

  it("monotributo con seña y comisión sumada: descuento por transferencia = comisión", () => {
    const c = condicionesDeCobro({ ...BASE, ivaCondition: "monotributo", depositPercent: "30", paymentCommissionPercent: "6" }, 1_000_000)!;
    expect(c).toEqual({
      version: 1,
      ivaCondicion: "monotributo",
      ivaPorcentaje: 0,
      totalSinIva: 1_000_000,
      iva: 0,
      total: 1_000_000,
      senaPorcentaje: 30,
      descuentoTransferenciaPorcentaje: 6,
      politicaCancelacion: null,
    });
  });

  it("la comisión que no se suma al precio no da descuento", () => {
    const c = condicionesDeCobro({ ...BASE, depositPercent: "30", paymentCommissionPercent: "6", includeCommissionInPrice: false }, 1000)!;
    expect(c.descuentoTransferenciaPorcentaje).toBe(0);
  });

  it("responsable inscripto: IVA a centavos y total con IVA (21 % por omisión)", () => {
    const c = condicionesDeCobro({ ...BASE, ivaCondition: "responsable_inscripto" }, 1_234_567.89)!;
    expect(c.ivaPorcentaje).toBe(21);
    expect(c.iva).toBe(259_259.26);
    expect(c.total).toBe(1_493_827.15);
  });

  it("la política de cancelación sola alcanza", () => {
    expect(condicionesDeCobro({ ...BASE, cancellationPolicy: "  La seña no se devuelve. " }, 10)?.politicaCancelacion).toBe("La seña no se devuelve.");
  });

  it("lee lo guardado y descarta lo que no tiene forma", () => {
    const c = condicionesDeCobro({ ...BASE, depositPercent: "30" }, 1000)!;
    expect(leerCondicionesCobro(JSON.parse(JSON.stringify(c)))).toEqual(c);
    expect(leerCondicionesCobro({ version: 2 })).toBeNull();
    expect(leerCondicionesCobro(null)).toBeNull();
    expect(leerCondicionesCobro({ ...c, total: "mucho" })).toBeNull();
  });
});
