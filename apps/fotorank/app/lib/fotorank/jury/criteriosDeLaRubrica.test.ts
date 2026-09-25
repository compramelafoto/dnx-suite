import test from "node:test";
import assert from "node:assert/strict";

import {
  CLICKATON_MIN_EVALUACIONES_POR_OBRA,
  criteriosParaConcurso,
  minimoDeEvaluacionesPorObra,
} from "./criteriosDeLaRubrica";

const CLICKATON = { slug: "clickaton-argentina-2026", distributionChannel: "CLICKATON" };
const SANTA_FE = { slug: "santa-fe-en-foco", distributionChannel: null };
const OTRO = { slug: "concurso-cualquiera", distributionChannel: null };

/**
 * El tapón: en producción la rúbrica nacía vacía y no había pantalla para
 * cargarle criterios, así que nunca se podía activar ni abrir el juzgamiento.
 */
test("una maratón de Clickatón nace con los 4 criterios de las bases", () => {
  const criterios = criteriosParaConcurso({ ...CLICKATON, esProduccion: true });
  assert.ok(criterios, "no puede quedar vacía en producción");
  assert.equal(criterios.length, 4);
});

test("los criterios de Clickatón van del 1 al 10", () => {
  const criterios = criteriosParaConcurso({ ...CLICKATON, esProduccion: true })!;
  for (const c of criterios) {
    assert.equal(c.minScore, 1, `${c.key} tiene que empezar en 1`);
    assert.equal(c.maxScore, 10, `${c.key} tiene que llegar a 10`);
    assert.equal(c.step, 1);
    assert.equal(c.required, true, `${c.key} no puede ser optativo`);
  }
});

test("los cuatro criterios pesan lo mismo", () => {
  const criterios = criteriosParaConcurso({ ...CLICKATON, esProduccion: true })!;
  const pesos = new Set(criterios.map((c) => c.weight));
  assert.equal(pesos.size, 1, "ninguno puede pesar más que otro");
});

test("son los criterios que dicen las bases, no otros", () => {
  const criterios = criteriosParaConcurso({ ...CLICKATON, esProduccion: true })!;
  assert.deepEqual(
    criterios.map((c) => c.key),
    ["prompt_fit", "composition_technique", "creativity_originality", "visual_impact"],
  );
});

test("cada criterio se explica: el jurado no adivina qué mirar", () => {
  const criterios = criteriosParaConcurso({ ...CLICKATON, esProduccion: true })!;
  for (const c of criterios) {
    assert.ok(c.name.length > 0, "sin nombre no se puede calificar");
    assert.ok((c.description ?? "").length > 0, `${c.key} tiene que decir qué se mira`);
  }
});

test("el orden es estable y sin repetidos", () => {
  const criterios = criteriosParaConcurso({ ...CLICKATON, esProduccion: true })!;
  const orden = criterios.map((c) => c.sortOrder);
  assert.deepEqual([...orden].sort((a, b) => a - b), orden, "vienen desordenados");
  assert.equal(new Set(orden).size, orden.length, "dos criterios en la misma posición");
  assert.equal(new Set(criterios.map((c) => c.key)).size, 4, "hay claves repetidas");
});

test("Santa Fe conserva su propia rúbrica", () => {
  const criterios = criteriosParaConcurso({ ...SANTA_FE, esProduccion: true });
  assert.ok(criterios);
  assert.equal(criterios.length, 5);
});

test("cualquier otro concurso en producción sigue naciendo vacío", () => {
  assert.equal(criteriosParaConcurso({ ...OTRO, esProduccion: true }), null);
});

test("fuera de producción hay criterios de ejemplo para probar", () => {
  const criterios = criteriosParaConcurso({ ...OTRO, esProduccion: false });
  assert.ok(criterios && criterios.length > 0);
});

/**
 * Tres miradas por obra: es lo que necesita el desempate que ya está escrito
 * —mediana y dispersión— para decir algo. Con dos no hay mediana útil.
 */
test("cada obra la miran 3 jurados cuando hay 3 o más", () => {
  assert.equal(CLICKATON_MIN_EVALUACIONES_POR_OBRA, 3);
  assert.equal(minimoDeEvaluacionesPorObra(3), 3);
  assert.equal(minimoDeEvaluacionesPorObra(5), 3);
  assert.equal(minimoDeEvaluacionesPorObra(12), 3);
});

test("con menos de 3 jurados la miran todos los que haya", () => {
  assert.equal(minimoDeEvaluacionesPorObra(1), 1);
  assert.equal(minimoDeEvaluacionesPorObra(2), 2);
});

test("sin jurados el mínimo no puede ser cero", () => {
  assert.equal(minimoDeEvaluacionesPorObra(0), 1);
  assert.equal(minimoDeEvaluacionesPorObra(-3), 1);
});
