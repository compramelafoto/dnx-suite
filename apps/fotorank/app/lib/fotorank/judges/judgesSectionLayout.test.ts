/**
 * Con pocos jurados un carrusel esconde información sin motivo; con muchos,
 * una grilla empuja el resto de la página hacia abajo.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { formatoDeSeccionDeJurados, TOPE_PARA_GRILLA } from "./judgesSectionLayout";

test("hasta seis, grilla", () => {
  for (let n = 1; n <= TOPE_PARA_GRILLA; n++) {
    assert.equal(formatoDeSeccionDeJurados(n), "grilla", `con ${n} debería ser grilla`);
  }
});

test("más de seis, carrusel", () => {
  assert.equal(formatoDeSeccionDeJurados(TOPE_PARA_GRILLA + 1), "carrusel");
  assert.equal(formatoDeSeccionDeJurados(20), "carrusel");
});

test("sin jurados, grilla: la sección no se dibuja igual", () => {
  assert.equal(formatoDeSeccionDeJurados(0), "grilla");
});
