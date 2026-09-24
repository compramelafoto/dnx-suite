import test from "node:test";
import assert from "node:assert/strict";

import { MENSAJE_SIN_ACCESO_A_CLICKATON, elegirBase } from "./baseDelConcurso";

/**
 * El defecto que dejó el visor sin funcionar: todo el camino de la rúbrica leía
 * de la base de FotoRank, y las obras de una maratón están en la de Clickatón.
 * Para el concurso `ck-contest-argentina-2026` la base de FotoRank tiene cero
 * concursos, cero lotes, cero asignaciones y cero snapshots.
 */
test("un concurso que está en casa se lee en casa", () => {
  assert.equal(elegirBase({ estaEnLaBasePropia: true, hayClienteCruzado: true }), "PROPIA");
});

test("si no está en casa, se busca en Clickatón", () => {
  assert.equal(elegirBase({ estaEnLaBasePropia: false, hayClienteCruzado: true }), "CLICKATON");
});

/**
 * Sin el cliente cruzado configurado no se inventa nada: el concurso existe,
 * pero no hay forma de llegar. Decirlo es mejor que mostrar una pantalla vacía
 * que parece "no te asignaron nada".
 */
test("sin cliente cruzado y sin concurso propio, no hay acceso", () => {
  assert.equal(elegirBase({ estaEnLaBasePropia: false, hayClienteCruzado: false }), "SIN_ACCESO");
});

test("el concurso propio no necesita el cliente cruzado", () => {
  assert.equal(elegirBase({ estaEnLaBasePropia: true, hayClienteCruzado: false }), "PROPIA");
});

test("el mensaje de sin acceso nombra la configuración que falta", () => {
  assert.match(MENSAJE_SIN_ACCESO_A_CLICKATON, /configuraci|conexi/i);
});
