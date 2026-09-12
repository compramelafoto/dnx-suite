import assert from "node:assert/strict";
import test from "node:test";

import { parseExpenseForm, previousPeriod } from "./expense-form";

const valido = {
  vendorId: 1,
  periodYear: 2026,
  periodMonth: 9,
  amountOriginal: 175.57,
  currency: "USD",
  fxRate: 1450,
  taxPercent: 30,
  status: "RECHAZADO",
};

test("acepta un gasto bien cargado y calcula los pesos", () => {
  const resultado = parseExpenseForm(valido);

  assert.equal(resultado.ok, true);
  if (resultado.ok) {
    assert.equal(resultado.value.amountArsMinor > 0, true);
  }
});

test("una factura en dólares sin tipo de cambio se rechaza con un mensaje claro", () => {
  const resultado = parseExpenseForm({ ...valido, fxRate: null });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /tipo de cambio/i);
});

test("rechaza un mes fuera de rango", () => {
  const resultado = parseExpenseForm({ ...valido, periodMonth: 13 });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /mes/i);
});

test("rechaza un estado que no existe", () => {
  const resultado = parseExpenseForm({ ...valido, status: "INVENTADO" });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /estado/i);
});

test("el mes anterior a enero es diciembre del año pasado", () => {
  assert.deepEqual(previousPeriod(2026, 1), { year: 2025, month: 12 });
});

test("el mes anterior a septiembre es agosto del mismo año", () => {
  assert.deepEqual(previousPeriod(2026, 9), { year: 2026, month: 8 });
});
