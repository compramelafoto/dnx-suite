import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canCarryOverGiftVoucher, evaluateGiftRedeemEligibility } from "./status";

const now = new Date("2026-10-01T12:00:00.000Z");
const closeAt = new Date("2026-12-05T23:59:59.000Z");
const afterClose = new Date("2026-12-06T00:00:01.000Z");

function base(
  overrides: Partial<Parameters<typeof evaluateGiftRedeemEligibility>[0]> = {},
) {
  return {
    status: "ACTIVE" as const,
    redeemableUntil: closeAt,
    editionRegistrationCloseAt: closeAt,
    giftVouchersEnabled: true,
    now,
    ...overrides,
  };
}

describe("elegibilidad de canje del regalo", () => {
  it("deja canjear un voucher activo dentro del plazo", () => {
    assert.equal(evaluateGiftRedeemEligibility(base()).ok, true);
  });

  it("no deja canjear si el pago todavía no se acreditó", () => {
    const result = evaluateGiftRedeemEligibility(base({ status: "PENDING_PAYMENT" }));
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "NOT_PAID");
  });

  it("no deja canjear dos veces", () => {
    const result = evaluateGiftRedeemEligibility(base({ status: "REDEEMED" }));
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "ALREADY_REDEEMED");
  });

  it("no deja canjear un voucher anulado o devuelto", () => {
    for (const status of ["CANCELLED", "REFUNDED"] as const) {
      const result = evaluateGiftRedeemEligibility(base({ status }));
      assert.equal(result.ok, false);
      assert.equal(result.ok === false && result.code, "CANCELLED");
    }
  });

  it("avisa que el voucher espera la edición siguiente", () => {
    const result = evaluateGiftRedeemEligibility(base({ status: "CARRIED_OVER" }));
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "CARRIED_OVER");
  });

  it("no deja canjear después del cierre de inscripciones", () => {
    const result = evaluateGiftRedeemEligibility(base({ now: afterClose }));
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "WINDOW_CLOSED");
  });

  it("no deja canjear si el módulo está apagado en la edición", () => {
    const result = evaluateGiftRedeemEligibility(base({ giftVouchersEnabled: false }));
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "MODULE_DISABLED");
  });

  it("deja canjear cuando la edición no tiene fecha de cierre", () => {
    assert.equal(
      evaluateGiftRedeemEligibility(
        base({ redeemableUntil: null, editionRegistrationCloseAt: null }),
      ).ok,
      true,
    );
  });

  it("cae al cierre de la edición cuando el voucher no tiene plazo propio", () => {
    const result = evaluateGiftRedeemEligibility(
      base({ redeemableUntil: null, now: afterClose }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "WINDOW_CLOSED");
  });

  it("todos los bloqueos traen un mensaje para mostrar", () => {
    for (const status of [
      "PENDING_PAYMENT",
      "REDEEMED",
      "CANCELLED",
      "REFUNDED",
      "CARRIED_OVER",
    ] as const) {
      const result = evaluateGiftRedeemEligibility(base({ status }));
      assert.equal(result.ok, false);
      assert.ok(result.ok === false && result.message.length > 10);
    }
  });
});

describe("traslado a la edición siguiente", () => {
  it("traslada un voucher activo cuyo plazo venció", () => {
    assert.equal(
      canCarryOverGiftVoucher({
        status: "ACTIVE",
        redeemableUntil: closeAt,
        now: afterClose,
      }),
      true,
    );
  });

  it("no traslada uno que todavía está en plazo", () => {
    assert.equal(
      canCarryOverGiftVoucher({ status: "ACTIVE", redeemableUntil: closeAt, now }),
      false,
    );
  });

  it("no traslada uno ya canjeado, anulado o trasladado", () => {
    for (const status of ["REDEEMED", "CANCELLED", "CARRIED_OVER", "REFUNDED"] as const) {
      assert.equal(
        canCarryOverGiftVoucher({ status, redeemableUntil: closeAt, now: afterClose }),
        false,
      );
    }
  });

  it("no traslada uno cuyo pago nunca se acreditó", () => {
    assert.equal(
      canCarryOverGiftVoucher({
        status: "PENDING_PAYMENT",
        redeemableUntil: closeAt,
        now: afterClose,
      }),
      false,
    );
  });

  it("no traslada uno sin plazo definido", () => {
    assert.equal(
      canCarryOverGiftVoucher({ status: "ACTIVE", redeemableUntil: null, now }),
      false,
    );
  });
});
