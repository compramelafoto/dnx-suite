import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateCheckInEligibility, evaluateKitEligibility } from "@/lib/checkout/domain/post-payment-eligibility";
import {
  countsAsActiveRegistration,
  isExpireCandidate,
} from "@/lib/public-registration/domain/expiration-rules";

/**
 * Un regalo pagado y sin activar OCUPA CUPO pero NO ES UN PARTICIPANTE.
 *
 * Esta tabla es la que protege esa distinción: cada superficie del sistema
 * tiene que tratarlo del lado correcto, y si alguien cambia una regla sin
 * darse cuenta, esta prueba lo frena.
 */
const now = new Date("2026-10-15T12:00:00.000Z");
const closeAt = new Date("2026-12-05T23:59:59.000Z");

describe("un regalo pagado y sin activar", () => {
  it("NO lo cancela el cron de expiración de reservas", () => {
    assert.equal(
      isExpireCandidate({
        status: "GIFT_AWAITING_REDEMPTION",
        paymentStatus: "APPROVED",
        // El hold llega hasta el cierre de inscripción, muy por delante de hoy.
        holdExpiresAt: closeAt,
        now,
      }),
      false,
    );
  });

  it("tampoco lo cancela si el plazo ya pasó: el pago está acreditado", () => {
    assert.equal(
      isExpireCandidate({
        status: "GIFT_AWAITING_REDEMPTION",
        paymentStatus: "APPROVED",
        holdExpiresAt: new Date("2026-09-01T00:00:00.000Z"),
        now,
      }),
      false,
    );
  });

  it("SÍ lo cancela el cron si el pago nunca llegó y venció la reserva", () => {
    assert.equal(
      isExpireCandidate({
        status: "DRAFT",
        paymentStatus: "PENDING",
        holdExpiresAt: new Date("2026-10-15T11:00:00.000Z"),
        now,
      }),
      true,
    );
  });

  it("NO bloquea a quien regaló para inscribirse él mismo", () => {
    // El email del regalo es de quien compra. Si contara como "su
    // inscripción", comprar un regalo lo dejaría afuera de la maratón.
    assert.equal(
      countsAsActiveRegistration({
        status: "GIFT_AWAITING_REDEMPTION",
        holdExpiresAt: closeAt,
        isGift: true,
        now,
      }),
      false,
    );
  });

  it("tampoco lo bloquea mientras el regalo está sin pagar", () => {
    assert.equal(
      countsAsActiveRegistration({
        status: "DRAFT",
        holdExpiresAt: new Date("2026-10-15T12:30:00.000Z"),
        isGift: true,
        now,
      }),
      false,
    );
  });

  it("una inscripción propia sin pagar SÍ lo bloquea", () => {
    assert.equal(
      countsAsActiveRegistration({
        status: "PENDING_PAYMENT",
        holdExpiresAt: new Date("2026-10-15T12:30:00.000Z"),
        isGift: false,
        now,
      }),
      true,
    );
  });

  it("NO puede acreditarse: todavía no se sabe quién participa", () => {
    const result = evaluateCheckInEligibility({
      registrationStatus: "GIFT_AWAITING_REDEMPTION",
      paymentStatus: "APPROVED",
      hasActiveCredential: false,
      alreadyCheckedIn: false,
    });
    assert.equal(result.ok, false);
  });

  it("NO puede retirar el kit", () => {
    const result = evaluateKitEligibility({
      registrationStatus: "GIFT_AWAITING_REDEMPTION",
      paymentStatus: "APPROVED",
      stockHoldsConsumed: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "NOT_PAID");
  });
});

describe("después de activarse", () => {
  it("es una inscripción confirmada como cualquier otra", () => {
    assert.equal(
      evaluateCheckInEligibility({
        registrationStatus: "CONFIRMED",
        paymentStatus: "APPROVED",
        hasActiveCredential: true,
        alreadyCheckedIn: false,
      }).ok,
      true,
    );
  });
});
