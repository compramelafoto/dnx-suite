/**
 * Un concurso distribuido por Clickatón guarda obras y votos en la base de
 * Clickatón. Equivocar esta decisión escribe el voto en la base que no es.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { platformForContest, platformLabel } from "./assignment-source";

test("un concurso de Clickatón vive en la base de Clickatón", () => {
  assert.equal(platformForContest({ distributionChannel: "CLICKATON" }), "clickaton");
});

test("un concurso propio vive en la base de FotoRank", () => {
  assert.equal(platformForContest({ distributionChannel: "FOTORANK" }), "fotorank");
});

test("sin canal declarado se asume FotoRank", () => {
  assert.equal(platformForContest({ distributionChannel: null }), "fotorank");
});

test("un canal desconocido se asume FotoRank y no rompe", () => {
  assert.equal(platformForContest({ distributionChannel: "OTRO" }), "fotorank");
});

test("cada plataforma tiene un nombre para mostrar", () => {
  assert.equal(platformLabel("clickaton"), "Clickatón");
  assert.equal(platformLabel("fotorank"), "FotoRank");
});
