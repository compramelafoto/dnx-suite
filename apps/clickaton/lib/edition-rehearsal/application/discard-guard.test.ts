import assert from "node:assert/strict";
import test from "node:test";

import { sePuedeDescartar } from "./discard-guard";

/**
 * El guardián del borrado. Es la pieza que impide que un ensayo termine
 * borrando una edición de verdad, así que se prueba en los dos sentidos: lo
 * que tiene que dejar pasar y, sobre todo, lo que tiene que frenar.
 */

const COPIA = {
  id: "copia1",
  nombre: "[ENSAYO] Clickatón Argentina",
  isOpsFixture: true,
  isPublished: false,
  cantidadDeInscripciones: 0,
};

test("una copia de ensayo se puede descartar", () => {
  const r = sePuedeDescartar(COPIA);
  assert.equal(r.ok, true);
  assert.equal(r.motivo, null);
});

test("una edición real NUNCA se puede descartar", () => {
  const r = sePuedeDescartar({
    id: "real",
    nombre: "Clickatón Argentina 2026",
    isOpsFixture: false,
    isPublished: true,
    cantidadDeInscripciones: 340,
  });
  assert.equal(r.ok, false);
  assert.match(r.motivo ?? "", /no es una copia de ensayo/i);
});

test("sin el flag de ensayo no se borra, aunque no esté publicada ni tenga gente", () => {
  const r = sePuedeDescartar({
    id: "real",
    nombre: "Edición en preparación",
    isOpsFixture: false,
    isPublished: false,
    cantidadDeInscripciones: 0,
  });
  assert.equal(r.ok, false);
  assert.match(r.motivo ?? "", /no es una copia de ensayo/i);
});

test("una copia publicada por error no se borra sin que alguien la mire", () => {
  const r = sePuedeDescartar({ ...COPIA, isPublished: true });
  assert.equal(r.ok, false);
  assert.match(r.motivo ?? "", /publicada/i);
});

test("una copia con inscripciones de gente real no se borra", () => {
  const r = sePuedeDescartar({ ...COPIA, cantidadDeInscripciones: 3 });
  assert.equal(r.ok, false);
  assert.match(r.motivo ?? "", /inscripciones/i);
});

test("la copia con sólo la inscripción del propio ensayo sí se borra", () => {
  const r = sePuedeDescartar({ ...COPIA, cantidadDeInscripciones: 1, inscripcionesDelEnsayo: 1 });
  assert.equal(r.ok, true);
});

test("si hay más inscripciones que las del ensayo, se frena", () => {
  const r = sePuedeDescartar({ ...COPIA, cantidadDeInscripciones: 4, inscripcionesDelEnsayo: 1 });
  assert.equal(r.ok, false);
});

test("una edición inexistente no se borra", () => {
  const r = sePuedeDescartar(null);
  assert.equal(r.ok, false);
  assert.match(r.motivo ?? "", /no encontramos/i);
});

test("el motivo del rechazo siempre se puede leer", () => {
  const rechazos = [
    sePuedeDescartar(null),
    sePuedeDescartar({ ...COPIA, isOpsFixture: false }),
    sePuedeDescartar({ ...COPIA, isPublished: true }),
    sePuedeDescartar({ ...COPIA, cantidadDeInscripciones: 9 }),
  ];
  for (const r of rechazos) {
    assert.equal(r.ok, false);
    assert.ok((r.motivo ?? "").trim().length > 0, "todo rechazo tiene que explicarse");
  }
});
