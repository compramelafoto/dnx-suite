/**
 * Reordenar parece trivial hasta que quedan huecos, empates o dos imágenes con
 * el mismo número. Entonces la galería se ordena distinto en cada recarga.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { moverImagen, ordenTrasBorrar, ordenParaNueva } from "./portfolioOrder";

const tres = () => [
  { id: "a", sortOrder: 0 },
  { id: "b", sortOrder: 1 },
  { id: "c", sortOrder: 2 },
];

test("subir la del medio la pone primera", () => {
  assert.deepEqual(moverImagen(tres(), "b", "arriba"), [
    { id: "b", sortOrder: 0 },
    { id: "a", sortOrder: 1 },
    { id: "c", sortOrder: 2 },
  ]);
});

test("bajar la del medio la pone última", () => {
  assert.deepEqual(moverImagen(tres(), "b", "abajo"), [
    { id: "a", sortOrder: 0 },
    { id: "c", sortOrder: 1 },
    { id: "b", sortOrder: 2 },
  ]);
});

test("subir la primera no hace nada, y no rompe el orden", () => {
  assert.deepEqual(moverImagen(tres(), "a", "arriba"), tres());
});

test("bajar la última no hace nada", () => {
  assert.deepEqual(moverImagen(tres(), "c", "abajo"), tres());
});

test("mover una que no existe deja todo como estaba", () => {
  assert.deepEqual(moverImagen(tres(), "zzz", "arriba"), tres());
});

test("borrar la del medio no deja huecos", () => {
  assert.deepEqual(ordenTrasBorrar(tres(), "b"), [
    { id: "a", sortOrder: 0 },
    { id: "c", sortOrder: 1 },
  ]);
});

test("un orden desordenado o con empates se normaliza", () => {
  const roto = [
    { id: "a", sortOrder: 5 },
    { id: "b", sortOrder: 5 },
    { id: "c", sortOrder: 0 },
  ];
  const arreglado = moverImagen(roto, "c", "abajo");
  assert.deepEqual(
    arreglado.map((i) => i.sortOrder),
    [0, 1, 2],
    "los números tienen que quedar contiguos desde 0",
  );
});

test("una imagen nueva va al final", () => {
  assert.equal(ordenParaNueva(3), 3);
  assert.equal(ordenParaNueva(0), 0);
});

test("una cantidad imposible no produce un orden negativo", () => {
  assert.equal(ordenParaNueva(-1), 0);
});
