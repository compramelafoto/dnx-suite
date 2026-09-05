import assert from "node:assert/strict";
import test from "node:test";

import { debeOfrecerPackDeMaratones } from "./pack-offer-policy";

test("una edición comercial ofrece el pack", () => {
  assert.equal(debeOfrecerPackDeMaratones({ isOpsFixture: false }), true);
});

test("una edición oculta de prueba NUNCA ofrece el pack", () => {
  // Una demo gratuita no puede mostrar una compra de $100.000 que termina
  // en un cobro real de Mercado Pago.
  assert.equal(debeOfrecerPackDeMaratones({ isOpsFixture: true }), false);
});

test("ante la duda no se ofrece nada pago", () => {
  assert.equal(debeOfrecerPackDeMaratones({ isOpsFixture: null }), true);
  assert.equal(debeOfrecerPackDeMaratones(null), false);
});
