import assert from "node:assert/strict";
import test from "node:test";

import { clickatonerWeekLabel, clickatonerWeekStart } from "./week";
import { pickClickatoner, type ClickatonerHistoryRow } from "./pick";
import { pickFeaturedWork, type WorkCandidate } from "./featured-work";
import { baseSlug, freeSlug, personKey } from "./slug";

const VIERNES = new Date("2026-10-09T03:00:00.000Z"); // viernes 9/10, 00:00 en Argentina

test("la semana: un miércoles pertenece al viernes anterior", () => {
  assert.deepEqual(clickatonerWeekStart(new Date("2026-10-14T15:30:00.000Z")), VIERNES);
});

test("la semana: el jueves 23:59 de Argentina todavía es la vieja aunque en UTC sea viernes", () => {
  assert.deepEqual(clickatonerWeekStart(new Date("2026-10-16T02:59:00.000Z")), VIERNES);
  assert.deepEqual(
    clickatonerWeekStart(new Date("2026-10-16T03:00:00.000Z")),
    new Date("2026-10-16T03:00:00.000Z"),
  );
});

test("la semana: misma clave exacta dentro de la semana y etiqueta legible", () => {
  assert.equal(
    clickatonerWeekStart(new Date("2026-10-10T12:34:56.789Z")).getTime(),
    clickatonerWeekStart(new Date("2026-10-13T08:00:01.001Z")).getTime(),
  );
  assert.equal(clickatonerWeekLabel(VIERNES), "del viernes 9 al jueves 15 de octubre");
});

const fila = (email: string, round: number, dia: number, skipped = false): ClickatonerHistoryRow => ({
  email,
  round,
  weekStart: new Date(Date.UTC(2026, 9, dia, 3)),
  skipped,
});

test("la elección: nadie se repite en la vuelta y los salteados cuentan como pasados", () => {
  assert.deepEqual(
    pickClickatoner({ candidates: ["a", "b", "c"], history: [fila("a", 1, 2), fila("b", 1, 9, true)], random: () => 0 }),
    { email: "c", round: 1 },
  );
});

test("la elección: vuelta nueva sin repetir al último; con uno solo, sale igual", () => {
  assert.deepEqual(
    pickClickatoner({ candidates: ["a", "b"], history: [fila("a", 1, 2), fila("b", 1, 9)], random: () => 0 }),
    { email: "a", round: 2 },
  );
  assert.deepEqual(
    pickClickatoner({ candidates: ["a"], history: [fila("a", 1, 2)], random: () => 0 }),
    { email: "a", round: 2 },
  );
});

test("la elección: una edición nueva suma gente a la vuelta en curso; sin candidatos, nadie", () => {
  assert.deepEqual(
    pickClickatoner({ candidates: ["a", "nuevo"], history: [fila("a", 1, 2)], random: () => 0 }),
    { email: "nuevo", round: 1 },
  );
  assert.equal(pickClickatoner({ candidates: [], history: [], random: () => 0 }), null);
  assert.deepEqual(
    pickClickatoner({ candidates: ["a", "b"], history: [], exclude: ["a"], random: () => 0 }),
    { email: "b", round: 1 },
  );
});

const obra = (submissionId: string, premio: string | null, puesto: number | null, dia = 19): WorkCandidate => ({
  submissionId,
  premio,
  puesto,
  editionEndAt: new Date(Date.UTC(2026, 8, dia)),
});

test("la obra destacada: la premiada primero, el premio más alto gana", () => {
  const r = pickFeaturedWork([obra("s1", null, 1), obra("s2", "HONORABLE_MENTION", 9), obra("s3", "SECOND_PLACE", 2)]);
  assert.equal(r?.submissionId, "s3");
});

test("la obra destacada: sin premios, la mejor ubicada; a igual puesto, la más reciente", () => {
  assert.equal(pickFeaturedWork([obra("s1", null, 4), obra("s2", null, 2)])?.submissionId, "s2");
  assert.equal(pickFeaturedWork([obra("s1", null, 2, 19), obra("s2", null, 2, 26)])?.submissionId, "s2");
  assert.equal(pickFeaturedWork([obra("s1", null, null), obra("s2", null, 7)])?.submissionId, "s2");
  assert.equal(pickFeaturedWork([]), null);
});

test("la dirección pública: sin tildes, y numerada si está tomada", () => {
  assert.equal(baseSlug("María José", "Ñúñez Gómez"), "maria-jose-nunez-gomez");
  assert.equal(baseSlug("", ""), "clickatoner");
  assert.equal(freeSlug("ana-paz", new Set(["ana-paz", "ana-paz-2"])), "ana-paz-3");
  assert.equal(freeSlug("ana-paz", new Set()), "ana-paz");
  assert.equal(personKey("  Ana@Ejemplo.COM "), "ana@ejemplo.com");
});
