import assert from "node:assert/strict";
import test from "node:test";

import {
  construirTramos,
  contarProblemas,
  validarTramo,
  type EventoParaTramo,
} from "./timeline-bars";

function eventos(over: Record<string, string | null> = {}): EventoParaTramo[] {
  const base: Record<string, string | null> = {
    REGISTRATION_OPEN: "2026-09-18T13:00:00.000Z",
    REGISTRATION_CLOSE: "2026-09-19T16:00:00.000Z",
    ACCREDITATION_OPEN: "2026-09-19T17:00:00.000Z",
    ACCREDITATION_CLOSE: "2026-09-19T19:30:00.000Z",
    PROMPT_RELEASE: "2026-09-19T19:00:00.000Z",
    MARATHON_START: "2026-09-19T19:00:00.000Z",
    CAPTURE_WINDOW_CLOSE: "2026-09-19T23:00:00.000Z",
    UPLOAD_WINDOW_OPEN: "2026-09-19T19:00:00.000Z",
    UPLOAD_WINDOW_CLOSE: "2026-09-20T01:00:00.000Z",
    JUDGING_OPEN: "2026-09-22T13:00:00.000Z",
    JUDGING_CLOSE: "2026-09-23T23:00:00.000Z",
    RESULTS_RELEASE: "2026-09-24T13:00:00.000Z",
    ...over,
  };
  return Object.entries(base).map(([eventType, iso]) => ({
    id: `ev-${eventType}`,
    eventType,
    startsAt: iso ? new Date(iso) : null,
  }));
}

test("cada barra agrupa el par de eventos que ya existe", () => {
  const tramos = construirTramos(eventos());
  const acreditacion = tramos.find((t) => t.id === "acreditacion")!;

  assert.equal(acreditacion.desdeEventId, "ev-ACCREDITATION_OPEN");
  assert.equal(acreditacion.hastaEventId, "ev-ACCREDITATION_CLOSE");
  assert.equal(acreditacion.desde?.toISOString(), "2026-09-19T17:00:00.000Z");
  assert.equal(acreditacion.hasta?.toISOString(), "2026-09-19T19:30:00.000Z");
  assert.equal(acreditacion.esHito, false);
});

test("la publicación de consignas es un momento, no un rango", () => {
  const tramos = construirTramos(eventos());
  const consignas = tramos.find((t) => t.id === "consignas")!;
  assert.equal(consignas.esHito, true);
  assert.equal(consignas.hastaEventId, null);
  assert.deepEqual(consignas.hasta, consignas.desde);
});

test("un cronograma normal no tiene problemas, aunque toma y entrega se solapen", () => {
  const tramos = construirTramos(eventos());
  assert.equal(contarProblemas(tramos), 0);
});

test("avisa si la entrega cierra antes de que termine la toma", () => {
  const tramos = construirTramos(
    eventos({ UPLOAD_WINDOW_CLOSE: "2026-09-19T22:00:00.000Z" }),
  );
  const subida = tramos.find((t) => t.id === "subida")!;
  const captura = tramos.find((t) => t.id === "captura")!;

  assert.equal(
    validarTramo(subida, tramos),
    "La entrega cierra antes de que termine la toma de fotos.",
  );
  assert.equal(
    validarTramo(captura, tramos),
    "La toma termina después de que cerró la entrega.",
    "el conflicto se señala en las dos barras",
  );
});

test("avisa si la entrega abre después de que ya se puede fotografiar", () => {
  const tramos = construirTramos(eventos({ UPLOAD_WINDOW_OPEN: "2026-09-19T21:00:00.000Z" }));
  assert.equal(
    validarTramo(tramos.find((t) => t.id === "subida")!, tramos),
    "La entrega abre después de que ya se puede fotografiar.",
  );
});

test("avisa si se puede fotografiar antes de publicar las consignas", () => {
  const tramos = construirTramos(eventos({ MARATHON_START: "2026-09-19T18:00:00.000Z" }));
  assert.equal(
    validarTramo(tramos.find((t) => t.id === "captura")!, tramos),
    "Se puede fotografiar antes de que se publiquen las consignas.",
  );
});

test("avisa si el final llega antes que el comienzo", () => {
  const tramos = construirTramos(eventos({ ACCREDITATION_CLOSE: "2026-09-19T16:00:00.000Z" }));
  assert.equal(
    validarTramo(tramos.find((t) => t.id === "acreditacion")!, tramos),
    "El final llega antes que el comienzo.",
  );
});

test("un tramo sin fecha cargada pide que se cargue", () => {
  const tramos = construirTramos(eventos({ JUDGING_OPEN: null }));
  assert.equal(
    validarTramo(tramos.find((t) => t.id === "jurado")!, tramos),
    "Falta cargar un horario.",
  );
});
