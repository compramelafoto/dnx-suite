import test from "node:test";
import assert from "node:assert/strict";

import { avisoDelVisor, etapaDelVisor, fechaDelCierre } from "./avisoDelVisor";

test("sin lote congelado el concurso todavía no abrió la evaluación", () => {
  assert.equal(etapaDelVisor({ hayLote: false, sePuedeCalificar: false }), "ESPERANDO_APERTURA");
  // Una sesión abierta sin lote no alcanza: no hay obras que mostrar.
  assert.equal(etapaDelVisor({ hayLote: false, sePuedeCalificar: true }), "ESPERANDO_APERTURA");
});

test("con lote y sin sesión se mira; con las dos se califica", () => {
  assert.equal(etapaDelVisor({ hayLote: true, sePuedeCalificar: false }), "SOLO_MIRAR");
  assert.equal(etapaDelVisor({ hayLote: true, sePuedeCalificar: true }), "CALIFICANDO");
});

test("esperando la apertura no culpa al jurado ni le pide que escriba", () => {
  const aviso = avisoDelVisor({
    etapa: "ESPERANDO_APERTURA",
    cantidadDeObras: 0,
    judgingEndsAt: "2026-11-13T02:59:00.000Z",
  });
  assert.ok(aviso);
  assert.equal(aviso.tipo, "PANTALLA");
  assert.match(aviso.titulo, /todavía no empezó/);
  assert.doesNotMatch(aviso.texto, /no te tocó/i);
  assert.match(aviso.texto, /jueves 12 de noviembre/);
});

test("con la evaluación abierta y sin obras sí es un problema de reparto", () => {
  const aviso = avisoDelVisor({ etapa: "CALIFICANDO", cantidadDeObras: 0, judgingEndsAt: null });
  assert.ok(aviso);
  assert.equal(aviso.tipo, "PANTALLA");
  assert.match(aviso.texto, /organización/);
});

test("mirando sin poder calificar se avisa con una franja, sin tapar las fotos", () => {
  const aviso = avisoDelVisor({ etapa: "SOLO_MIRAR", cantidadDeObras: 10, judgingEndsAt: null });
  assert.ok(aviso);
  assert.equal(aviso.tipo, "FRANJA");
});

test("calificando con obras no hay nada que avisar", () => {
  assert.equal(avisoDelVisor({ etapa: "CALIFICANDO", cantidadDeObras: 10, judgingEndsAt: null }), null);
});

test("el cierre se lee en hora argentina", () => {
  // 02:59 UTC del 13 son las 23:59 del 12 en Buenos Aires.
  assert.equal(fechaDelCierre("2026-11-13T02:59:00.000Z"), "jueves 12 de noviembre, 23:59");
  assert.equal(fechaDelCierre(null), null);
});
