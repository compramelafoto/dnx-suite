import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveArgentinaDayWindow } from "./day-window";

test("el informe de las 03:00 UTC cubre el día argentino que acaba de terminar", () => {
  // 2026-08-24T03:00:00Z = 2026-08-24 00:00 en Argentina (UTC-3).
  const window = resolveArgentinaDayWindow(new Date("2026-08-24T03:00:00.000Z"));

  assert.equal(window.reportDate, "2026-08-23");
  assert.equal(window.current.start.toISOString(), "2026-08-23T03:00:00.000Z");
  assert.equal(window.current.end.toISOString(), "2026-08-24T03:00:00.000Z");
});

test("la ventana previa es el día anterior completo", () => {
  const window = resolveArgentinaDayWindow(new Date("2026-08-24T03:00:00.000Z"));

  assert.equal(window.previous.start.toISOString(), "2026-08-22T03:00:00.000Z");
  assert.equal(window.previous.end.toISOString(), "2026-08-23T03:00:00.000Z");
});

test("la ventana de siete días termina donde empieza el día informado", () => {
  const window = resolveArgentinaDayWindow(new Date("2026-08-24T03:00:00.000Z"));

  assert.equal(window.trailingSevenDays.start.toISOString(), "2026-08-16T03:00:00.000Z");
  assert.equal(window.trailingSevenDays.end.toISOString(), "2026-08-23T03:00:00.000Z");
});

test("una ejecución a media mañana sigue informando el día anterior", () => {
  // 2026-08-24T14:30:00Z = 2026-08-24 11:30 en Argentina.
  const window = resolveArgentinaDayWindow(new Date("2026-08-24T14:30:00.000Z"));

  assert.equal(window.reportDate, "2026-08-23");
  assert.equal(window.current.end.toISOString(), "2026-08-24T03:00:00.000Z");
});

test("cruce de mes: el 1 de septiembre informa el 31 de agosto", () => {
  const window = resolveArgentinaDayWindow(new Date("2026-09-01T03:00:00.000Z"));

  assert.equal(window.reportDate, "2026-08-31");
  assert.equal(window.current.start.toISOString(), "2026-08-31T03:00:00.000Z");
});

test("cruce de año: el 1 de enero informa el 31 de diciembre", () => {
  const window = resolveArgentinaDayWindow(new Date("2027-01-01T03:00:00.000Z"));

  assert.equal(window.reportDate, "2026-12-31");
});

test("justo antes de la medianoche argentina todavía se informa el día anteanterior", () => {
  // 2026-08-24T02:59:00Z = 2026-08-23 23:59 en Argentina.
  const window = resolveArgentinaDayWindow(new Date("2026-08-24T02:59:00.000Z"));

  assert.equal(window.reportDate, "2026-08-22");
});
