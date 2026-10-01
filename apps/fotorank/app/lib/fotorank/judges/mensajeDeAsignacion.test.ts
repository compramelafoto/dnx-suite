import test from "node:test";
import assert from "node:assert/strict";

import { mensajeDeAsignacion } from "./mensajeDeAsignacion";

const NADA = { created: 0, skippedExisting: 0, skippedCompite: 0 };

test("una sola asignación se dice en singular", () => {
  assert.equal(mensajeDeAsignacion({ ...NADA, created: 1 }), "Se creó 1 asignación.");
});

test("varias, en plural", () => {
  assert.equal(mensajeDeAsignacion({ ...NADA, created: 4 }), "Se crearon 4 asignaciones.");
});

test("las omitidas por duplicado se informan", () => {
  const msg = mensajeDeAsignacion({ created: 2, skippedExisting: 1, skippedCompite: 0 });
  assert.match(msg, /Se crearon 2 asignaciones/);
  assert.match(msg, /1 categoría que ya tenían asignación/);
});

test("las omitidas porque compite se informan con su propio motivo", () => {
  const msg = mensajeDeAsignacion({ created: 2, skippedExisting: 0, skippedCompite: 3 });
  assert.match(msg, /3 categorías donde este jurado compite con obra propia/);
  assert.ok(!/ya tenían asignación/.test(msg), "no debería mezclar los motivos");
});

test("los dos motivos conviven sin pisarse", () => {
  const msg = mensajeDeAsignacion({ created: 1, skippedExisting: 2, skippedCompite: 1 });
  assert.match(msg, /2 categorías que ya tenían asignación/);
  assert.match(msg, /1 categoría donde este jurado compite/);
});

test("si no se creó nada, el mensaje empieza por eso y explica por qué", () => {
  const msg = mensajeDeAsignacion({ created: 0, skippedExisting: 0, skippedCompite: 2 });
  assert.match(msg, /^No se creó ninguna asignación:/);
  assert.match(msg, /compite con obra propia/);
});

test("nada creado y nada omitido no inventa un motivo", () => {
  const msg = mensajeDeAsignacion(NADA);
  assert.equal(msg, "No se creó ninguna asignación.");
  assert.ok(!msg.includes(":"), "no debería prometer una explicación que no da");
});

test("nunca dice que creó algo que no creó", () => {
  for (const caso of [
    { created: 0, skippedExisting: 3, skippedCompite: 0 },
    { created: 0, skippedExisting: 0, skippedCompite: 3 },
    { created: 0, skippedExisting: 1, skippedCompite: 1 },
  ]) {
    assert.match(mensajeDeAsignacion(caso), /^No se creó ninguna asignación/);
  }
});
