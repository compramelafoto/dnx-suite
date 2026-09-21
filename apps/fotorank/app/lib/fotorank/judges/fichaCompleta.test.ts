/**
 * El directorio ordena por qué tan completa está la ficha. No es un ranking de
 * calidad —eso exigiría reseñas— sino de utilidad para quien busca: una ficha
 * vacía no ayuda a nadie y no merece el primer lugar.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { puntajeDeFicha, PUNTAJE_MAXIMO } from "./fichaCompleta";

const vacia = {
  tieneFoto: false,
  cantidadDePortfolio: 0,
  titular: null,
  bio: null,
  aniosDeExperiencia: null,
  especialidades: [] as string[],
};

const completa = {
  tieneFoto: true,
  cantidadDePortfolio: 3,
  titular: "Fotógrafa documental",
  bio: "a".repeat(120),
  aniosDeExperiencia: 10,
  especialidades: ["documental"],
};

test("una ficha vacía no suma nada", () => {
  assert.equal(puntajeDeFicha(vacia), 0);
});

test("una ficha completa llega al máximo", () => {
  assert.equal(puntajeDeFicha(completa), PUNTAJE_MAXIMO);
  assert.equal(PUNTAJE_MAXIMO, 6);
});

test("con menos de tres fotos el portfolio no suma", () => {
  assert.equal(puntajeDeFicha({ ...completa, cantidadDePortfolio: 2 }), PUNTAJE_MAXIMO - 1);
  assert.equal(puntajeDeFicha({ ...completa, cantidadDePortfolio: 3 }), PUNTAJE_MAXIMO);
});

test("una bio corta no suma", () => {
  assert.equal(puntajeDeFicha({ ...completa, bio: "Soy fotógrafa." }), PUNTAJE_MAXIMO - 1);
});

test("cero años de experiencia SÍ suma: es un dato declarado", () => {
  assert.equal(puntajeDeFicha({ ...completa, aniosDeExperiencia: 0 }), PUNTAJE_MAXIMO);
  assert.equal(puntajeDeFicha({ ...completa, aniosDeExperiencia: null }), PUNTAJE_MAXIMO - 1);
});

test("un titular en blanco no suma", () => {
  assert.equal(puntajeDeFicha({ ...completa, titular: "   " }), PUNTAJE_MAXIMO - 1);
});

test("sin especialidades no suma", () => {
  assert.equal(puntajeDeFicha({ ...completa, especialidades: [] }), PUNTAJE_MAXIMO - 1);
});

test("el puntaje nunca se pasa del máximo ni baja de cero", () => {
  const exagerada = { ...completa, cantidadDePortfolio: 12, especialidades: ["a", "b", "c"] };
  assert.equal(puntajeDeFicha(exagerada), PUNTAJE_MAXIMO);
  assert.ok(puntajeDeFicha(vacia) >= 0);
});
