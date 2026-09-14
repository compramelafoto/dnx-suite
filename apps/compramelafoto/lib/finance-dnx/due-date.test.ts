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
  // Esta prueba sólo tiene sentido si sacar el guard de Number.isNaN puede
  // hacerla fallar. `isOverdueUnpaid` compara días calendario con
  // `toISOString().slice(0, 10)`, y `toISOString()` de una fecha inválida
  // TIRA (RangeError: Invalid time value) en vez de devolver algo
  // comparable — a diferencia de comparar `getTime()` con `<`, donde
  // `NaN < numero` es sencillamente `false` y el guard nunca se nota. Por
  // eso: sin el guard, esta llamada explota y `assert.doesNotThrow` la
  // detecta.
  assert.doesNotThrow(() => isOverdueUnpaid("no-es-una-fecha", "IMPAGO", AHORA));
  assert.equal(isOverdueUnpaid("no-es-una-fecha", "IMPAGO", AHORA), false);
});

// Vencimiento "hoy" vs "mañana", mirados desde un momento elegido a
// propósito: las 00:30 UTC del 13/9, que en Argentina (UTC-3) todavía son
// las 21:30 del 12/9. Es exactamente el horario en el que el bug de huso
// horario (comparar instantes en vez de días calendario) hacía que una
// factura que vence MAÑANA ya apareciera vencida HOY.
const AHORA_LIMITE = new Date("2026-09-13T00:30:00Z"); // 12/9 21:30 hora Argentina

test("una factura que vence hoy no se pinta de vencida (recién al otro día)", () => {
  // "Hoy" en Argentina, con AHORA_LIMITE, es el 12/9. Si `<` se cambiara por
  // `<=` esta prueba pasaría a fallar: es la que fija esa decisión de
  // producto (vence hoy todavía no es "vencida").
  assert.equal(isOverdueUnpaid("2026-09-12", "IMPAGO", AHORA_LIMITE), false);
});

test("una factura que vence mañana no se pinta de vencida ni de noche, hora Argentina", () => {
  // Antes del fix, comparar instantes marcaba esta factura como vencida
  // porque en UTC ya era 13/9 (aunque en Argentina todavía es 12/9 a la
  // noche). Es el caso concreto del hallazgo M-1.
  assert.equal(isOverdueUnpaid("2026-09-13", "IMPAGO", AHORA_LIMITE), false);
});
