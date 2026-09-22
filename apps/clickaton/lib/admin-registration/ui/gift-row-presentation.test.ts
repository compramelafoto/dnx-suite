import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  esFilaDeRegaloSinActivar,
  presentAdminParticipantIdentity,
} from "./gift-row-presentation";
import { presentAdminOperationalSummary } from "./admin-status-presentation";
import { REGISTRATION_STATUS_FILTER_OPTIONS } from "./status-filter-options";
import { filtersFromSearchParams } from "../actions/filters";

const REGALO_SIN_ACTIVAR = {
  status: "GIFT_AWAITING_REDEMPTION" as const,
  firstName: "Daniel",
  lastName: "Cuart",
  email: "daniel@example.com",
};

describe("cómo se muestra un regalo sin activar en el listado", () => {
  it("no muestra al comprador como si fuera el participante", () => {
    const identidad = presentAdminParticipantIdentity(REGALO_SIN_ACTIVAR);
    assert.equal(identidad.awaitingParticipant, true);
    assert.equal(identidad.displayName, "A designar");
    // El nombre del comprador se conserva, pero dicho como lo que es.
    assert.match(identidad.note ?? "", /Daniel Cuart/);
    assert.match(identidad.note ?? "", /regal/i);
  });

  it("una inscripción común muestra su nombre y ninguna aclaración", () => {
    const identidad = presentAdminParticipantIdentity({
      status: "CONFIRMED",
      firstName: "Belén",
      lastName: "Córdoba",
      email: "belen@example.com",
    });
    assert.equal(identidad.awaitingParticipant, false);
    assert.equal(identidad.displayName, "Belén Córdoba");
    assert.equal(identidad.note, null);
  });

  it("un regalo ya activado es una inscripción común", () => {
    // Tras el canje la inscripción queda CONFIRMED con los datos de quien
    // participa: no hay nada que aclarar.
    assert.equal(esFilaDeRegaloSinActivar({ status: "CONFIRMED" }), false);
  });

  it("si el comprador no dejó nombre, no inventa uno", () => {
    const identidad = presentAdminParticipantIdentity({
      status: "GIFT_AWAITING_REDEMPTION",
      firstName: "",
      lastName: "   ",
      email: "quien@example.com",
    });
    assert.equal(identidad.displayName, "A designar");
    assert.match(identidad.note ?? "", /quien@example\.com/);
  });
});

describe("el estado general de un regalo sin activar", () => {
  it("no dice 'Requiere atención': está todo bien, falta que lo activen", () => {
    const resumen = presentAdminOperationalSummary({
      registrationStatus: "GIFT_AWAITING_REDEMPTION",
      paymentStatus: "APPROVED",
      fulfillmentStatus: "PENDING",
    });
    assert.equal(resumen.key, "gift_awaiting");
    assert.equal(resumen.label, "Regalo sin activar");
    assert.equal(resumen.attention, "watch");
    assert.notEqual(resumen.tone, "danger");
  });

  it("el kit pendiente no lo pisa: todavía no se sabe el talle", () => {
    // Antes del canje no hay talle elegido; pedir que se entregue el kit
    // sería una acción imposible.
    const resumen = presentAdminOperationalSummary({
      registrationStatus: "GIFT_AWAITING_REDEMPTION",
      paymentStatus: "APPROVED",
      fulfillmentStatus: "PENDING",
    });
    assert.notEqual(resumen.key, "kit_pending");
  });

  it("un regalo anulado y devuelto sigue mostrándose como inactivo", () => {
    const resumen = presentAdminOperationalSummary({
      registrationStatus: "REFUNDED",
      paymentStatus: "REFUNDED",
    });
    assert.equal(resumen.key, "cancelled");
  });

  it("la próxima acción apunta al panel de Regalos, no al detalle", () => {
    const resumen = presentAdminOperationalSummary({
      registrationStatus: "GIFT_AWAITING_REDEMPTION",
      paymentStatus: "APPROVED",
    });
    assert.match(resumen.nextAction ?? "", /Regalos/);
  });
});

describe("el filtro por estado del listado", () => {
  it("acepta todas las opciones que ofrece, incluido el regalo sin activar", () => {
    // Una opción que la lista blanca no conoce se descarta sin avisar: el
    // filtro parece aplicarse y el listado sigue mostrando todo.
    for (const status of REGISTRATION_STATUS_FILTER_OPTIONS) {
      const filtros = filtersFromSearchParams({ status });
      assert.equal(filtros.status, status, `el filtro descartó ${status}`);
    }
  });

  it("sigue descartando un estado inventado", () => {
    assert.equal(filtersFromSearchParams({ status: "CUALQUIERA" }).status, undefined);
  });
});
