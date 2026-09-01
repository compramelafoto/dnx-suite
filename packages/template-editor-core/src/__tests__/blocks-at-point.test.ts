import assert from "node:assert/strict";
import { test } from "node:test";
import { blocksAtPoint, nextBlockInStack } from "../blocks-at-point";
import type { TemplateV2Block } from "../render-core";

const b = (
  id: string,
  zIndex: number,
  over: Partial<TemplateV2Block["layout"]> = {},
  pageIndex = 0,
): TemplateV2Block => ({
  id,
  type: "SHAPE",
  pageIndex,
  layout: {
    x: 0, y: 0, width: 100, height: 100,
    rotation: 0, zIndex, opacity: 1, visible: true, locked: false,
    ...over,
  },
  configJson: {},
});

/** El caso real: un fondo que ocupa la hoja y cosas encima. */
const FONDO = b("fondo", 0, { width: 600, height: 800 });
const TEXTO = b("texto", 5, { x: 50, y: 50, width: 200, height: 40 });
const FOTO = b("foto", 9, { x: 60, y: 55, width: 60, height: 60 });

test("devuelve los bloques bajo el punto, de arriba hacia abajo", () => {
  const r = blocksAtPoint([FONDO, TEXTO, FOTO], 80, 70);
  assert.deepEqual(r.map((x) => x.id), ["foto", "texto", "fondo"]);
});

test("fuera de un bloque, ese bloque no aparece", () => {
  const r = blocksAtPoint([FONDO, TEXTO, FOTO], 400, 400);
  assert.deepEqual(r.map((x) => x.id), ["fondo"]);
});

test("los bloqueados y los ocultos no entran en la ronda", () => {
  const bloqueado = b("bloqueado", 20, { locked: true });
  const oculto = b("oculto", 30, { visible: false });
  const r = blocksAtPoint([FONDO, bloqueado, oculto], 10, 10);
  assert.deepEqual(r.map((x) => x.id), ["fondo"]);
});

test("solo mira la hoja que se está editando", () => {
  const dorso = b("dorso", 50, {}, 1);
  assert.deepEqual(blocksAtPoint([FONDO, dorso], 10, 10, 0).map((x) => x.id), ["fondo"]);
  assert.deepEqual(blocksAtPoint([FONDO, dorso], 10, 10, 1).map((x) => x.id), ["dorso"]);
});

test("sin nada seleccionado, toma el de más arriba", () => {
  const pila = blocksAtPoint([FONDO, TEXTO, FOTO], 80, 70);
  assert.equal(nextBlockInStack(pila, null)?.id, "foto");
});

test("cada clic baja un nivel", () => {
  const pila = blocksAtPoint([FONDO, TEXTO, FOTO], 80, 70);
  assert.equal(nextBlockInStack(pila, "foto")?.id, "texto");
  assert.equal(nextBlockInStack(pila, "texto")?.id, "fondo");
});

test("al llegar al fondo vuelve al tope", () => {
  /*
   * Cortar la ronda dejaría a alguien apretando sin que pase nada, sin saber si llegó al final
   * o si la tecla dejó de funcionar.
   */
  const pila = blocksAtPoint([FONDO, TEXTO, FOTO], 80, 70);
  assert.equal(nextBlockInStack(pila, "fondo")?.id, "foto");
});

test("si lo seleccionado no está bajo el punto, empieza una ronda nueva", () => {
  const pila = blocksAtPoint([FONDO, TEXTO, FOTO], 80, 70);
  assert.equal(nextBlockInStack(pila, "otro-que-no-esta")?.id, "foto");
});

test("sin bloques bajo el punto no devuelve nada", () => {
  assert.equal(nextBlockInStack([], "foto"), null);
});
