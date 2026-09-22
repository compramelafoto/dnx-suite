import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ESTADOS_SIN_PARTICIPANTE,
  motivoSinParticipante,
  tieneParticipanteDefinido,
} from "./participante-definido";

describe("¿hay participante en esta inscripción?", () => {
  it("un regalo PAGO pero sin activar NO tiene participante", () => {
    // El caso que rompió la placa: está pago, pero los datos son de quien lo
    // compró, no de quien va a participar.
    assert.equal(
      tieneParticipanteDefinido({
        status: "GIFT_AWAITING_REDEMPTION",
        paymentStatus: "APPROVED",
      }),
      false,
    );
  });

  it("una inscripción confirmada sí lo tiene", () => {
    assert.equal(
      tieneParticipanteDefinido({ status: "CONFIRMED", paymentStatus: "APPROVED" }),
      true,
    );
  });

  it("un regalo ya activado es una inscripción como cualquier otra", () => {
    assert.equal(tieneParticipanteDefinido({ status: "CONFIRMED" }), true);
  });

  it("ningún estado previo a la confirmación tiene participante", () => {
    for (const status of [
      "DRAFT",
      "PENDING_PAYMENT",
      "WAITLISTED",
      "CANCELLED",
      "REFUNDED",
      "EXPIRED",
      "DISQUALIFIED",
      "REFUND_REQUESTED",
      "TRANSFERRED_TO_NEXT_EDITION",
    ] as const) {
      assert.equal(tieneParticipanteDefinido({ status }), false, status);
    }
  });

  it("no alcanza con que el pago esté aprobado", () => {
    // Justamente la equivalencia que los regalos rompieron.
    assert.equal(
      tieneParticipanteDefinido({
        status: "GIFT_AWAITING_REDEMPTION",
        paymentStatus: "APPROVED",
      }),
      false,
    );
  });

  it("la lista que usan las consultas dice lo mismo que la función", () => {
    // Si alguien agrega un estado a la lista y se olvida de la función (o al
    // revés), los totales de la base y la pantalla dejan de coincidir.
    for (const status of ESTADOS_SIN_PARTICIPANTE) {
      assert.equal(
        tieneParticipanteDefinido({ status, paymentStatus: "APPROVED" }),
        false,
        status,
      );
    }
  });

  it("distingue el motivo: un regalo sin activar no es 'sin pagar'", () => {
    assert.equal(
      motivoSinParticipante({ status: "GIFT_AWAITING_REDEMPTION" }),
      "GIFT_NOT_REDEEMED",
    );
    assert.equal(motivoSinParticipante({ status: "PENDING_PAYMENT" }), "NOT_CONFIRMED");
  });
});
