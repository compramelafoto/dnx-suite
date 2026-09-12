import assert from "node:assert/strict";
import test from "node:test";

import { isOverdueUnpaid } from "./due-date";

const AHORA = new Date("2026-09-12T12:00:00Z");

test("una factura sin fecha de vencimiento nunca está vencida", () => {
  assert.equal(isOverdueUnpaid(null, "FACTURADO", AHORA), false);
});

test("una factura rechazada con vencimiento pasado está vencida e impaga", () => {
  assert.equal(isOverdueUnpaid("2026-05-10", "RECHAZADO", AHORA), true);
});

test("una factura impaga con vencimiento pasado está vencida e impaga", () => {
  assert.equal(isOverdueUnpaid("2026-05-10", "IMPAGO", AHORA), true);
});

test("una factura pagada no se marca aunque el vencimiento haya pasado", () => {
  assert.equal(isOverdueUnpaid("2026-05-10", "PAGADO", AHORA), false);
});

test("una factura reembolsada tampoco se marca", () => {
  assert.equal(isOverdueUnpaid("2026-05-10", "REEMBOLSADO", AHORA), false);
});

test("una factura con vencimiento futuro no está vencida", () => {
  assert.equal(isOverdueUnpaid("2026-12-01", "IMPAGO", AHORA), false);
});

test("una fecha inválida no rompe la función", () => {
  assert.equal(isOverdueUnpaid("no-es-una-fecha", "IMPAGO", AHORA), false);
});
