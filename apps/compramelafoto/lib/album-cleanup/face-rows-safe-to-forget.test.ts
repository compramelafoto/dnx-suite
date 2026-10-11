import { strict as assert } from "node:assert";
import { test } from "node:test";
import { faceRowsSafeToForget, hasPendingFaceDeletions } from "./face-rows-safe-to-forget.ts";

/**
 * Implementación vieja (con el bug): borraba todas las filas de caras de la foto,
 * hubiera confirmado Amazon el borrado o no. Se conserva acá para demostrar que el
 * test discrimina la regresión.
 */
function buggyRowsToForget(outcomes: Array<{ id: number }>): number[] {
  return outcomes.map((o) => o.id);
}

test("sólo se olvidan las caras que Amazon confirmó borradas", () => {
  const outcomes = [
    { id: 1, faceId: "f1", deleted: true },
    { id: 2, faceId: "f2", deleted: false },
    { id: 3, faceId: "f3", deleted: true },
  ];

  assert.deepEqual(faceRowsSafeToForget(outcomes), [1, 3]);

  // La implementación vieja se llevaba puesta la 2, que sigue viva en Amazon.
  assert.deepEqual(buggyRowsToForget(outcomes), [1, 2, 3]);
});

test("caso del 2026-10-06: Amazon caída, no se olvida ninguna", () => {
  // Con la cuenta suspendida, todos los borrados fallan con UnrecognizedClientException.
  const outcomes = [
    { id: 10, faceId: "f10", deleted: false },
    { id: 11, faceId: "f11", deleted: false },
  ];

  assert.deepEqual(faceRowsSafeToForget(outcomes), []);
  assert.equal(hasPendingFaceDeletions(outcomes), true);
});

test("sin caras que borrar no queda nada pendiente", () => {
  assert.deepEqual(faceRowsSafeToForget([]), []);
  assert.equal(hasPendingFaceDeletions([]), false);
});

test("si Amazon confirmó todo, no queda nada pendiente", () => {
  const outcomes = [
    { id: 5, faceId: "f5", deleted: true },
    { id: 6, faceId: "f6", deleted: true },
  ];

  assert.deepEqual(faceRowsSafeToForget(outcomes), [5, 6]);
  assert.equal(hasPendingFaceDeletions(outcomes), false);
});
