import assert from "node:assert/strict";
import test from "node:test";

import { parseDateTimeInput, toDateTimeLocalValue } from "@/lib/admin/datetime-input";
import { formatearHoraDePared } from "@/lib/fecha-ar";
import { toDatetimeLocalValue } from "@/lib/admin-catalog/ui/ticket-status";

/**
 * El cronograma y el catálogo de entradas escriben horas: si la ida y la vuelta
 * no usan la misma zona, el horario se corre 3 horas cada vez que alguien abre
 * el formulario y guarda. Corre con TZ=UTC, que es el runtime de Vercel.
 */

test("la hora que se carga es la que queda guardada", () => {
  // Las 19:00 del día de la maratón, en Argentina.
  const guardado = parseDateTimeInput("2026-12-12T19:00");
  assert.equal(guardado?.toISOString(), "2026-12-12T22:00:00.000Z");
  assert.equal(toDateTimeLocalValue(guardado), "2026-12-12T19:00");
});

test("abrir el formulario y guardar sin tocar nada no mueve el horario", () => {
  const original = new Date("2026-12-12T22:00:00.000Z");
  const enPantalla = toDateTimeLocalValue(original);
  const reguardado = parseDateTimeInput(enPantalla);
  assert.equal(reguardado?.toISOString(), original.toISOString());
});

test("la venta de entradas usa el mismo criterio que el cronograma", () => {
  const original = new Date("2026-12-12T22:00:00.000Z");
  assert.equal(toDatetimeLocalValue(original), "2026-12-12T19:00");
});

test("la zona de la edición manda sobre la de Argentina", () => {
  const guardado = parseDateTimeInput("2026-07-15T12:00", "Europe/Madrid");
  assert.equal(guardado?.toISOString(), "2026-07-15T10:00:00.000Z");
  assert.equal(toDateTimeLocalValue(guardado, "Europe/Madrid"), "2026-07-15T12:00");
});

test("las barras del cronograma escriben la hora de pared sin convertirla", () => {
  assert.equal(
    formatearHoraDePared("2026-12-12T19:00", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    "19:00",
  );
  assert.equal(
    formatearHoraDePared("2026-12-12T00:30", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    "00:30",
  );
  assert.equal(
    formatearHoraDePared("2026-12-12T19:00", { weekday: "short", day: "numeric", month: "short" }),
    formatearHoraDePared(Date.parse("2026-12-12T19:00:00.000Z"), {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
  );
  assert.equal(formatearHoraDePared("no es una fecha", { hour: "2-digit" }), "—");
});
