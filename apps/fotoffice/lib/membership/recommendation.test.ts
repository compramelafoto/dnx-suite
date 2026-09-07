import { describe, expect, it } from "vitest";
import {
  benefitDiscountMinor,
  canVoidBenefit,
  isBenefitEligibleCharge,
  pickChargeForBenefit,
  shouldAwardBenefit,
  type BenefitCharge,
} from "./recommendation";

const CUOTA = 4700000; // $47.000,00

function cargo(period: string, extra: Partial<BenefitCharge> = {}): BenefitCharge {
  const [anio, mes] = period.split("-").map(Number);
  return {
    id: `c-${period}`,
    concept: "MENSUAL",
    period,
    dueDate: new Date(Date.UTC(anio ?? 2026, (mes ?? 1) - 1, 10)),
    amountMinor: CUOTA,
    balanceMinor: CUOTA,
    ...extra,
  };
}

describe("isBenefitEligibleCharge", () => {
  it("acepta una cuota mensual impaga", () => {
    expect(isBenefitEligibleCharge({ concept: "MENSUAL", period: "2026-09", balanceMinor: CUOTA })).toBe(true);
  });

  it("rechaza el ingreso: el beneficio es sobre la cuota, no sobre el alta", () => {
    expect(isBenefitEligibleCharge({ concept: "INGRESO", period: "2026-09", balanceMinor: CUOTA })).toBe(false);
  });

  it("rechaza la credencial impresa y la reimpresión", () => {
    expect(isBenefitEligibleCharge({ concept: "OTRO", period: "TARJETA", balanceMinor: CUOTA })).toBe(false);
    expect(isBenefitEligibleCharge({ concept: "OTRO", period: "TARJETA-2026-09", balanceMinor: CUOTA })).toBe(false);
  });

  it("rechaza el arrastre del sistema anterior", () => {
    expect(isBenefitEligibleCharge({ concept: "OTRO", period: "APERTURA", balanceMinor: CUOTA })).toBe(false);
  });

  it("rechaza una cuota ya cancelada", () => {
    expect(isBenefitEligibleCharge({ concept: "MENSUAL", period: "2026-09", balanceMinor: 0 })).toBe(false);
  });
});

describe("pickChargeForBenefit", () => {
  it("elige la cuota impaga más antigua", () => {
    const elegido = pickChargeForBenefit([cargo("2026-09"), cargo("2026-07"), cargo("2026-08")], []);
    expect(elegido?.id).toBe("c-2026-07");
  });

  it("saltea las cuotas que ya tienen una bonificación: una por cuota", () => {
    const elegido = pickChargeForBenefit([cargo("2026-07"), cargo("2026-08")], ["c-2026-07"]);
    expect(elegido?.id).toBe("c-2026-08");
  });

  it("ignora el ingreso, la credencial y el arrastre", () => {
    const elegido = pickChargeForBenefit(
      [
        cargo("2026-06", { id: "c-ingreso", concept: "INGRESO" }),
        cargo("2026-05", { id: "c-apertura", concept: "OTRO", period: "APERTURA" }),
        cargo("2026-08"),
      ],
      [],
    );
    expect(elegido?.id).toBe("c-2026-08");
  });

  it("sin cuotas elegibles devuelve null: la bonificación espera", () => {
    expect(pickChargeForBenefit([cargo("2026-07", { balanceMinor: 0 })], [])).toBeNull();
  });
});

describe("benefitDiscountMinor", () => {
  it("el 100% bonifica la cuota entera, sin centavos perdidos", () => {
    expect(benefitDiscountMinor({ amountMinor: CUOTA, balanceMinor: CUOTA, percent: 100 })).toBe(CUOTA);
  });

  it("el 50% bonifica la mitad", () => {
    expect(benefitDiscountMinor({ amountMinor: CUOTA, balanceMinor: CUOTA, percent: 50 })).toBe(CUOTA / 2);
  });

  it("nunca supera el saldo pendiente: no genera saldo a favor", () => {
    expect(benefitDiscountMinor({ amountMinor: CUOTA, balanceMinor: 1000000, percent: 100 })).toBe(1000000);
  });

  it("redondea hacia abajo, en contra del descuento", () => {
    expect(benefitDiscountMinor({ amountMinor: 333, balanceMinor: 333, percent: 33.33 })).toBe(110);
  });

  it("un porcentaje en cero no descuenta nada", () => {
    expect(benefitDiscountMinor({ amountMinor: CUOTA, balanceMinor: CUOTA, percent: 0 })).toBe(0);
  });
});

describe("canVoidBenefit", () => {
  it("una bonificación pendiente se puede anular", () => {
    expect(canVoidBenefit({ status: "PENDIENTE", appliedChargeBalanceMinor: null })).toEqual({ ok: true });
  });

  it("una aplicada a una cuota impaga se puede anular: el importe vuelve al saldo", () => {
    expect(canVoidBenefit({ status: "APLICADA", appliedChargeBalanceMinor: 1000000 })).toEqual({ ok: true });
  });

  it("una aplicada a una cuota ya pagada NO se puede anular", () => {
    const r = canVoidBenefit({ status: "APLICADA", appliedChargeBalanceMinor: 0 });
    expect(r.ok).toBe(false);
  });

  it("una ya anulada no se vuelve a anular", () => {
    expect(canVoidBenefit({ status: "ANULADA", appliedChargeBalanceMinor: null }).ok).toBe(false);
  });
});

describe("shouldAwardBenefit", () => {
  const base = {
    enabled: true,
    percent: 100,
    recommenderMemberId: "socio-a",
    recommenderStatus: "ACTIVE",
    newMemberId: "socio-b",
    alreadyAwarded: false,
  };

  it("acredita cuando se cumplen todas las condiciones", () => {
    expect(shouldAwardBenefit(base)).toEqual({ award: true, percent: 100 });
  });

  it("con el módulo apagado no acredita nada", () => {
    expect(shouldAwardBenefit({ ...base, enabled: false }).award).toBe(false);
  });

  it("sin recomendante no acredita", () => {
    expect(shouldAwardBenefit({ ...base, recommenderMemberId: null }).award).toBe(false);
  });

  it("si el recomendante está de baja no acredita", () => {
    expect(shouldAwardBenefit({ ...base, recommenderStatus: "INACTIVE" }).award).toBe(false);
  });

  it("nadie se recomienda a sí mismo", () => {
    expect(shouldAwardBenefit({ ...base, recommenderMemberId: "socio-b" }).award).toBe(false);
  });

  it("no acredita dos veces por el mismo socio nuevo", () => {
    expect(shouldAwardBenefit({ ...base, alreadyAwarded: true }).award).toBe(false);
  });

  it("con porcentaje en cero no tiene sentido acreditar", () => {
    expect(shouldAwardBenefit({ ...base, percent: 0 }).award).toBe(false);
  });
});
