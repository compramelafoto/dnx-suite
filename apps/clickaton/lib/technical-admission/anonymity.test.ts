import test from "node:test";
import assert from "node:assert/strict";

import { buildAnonymousJuryCode, codigosAnonimosDelLote } from "./anonymity";

const CONTEST = "ck-contest-argentina-2026";
const BATCH = "lote-1";

function entradas(cuantas: number, categoryId = "general", categorySlug = "general") {
  // El id lleva la categoría: dos obras distintas no pueden compartir entryId,
  // y si el helper los repitiera el Map se pisaría solo.
  return Array.from({ length: cuantas }, (_, i) => ({
    entryId: `${categoryId}-entry-${i + 1}`,
    categoryId,
    categorySlug,
  }));
}

/**
 * El defecto que rompió el congelamiento de la 1ª edición: el código salía de
 * un hash recortado a 9000 valores posibles. Con 270 obras en una categoría la
 * probabilidad de que dos choquen es del 98% — el problema del cumpleaños — y
 * chocaron a las 80.
 */
test("270 obras en la misma categoría dan 270 códigos distintos", () => {
  const codigos = codigosAnonimosDelLote({
    contestId: CONTEST,
    batchId: BATCH,
    entradas: entradas(270),
  });
  assert.equal(codigos.size, 270);
  assert.equal(new Set(codigos.values()).size, 270, "hay códigos repetidos");
});

test("con muchas más obras tampoco se repite ninguno", () => {
  const codigos = codigosAnonimosDelLote({
    contestId: CONTEST,
    batchId: BATCH,
    entradas: entradas(9000),
  });
  assert.equal(new Set(codigos.values()).size, 9000);
});

test("el mismo lote da siempre los mismos códigos", () => {
  const a = codigosAnonimosDelLote({ contestId: CONTEST, batchId: BATCH, entradas: entradas(50) });
  const b = codigosAnonimosDelLote({ contestId: CONTEST, batchId: BATCH, entradas: entradas(50) });
  assert.deepEqual([...a.entries()].sort(), [...b.entries()].sort());
});

/**
 * El número no puede seguir el orden de carga: si el 0001 fuera el primero que
 * subió, el jurado sabría quién llegó primero y el orden diría algo que no
 * tiene que decir.
 */
test("el orden de los códigos no sigue el orden de las obras", () => {
  const codigos = codigosAnonimosDelLote({
    contestId: CONTEST,
    batchId: BATCH,
    entradas: entradas(60),
  });
  const primeros = entradas(60)
    .slice(0, 10)
    .map((e) => codigos.get(e.entryId)!);
  const enOrden = [...primeros].sort();
  assert.notDeepEqual(primeros, enOrden, "los primeros diez salieron en orden");
});

test("el prefijo sale de la categoría", () => {
  const codigos = codigosAnonimosDelLote({
    contestId: CONTEST,
    batchId: BATCH,
    entradas: entradas(3, "cat-color", "color"),
  });
  for (const c of codigos.values()) assert.match(c, /^COLOR-\d{4}$/);
});

test("cada categoría numera desde uno", () => {
  const codigos = codigosAnonimosDelLote({
    contestId: CONTEST,
    batchId: BATCH,
    entradas: [...entradas(5, "cat-a", "alfa"), ...entradas(5, "cat-b", "beta")],
  });
  const alfa = [...codigos.values()].filter((c) => c.startsWith("ALFA-"));
  const beta = [...codigos.values()].filter((c) => c.startsWith("BETA-"));
  assert.equal(alfa.length, 5);
  assert.equal(beta.length, 5);
  assert.ok(alfa.includes("ALFA-0001"));
  assert.ok(beta.includes("BETA-0001"));
});

test("una categoría sin nombre no deja el código sin prefijo", () => {
  const codigos = codigosAnonimosDelLote({
    contestId: CONTEST,
    batchId: BATCH,
    entradas: [{ entryId: "e1", categoryId: "cat", categorySlug: null }],
  });
  assert.match(codigos.get("e1")!, /^CAT-\d{4}$/);
});

test("sin entradas no devuelve nada y no explota", () => {
  assert.equal(
    codigosAnonimosDelLote({ contestId: CONTEST, batchId: BATCH, entradas: [] }).size,
    0,
  );
});

test("un lote distinto da códigos distintos para las mismas obras", () => {
  const a = codigosAnonimosDelLote({ contestId: CONTEST, batchId: "lote-1", entradas: entradas(40) });
  const b = codigosAnonimosDelLote({ contestId: CONTEST, batchId: "lote-2", entradas: entradas(40) });
  const iguales = [...a.entries()].filter(([id, codigo]) => b.get(id) === codigo).length;
  assert.ok(iguales < 40, "los dos lotes dieron exactamente los mismos códigos");
});

/** La función vieja se conserva sólo para no romper lo ya escrito. */
test("el código de a uno sigue existiendo", () => {
  const codigo = buildAnonymousJuryCode({
    contestId: CONTEST,
    categoryId: "cat",
    entryId: "e1",
    batchId: BATCH,
    categorySlug: "general",
  });
  assert.match(codigo, /^GENERA-\d{4}$/);
});
