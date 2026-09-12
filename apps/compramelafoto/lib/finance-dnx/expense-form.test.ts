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

test("rechaza un taxPercent no numérico", () => {
  const resultado = parseExpenseForm({ ...valido, taxPercent: "abc" });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /impuesto|tax/i);
});

test("rechaza un fxRate presente pero no numérico", () => {
  const resultado = parseExpenseForm({ ...valido, fxRate: "abc" });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /cambio|fxRate|rate/i);
});

test("acepta fxRate null en una factura ARS", () => {
  const resultado = parseExpenseForm({
    ...valido,
    currency: "ARS",
    fxRate: null,
  });

  assert.equal(resultado.ok, true);
});

test("rechaza un amountOriginal en cero", () => {
  const resultado = parseExpenseForm({ ...valido, amountOriginal: 0 });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /importe/i);
});

test("rechaza un amountOriginal negativo", () => {
  const resultado = parseExpenseForm({ ...valido, amountOriginal: -50 });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /importe/i);
});

test("rechaza un fxRate en cero", () => {
  const resultado = parseExpenseForm({ ...valido, fxRate: 0 });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /cambio/i);
});

test("rechaza un fxRate negativo", () => {
  const resultado = parseExpenseForm({ ...valido, fxRate: -1450 });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /cambio/i);
});

test("rechaza un taxPercent fuera de rango (excede la capacidad de la columna)", () => {
  const resultado = parseExpenseForm({ ...valido, taxPercent: 1500 });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /impuesto/i);
});

test("rechaza un taxPercent negativo", () => {
  const resultado = parseExpenseForm({ ...valido, taxPercent: -1 });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /impuesto/i);
});

test("acepta el borde superior de taxPercent (999.99)", () => {
  const resultado = parseExpenseForm({ ...valido, taxPercent: 999.99 });

  assert.equal(resultado.ok, true);
});

test("acepta taxPercent en 0", () => {
  const resultado = parseExpenseForm({ ...valido, taxPercent: 0 });

  assert.equal(resultado.ok, true);
});

test("acepta un gasto sin fecha de vencimiento", () => {
  const resultado = parseExpenseForm(valido);

  assert.equal(resultado.ok, true);
  if (resultado.ok) assert.equal(resultado.value.dueDate, null);
});

test("acepta un gasto con fecha de vencimiento válida", () => {
  const resultado = parseExpenseForm({ ...valido, dueDate: "2026-10-10" });

  assert.equal(resultado.ok, true);
  if (resultado.ok) {
    assert.equal(resultado.value.dueDate instanceof Date, true);
  }
});

test("acepta dueDate null explícito", () => {
  const resultado = parseExpenseForm({ ...valido, dueDate: null });

  assert.equal(resultado.ok, true);
  if (resultado.ok) assert.equal(resultado.value.dueDate, null);
});

test("rechaza una fecha de vencimiento que no se puede interpretar", () => {
  const resultado = parseExpenseForm({ ...valido, dueDate: "no-es-una-fecha" });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /vencimiento/i);
});
