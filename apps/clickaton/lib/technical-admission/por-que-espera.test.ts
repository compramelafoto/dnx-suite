import test from "node:test";
import assert from "node:assert/strict";

import { porQueEspera, senalDeDecision } from "./por-que-espera";

test("sin fecha de captura dice que el archivo llegó sin metadatos", () => {
  const motivo = porQueEspera({
    codigos: ["EXIF_INCONSISTENT"],
    razonDeCaptura: "EXIF_CAPTURE_DATE_ABSENT",
  });

  assert.match(motivo.titulo, /sin fecha de captura/i);
  assert.match(motivo.quePaso, /metadatos/i);
  assert.ok(motivo.comoDecidir.length > 0, "tiene que decir qué mirar para decidir");
});

/**
 * El caso que trajo las 43: el texto genérico decía "datos de captura
 * inconsistentes", y no hay ninguna inconsistencia — no hay dato.
 */
test("sin fecha de captura no habla de inconsistencia", () => {
  const motivo = porQueEspera({
    codigos: ["EXIF_INCONSISTENT"],
    razonDeCaptura: "EXIF_CAPTURE_DATE_ABSENT",
  });

  assert.doesNotMatch(motivo.titulo, /inconsistent/i);
  assert.doesNotMatch(motivo.quePaso, /inconsistent/i);
});

test("con fecha fuera de la ventana lo dice y muestra la hora leída", () => {
  const motivo = porQueEspera({
    codigos: ["EXIF_INCONSISTENT"],
    razonDeCaptura: "OUTSIDE_WINDOW",
    horaDeCaptura: "19/09 23:20",
  });

  assert.match(motivo.titulo, /fuera del horario/i);
  assert.match(motivo.quePaso, /23:20/);
});

test("el duplicado tiene su propia explicación", () => {
  const motivo = porQueEspera({ codigos: ["DUPLICATE_REVIEW"], razonDeCaptura: null });
  assert.match(motivo.titulo, /duplicad/i);
});

test("la falta de acreditación tiene su propia explicación", () => {
  const motivo = porQueEspera({ codigos: ["ACCREDITATION_MISSING"], razonDeCaptura: null });
  assert.match(motivo.titulo, /acredit/i);
});

test("un código que nadie previó no deja la ficha muda", () => {
  const motivo = porQueEspera({ codigos: ["MOTIVO_NUEVO"], razonDeCaptura: null });
  assert.ok(motivo.titulo.length > 0);
  assert.ok(motivo.quePaso.length > 0);
  assert.ok(motivo.comoDecidir.length > 0);
});

test("sin ningún código tampoco queda muda", () => {
  const motivo = porQueEspera({ codigos: [], razonDeCaptura: null });
  assert.ok(motivo.titulo.length > 0);
});

test("la señal distingue admitida, rechazada y en espera", () => {
  assert.equal(senalDeDecision("ADMITTED"), "ADMITIDA");
  assert.equal(senalDeDecision("FROZEN_FOR_JURY"), "ADMITIDA");
  assert.equal(senalDeDecision("ELIGIBLE"), "ADMITIDA");
  assert.equal(senalDeDecision("REJECTED"), "RECHAZADA");
  assert.equal(senalDeDecision("EXCLUDED"), "RECHAZADA");
  assert.equal(senalDeDecision("PENDING_MANUAL_REVIEW"), "ESPERA");
  assert.equal(senalDeDecision("REPLACED"), "FUERA_DE_JUEGO");
  assert.equal(senalDeDecision("WITHDRAWN"), "FUERA_DE_JUEGO");
  assert.equal(senalDeDecision("LO_QUE_SEA"), "FUERA_DE_JUEGO");
});
