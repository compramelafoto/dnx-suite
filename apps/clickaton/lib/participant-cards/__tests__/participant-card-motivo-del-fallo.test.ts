import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { codigoConMotivo } from "../participant-card-motivo-del-fallo";

/**
 * Por qué el motivo se guarda junto al código.
 *
 * Los registros del servidor duran minutos: si nadie está mirando cuando una placa falla, el
 * motivo se pierde y hay que desplegar de nuevo sólo para averiguarlo. Pasó varias veces. El
 * código solo dice "el render falló", que no alcanza para decidir nada.
 *
 * Se guarda en el mismo campo porque agregar una columna obliga a tocar a mano las cinco bases
 * que comparten el esquema.
 */
describe("motivo del fallo guardado con el código", () => {
  it("deja el código adelante, para poder seguir filtrando por él", () => {
    const valor = codigoConMotivo("CLICKATON_CARD_RENDER_FAILED", "Cannot find module 'x'");

    assert.ok(valor.startsWith("CLICKATON_CARD_RENDER_FAILED"));
    assert.match(valor, /Cannot find module 'x'/);
  });

  it("sin motivo, guarda sólo el código", () => {
    assert.equal(
      codigoConMotivo("CLICKATON_CARD_RENDER_FAILED", undefined),
      "CLICKATON_CARD_RENDER_FAILED",
    );
  });

  it("recorta un motivo largo: puede arrastrar una dirección o un nombre", () => {
    const valor = codigoConMotivo("X", "y".repeat(900));

    assert.ok(valor.length <= 320, `quedó de ${valor.length} caracteres`);
  });

  it("aplasta los saltos de línea, que ensucian la consulta", () => {
    const valor = codigoConMotivo("X", "primera\nsegunda\n\ttercera");

    assert.ok(!valor.includes("\n"));
    assert.match(valor, /primera segunda tercera/);
  });
});
