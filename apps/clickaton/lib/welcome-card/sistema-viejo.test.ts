/* eslint-disable turbo/no-undeclared-env-vars -- el test enciende y apaga la bandera documentada */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isSistemaViejoDePlacasActivo } from "./sistema-viejo";

/**
 * El generador viejo de placas.
 *
 * Genera una sola placa, con el diseño clavado en el código, y desde agosto la venía sacando
 * **sin un solo texto**: el servidor no tiene tipografías instaladas y él las pedía prestadas.
 * Se apaga cuando el sistema nuevo genera bien, y hasta entonces queda como respaldo.
 *
 * Por defecto sigue encendido: apagarlo tiene que ser una decisión explícita, no algo que pase
 * por olvidarse de declarar una variable.
 */
const ORIGINAL = process.env.CLICKATON_WELCOME_CARDS_LEGACY_ENABLED;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CLICKATON_WELCOME_CARDS_LEGACY_ENABLED;
  else process.env.CLICKATON_WELCOME_CARDS_LEGACY_ENABLED = ORIGINAL;
});

describe("interruptor del generador viejo", () => {
  it("sin declarar, sigue encendido", () => {
    delete process.env.CLICKATON_WELCOME_CARDS_LEGACY_ENABLED;
    assert.equal(isSistemaViejoDePlacasActivo(), true);
  });

  it("se apaga con la bandera en false", () => {
    process.env.CLICKATON_WELCOME_CARDS_LEGACY_ENABLED = "false";
    assert.equal(isSistemaViejoDePlacasActivo(), false);
  });

  it("un valor raro no lo apaga por accidente", () => {
    process.env.CLICKATON_WELCOME_CARDS_LEGACY_ENABLED = "pepe";
    assert.equal(isSistemaViejoDePlacasActivo(), true);
  });
});
