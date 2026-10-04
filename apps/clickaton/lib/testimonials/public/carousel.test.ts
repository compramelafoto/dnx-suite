import assert from "node:assert/strict";
import { test } from "node:test";
import { nextSlideIndex, shuffleForDisplay } from "./carousel";

const cinco = ["a", "b", "c", "d", "e"];

test("el barajado no pierde ni repite ninguno", () => {
  const salida = shuffleForDisplay(cinco, () => 0.42);
  assert.equal(salida.length, cinco.length);
  assert.deepEqual([...salida].sort(), [...cinco].sort());
});

test("el barajado no toca la lista original", () => {
  const original = [...cinco];
  shuffleForDisplay(cinco, Math.random);
  assert.deepEqual(cinco, original);
});

test("con el mismo azar, el orden es el mismo", () => {
  const azarFijo = () => 0.7;
  assert.deepEqual(
    shuffleForDisplay(cinco, azarFijo),
    shuffleForDisplay(cinco, azarFijo),
  );
});

test("con azar distinto, el orden cambia", () => {
  // Con 5 elementos, dos recorridos opuestos no pueden dar lo mismo.
  const a = shuffleForDisplay(cinco, () => 0);
  const b = shuffleForDisplay(cinco, () => 0.999);
  assert.notDeepEqual(a, b);
});

test("una lista de uno o vacía no rompe", () => {
  assert.deepEqual(shuffleForDisplay([], Math.random), []);
  assert.deepEqual(shuffleForDisplay(["solo"], Math.random), ["solo"]);
});

test("el carrusel avanza de a uno y vuelve al principio", () => {
  assert.equal(nextSlideIndex(0, 8), 1);
  assert.equal(nextSlideIndex(6, 8), 7);
  assert.equal(nextSlideIndex(7, 8), 0);
});

test("sin testimonios el índice se queda en cero y no divide por cero", () => {
  assert.equal(nextSlideIndex(0, 0), 0);
  assert.equal(nextSlideIndex(3, 1), 0);
});
