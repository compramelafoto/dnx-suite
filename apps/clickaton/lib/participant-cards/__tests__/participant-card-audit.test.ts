import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { recordParticipantCardAudit } from "../participant-card-audit";

const original = console.info;
const capturado: string[] = [];

function capturar() {
  capturado.length = 0;
  console.info = (linea: unknown) => {
    capturado.push(String(linea));
  };
}

afterEach(() => {
  console.info = original;
});

/**
 * Cuando una placa falla, el registro guardaba el código y tiraba el mensaje. El código dice
 * "el render falló" y nada más: para saber *por qué* había que adivinar. El mensaje se recorta
 * porque puede arrastrar la dirección de una foto o el nombre de alguien.
 */
describe("registro de una placa fallida", () => {
  it("guarda el motivo del fallo, no sólo el código", () => {
    capturar();

    recordParticipantCardAudit("CLICKATON_CARD_FAILED", {
      errorCode: "CLICKATON_CARD_RENDER_FAILED",
      errorMessage: "Cannot find module '@napi-rs/canvas'",
    });

    const registro = JSON.parse(capturado[0]!) as Record<string, unknown>;
    assert.equal(registro.errorMessage, "Cannot find module '@napi-rs/canvas'");
  });

  it("recorta un mensaje largo a 200 caracteres", () => {
    capturar();

    recordParticipantCardAudit("CLICKATON_CARD_FAILED", {
      errorMessage: "x".repeat(500),
    });

    const registro = JSON.parse(capturado[0]!) as Record<string, unknown>;
    assert.equal(String(registro.errorMessage).length, 200);
  });
});
