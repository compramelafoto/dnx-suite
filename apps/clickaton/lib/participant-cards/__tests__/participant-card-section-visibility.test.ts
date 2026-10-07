import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideParticipantCardsSections } from "../participant-card-section-visibility";

describe("qué sección de placas ve el participante", () => {
  it("muestra el sistema nuevo cuando está operativo", () => {
    assert.deepEqual(decideParticipantCardsSections({ paid: true, v2Available: true }), { v2: true });
  });

  it("no la muestra si el sistema nuevo no está operativo", () => {
    assert.deepEqual(decideParticipantCardsSections({ paid: true, v2Available: false }), { v2: false });
  });

  it("no la muestra a quien todavía no pagó", () => {
    assert.deepEqual(decideParticipantCardsSections({ paid: false, v2Available: true }), { v2: false });
  });
});

/**
 * Generar y mostrar son dos cosas distintas.
 *
 * Para encender esto con seguridad hay que poder generar primero el backlog de placas,
 * comprobar que salieron bien, y recién entonces mostrárselas a la gente. Con una sola llave,
 * el primer intento fallido lo ve el participante: fue exactamente lo que pasó al encenderlo.
 */
describe("generar y mostrar se encienden por separado", () => {
  it("no muestra la sección nueva mientras la vitrina esté apagada, aunque se esté generando", () => {
    assert.deepEqual(
      decideParticipantCardsSections({ paid: true, v2Available: true, publicUiEnabled: false }),
      { v2: false }
    );
  });

  it("muestra la sección nueva cuando la vitrina está encendida", () => {
    assert.deepEqual(
      decideParticipantCardsSections({ paid: true, v2Available: true, publicUiEnabled: true }),
      { v2: true }
    );
  });
});
