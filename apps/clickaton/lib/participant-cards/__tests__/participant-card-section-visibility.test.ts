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
      { v2: false, legacy: true }
    );
  });

  it("muestra la sección nueva cuando la vitrina está encendida", () => {
    assert.deepEqual(
      decideParticipantCardsSections({ paid: true, v2Available: true, publicUiEnabled: true }),
      { v2: true, legacy: false }
    );
  });

  it("con la vitrina apagada el participante sigue viendo su placa de siempre", () => {
    const visible = decideParticipantCardsSections({
      paid: true,
      v2Available: true,
      publicUiEnabled: false,
    });
    assert.ok(visible.legacy, "quien pagó no puede quedarse sin placa");
  });
});

/**
 * Cuando el generador viejo se apaga, su placa deja de ofrecerse aunque el sistema nuevo no
 * esté disponible. Es el único caso en que quien pagó puede no ver ninguna sección: ya no hay
 * nada viejo que mostrar, y mostrar un botón que no genera nada es peor que no mostrar nada.
 */
describe("con el generador viejo apagado", () => {
  it("no ofrece la placa de siempre", () => {
    assert.deepEqual(
      decideParticipantCardsSections({
        paid: true,
        v2Available: false,
        legacyEnabled: false,
      }),
      { v2: false, legacy: false }
    );
  });

  it("el sistema nuevo se sigue mostrando normalmente", () => {
    assert.deepEqual(
      decideParticipantCardsSections({
        paid: true,
        v2Available: true,
        legacyEnabled: false,
      }),
      { v2: true, legacy: false }
    );
  });

  it("mientras siga encendido, nada cambia", () => {
    assert.deepEqual(
      decideParticipantCardsSections({ paid: true, v2Available: false, legacyEnabled: true }),
      { v2: false, legacy: true }
    );
  });
});
