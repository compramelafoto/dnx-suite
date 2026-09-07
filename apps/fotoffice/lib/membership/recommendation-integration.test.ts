import { describe, expect, it } from "vitest";
import { benefitDiscountMinor, pickChargeForBenefit, type BenefitCharge } from "./recommendation";
import { splitMinorByPlatformFee } from "@/lib/platform-fee/fee";
import { selectChargesToPay } from "./select-charges";

/**
 * Las dos reglas de plata que cruzan módulos.
 *
 * Viven en su propio archivo porque no prueban una función sino un acuerdo entre tres: la
 * bonificación baja el saldo del cargo, el cobro toma ese saldo, y la comisión se calcula
 * sobre lo cobrado. Si alguno de los tres cambia, esto lo delata.
 */

const CUOTA = 4700000; // $47.000,00

function cargo(period: string, balanceMinor = CUOTA): BenefitCharge {
  const [anio, mes] = period.split("-").map(Number);
  return {
    id: `c-${period}`,
    concept: "MENSUAL",
    period,
    dueDate: new Date(Date.UTC(anio ?? 2026, (mes ?? 1) - 1, 10)),
    amountMinor: CUOTA,
    balanceMinor,
  };
}

describe("la cuota bonificada y el cobro", () => {
  it("la comisión de la plataforma se calcula sobre lo que se paga, no sobre el valor original", () => {
    const descuento = benefitDiscountMinor({ amountMinor: CUOTA, balanceMinor: CUOTA, percent: 50 });
    const aPagar = CUOTA - descuento;

    const conBonificacion = splitMinorByPlatformFee(aPagar, 500);
    const sinBonificacion = splitMinorByPlatformFee(CUOTA, 500);

    expect(conBonificacion.feeMinor).toBeLessThan(sinBonificacion.feeMinor);
  });

  it("una cuota bonificada al 100% desaparece de lo que hay que pagar", () => {
    const descuento = benefitDiscountMinor({ amountMinor: CUOTA, balanceMinor: CUOTA, percent: 100 });
    const abiertos = [
      {
        id: "c-2026-08",
        concept: "MENSUAL",
        period: "2026-08",
        dueDate: new Date(Date.UTC(2026, 7, 10)),
        balanceMinor: CUOTA - descuento,
      },
      {
        id: "c-2026-09",
        concept: "MENSUAL",
        period: "2026-09",
        dueDate: new Date(Date.UTC(2026, 8, 10)),
        balanceMinor: CUOTA,
      },
    ];
    const r = selectChargesToPay(abiertos, { howMany: "ALL" });
    expect(r.ok && r.selection.totalMinor).toBe(CUOTA);
    expect(r.ok && r.selection.chargeIds).toEqual(["c-2026-09"]);
  });

  it("dos bonificaciones del 50% caen en dos cuotas distintas", () => {
    const cargos = [cargo("2026-08"), cargo("2026-09")];
    const primera = pickChargeForBenefit(cargos, []);
    const segunda = pickChargeForBenefit(cargos, [primera!.id]);
    expect(primera?.id).toBe("c-2026-08");
    expect(segunda?.id).toBe("c-2026-09");
  });
});
