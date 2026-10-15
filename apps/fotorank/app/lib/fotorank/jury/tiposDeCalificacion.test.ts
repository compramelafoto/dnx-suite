import assert from "node:assert/strict";
import test from "node:test";

import { computeWeightedScore } from "./scoring-engine";
import {
  CLAVE_SELECCION,
  cupoDeLaSesion,
  leerConfiguracion,
  rubricaParaTipo,
  tipoDeLaRubrica,
} from "./tiposDeCalificacion";

const CRITERIOS = [
  { key: "a", name: "A", description: null, weight: 60, minScore: 1, maxScore: 10, step: 1, required: true, sortOrder: 10 },
  { key: "b", name: "B", description: null, weight: 40, minScore: 1, maxScore: 10, step: 1, required: true, sortOrder: 20 },
];

test("criterios sin criterios cargados no arma rúbrica", () => {
  assert.equal(rubricaParaTipo({ tipo: "CRITERIOS" }, null), null);
  assert.equal(rubricaParaTipo({ tipo: "CRITERIOS" }, CRITERIOS)?.modo, "WEIGHTED_SCORE");
});

test("nota única es un criterio con la escala elegida", () => {
  const r = rubricaParaTipo({ tipo: "NOTA_UNICA", escala: "0_100" }, null)!;
  assert.equal(r.criterios.length, 1);
  assert.equal(r.criterios[0]!.minScore, 0);
  assert.equal(r.criterios[0]!.maxScore, 100);
});

test("sí o no y elegir con cupo son un criterio 0–1", () => {
  const r = rubricaParaTipo({ tipo: "SELECCION_CON_CUPO", cupo: 5 }, null)!;
  assert.equal(r.modo, "APPROVAL");
  assert.equal(r.criterios[0]!.key, CLAVE_SELECCION);
  assert.equal(r.criterios[0]!.maxScore, 1);
});

test("el motor de siempre calcula bien cada tipo", () => {
  const si = rubricaParaTipo({ tipo: "SI_NO" }, null)!;
  const conSi = computeWeightedScore({ criteria: si.criterios, scores: [{ key: CLAVE_SELECCION, score: 1 }] });
  const conNo = computeWeightedScore({ criteria: si.criterios, scores: [{ key: CLAVE_SELECCION, score: 0 }] });
  assert.ok(conSi.ok && conNo.ok);
  if (conSi.ok && conNo.ok) {
    assert.equal(conSi.normalizedScore, 1);
    assert.equal(conNo.normalizedScore, 0);
  }
  const nota = rubricaParaTipo({ tipo: "NOTA_UNICA", escala: "1_5" }, null)!;
  const cuatro = computeWeightedScore({ criteria: nota.criterios, scores: [{ key: "nota", score: 4 }] });
  assert.ok(cuatro.ok && cuatro.normalizedScore === 0.8);
  const fuera = computeWeightedScore({ criteria: nota.criterios, scores: [{ key: "nota", score: 7 }], requireAllRequired: true });
  assert.equal(fuera.ok, false, "una nota fuera de escala se rechaza");
});

test("el tipo se reconstruye desde la rúbrica guardada", () => {
  for (const c of [
    { tipo: "CRITERIOS" as const },
    { tipo: "NOTA_UNICA" as const, escala: "1_10" as const },
    { tipo: "SI_NO" as const },
    { tipo: "SELECCION_CON_CUPO" as const, cupo: 12 },
  ]) {
    const r = rubricaParaTipo(c, CRITERIOS)!;
    const vuelta = tipoDeLaRubrica({
      modo: r.modo,
      criterios: r.criterios,
      cupo: c.tipo === "SELECCION_CON_CUPO" ? c.cupo : null,
    });
    assert.deepEqual(vuelta, c);
  }
});

test("el formulario valida escala y cupo", () => {
  assert.ok("error" in leerConfiguracion({ tipo: "NOTA_UNICA", escala: "3_7" }));
  assert.ok("error" in leerConfiguracion({ tipo: "SELECCION_CON_CUPO", cupo: "0" }));
  assert.deepEqual(leerConfiguracion({ tipo: "SELECCION_CON_CUPO", cupo: "8" }), { tipo: "SELECCION_CON_CUPO", cupo: 8 });
  assert.equal(cupoDeLaSesion({ cupoDeSeleccion: 8 }), 8);
  assert.equal(cupoDeLaSesion({}), null);
});
