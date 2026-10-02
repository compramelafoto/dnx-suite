import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirBasesAlPublicar } from "./basesAlPublicar";

const BASES = "# BASES Y CONDICIONES\n\nArtículo 1: podrán participar fotógrafos mayores de edad.";

test("publicar sin versión oficial y con texto: crea la versión", () => {
  const r = decidirBasesAlPublicar({
    estadoAnterior: "DRAFT",
    estadoNuevo: "PUBLISHED",
    tieneVersionPublicada: false,
    textoDeBases: BASES,
    produccion: true,
  });
  assert.deepEqual(r, { accion: "publicar", contenido: BASES });
});

test("ACTIVE cuenta como publicado", () => {
  const r = decidirBasesAlPublicar({
    estadoAnterior: "DRAFT",
    estadoNuevo: "ACTIVE",
    tieneVersionPublicada: false,
    textoDeBases: BASES,
    produccion: true,
  });
  assert.equal(r.accion, "publicar");
});

test("publicar sin versión oficial y sin texto: bloquea", () => {
  const r = decidirBasesAlPublicar({
    estadoAnterior: "READY_TO_PUBLISH",
    estadoNuevo: "PUBLISHED",
    tieneVersionPublicada: false,
    textoDeBases: "   ",
    produccion: true,
  });
  assert.equal(r.accion, "bloquear");
});

test("si ya hay versión oficial no la toca (el circuito de Bases manda)", () => {
  const r = decidirBasesAlPublicar({
    estadoAnterior: "DRAFT",
    estadoNuevo: "PUBLISHED",
    tieneVersionPublicada: true,
    textoDeBases: "otro texto distinto",
    produccion: true,
  });
  assert.deepEqual(r, { accion: "nada" });
});

test("guardar como borrador no crea ni bloquea", () => {
  const r = decidirBasesAlPublicar({
    estadoAnterior: "DRAFT",
    estadoNuevo: "DRAFT",
    tieneVersionPublicada: false,
    textoDeBases: "",
    produccion: true,
  });
  assert.deepEqual(r, { accion: "nada" });
});

test("texto con marcadores de borrador en producción: bloquea", () => {
  const r = decidirBasesAlPublicar({
    estadoNuevo: "PUBLISHED",
    tieneVersionPublicada: false,
    estadoAnterior: "DRAFT",
    textoDeBases: `${BASES}\n\nBORRADOR — revisar premios`,
    produccion: true,
  });
  assert.equal(r.accion, "bloquear");
});

test("editar un concurso ya publicado sin bases no lo traba", () => {
  const r = decidirBasesAlPublicar({
    estadoAnterior: "PUBLISHED",
    estadoNuevo: "PUBLISHED",
    tieneVersionPublicada: false,
    textoDeBases: "",
    produccion: true,
  });
  assert.deepEqual(r, { accion: "nada" });
});

test("concurso que se inscribe por Clickatón: no exige bases", () => {
  const r = decidirBasesAlPublicar({
    estadoAnterior: "DRAFT",
    estadoNuevo: "PUBLISHED",
    tieneVersionPublicada: false,
    textoDeBases: "",
    produccion: true,
    exigeBases: false,
  });
  assert.deepEqual(r, { accion: "nada" });
});
