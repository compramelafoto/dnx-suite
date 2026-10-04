import test from "node:test";
import assert from "node:assert/strict";

import {
  ARRASTRE_MINIMO,
  esGestoHorizontal,
  haciaDondePasar,
} from "./gestoLateral";

/* ---------- de quién es el dedo ---------- */

test("un movimiento chico todavía no define nada", () => {
  assert.equal(esGestoHorizontal(4, 3), null);
});

test("moverse a lo ancho es un gesto del visor", () => {
  assert.equal(esGestoHorizontal(40, 5), true);
  assert.equal(esGestoHorizontal(-40, 5), true);
});

/** Desplazar la página hacia arriba y abajo tiene que seguir siendo del teléfono. */
test("moverse a lo alto no es del visor", () => {
  assert.equal(esGestoHorizontal(5, 40), false);
});

/* ---------- hacia dónde pasar ---------- */

test("arrastrar hacia la izquierda trae lo que viene", () => {
  assert.equal(haciaDondePasar({ dx: -80, milisegundos: 300 }), 1);
});

test("arrastrar hacia la derecha vuelve a lo anterior", () => {
  assert.equal(haciaDondePasar({ dx: 80, milisegundos: 300 }), -1);
});

test("un arrastre corto y lento no alcanza", () => {
  assert.equal(haciaDondePasar({ dx: -20, milisegundos: 900 }), null);
});

/** Un tirón de dos centímetros en un suspiro es una intención clarísima. */
test("un tirón corto pero rápido sí alcanza", () => {
  assert.equal(haciaDondePasar({ dx: -30, milisegundos: 40 }), 1);
});

test("justo en el mínimo de recorrido ya cuenta, por lento que sea", () => {
  assert.equal(
    haciaDondePasar({ dx: -ARRASTRE_MINIMO, milisegundos: 5000 }),
    1,
  );
});

test("sin movimiento no pasa nada", () => {
  assert.equal(haciaDondePasar({ dx: 0, milisegundos: 10 }), null);
});

/** Un toque es un dx de cero en pocos milisegundos: no puede contar como paso. */
test("un toque seco no se confunde con un arrastre veloz", () => {
  assert.equal(haciaDondePasar({ dx: 0, milisegundos: 1 }), null);
});
