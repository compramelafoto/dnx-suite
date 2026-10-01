import assert from "node:assert/strict";
import { test } from "node:test";

import { packSavingsArs } from "./pack-savings";

/**
 * El combo del Colegio Goethe: el Pack 3 es exactamente el Pack 1 más el Pack 2.
 * Comprarlos sueltos sale $48.944 y el combo $46.000, así que el ahorro real es
 * $2.944. Sin este cartel el padre no tiene forma de saber que conviene.
 */
const GOETHE = [
  { id: 60, price: 18584, benefits: [{ line: "1× Copia grupal" }] },
  { id: 61, price: 30360, benefits: [{ line: "1× Librito grupal" }] },
  {
    id: 62,
    price: 46000,
    benefits: [{ line: "1× Copia grupal" }, { line: "1× Librito grupal" }],
  },
];

test("combo: calcula el ahorro contra la suma de los packs sueltos", () => {
  assert.equal(packSavingsArs(GOETHE[2], GOETHE), 2944);
});

test("un pack suelto no tiene ahorro que mostrar", () => {
  assert.equal(packSavingsArs(GOETHE[0], GOETHE), null);
  assert.equal(packSavingsArs(GOETHE[1], GOETHE), null);
});

test("si falta una de las partes no inventamos un ahorro", () => {
  const packs = [
    { id: 1, price: 10000, benefits: [{ line: "1× Copia grupal" }] },
    {
      id: 2,
      price: 25000,
      benefits: [{ line: "1× Copia grupal" }, { line: "1× Librito grupal" }],
    },
  ];
  assert.equal(packSavingsArs(packs[1], packs), null);
});

test("si el combo sale igual o más caro que las partes, no se muestra nada", () => {
  const packs = [
    { id: 1, price: 10000, benefits: [{ line: "A" }] },
    { id: 2, price: 10000, benefits: [{ line: "B" }] },
    { id: 3, price: 20000, benefits: [{ line: "A" }, { line: "B" }] },
    { id: 4, price: 25000, benefits: [{ line: "A" }, { line: "B" }] },
  ];
  assert.equal(packSavingsArs(packs[2], packs), null);
  assert.equal(packSavingsArs(packs[3], packs), null);
});

test("un beneficio repetido se cuenta las veces que aparece", () => {
  const packs = [
    { id: 1, price: 10000, benefits: [{ line: "1× Copia grupal" }] },
    {
      id: 2,
      price: 17000,
      benefits: [{ line: "1× Copia grupal" }, { line: "1× Copia grupal" }],
    },
  ];
  assert.equal(packSavingsArs(packs[1], packs), 3000);
});

test("entre dos packs sueltos iguales toma el más barato", () => {
  const packs = [
    { id: 1, price: 12000, benefits: [{ line: "A" }] },
    { id: 2, price: 10000, benefits: [{ line: "A" }] },
    { id: 3, price: 30000, benefits: [{ line: "B" }] },
    { id: 4, price: 35000, benefits: [{ line: "A" }, { line: "B" }] },
  ];
  assert.equal(packSavingsArs(packs[3], packs), 5000);
});

test("un pack sin beneficios no rompe nada", () => {
  const packs = [{ id: 1, price: 1000, benefits: [] }];
  assert.equal(packSavingsArs(packs[0], packs), null);
});
