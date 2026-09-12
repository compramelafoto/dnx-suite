import assert from "node:assert/strict";
import test from "node:test";

import { computeAmountArsMinor } from "./money";

test("una factura en pesos se toma tal cual", () => {
  const resultado = computeAmountArsMinor({
    amountOriginalMinor: 150_00,
    currency: "ARS",
    fxRate: null,
    taxPercent: 0,
  });

  assert.equal(resultado, 150_00);
});

test("una factura en dólares se multiplica por el dólar del mes", () => {
  const resultado = computeAmountArsMinor({
    amountOriginalMinor: 20_00,
    currency: "USD",
    fxRate: 1450,
    taxPercent: 0,
  });

  assert.equal(resultado, 29_000_00);
});

test("los impuestos se suman sobre el consumo en dólares", () => {
  const resultado = computeAmountArsMinor({
    amountOriginalMinor: 20_00,
    currency: "USD",
    fxRate: 1000,
    taxPercent: 30,
  });

  assert.equal(resultado, 26_000_00);
});

test("una factura en dólares sin tipo de cambio cargado es un error explícito", () => {
  assert.throws(
    () =>
      computeAmountArsMinor({
        amountOriginalMinor: 20_00,
        currency: "USD",
        fxRate: null,
        taxPercent: 0,
      }),
    /tipo de cambio/i,
  );
});

test("el resultado se redondea a centavos enteros", () => {
  const resultado = computeAmountArsMinor({
    amountOriginalMinor: 3_33,
    currency: "USD",
    fxRate: 1000.555,
    taxPercent: 21,
  });

  assert.equal(Number.isInteger(resultado), true);
});
