import test from "node:test";
import assert from "node:assert/strict";

import { caminoDeEvaluacion, MOTIVO_DEL_CAMINO_VIEJO } from "./caminoDeEvaluacion";

/**
 * El defecto que vio el dueño al entrar con la cuenta de una jurado: el panel
 * tenía dos botones y el destacado llevaba al motor viejo. Ahí la pantalla
 * mostraba las 270 obras de la categoría —en vez de las 170 de su vacante— y
 * pedía un puntaje único en lugar de los cuatro criterios de la rúbrica.
 */
test("con lote congelado va al camino de la rúbrica", () => {
  const camino = caminoDeEvaluacion({
    hayLoteCongelado: true,
    contestId: "ck-contest",
    assignmentId: "asig-1",
  });
  assert.equal(camino.href, "/jurado/concursos/ck-contest");
});

test("sin lote congelado sigue el camino de siempre", () => {
  const camino = caminoDeEvaluacion({
    hayLoteCongelado: false,
    contestId: "otro-concurso",
    assignmentId: "asig-9",
  });
  assert.equal(camino.href, "/jurado/asignaciones/asig-9/evaluar");
});

test("el botón dice lo mismo en los dos casos", () => {
  const a = caminoDeEvaluacion({ hayLoteCongelado: true, contestId: "c", assignmentId: "a" });
  const b = caminoDeEvaluacion({ hayLoteCongelado: false, contestId: "c", assignmentId: "a" });
  assert.equal(a.etiqueta, b.etiqueta);
  assert.match(a.etiqueta, /calificar/i);
});

test("sólo el camino de la rúbrica respeta el reparto", () => {
  assert.equal(
    caminoDeEvaluacion({ hayLoteCongelado: true, contestId: "c", assignmentId: "a" })
      .respetaElReparto,
    true,
  );
  assert.equal(
    caminoDeEvaluacion({ hayLoteCongelado: false, contestId: "c", assignmentId: "a" })
      .respetaElReparto,
    false,
  );
});

test("el motivo explica por qué el camino viejo no sirve con lote congelado", () => {
  assert.match(MOTIVO_DEL_CAMINO_VIEJO, /reparto|vacante/i);
});
