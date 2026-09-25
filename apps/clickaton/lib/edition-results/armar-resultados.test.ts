import assert from "node:assert/strict";
import test from "node:test";

import {
  armarResultados,
  porConsigna,
  REGLA_DE_FABRICA_DE_MARATON,
  type NotaDeJurado,
  type ObraCongelada,
} from "./armar-resultados";

const regla = { ...REGLA_DE_FABRICA_DE_MARATON, minimumValidEvaluations: 3 };

function obra(n: number, consigna: string): ObraCongelada {
  return {
    snapshotId: `s${n}`,
    anonymousCode: `GENERA-000${n}`,
    categoryId: "cat",
    promptExternalId: consigna,
    admissionStatus: "FROZEN_FOR_JURY",
    entryStatus: "SUBMITTED",
  };
}

function nota(snapshotId: string, total: number, status = "SUBMITTED"): NotaDeJurado {
  return {
    snapshotId,
    status,
    totalScore: total,
    normalizedScore: total / 10,
    priorityCriterionScore: null,
  };
}

test("el parcial le da puesto a una obra con una sola mirada enviada", () => {
  const r = armarResultados({
    obras: [obra(1, "c1"), obra(2, "c1"), obra(3, "c1")],
    notas: [nota("s1", 6), nota("s2", 8), nota("s2", 9)],
    regla,
    loteFinal: null,
  });
  assert.equal(r.modo, "PARCIAL");
  assert.deepEqual(
    r.filas.map((f) => [f.anonymousCode, f.puesto, f.miradas]),
    [
      ["GENERA-0002", 1, 2],
      ["GENERA-0001", 2, 1],
      ["GENERA-0003", null, 0],
    ],
  );
  assert.equal(r.miradasPorObra, 3);
});

test("el parcial ignora las notas que el jurado no envió", () => {
  const r = armarResultados({
    obras: [obra(1, "c1"), obra(2, "c1")],
    notas: [nota("s1", 5), nota("s2", 10, "IN_PROGRESS")],
    regla,
    loteFinal: null,
  });
  assert.equal(r.filas[0]?.anonymousCode, "GENERA-0001");
  assert.equal(r.filas[1]?.puesto, null);
});

test("cada consigna tiene su propio ranking", () => {
  const r = armarResultados({
    obras: [obra(1, "c1"), obra(2, "c2")],
    notas: [nota("s1", 5), nota("s2", 7)],
    regla,
    loteFinal: null,
  });
  const grupos = porConsigna(r.filas, [{ id: "c1" }, { id: "c2" }]);
  assert.deepEqual(
    grupos.map((g) => [g.consignaId, g.filas.map((f) => f.puesto)]),
    [
      ["c1", [1]],
      ["c2", [1]],
    ],
  );
});

test("con lote final manda el puesto final, no el cálculo en vivo", () => {
  const r = armarResultados({
    obras: [obra(1, "c1"), obra(2, "c1")],
    notas: [nota("s1", 10), nota("s2", 1)],
    regla,
    loteFinal: [
      {
        snapshotId: "s1",
        aggregateScore: 7,
        evaluationCount: 3,
        preliminaryPosition: 1,
        finalPosition: 2,
        awardType: "SECOND_PLACE",
        resultStatus: "RANKED",
      },
      {
        snapshotId: "s2",
        aggregateScore: 7,
        evaluationCount: 3,
        preliminaryPosition: 1,
        finalPosition: 1,
        awardType: "FIRST_PLACE",
        resultStatus: "RANKED",
      },
    ],
  });
  assert.equal(r.modo, "FINAL");
  assert.deepEqual(
    r.filas.map((f) => [f.anonymousCode, f.puesto, f.premio]),
    [
      ["GENERA-0002", 1, "FIRST_PLACE"],
      ["GENERA-0001", 2, "SECOND_PLACE"],
    ],
  );
});
