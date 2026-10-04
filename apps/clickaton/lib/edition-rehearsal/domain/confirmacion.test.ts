import assert from "node:assert/strict";
import test from "node:test";

import { PALABRA_DE_CONFIRMACION, confirmacionValida } from "./confirmacion";

/**
 * La confirmación del ensayo completo.
 *
 * Antes pedía escribir el nombre exacto de la edición, y eso resultó
 * intipeable: la edición real se llama "Clickatón  - Día del Fotógrafo
 * Primavera 2026 - 1º Edición", con dos espacios seguidos que nadie ve. Nadie
 * podía correr el ensayo. Ahora es una palabra fija y corta.
 */

test("la palabra correcta confirma", () => {
  assert.equal(confirmacionValida(PALABRA_DE_CONFIRMACION), true);
});

test("no distingue mayúsculas de minúsculas", () => {
  assert.equal(confirmacionValida("ensayo"), true);
  assert.equal(confirmacionValida("Ensayo"), true);
  assert.equal(confirmacionValida("ENSAYO"), true);
});

test("perdona los espacios de más", () => {
  assert.equal(confirmacionValida("  ensayo  "), true);
});

test("otra palabra no confirma", () => {
  assert.equal(confirmacionValida("borrar"), false);
  assert.equal(confirmacionValida("si"), false);
});

test("el vacío nunca confirma", () => {
  assert.equal(confirmacionValida(""), false);
  assert.equal(confirmacionValida("   "), false);
});

test("la palabra es corta y sin acentos, para que se pueda tipear", () => {
  assert.ok(PALABRA_DE_CONFIRMACION.length <= 10);
  assert.match(PALABRA_DE_CONFIRMACION, /^[A-Za-z]+$/, "sin espacios, acentos ni símbolos");
});
