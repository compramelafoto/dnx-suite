/**
 * Cooldown puro del aviso global de intento de captura — sin sessionStorage.
 * Ejecutar: pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/editorial-photos/capture-notice-policy.test.ts
 */

import assert from "node:assert/strict";
import {
  CAPTURE_NOTICE_COOLDOWN_MS,
  CAPTURE_NOTICE_MAX_PER_SESSION,
  INITIAL_CAPTURE_NOTICE_STATE,
  isAccusatorySignal,
  nextCaptureNoticeState,
  shouldTriggerCaptureNotice,
} from "./capture-notice-policy";
import { PHOTO_PROTECTION_LEGAL_TEXT } from "./legal-text";

// --- 1. Primer intento (estado inicial) siempre dispara ---
{
  assert.equal(shouldTriggerCaptureNotice(INITIAL_CAPTURE_NOTICE_STATE, Date.now()), true);
}

// --- 2. Un segundo intento inmediato (dentro del cooldown) no dispara ---
{
  const now = 1_000_000;
  const afterFirst = nextCaptureNoticeState(INITIAL_CAPTURE_NOTICE_STATE, now);
  assert.equal(shouldTriggerCaptureNotice(afterFirst, now + 1000), false);
}

// --- 3. Pasado el cooldown, vuelve a disparar ---
{
  const now = 1_000_000;
  const afterFirst = nextCaptureNoticeState(INITIAL_CAPTURE_NOTICE_STATE, now);
  assert.equal(
    shouldTriggerCaptureNotice(afterFirst, now + CAPTURE_NOTICE_COOLDOWN_MS + 1),
    true,
  );
}

// --- 4. Tope de avisos por sesión: no hostiga más allá del máximo, aunque pase mucho tiempo ---
{
  let state = INITIAL_CAPTURE_NOTICE_STATE;
  let now = 0;
  let triggeredCount = 0;
  for (let i = 0; i < CAPTURE_NOTICE_MAX_PER_SESSION + 5; i++) {
    now += CAPTURE_NOTICE_COOLDOWN_MS + 1;
    if (shouldTriggerCaptureNotice(state, now)) {
      triggeredCount += 1;
      state = nextCaptureNoticeState(state, now);
    }
  }
  assert.equal(
    triggeredCount,
    CAPTURE_NOTICE_MAX_PER_SESSION,
    "nunca debe superar el máximo de avisos por sesión, sin importar cuánto tiempo pase",
  );
}

// --- 5. El mensaje legal no usa frases alarmistas/no verificables prohibidas ---
{
  const forbidden = ["captura bloqueada", "delito", "denunciad", "serás denunciado"];
  const lower = PHOTO_PROTECTION_LEGAL_TEXT.toLowerCase();
  for (const phrase of forbidden) {
    assert.ok(!lower.includes(phrase), `el mensaje legal no debe incluir "${phrase}"`);
  }
  assert.ok(lower.includes("derechos de autor"));
  assert.ok(lower.includes("compramelafoto"));
}

// --- 6. visibilitychange nunca acusa: cambiar de pestaña/minimizar/bloquear
// el teléfono son motivos benignos, no evidencia de captura ---
{
  assert.equal(
    isAccusatorySignal("visibilitychange"),
    false,
    "visibilitychange no debe disparar nunca el aviso legal",
  );
}

// --- 7. Clic derecho y arrastre sobre una foto protegida sí son señales deliberadas ---
{
  assert.equal(isAccusatorySignal("contextmenu"), true);
  assert.equal(isAccusatorySignal("dragstart"), true);
}

// --- 8. PrintScreen solo cuenta cuando el navegador realmente entrega el evento
// (la política en sí no inventa el evento — isAccusatorySignal solo decide si,
// UNA VEZ recibido el evento real, corresponde mostrar el aviso) ---
{
  assert.equal(isAccusatorySignal("printscreen"), true);
}

console.log("capture-notice-policy.test.ts: OK");
