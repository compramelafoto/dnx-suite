import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_NOTE_LENGTH,
  areEditionNotesExpired,
  noteRetentionCutoff,
  normalizeNoteBody,
  shouldAcceptNoteWrite,
} from "./domain";

const AHORA = new Date("2026-10-20T12:00:00.000Z");

test("la nota se recorta al máximo y nunca rompe", () => {
  assert.equal(normalizeNoteBody("hola").length, 4);
  assert.equal(normalizeNoteBody("x".repeat(5000)).length, MAX_NOTE_LENGTH);
  assert.equal(normalizeNoteBody(undefined), "");
  assert.equal(normalizeNoteBody(42), "");
  assert.equal(normalizeNoteBody("a\r\nb"), "a\nb", "saltos de Windows normalizados");
});

test("gana la escritura más reciente del dispositivo", () => {
  const vieja = new Date("2026-09-19T18:00:00.000Z");
  const nueva = new Date("2026-09-19T18:05:00.000Z");

  assert.equal(
    shouldAcceptNoteWrite({ storedClientUpdatedAt: vieja, incomingClientUpdatedAt: nueva }),
    true,
  );
  assert.equal(
    shouldAcceptNoteWrite({ storedClientUpdatedAt: nueva, incomingClientUpdatedAt: vieja }),
    false,
    "la computadora no puede pisar lo que el teléfono escribió después",
  );
});

test("el mismo envío reintentado tras un corte de señal se acepta", () => {
  const t = new Date("2026-09-19T18:00:00.000Z");
  assert.equal(
    shouldAcceptNoteWrite({ storedClientUpdatedAt: t, incomingClientUpdatedAt: t }),
    true,
  );
});

test("sin marca de tiempo se acepta: perder la nota es peor que perder el orden", () => {
  const t = new Date("2026-09-19T18:00:00.000Z");
  assert.equal(
    shouldAcceptNoteWrite({ storedClientUpdatedAt: null, incomingClientUpdatedAt: t }),
    true,
  );
  assert.equal(
    shouldAcceptNoteWrite({ storedClientUpdatedAt: t, incomingClientUpdatedAt: null }),
    true,
  );
});

test("el corte de retención son 30 días hacia atrás", () => {
  assert.equal(noteRetentionCutoff(AHORA).toISOString(), "2026-09-20T12:00:00.000Z");
});

test("una edición que cerró hace más de 30 días ya vencía", () => {
  assert.equal(
    areEditionNotesExpired({
      uploadWindowEndsAt: new Date("2026-09-19T22:00:00.000Z"),
      now: AHORA,
    }),
    true,
  );
});

test("una edición que cerró hace menos de 30 días se conserva", () => {
  assert.equal(
    areEditionNotesExpired({
      uploadWindowEndsAt: new Date("2026-10-01T22:00:00.000Z"),
      now: AHORA,
    }),
    false,
  );
});

test("una edición sin cierre de entrega cargado no se borra nunca", () => {
  assert.equal(
    areEditionNotesExpired({ uploadWindowEndsAt: null, now: AHORA }),
    false,
    "sin fecha no hay plazo que contar",
  );
});
