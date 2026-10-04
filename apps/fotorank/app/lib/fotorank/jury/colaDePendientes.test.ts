import test from "node:test";
import assert from "node:assert/strict";

import {
  aplicarPendientes,
  confirmar,
  cuantasEsperan,
  encolar,
  estaPendiente,
  fallo,
  leerCola,
  siguiente,
  type Pendiente,
} from "./colaDePendientes";

function pendiente(
  id: string,
  notas: Record<string, number>,
  extra: Partial<Pendiente> = {},
): Pendiente {
  return {
    snapshotId: `snap-${id}`,
    entryId: id,
    notas,
    momento: 1000,
    intentos: 0,
    ...extra,
  };
}

/* ---------- encolar ---------- */

test("la primera calificación entra en la cola", () => {
  const cola = encolar([], pendiente("1", { a: 7 }));
  assert.equal(cuantasEsperan(cola), 1);
});

/**
 * El servidor recibe la tanda completa en cada guardado: apilar los pasos
 * intermedios multiplicaría los envíos para el mismo resultado.
 */
test("una obra ocupa un solo lugar, con su último estado", () => {
  let cola = encolar([], pendiente("1", { a: 7 }));
  cola = encolar(cola, pendiente("1", { a: 7, b: 9 }));
  assert.equal(cuantasEsperan(cola), 1);
  assert.deepEqual(cola[0]?.notas, { a: 7, b: 9 });
});

test("dos obras distintas ocupan dos lugares", () => {
  let cola = encolar([], pendiente("1", { a: 7 }));
  cola = encolar(cola, pendiente("2", { a: 3 }));
  assert.equal(cuantasEsperan(cola), 2);
});

/** Guardar una calificación no puede borrar un comentario que nadie tocó. */
test("un comentario en la cola sobrevive a una calificación nueva", () => {
  let cola = encolar([], pendiente("1", { a: 7 }, { comentario: "buena luz" }));
  cola = encolar(cola, pendiente("1", { a: 7, b: 2 }));
  assert.equal(cola[0]?.comentario, "buena luz");
});

test("un comentario nuevo reemplaza al anterior", () => {
  let cola = encolar([], pendiente("1", { a: 7 }, { comentario: "buena luz" }));
  cola = encolar(cola, pendiente("1", { a: 7 }, { comentario: "" }));
  assert.equal(cola[0]?.comentario, "");
});

test("volver a encolar borra los intentos fallidos", () => {
  let cola = encolar([], pendiente("1", { a: 7 }));
  cola = fallo(cola, "snap-1");
  cola = encolar(cola, pendiente("1", { a: 8 }));
  assert.equal(cola[0]?.intentos, 0);
});

/* ---------- confirmar y fallar ---------- */

test("confirmar la saca de la cola", () => {
  const cola = confirmar(encolar([], pendiente("1", { a: 7 })), "snap-1");
  assert.equal(cuantasEsperan(cola), 0);
});

test("confirmar algo que no está no rompe nada", () => {
  const cola = confirmar(encolar([], pendiente("1", { a: 7 })), "snap-9");
  assert.equal(cuantasEsperan(cola), 1);
});

test("fallar la deja en la cola y le suma un intento", () => {
  const cola = fallo(encolar([], pendiente("1", { a: 7 })), "snap-1");
  assert.equal(cuantasEsperan(cola), 1);
  assert.equal(cola[0]?.intentos, 1);
});

/* ---------- a quién le toca ---------- */

test("sin cola no hay siguiente", () => {
  assert.equal(siguiente([]), null);
});

test("le toca al más viejo", () => {
  const cola = [
    pendiente("2", {}, { momento: 2000 }),
    pendiente("1", {}, { momento: 1000 }),
  ];
  assert.equal(siguiente(cola)?.entryId, "1");
});

/** Sin esto el visor se quedaría girando sobre la obra que no entra. */
test("el que ya falló cede el turno al que no falló", () => {
  const cola = [
    pendiente("1", {}, { momento: 1000, intentos: 3 }),
    pendiente("2", {}, { momento: 2000, intentos: 0 }),
  ];
  assert.equal(siguiente(cola)?.entryId, "2");
});

test("se sabe qué obra tiene algo sin confirmar", () => {
  const cola = encolar([], pendiente("7", { a: 1 }));
  assert.equal(estaPendiente(cola, "7"), true);
  assert.equal(estaPendiente(cola, "8"), false);
});

/* ---------- lo que quedó guardado en el aparato ---------- */

test("sin nada guardado la cola arranca vacía", () => {
  assert.deepEqual(leerCola(null), []);
  assert.deepEqual(leerCola(""), []);
});

test("una cola guardada se recupera entera", () => {
  const cola = encolar([], pendiente("1", { a: 7 }));
  assert.deepEqual(leerCola(JSON.stringify(cola)), cola);
});

/** Insistir con algo ilegible dejaría el visor trabado en cada arranque. */
test("una cola rota se descarta en silencio", () => {
  assert.deepEqual(leerCola("{no es json"), []);
  assert.deepEqual(leerCola('{"no":"es una lista"}'), []);
  assert.deepEqual(leerCola('[{"falta":"todo"}]'), []);
});

test("de una cola a medio romper se rescata lo que sirve", () => {
  const buena = pendiente("1", { a: 7 });
  const crudo = JSON.stringify([buena, { basura: true }]);
  assert.deepEqual(leerCola(crudo), [buena]);
});

/* ---------- lo pendiente pisa lo que vino del servidor ---------- */

const OBRAS = [
  { entryId: "1", notas: { a: 1 }, comentario: "" },
  { entryId: "2", notas: { a: 2 }, comentario: "viejo" },
];

test("sin pendientes las obras quedan como vinieron", () => {
  assert.equal(aplicarPendientes(OBRAS, []), OBRAS);
});

/**
 * Al volver a entrar, el servidor manda lo último que le llegó, que es lo
 * viejo. Si no se pisara, el jurado vería desaparecer su último trabajo.
 */
test("lo que quedó en el aparato pisa lo que trajo el servidor", () => {
  const cola = encolar([], pendiente("1", { a: 9, b: 4 }));
  const r = aplicarPendientes(OBRAS, cola);
  assert.deepEqual(r[0]?.notas, { a: 9, b: 4 });
  assert.deepEqual(r[1]?.notas, { a: 2 });
});

test("un pendiente sin comentario deja el que traía el servidor", () => {
  const cola = encolar([], pendiente("2", { a: 5 }));
  assert.equal(aplicarPendientes(OBRAS, cola)[1]?.comentario, "viejo");
});

test("un pendiente con comentario lo pisa", () => {
  const cola = encolar([], pendiente("2", { a: 5 }, { comentario: "nuevo" }));
  assert.equal(aplicarPendientes(OBRAS, cola)[1]?.comentario, "nuevo");
});
