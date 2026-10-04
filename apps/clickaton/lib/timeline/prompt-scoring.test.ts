import assert from "node:assert/strict";
import test from "node:test";

import {
  countScoringPrompts,
  filterExtraPrompts,
  filterScoringPrompts,
  isScoringPrompt,
} from "./prompt-scoring";

/** Las 10 del concurso más Claroscuro, la sorpresa extra que no puntúa. */
const EDICION_1 = [
  { sequence: 1, title: "Primavera", countsForScoring: true },
  { sequence: 2, title: "Mi lugar", countsForScoring: true },
  { sequence: 3, title: "Movimiento", countsForScoring: true },
  { sequence: 4, title: "Sombras", countsForScoring: true },
  { sequence: 5, title: "Aromas", countsForScoring: true },
  { sequence: 6, title: "Lo invisible", countsForScoring: true },
  { sequence: 7, title: "Década del '80", countsForScoring: true },
  { sequence: 8, title: "Geometría", countsForScoring: true },
  { sequence: 9, title: "Detalles", countsForScoring: true },
  { sequence: 10, title: "Titanic", countsForScoring: true },
  { sequence: 11, title: "Claroscuro", countsForScoring: false },
];

test("una consigna común puntúa", () => {
  assert.equal(isScoringPrompt({ countsForScoring: true }), true);
});

test("la sorpresa extra no puntúa", () => {
  assert.equal(isScoringPrompt({ countsForScoring: false }), false);
});

test("el jurado recibe las 10, no las 11", () => {
  const paraJurado = filterScoringPrompts(EDICION_1);
  assert.equal(paraJurado.length, 10);
  assert.ok(!paraJurado.some((p) => p.title === "Claroscuro"));
});

test("el denominador del reglamento sigue siendo 10 con la consigna extra cargada", () => {
  assert.equal(countScoringPrompts(EDICION_1), 10);
});

test("la consigna extra se puede nombrar aparte", () => {
  const extra = filterExtraPrompts(EDICION_1);
  assert.deepEqual(
    extra.map((p) => p.title),
    ["Claroscuro"],
  );
});

test("una edición sin consignas extra no cambia de comportamiento", () => {
  const soloConcurso = EDICION_1.filter((p) => p.countsForScoring);
  assert.equal(countScoringPrompts(soloConcurso), 10);
  assert.deepEqual(filterExtraPrompts(soloConcurso), []);
});

test("sin consignas no rompe", () => {
  assert.equal(countScoringPrompts([]), 0);
  assert.deepEqual(filterScoringPrompts([]), []);
});
