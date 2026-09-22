import assert from "node:assert/strict";
import { test } from "node:test";
import { averageAspect, calculateNps, wouldReturnRate } from "./metrics.ts";

test("NPS: promotores menos detractores sobre el total", () => {
  const r = calculateNps([10, 9, 8, 7, 6, 0]);
  assert.equal(r.total, 6);
  assert.equal(r.promoters, 2);
  assert.equal(r.passives, 2);
  assert.equal(r.detractors, 2);
  assert.equal(r.score, 0);
});

test("NPS sin respuestas no divide por cero", () => {
  const r = calculateNps([]);
  assert.equal(r.total, 0);
  assert.equal(r.promoters, 0);
  assert.equal(r.score, 0);
});

test("NPS redondea a entero", () => {
  const r = calculateNps([10, 10, 0]);
  assert.equal(r.score, 33);
});

test("NPS todo detractores da -100", () => {
  assert.equal(calculateNps([0, 3, 6]).score, -100);
});

test("NPS ignora valores fuera de 0..10", () => {
  const r = calculateNps([10, 99, -4, 9]);
  assert.equal(r.total, 2);
  assert.equal(r.promoters, 2);
  assert.equal(r.score, 100);
});

test('el promedio ignora los "No aplica" y los cuenta aparte', () => {
  const r = averageAspect([5, 4, null, null, 3]);
  assert.equal(r.answered, 3);
  assert.equal(r.notApplicable, 2);
  assert.equal(r.average, 4);
});

test("un aspecto que nadie puntuó no tiene promedio", () => {
  const r = averageAspect([null, null]);
  assert.equal(r.average, null);
  assert.equal(r.answered, 0);
  assert.equal(r.notApplicable, 2);
});

test("el promedio se redondea a un decimal", () => {
  assert.equal(averageAspect([5, 4, 4]).average, 4.3);
});

test("volvería a participar: sí y tal vez cuentan como positivo", () => {
  const r = wouldReturnRate(["YES", "YES", "MAYBE", "NO", null]);
  assert.equal(r.yes, 2);
  assert.equal(r.maybe, 1);
  assert.equal(r.no, 1);
  assert.equal(r.answered, 4);
  assert.equal(r.positiveRate, 75);
});

test("sin respuestas, la tasa de retorno es cero y no NaN", () => {
  const r = wouldReturnRate([null, null]);
  assert.equal(r.answered, 0);
  assert.equal(r.positiveRate, 0);
});
