import { describe, expect, it } from "vitest";
import { printedCardOffer } from "./reissue";

const hoy = new Date("2026-08-28T12:00:00Z");
const futuro = new Date("2028-08-28T00:00:00Z");
const pasado = new Date("2026-01-01T00:00:00Z");

describe("printedCardOffer", () => {
  it("sin tarjeta impresa se ofrece la primera", () => {
    expect(printedCardOffer({ state: null, validUntil: null, now: hoy })).toEqual({
      ofrecer: true,
      motivo: "PRIMERA",
    });
  });

  /** Ya la tiene en la mano: puede querer otra por un cambio de datos, o porque la perdió. */
  it("entregada se ofrece la reemisión", () => {
    expect(printedCardOffer({ state: "ENTREGADO", validUntil: futuro, now: hoy })).toEqual({
      ofrecer: true,
      motivo: "REEMISION",
    });
  });

  it("anulada se ofrece de nuevo", () => {
    expect(printedCardOffer({ state: "ANULADO", validUntil: futuro, now: hoy }).ofrecer).toBe(true);
  });

  it("vencida se ofrece la reemisión aunque figure entregada", () => {
    const r = printedCardOffer({ state: "ENTREGADO", validUntil: pasado, now: hoy });
    expect(r).toEqual({ ofrecer: true, motivo: "REEMISION" });
  });

  /**
   * Con una en curso no se ofrece nada: pedir otra mientras la primera se imprime sería
   * cobrarle dos tarjetas por el mismo trámite.
   */
  it("en curso no se ofrece", () => {
    for (const state of ["PENDIENTE_PAGO", "EN_COLA", "IMPRESO", "LISTO_PARA_RETIRAR", "ENVIADO"] as const) {
      expect(printedCardOffer({ state, validUntil: futuro, now: hoy }).ofrecer).toBe(false);
    }
  });

  /** Una en curso pero vencida es un trámite abandonado: se puede volver a pedir. */
  it("en curso pero vencida vuelve a ofrecerse", () => {
    expect(printedCardOffer({ state: "EN_COLA", validUntil: pasado, now: hoy }).ofrecer).toBe(true);
  });

  it("una fecha de vigencia ausente no bloquea ni habilita por sí sola", () => {
    expect(printedCardOffer({ state: "EN_COLA", validUntil: null, now: hoy }).ofrecer).toBe(false);
  });
});
