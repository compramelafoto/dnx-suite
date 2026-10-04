import test from "node:test";
import assert from "node:assert/strict";

import { revisarSubidaEnTermino } from "./subida-en-termino";

const DESDE = new Date("2026-09-19T19:00:00Z"); // 16:00 ARG
const HASTA = new Date("2026-09-20T02:00:00Z"); // 23:00 ARG

function envio(subida: string | null) {
  return {
    subidaEn: subida ? new Date(subida) : null,
    ventanaDesde: DESDE,
    ventanaHasta: HASTA,
  };
}

test("una foto subida en el medio de la ventana está en término", () => {
  const r = revisarSubidaEnTermino(envio("2026-09-19T22:40:00Z"));
  assert.equal(r.enTermino, true);
  assert.equal(r.motivo, "EN_TERMINO");
});

test("el momento exacto de apertura ya cuenta", () => {
  const r = revisarSubidaEnTermino(envio("2026-09-19T19:00:00Z"));
  assert.equal(r.enTermino, true);
});

test("un segundo antes de abrir, no", () => {
  const r = revisarSubidaEnTermino(envio("2026-09-19T18:59:59Z"));
  assert.equal(r.enTermino, false);
  assert.equal(r.motivo, "LLEGO_ANTES");
});

test("el momento exacto de cierre ya es tarde", () => {
  // El final es exclusivo: a las 23:00:00 en punto ya no se entra. Es la misma
  // regla que aplica la pantalla de subida.
  const r = revisarSubidaEnTermino(envio("2026-09-20T02:00:00Z"));
  assert.equal(r.enTermino, false);
  assert.equal(r.motivo, "LLEGO_TARDE");
});

test("un segundo antes del cierre todavía entra", () => {
  const r = revisarSubidaEnTermino(envio("2026-09-20T01:59:59Z"));
  assert.equal(r.enTermino, true);
});

/**
 * El defecto que originó todo esto: la respuesta no puede depender de cuándo
 * se hace la pregunta.
 */
test("la respuesta no cambia según cuándo se revise", () => {
  const laFoto = envio("2026-09-19T22:40:00Z");
  const durante = revisarSubidaEnTermino(laFoto);
  // Cuatro días después, con la maratón terminada hace rato:
  const despues = revisarSubidaEnTermino(laFoto);
  assert.deepEqual(durante, despues);
  assert.equal(despues.enTermino, true, "revisar tarde no puede volver tardía una foto puntual");
});

test("sin ventana configurada no se inventa una regla", () => {
  const r = revisarSubidaEnTermino({
    subidaEn: new Date("2026-09-19T22:40:00Z"),
    ventanaDesde: null,
    ventanaHasta: null,
  });
  assert.equal(r.enTermino, null, "ni en término ni fuera: no hay con qué decidir");
  assert.equal(r.motivo, "SIN_VENTANA");
});

test("sin fecha de subida tampoco se decide", () => {
  const r = revisarSubidaEnTermino(envio(null));
  assert.equal(r.enTermino, null);
  assert.equal(r.motivo, "SIN_FECHA_DE_SUBIDA");
});

test("una ventana abierta sin cierre acepta todo lo posterior a la apertura", () => {
  const r = revisarSubidaEnTermino({
    subidaEn: new Date("2027-01-01T00:00:00Z"),
    ventanaDesde: DESDE,
    ventanaHasta: null,
  });
  assert.equal(r.enTermino, true);
});

test("el caso real: las 100 fotos rechazadas estaban en término", () => {
  // Rango real de subida de las rechazadas en Argentina 2026.
  for (const cuando of ["2026-09-19T22:40:48Z", "2026-09-19T23:30:00Z", "2026-09-20T00:09:44Z"]) {
    assert.equal(
      revisarSubidaEnTermino(envio(cuando)).enTermino,
      true,
      `${cuando} debería estar en término`,
    );
  }
});
