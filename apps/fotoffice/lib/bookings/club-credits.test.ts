import { describe, expect, it } from "vitest";
import {
  canCoverWithCredits,
  clubBalanceOf,
  clubCreditWords,
  creditsNeededFor,
  grantWindow,
} from "./club-credits";

const pago = new Date("2026-10-13T15:00:00.000Z");

describe("club con turnos incluidos", () => {
  it("la bolsa vence a los 30 días del pago, no a fin de mes", () => {
    const { validFrom, validUntil } = grantWindow(pago, 30);
    expect(validFrom).toEqual(pago);
    expect(validUntil.toISOString()).toBe("2026-11-12T15:00:00.000Z");
  });

  it("una validez inválida cae en 30 días", () => {
    expect(grantWindow(pago, 0).validUntil.toISOString()).toBe("2026-11-12T15:00:00.000Z");
  });

  it("lo que queda es lo otorgado menos lo usado, nunca negativo", () => {
    const grant = { id: "g", credits: 4, validFrom: pago, validUntil: grantWindow(pago, 30).validUntil };
    expect(clubBalanceOf(grant, 1).available).toBe(3);
    expect(clubBalanceOf(grant, 9).available).toBe(0);
  });

  it("un corte de 30 minutos usa un turno; una hora, dos", () => {
    expect(creditsNeededFor({ pricingMode: "BLOCK", blockMinutes: 30, minutes: 30 })).toBe(1);
    expect(creditsNeededFor({ pricingMode: "BLOCK", blockMinutes: 30, minutes: 60 })).toBe(2);
    expect(creditsNeededFor({ pricingMode: "HOURLY", blockMinutes: null, minutes: 120 })).toBe(1);
  });

  it("sale de la bolsa sólo con saldo y si el turno cae antes del vencimiento", () => {
    const grant = { id: "g", credits: 4, validFrom: pago, validUntil: grantWindow(pago, 30).validUntil };
    const balance = clubBalanceOf(grant, 3);
    const dentro = new Date("2026-11-01T14:00:00.000Z");
    const despues = new Date("2026-11-20T14:00:00.000Z");
    expect(canCoverWithCredits({ balance, needed: 1, startAt: dentro })).toBe(true);
    expect(canCoverWithCredits({ balance, needed: 2, startAt: dentro })).toBe(false);
    expect(canCoverWithCredits({ balance, needed: 1, startAt: despues })).toBe(false);
    expect(canCoverWithCredits({ balance: null, needed: 1, startAt: dentro })).toBe(false);
  });

  it("nombra los turnos como los nombró la categoría", () => {
    expect(clubCreditWords("cortes")).toEqual({ singular: "corte", plural: "cortes" });
    expect(clubCreditWords(null)).toEqual({ singular: "turno", plural: "turnos" });
    expect(clubCreditWords("sesiones")).toEqual({ singular: "sesión", plural: "sesiones" });
  });
});
