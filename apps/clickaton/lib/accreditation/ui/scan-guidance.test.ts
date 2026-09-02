import assert from "node:assert/strict";
import test from "node:test";

import { describirBloqueoDeAcreditacion } from "./scan-guidance";
import { avisoParaTono } from "./scan-feedback";

const TZ = "America/Argentina/Buenos_Aires";

test("fuera de horario dice desde y hasta cuándo se puede acreditar", () => {
  const texto = describirBloqueoDeAcreditacion({
    reason: "WINDOW_CLOSED",
    window: {
      opensAt: "2026-09-02T10:00:00.000Z",
      closesAt: "2026-09-02T15:00:00.000Z",
      timezone: TZ,
    },
  });
  assert.match(texto, /07:00/, "debe mostrar la apertura en hora local");
  assert.match(texto, /12:00/, "debe mostrar el cierre en hora local");
});

test("sin cronograma explica que falta cargarlo, que es la causa real", () => {
  const texto = describirBloqueoDeAcreditacion({
    reason: "WINDOW_CLOSED",
    window: { opensAt: null, closesAt: null, timezone: TZ },
  });
  assert.match(texto, /cronograma/i);
});

test("cada motivo da una instrucción, nunca un texto vacío", () => {
  for (const reason of [
    "ACCREDITATION_DISABLED",
    "PAYMENT_PENDING",
    "NOT_CONFIRMED",
    "CREDENTIAL_MISSING",
    "REGISTRATION_INACTIVE",
    "DISQUALIFIED",
    "MOTIVO_DESCONOCIDO",
    null,
  ]) {
    const texto = describirBloqueoDeAcreditacion({ reason, window: null });
    assert.ok(texto.length > 20, `motivo ${reason} sin instrucción`);
  }
});

test("el aviso sonoro distingue válido, inválido y a revisar", () => {
  assert.equal(avisoParaTono("GREEN"), "ok");
  assert.equal(avisoParaTono("RED"), "error");
  assert.equal(avisoParaTono("YELLOW"), "warning");
  assert.equal(avisoParaTono("BLUE"), "warning");
  assert.equal(avisoParaTono(undefined), "warning");
});
