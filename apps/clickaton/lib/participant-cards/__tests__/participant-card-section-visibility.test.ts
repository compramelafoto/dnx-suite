import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideParticipantCardsSections } from "../participant-card-section-visibility";

/**
 * Un participante que pagó tiene que ver su placa. Cuál de los dos sistemas se la muestra es un
 * detalle interno; que no se la muestre ninguno, no.
 */
describe("qué sección de placas ve el participante", () => {
  it("muestra el sistema nuevo cuando está operativo", () => {
    assert.deepEqual(
      decideParticipantCardsSections({ paid: true, v2Available: true }),
      { v2: true, legacy: false }
    );
  });

  it("cae en la placa de siempre si el sistema nuevo no está operativo", () => {
    assert.deepEqual(
      decideParticipantCardsSections({ paid: true, v2Available: false }),
      { v2: false, legacy: true }
    );
  });

  it("nunca deja sin placa a quien pagó", () => {
    for (const v2Available of [true, false]) {
      const visible = decideParticipantCardsSections({ paid: true, v2Available });
      assert.ok(visible.v2 || visible.legacy, `quedó sin placa con v2Available=${v2Available}`);
    }
  });

  it("no muestra nada a quien todavía no pagó", () => {
    assert.deepEqual(
      decideParticipantCardsSections({ paid: false, v2Available: false }),
      { v2: false, legacy: false }
    );
  });

  it("tampoco ofrece el sistema nuevo a quien no pagó", () => {
    assert.deepEqual(
      decideParticipantCardsSections({ paid: false, v2Available: true }),
      { v2: false, legacy: false }
    );
  });
});
