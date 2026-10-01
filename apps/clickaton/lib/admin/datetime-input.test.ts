/**
 * Los campos `datetime-local` del panel representan hora local del evento.
 * Antes se interpretaban con el huso del runtime: en Vercel (UTC) eso grababa
 * las fechas 3 horas antes de lo que el administrador escribía.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ADMIN_TIME_ZONE,
  formatAdminDateTime,
  parseDateTimeInput,
  toDateTimeLocalValue,
} from "./datetime-input";

test("lo escrito en el panel es hora argentina, no UTC", () => {
  const date = parseDateTimeInput("2026-09-18T23:59");
  assert.ok(date);
  assert.equal(date.toISOString(), "2026-09-19T02:59:00.000Z");
});

test("acepta segundos en el valor del campo", () => {
  const date = parseDateTimeInput("2026-09-18T23:59:30");
  assert.ok(date);
  assert.equal(date.toISOString(), "2026-09-19T02:59:30.000Z");
});

test("muestra el instante guardado en hora argentina", () => {
  // Lo que hoy tiene grabada la edición de septiembre 2026.
  const value = toDateTimeLocalValue(new Date("2026-09-19T19:00:00.000Z"));
  assert.equal(value, "2026-09-19T16:00");
});

test("ida y vuelta sin corrimiento", () => {
  const original = "2026-09-19T16:00";
  const date = parseDateTimeInput(original);
  assert.ok(date);
  assert.equal(toDateTimeLocalValue(date), original);
});

test("un ISO con zona explícita se respeta tal cual", () => {
  assert.equal(
    parseDateTimeInput("2026-09-19T16:00:00.000-03:00")?.toISOString(),
    "2026-09-19T19:00:00.000Z",
  );
  assert.equal(
    parseDateTimeInput("2026-09-19T19:00:00.000Z")?.toISOString(),
    "2026-09-19T19:00:00.000Z",
  );
});

test("respeta el horario de verano de la zona indicada", () => {
  // Madrid: +02:00 en julio, +01:00 en enero.
  assert.equal(
    parseDateTimeInput("2026-07-15T12:00", "Europe/Madrid")?.toISOString(),
    "2026-07-15T10:00:00.000Z",
  );
  assert.equal(
    parseDateTimeInput("2026-01-15T12:00", "Europe/Madrid")?.toISOString(),
    "2026-01-15T11:00:00.000Z",
  );
  assert.equal(
    toDateTimeLocalValue(new Date("2026-07-15T10:00:00.000Z"), "Europe/Madrid"),
    "2026-07-15T12:00",
  );
});

test("medianoche no se corre de día", () => {
  const date = parseDateTimeInput("2026-09-19T00:00");
  assert.ok(date);
  assert.equal(date.toISOString(), "2026-09-19T03:00:00.000Z");
  assert.equal(toDateTimeLocalValue(date), "2026-09-19T00:00");
});

test("vacío e inválido dan null", () => {
  assert.equal(parseDateTimeInput(""), null);
  assert.equal(parseDateTimeInput("   "), null);
  assert.equal(parseDateTimeInput(null), null);
  assert.equal(parseDateTimeInput("no es una fecha"), null);
  assert.equal(toDateTimeLocalValue(null), "");
  assert.equal(toDateTimeLocalValue(new Date("invalida")), "");
});

test("la zona por defecto es la de las operaciones argentinas", () => {
  assert.equal(DEFAULT_ADMIN_TIME_ZONE, "America/Argentina/Buenos_Aires");
});

test("una zona mal escrita cae a la de Argentina sin romper el panel", () => {
  assert.equal(
    parseDateTimeInput("2026-09-18T23:59", "Tierra/Media")?.toISOString(),
    "2026-09-19T02:59:00.000Z",
  );
  assert.equal(
    toDateTimeLocalValue(new Date("2026-09-19T19:00:00.000Z"), ""),
    "2026-09-19T16:00",
  );
  assert.equal(formatAdminDateTime(null, "Tierra/Media"), "—");
});
