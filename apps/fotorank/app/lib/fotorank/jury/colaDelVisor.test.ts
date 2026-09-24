import test from "node:test";
import assert from "node:assert/strict";

import {
  ESTADOS_DE_OBRA,
  estadoDeLaObra,
  laSiguiente,
  obrasVisibles,
  resumenDeLaCola,
  type ObraEnElVisor,
} from "./colaDelVisor";

const CRITERIOS = ["prompt_fit", "composition_technique", "creativity_originality", "visual_impact"];

function obra(id: string, consigna: number, notas: Record<string, number> = {}): ObraEnElVisor {
  return {
    entryId: id,
    snapshotId: `snap-${id}`,
    codigo: `GENERA-${id}`,
    consignaNumero: consigna,
    consignaTitulo: `Consigna ${consigna}`,
    previewUrl: `/preview/${id}`,
    notas,
    enviada: false,
  };
}

function completa(id: string, consigna: number): ObraEnElVisor {
  return obra(id, consigna, {
    prompt_fit: 8,
    composition_technique: 7,
    creativity_originality: 9,
    visual_impact: 8,
  });
}

/* ---------- el estado de cada obra ---------- */

test("sin ninguna nota está sin calificar", () => {
  assert.equal(estadoDeLaObra(obra("1", 3), CRITERIOS), "SIN_CALIFICAR");
});

test("con todas las notas está calificada", () => {
  assert.equal(estadoDeLaObra(completa("1", 3), CRITERIOS), "CALIFICADA");
});

/**
 * Las que tienen algo puesto y algo faltando son las que se pierden si nadie
 * avisa: no cuentan para el resultado y el jurado cree que las hizo.
 */
test("con algunas notas está sin terminar", () => {
  const a = obra("1", 3, { prompt_fit: 8, composition_technique: 7 });
  assert.equal(estadoDeLaObra(a, CRITERIOS), "SIN_TERMINAR");
});

test("una nota de más no la rompe", () => {
  const a = obra("1", 3, { ...completa("1", 3).notas, criterio_viejo: 5 });
  assert.equal(estadoDeLaObra(a, CRITERIOS), "CALIFICADA");
});

test("sin criterios definidos ninguna obra queda calificada", () => {
  assert.equal(estadoDeLaObra(completa("1", 3), []), "SIN_CALIFICAR");
});

/* ---------- el resumen ---------- */

test("el resumen cuenta las tres pilas", () => {
  const r = resumenDeLaCola(
    [
      completa("1", 3),
      completa("2", 3),
      obra("3", 3, { prompt_fit: 5 }),
      obra("4", 4),
      obra("5", 4),
    ],
    CRITERIOS,
  );
  assert.deepEqual(r, { total: 5, calificadas: 2, sinCalificar: 2, sinTerminar: 1, faltan: 3 });
});

test("una cola vacía no rompe el resumen", () => {
  assert.deepEqual(resumenDeLaCola([], CRITERIOS), {
    total: 0,
    calificadas: 0,
    sinCalificar: 0,
    sinTerminar: 0,
    faltan: 0,
  });
});

/* ---------- el filtro ---------- */

const COLA = [completa("1", 3), obra("2", 3, { prompt_fit: 5 }), obra("3", 3), obra("4", 4)];

test("el filtro de todas muestra todo, de la consigna elegida", () => {
  const v = obrasVisibles(COLA, CRITERIOS, { consigna: 3, filtro: "TODAS" });
  assert.equal(v.length, 3);
});

test("sin calificar deja sólo las que no tienen nada", () => {
  const v = obrasVisibles(COLA, CRITERIOS, { consigna: 3, filtro: "SIN_CALIFICAR" });
  assert.deepEqual(v.map((o) => o.entryId), ["3"]);
});

test("sin terminar deja las que quedaron a medias", () => {
  const v = obrasVisibles(COLA, CRITERIOS, { consigna: 3, filtro: "SIN_TERMINAR" });
  assert.deepEqual(v.map((o) => o.entryId), ["2"]);
});

/** Las 27 de "Sombras" y después las 27 de "Color": comparar iguales con iguales. */
test("el visor trabaja una consigna por vez", () => {
  const v = obrasVisibles(COLA, CRITERIOS, { consigna: 4, filtro: "TODAS" });
  assert.deepEqual(v.map((o) => o.entryId), ["4"]);
});

test("sin consigna elegida muestra todas las del filtro", () => {
  const v = obrasVisibles(COLA, CRITERIOS, { consigna: null, filtro: "TODAS" });
  assert.equal(v.length, 4);
});

test("los cuatro filtros existen", () => {
  assert.deepEqual(ESTADOS_DE_OBRA, ["SIN_CALIFICAR", "SIN_TERMINAR", "CALIFICADA"]);
});

/* ---------- moverse ---------- */

test("avanzar da la siguiente de la lista", () => {
  const lista = [obra("1", 3), obra("2", 3), obra("3", 3)];
  assert.equal(laSiguiente(lista, "1", 1)?.entryId, "2");
  assert.equal(laSiguiente(lista, "2", -1)?.entryId, "1");
});

test("en el final da la vuelta", () => {
  const lista = [obra("1", 3), obra("2", 3)];
  assert.equal(laSiguiente(lista, "2", 1)?.entryId, "1");
  assert.equal(laSiguiente(lista, "1", -1)?.entryId, "2");
});

test("con una sola obra se queda en ella", () => {
  const lista = [obra("1", 3)];
  assert.equal(laSiguiente(lista, "1", 1)?.entryId, "1");
});

test("con la lista vacía no hay siguiente", () => {
  assert.equal(laSiguiente([], "1", 1), null);
});

test("si la actual ya no está en la lista, arranca por la primera", () => {
  const lista = [obra("7", 3), obra("8", 3)];
  assert.equal(laSiguiente(lista, "no-existe", 1)?.entryId, "7");
});
