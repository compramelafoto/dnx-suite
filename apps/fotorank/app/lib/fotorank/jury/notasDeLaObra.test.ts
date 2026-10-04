import test from "node:test";
import assert from "node:assert/strict";

import {
  PASOS_QUE_SE_RECUERDAN,
  apilar,
  borrarTodo,
  desapilar,
  ponerNota,
  sacarNota,
  sonIguales,
  type PasoAtras,
} from "./notasDeLaObra";

/* ---------- poner una nota ---------- */

test("poner una nota en un criterio vacío", () => {
  assert.deepEqual(ponerNota({}, "prompt_fit", 7), { prompt_fit: 7 });
});

test("poner otra nota la reemplaza", () => {
  assert.deepEqual(ponerNota({ prompt_fit: 3 }, "prompt_fit", 7), {
    prompt_fit: 7,
  });
});

/**
 * El defecto que encontró el dueño calificando: con el segundo criterio
 * seleccionado, tocar el 7 del primero cambiaba la nota del segundo. Acá el
 * criterio se nombra y no se deduce, así que no hay manera de errarle.
 */
test("la nota cae en el criterio que se nombra, no en otro", () => {
  const antes = { composition_technique: 4 };
  assert.deepEqual(ponerNota(antes, "prompt_fit", 7), {
    composition_technique: 4,
    prompt_fit: 7,
  });
});

test("elegir de nuevo la misma nota la saca", () => {
  assert.deepEqual(
    ponerNota({ prompt_fit: 7, visual_impact: 2 }, "prompt_fit", 7),
    {
      visual_impact: 2,
    },
  );
});

test("poner no modifica el objeto que recibe", () => {
  const antes = { prompt_fit: 3 };
  ponerNota(antes, "prompt_fit", 9);
  assert.deepEqual(antes, { prompt_fit: 3 });
});

/* ---------- sacar ---------- */

test("sacar una nota deja las otras", () => {
  assert.deepEqual(sacarNota({ a: 1, b: 2 }, "a"), { b: 2 });
});

test("sacar lo que no está no rompe nada", () => {
  const antes = { a: 1 };
  assert.equal(sacarNota(antes, "b"), antes);
});

test("borrar todo deja la obra sin ninguna nota", () => {
  assert.deepEqual(borrarTodo(), {});
});

/* ---------- comparar ---------- */

test("dos juegos con las mismas notas son iguales", () => {
  assert.equal(sonIguales({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
});

test("una nota de diferencia ya no es igual", () => {
  assert.equal(sonIguales({ a: 1 }, { a: 2 }), false);
  assert.equal(sonIguales({ a: 1 }, { a: 1, b: 2 }), false);
});

/* ---------- volver atrás ---------- */

function paso(entryId: string, notas: Record<string, number>): PasoAtras {
  return { entryId, notas };
}

test("deshacer devuelve el último estado apilado", () => {
  const pila = apilar(apilar([], paso("1", {})), paso("1", { a: 5 }));
  const r = desapilar(pila);
  assert.deepEqual(r?.paso, paso("1", { a: 5 }));
  assert.equal(r?.resto.length, 1);
});

test("deshacer dos veces llega hasta el principio", () => {
  let pila = apilar([], paso("1", {}));
  pila = apilar(pila, paso("1", { a: 5 }));
  const uno = desapilar(pila)!;
  const dos = desapilar(uno.resto)!;
  assert.deepEqual(dos.paso.notas, {});
  assert.equal(dos.resto.length, 0);
});

test("sin nada apilado no hay nada que deshacer", () => {
  assert.equal(desapilar([]), null);
});

/** Deshacer sirve para arreglar un desliz; recordar la sesión entera no. */
test("la pila se queda con los últimos pasos y suelta los viejos", () => {
  let pila: PasoAtras[] = [];
  for (let i = 0; i < PASOS_QUE_SE_RECUERDAN + 10; i += 1) {
    pila = apilar(pila, paso("1", { a: i }));
  }
  assert.equal(pila.length, PASOS_QUE_SE_RECUERDAN);
  assert.deepEqual(pila[0]?.notas, { a: 10 });
  assert.deepEqual(pila[pila.length - 1]?.notas, {
    a: PASOS_QUE_SE_RECUERDAN + 9,
  });
});

test("deshacer recuerda de qué obra era cada paso", () => {
  const pila = apilar(
    apilar([], paso("foto-1", { a: 1 })),
    paso("foto-2", { b: 2 }),
  );
  assert.equal(desapilar(pila)?.paso.entryId, "foto-2");
});
